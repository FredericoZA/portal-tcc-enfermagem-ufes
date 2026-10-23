-- A stale application revision is a permanent HTTP conflict, not a
-- PostgreSQL serialization failure. PostgREST 14 retries 40001 internally.
-- Preserve the existing projection pipeline, owner, grants and CAS guard.
do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.portal_commit_runtime_state(bigint,jsonb)'::regprocedure)
    into function_definition;
  if position('PT409' in function_definition) > 0
     and position('40001' in function_definition) = 0 then
    return;
  end if;
  if position('Conflito de concorrência' in function_definition) = 0
     or position('using errcode=''40001''' in function_definition) = 0 then
    raise exception 'A definição do commit difere do contrato esperado; revise antes da migração.';
  end if;
  function_definition := replace(function_definition,
    'using errcode=''40001''', 'using errcode=''PT409''');
  execute function_definition;
end;
$migration$;

