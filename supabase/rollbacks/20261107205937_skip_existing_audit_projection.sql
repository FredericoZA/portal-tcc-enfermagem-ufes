begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $migration$
declare
  definition text;
  old_loop constant text := 'for audit_row in select value from jsonb_array_elements(coalesce(next_payload->''auditLogs'',''[]''::jsonb)) loop';
  new_loop constant text := 'for audit_row in
    select incoming.value
    from jsonb_array_elements(coalesce(next_payload->''auditLogs'',''[]''::jsonb)) with ordinality as incoming(value,ordinality)
    where not exists (
      select 1 from public.portal_audit_events as existing
      where existing.external_id=incoming.value->>''id''
    )
    order by incoming.ordinality
  loop';
begin
  select pg_get_functiondef('public.portal_project_runtime_state(jsonb)'::regprocedure) into definition;
  if position(old_loop in definition)>0 and position(new_loop in definition)=0 then return; end if;
  if (length(definition)-length(replace(definition,new_loop,'')))/length(new_loop)<>1 then
    raise exception 'A definição do projetor mudou; revise antes de reverter a seleção de auditoria.';
  end if;
  execute replace(definition,new_loop,old_loop);
end;
$migration$;
commit;
