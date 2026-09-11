do $migration$
declare
  crypto_schema text;
  fn record;
begin
  select n.nspname into crypto_schema
  from pg_extension e join pg_namespace n on n.oid=e.extnamespace
  where e.extname='pgcrypto';
  if crypto_schema is null then raise exception 'A extensão pgcrypto precisa estar instalada.'; end if;
  if has_schema_privilege('anon',crypto_schema,'CREATE') or has_schema_privilege('authenticated',crypto_schema,'CREATE') then
    raise exception 'O schema da extensão pgcrypto não pode permitir criação por usuários da API.';
  end if;
  for fn in
    select p.proname,pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'portal_commit_runtime_state','portal_project_runtime_state','portal_project_runtime_state_v4',
      'portal_claim_asten_dispatch','portal_update_asten_dispatch'
    )
  loop
    execute format('alter function public.%I(%s) set search_path = public, %I, pg_temp',fn.proname,fn.args,crypto_schema);
  end loop;
end
$migration$;
