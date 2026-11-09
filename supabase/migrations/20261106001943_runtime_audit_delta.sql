begin;

-- Read the state, revision and audit chunks under a single MVCC snapshot.
-- Content-defined boundaries keep most chunks stable after old events roll off.
create function public.portal_read_runtime_snapshot_v1(known_audit_chunks text[])
returns table(revision bigint, payload jsonb, audit_chunks jsonb)
language sql
stable
security invoker
set search_path = public, extensions, pg_temp
as $$
  with snapshot as materialized (
    select state.revision, state.payload
    from public.portal_runtime_state state
    where state.id = 'global'
  ),
  entries as (
    select entry.event, entry.ordinality,
      count(*) filter (where get_byte(digest(coalesce(entry.event->>'id',entry.event::text),'sha256'),0)<8)
        over (order by entry.ordinality) as chunk
    from snapshot
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(snapshot.payload->'auditLogs') = 'array'
        then snapshot.payload->'auditLogs' else '[]'::jsonb end
    ) with ordinality as entry(event,ordinality)
  ),
  groups as (
    select chunk, jsonb_agg(event order by ordinality) as events from entries group by chunk
  ),
  fingerprints as materialized (
    select chunk, events, encode(digest(events::text,'sha256'),'hex') as fingerprint from groups
  )
  select snapshot.revision,
    case when jsonb_typeof(snapshot.payload->'auditLogs') = 'array'
      then snapshot.payload - 'auditLogs' else snapshot.payload end,
    case when jsonb_typeof(snapshot.payload->'auditLogs') = 'array' then coalesce((
      select jsonb_agg(
        case when fingerprint = any(known_audit_chunks[1:5000]) then jsonb_build_object('fingerprint',fingerprint)
          else jsonb_build_object('fingerprint',fingerprint,'events',events) end order by chunk
      ) from fingerprints
    ), '[]'::jsonb) end
  from snapshot;
$$;

revoke all on function public.portal_read_runtime_snapshot_v1(text[]) from public, anon, authenticated;
grant execute on function public.portal_read_runtime_snapshot_v1(text[]) to service_role;

comment on function public.portal_read_runtime_snapshot_v1(text[]) is
  'Backend-only snapshot read. Reuse confirmed audit chunks by content hash; preserve the full aggregate and its optimistic commit contract.';

notify pgrst, 'reload schema';
commit;
