begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';
lock table public.portal_runtime_state in share row exclusive mode;

-- Current metadata only: pre-serialize once per commit, not once per cold reader.
-- json (not jsonb) deliberately preserves its serialized wire representation.
create table public.portal_runtime_wire_snapshot (
  state_id text primary key references public.portal_runtime_state(id) on delete cascade,
  revision bigint not null,
  envelope json not null
);
alter table public.portal_runtime_wire_snapshot enable row level security;
alter table public.portal_runtime_wire_snapshot force row level security;
revoke all on public.portal_runtime_wire_snapshot from public,anon,authenticated;
grant select,insert,update,delete on public.portal_runtime_wire_snapshot to service_role;

create function public.portal_refresh_runtime_wire_snapshot()
returns trigger language plpgsql security invoker
set search_path = public, extensions, pg_temp
as $$
begin
  if new.id <> 'global' then return new; end if;
  insert into public.portal_runtime_wire_snapshot(state_id,revision,envelope)
  values(new.id,new.revision,json_build_array(json_build_object('revision',new.revision,'payload',new.payload)))
  on conflict(state_id) do update set revision=excluded.revision,envelope=excluded.envelope;
  return new;
end;
$$;
revoke all on function public.portal_refresh_runtime_wire_snapshot() from public,anon,authenticated;
create trigger portal_runtime_wire_snapshot_refresh
after insert or update of payload,revision on public.portal_runtime_state
for each row execute function public.portal_refresh_runtime_wire_snapshot();

insert into public.portal_runtime_wire_snapshot(state_id,revision,envelope)
select id,revision,json_build_array(json_build_object('revision',revision,'payload',payload))
from public.portal_runtime_state where id='global';

create function public.portal_read_runtime_wire_snapshot_v1()
returns json language plpgsql stable security invoker
set search_path = public, extensions, pg_temp
as $$
declare result json;
begin
  select wire.envelope into result
  from public.portal_runtime_wire_snapshot wire
  join public.portal_runtime_state state on state.id=wire.state_id and state.revision=wire.revision
  where state.id='global';
  if result is not null then return result; end if;
  if exists(select 1 from public.portal_runtime_state where id='global') then
    raise exception 'A projeção atual do Portal não está disponível.' using errcode='PT503';
  end if;
  return '[]'::json;
end;
$$;
revoke all on function public.portal_read_runtime_wire_snapshot_v1() from public,anon,authenticated;
grant execute on function public.portal_read_runtime_wire_snapshot_v1() to service_role;
comment on table public.portal_runtime_wire_snapshot is
  'Backend-only serialized CURRENT metadata snapshot. Same-transaction revision binding; no files or extra historical revisions. Warm reads retain audit deltas.';
notify pgrst,'reload schema';
commit;
