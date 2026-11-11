-- Leitura parcial para rotas explicitamente somente-leitura.
-- O snapshot canônico, as projeções de auditoria e as permissões permanecem intactos.
-- A revisão e o payload parcial são extraídos da MESMA linha MVCC.
create function public.portal_read_runtime_lite_v1()
returns table(revision bigint, payload jsonb)
language sql stable security invoker
set search_path = pg_catalog, pg_temp
as $$
  select state.revision,
         case
           when pg_catalog.jsonb_typeof(state.payload->'auditLogs') = 'array'
           then state.payload - 'auditLogs'
           else state.payload
         end
  from public.portal_runtime_state as state
  where state.id = 'global';
$$;

revoke all on function public.portal_read_runtime_lite_v1() from public, anon, authenticated;
grant execute on function public.portal_read_runtime_lite_v1() to service_role;
comment on function public.portal_read_runtime_lite_v1() is
  'Backend-only read-only projection. Omits auditLogs for whitelisted GET handlers; full canonical snapshot is mandatory for writes and audit routes.';
notify pgrst, 'reload schema';
