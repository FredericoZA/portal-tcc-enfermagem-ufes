begin;

-- Only the CURRENT audit projection is retained. No documents or revision history.
-- Serialize bootstrap with canonical/draft writes; normal reads remain available.
lock table public.portal_runtime_state in share row exclusive mode;

create table public.portal_runtime_audit_projection (
  state_id text primary key references public.portal_runtime_state(id) on delete cascade,
  ready boolean not null
);
create table public.portal_runtime_audit_chunks (
  state_id text not null references public.portal_runtime_audit_projection(state_id) on delete cascade,
  chunk bigint not null check (chunk >= 0),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  events jsonb not null check (jsonb_typeof(events) = 'array'),
  primary key (state_id, chunk)
);
alter table public.portal_runtime_audit_projection enable row level security;
alter table public.portal_runtime_audit_projection force row level security;
alter table public.portal_runtime_audit_chunks enable row level security;
alter table public.portal_runtime_audit_chunks force row level security;
revoke all on public.portal_runtime_audit_projection,public.portal_runtime_audit_chunks from public,anon,authenticated;
grant all on public.portal_runtime_audit_projection,public.portal_runtime_audit_chunks to service_role;

create function public.portal_refresh_runtime_audit_projection()
returns trigger language plpgsql security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  audit jsonb;
begin
  if new.id <> 'global' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.payload->'auditLogs' is not distinct from new.payload->'auditLogs'
      and exists(select 1 from public.portal_runtime_audit_projection where state_id=new.id)
    then return new; end if;
  end if;
  insert into public.portal_runtime_audit_projection(state_id,ready) values(new.id,false)
    on conflict(state_id) do update set ready=false;
  audit := new.payload->'auditLogs';
  if jsonb_typeof(audit) = 'array' then
    -- Oversized histories keep the original complete RPC, without truncation.
    if octet_length(audit::text) > 16777216 then
      delete from public.portal_runtime_audit_chunks where state_id=new.id;
      return new;
    end if;
    with entries as (
        select entry.event,entry.ordinality,
          count(*) filter(where get_byte(digest(coalesce(entry.event->>'id',entry.event::text),'sha256'),0)<8)
            over(order by entry.ordinality) as chunk
        from jsonb_array_elements(audit) with ordinality as entry(event,ordinality)
      ), groups as materialized (
        select chunk,jsonb_agg(event order by ordinality) as events
        from entries group by chunk order by chunk limit 5001
      ), written as (
        insert into public.portal_runtime_audit_chunks as existing(state_id,chunk,fingerprint,events)
        select new.id,chunk,encode(digest(events::text,'sha256'),'hex'),events from groups
        on conflict(state_id,chunk) do update set fingerprint=excluded.fingerprint,events=excluded.events
          where existing.fingerprint is distinct from excluded.fingerprint
        returning chunk
      )
      delete from public.portal_runtime_audit_chunks existing
      where existing.state_id=new.id and existing.chunk not in(select chunk from groups);
    if (select count(*) from public.portal_runtime_audit_chunks where state_id=new.id)>5000 then
      delete from public.portal_runtime_audit_chunks where state_id=new.id;
      return new;
    end if;
  else
    delete from public.portal_runtime_audit_chunks where state_id=new.id;
  end if;
  update public.portal_runtime_audit_projection set ready=true where state_id=new.id;
  return new;
end;
$$;
revoke all on function public.portal_refresh_runtime_audit_projection() from public,anon,authenticated;
grant execute on function public.portal_refresh_runtime_audit_projection() to service_role;
create trigger portal_runtime_audit_projection_refresh
after insert or update of payload on public.portal_runtime_state
for each row execute function public.portal_refresh_runtime_audit_projection();

-- Bootstrap through the same trigger, without changing canonical revision/payload.
update public.portal_runtime_state set payload=payload where id='global';

-- Retain the installed implementation as a bounded-projection fallback.
alter function public.portal_read_runtime_snapshot_v1(text[]) rename to portal_read_runtime_snapshot_uncached_v1;
create function public.portal_read_runtime_snapshot_v1(known_audit_chunks text[])
returns table(revision bigint,payload jsonb,audit_chunks jsonb)
language plpgsql stable security invoker
set search_path = public, extensions, pg_temp
as $$
begin
  if not exists(select 1 from public.portal_runtime_audit_projection where state_id='global' and ready) then
    return query select * from public.portal_read_runtime_snapshot_uncached_v1(known_audit_chunks);
    return;
  end if;
  return query
    select state.revision,
      case when jsonb_typeof(state.payload->'auditLogs')='array' then state.payload-'auditLogs' else state.payload end,
      case when jsonb_typeof(state.payload->'auditLogs')='array' then coalesce((
        select jsonb_agg(
          case when chunks.fingerprint=any(known_audit_chunks[1:5000]) then jsonb_build_object('fingerprint',chunks.fingerprint)
            else jsonb_build_object('fingerprint',chunks.fingerprint,'events',chunks.events) end order by chunks.chunk)
        from public.portal_runtime_audit_chunks chunks where chunks.state_id=state.id
      ),'[]'::jsonb) end
    from public.portal_runtime_state state where state.id='global';
end;
$$;
revoke all on function public.portal_read_runtime_snapshot_v1(text[]) from public,anon,authenticated;
grant execute on function public.portal_read_runtime_snapshot_v1(text[]) to service_role;
comment on table public.portal_runtime_audit_chunks is
  'Backend-only current audit projection, bounded to 16 MiB input/5000 chunks; rebuilt atomically only when auditLogs changes. No document storage or additional history.';
notify pgrst,'reload schema';
commit;
