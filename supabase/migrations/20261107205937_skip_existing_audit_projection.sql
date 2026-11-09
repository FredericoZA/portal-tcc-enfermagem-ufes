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
  if position(new_loop in definition)>0 and position(old_loop in definition)=0 then return; end if;
  if (length(definition)-length(replace(definition,old_loop,'')))/length(old_loop)<>1
     or position('-- Append-only audit projection. Existing events are never updated.' in definition)=0 then
    raise exception 'A definição do projetor difere do contrato de auditoria esperado; revise antes da migração.';
  end if;
  -- Retain the installed owner, ACL, security mode, search_path and every other
  -- projection verbatim. ON CONFLICT remains for duplicate IDs in one batch/races.
  -- Existing external IDs are immutable: their incoming contents are ignored,
  -- including casts that the discarded INSERT formerly evaluated. New events
  -- retain all existing constraints/validation and transaction rollback behavior.
  execute replace(definition,old_loop,new_loop);
end;
$migration$;
commit;
