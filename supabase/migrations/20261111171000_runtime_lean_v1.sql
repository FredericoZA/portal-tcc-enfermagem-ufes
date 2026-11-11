-- Projecao temporaria somente-leitura para endpoints sem acervo historico.
-- Nao modifica o estado canonico nem suas politicas de retencao.
create function public.portal_read_runtime_lean_v1()
returns table(revision bigint, payload jsonb)
language sql stable security invoker
set search_path = pg_catalog, pg_temp
as $$
  select state.revision, state.payload - 'auditLogs' - 'legacyAcademicRecords'
  from public.portal_runtime_state as state
  where state.id = 'global';
$$;
revoke all on function public.portal_read_runtime_lean_v1() from public, anon, authenticated;
grant execute on function public.portal_read_runtime_lean_v1() to service_role;
comment on function public.portal_read_runtime_lean_v1() is
  'Projection for small backend GETs. Legacy academic records and audit logs remain in the canonical DB, untouched.';
notify pgrst, 'reload schema';
