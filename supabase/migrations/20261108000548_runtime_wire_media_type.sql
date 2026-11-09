begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

-- PostgREST 14 selects the raw handler from the function return domain.
-- Plain bytea with this Accept header is rejected with PGRST107/406.
create domain public."application/octet-stream" as bytea;
revoke all on domain public."application/octet-stream" from public,anon,authenticated;
grant usage on domain public."application/octet-stream" to service_role;
drop function public.portal_read_runtime_wire_bytes_v1();
create function public.portal_read_runtime_wire_bytes_v1()
returns public."application/octet-stream" language plpgsql stable security invoker
set search_path = public, extensions, pg_temp
as $$
declare result bytea;
begin
  select convert_to(wire.envelope::text,'UTF8') into result
  from public.portal_runtime_wire_snapshot wire
  join public.portal_runtime_state state on state.id=wire.state_id and state.revision=wire.revision
  where state.id='global';
  if result is not null then return result; end if;
  if exists(select 1 from public.portal_runtime_state where id='global') then
    raise exception 'A projeção atual do Portal não está disponível.' using errcode='PT503';
  end if;
  return convert_to('[]','UTF8');
end;
$$;
revoke all on function public.portal_read_runtime_wire_bytes_v1() from public,anon,authenticated;
grant execute on function public.portal_read_runtime_wire_bytes_v1() to service_role;
comment on function public.portal_read_runtime_wire_bytes_v1() is
  'Backend-only raw UTF-8 current metadata envelope; same-transaction revision validation, no files and no stale-cache fallback.';
notify pgrst,'reload schema';
commit;
