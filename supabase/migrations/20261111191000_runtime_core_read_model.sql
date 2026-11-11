-- Backend-only, atomically current revision and compact operational state.
-- TCC legacy catalog and audit remain in canonical row for routes that need them.
create function public.portal_read_runtime_core_v1()
returns table(revision bigint, payload jsonb)
language sql stable security invoker
set search_path = pg_catalog, pg_temp
as $$
  select state.revision, state.payload - array['auditLogs','legacyAcademicRecords']::text[]
  from public.portal_runtime_state state
  where state.id = 'global';
$$;
revoke all on function public.portal_read_runtime_core_v1() from public, anon, authenticated;
grant execute on function public.portal_read_runtime_core_v1() to service_role;
comment on function public.portal_read_runtime_core_v1() is
  'Backend-only projection for selected GET endpoints. No audit nor legacy records. Never use for writes.';
notify pgrst,'reload schema';
