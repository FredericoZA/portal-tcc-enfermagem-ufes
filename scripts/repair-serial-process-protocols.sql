-- Controlled data repair. This file only defines a function in the current
-- database session. Use the reviewed runtime revision and both process IDs.
-- Requires 20261105172558_accept_serial_tcc_protocol.sql.
-- Example inside a transaction after loading this file with \i:
-- select pg_temp.repair_serial_process_protocols(981, '<real-id>', '<pilot-id>');
create function pg_temp.repair_serial_process_protocols(expected_revision bigint, real_id text, pilot_id text)
returns bigint
language plpgsql
as $$
declare
  current_payload jsonb;
  current_revision bigint;
  next_payload jsonb;
  real_process jsonb;
  pilot_process jsonb;
  counters jsonb;
  corrected_at text := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  real_old constant text := 'TCC-2026-0001';
  pilot_old constant text := 'TCC-2026-0006';
  real_new constant text := 'TCC - 00001';
  pilot_new constant text := 'TCC - 00002';
begin
  if coalesce(real_id, '') = '' or coalesce(pilot_id, '') = '' or real_id = pilot_id then
    raise exception 'Informe os dois identificadores distintos já conferidos.';
  end if;

  select payload, revision into strict current_payload, current_revision
  from public.portal_runtime_state where id = 'global' for update;
  if current_revision is distinct from expected_revision then
    raise exception 'A revisão do portal mudou. Confira o estado antes de executar.' using errcode = 'PT409';
  end if;

  select value into strict real_process from jsonb_array_elements(current_payload->'processes')
  where value->>'id' = real_id;
  select value into strict pilot_process from jsonb_array_elements(current_payload->'processes')
  where value->>'id' = pilot_id;
  counters := coalesce(current_payload->'processProtocolCounters', '{}'::jsonb);
  if real_process->>'protocolo' = real_new and pilot_process->>'protocolo' = pilot_new
     and coalesce(real_process->'previousProtocols', '[]'::jsonb) ? real_old
     and coalesce(pilot_process->'previousProtocols', '[]'::jsonb) ? pilot_old
     and not (coalesce(real_process->'previousProtocols', '[]'::jsonb) ? pilot_old)
     and (counters->>'TCC-9999')::bigint >= 2 then
    return current_revision;
  end if;

  if jsonb_array_length(current_payload->'processes') <> 2
     or real_process->>'protocolo' is distinct from real_old
     or pilot_process->>'protocolo' is distinct from pilot_old
     or coalesce(real_process->'previousProtocols', '[]'::jsonb) <> jsonb_build_array(pilot_old)
     or coalesce(pilot_process->'previousProtocols', '[]'::jsonb) <> '[]'::jsonb
     or (counters->>'TCC-2026')::bigint is distinct from 6
     or coalesce((counters->>'TCC-9999')::bigint, 0) <> 0
     or (select count(*) from public.portal_processes where
       (external_id = real_id and code = real_old) or (external_id = pilot_id and code = pilot_old)) <> 2
     or exists (select 1 from public.portal_processes where code in (real_new, pilot_new))
     or exists (select 1 from jsonb_array_elements(coalesce(current_payload->'legacyAcademicRecords', '[]'::jsonb)) as record
       where record->>'protocolo' in (real_new, pilot_new, real_old, pilot_old))
     or exists (select 1 from jsonb_array_elements(coalesce(current_payload->'processDeletionTasks', '[]'::jsonb)) as task
       where task->>'protocol' in (real_new, pilot_new)) then
    raise exception 'Os protocolos, a projeção ou o contador mudaram. A correção requer nova conferência.';
  end if;

  insert into public.portal_runtime_state_backups(state_id, revision, payload, reason)
  values ('global', current_revision, current_payload, 'BEFORE_SERIAL_TCC_PROTOCOL_REPAIR');

  -- The exact old 0006 already resolves to the pilot. Transfer that alias to
  -- the pilot and keep every other alias and all issued material untouched.
  next_payload := jsonb_set(current_payload, '{processes}', (
    select jsonb_agg(
      case when value->>'id' = real_id then value || jsonb_build_object(
        'protocolo', real_new, 'previousProtocols', jsonb_build_array(real_old))
      else value || jsonb_build_object(
        'protocolo', pilot_new, 'previousProtocols', jsonb_build_array(pilot_old))
      end order by ordinality)
    from jsonb_array_elements(current_payload->'processes') with ordinality
  ));
  next_payload := jsonb_set(next_payload, '{processProtocolCounters}', counters || jsonb_build_object('TCC-9999', 2));
  next_payload := jsonb_set(next_payload, '{auditLogs}', coalesce(next_payload->'auditLogs', '[]'::jsonb) || (
    select jsonb_agg(jsonb_build_object(
      'id', 'serial-protocol-repair-' || (value->>'id'), 'processId', value->>'id', 'actorEmail', 'system@portal.local',
      'actorRoles', '[]'::jsonb, 'action', 'CORRECAO_PROTOCOLO_SOLICITADA', 'entityType', 'processo', 'entityId', value->>'id',
      'before', case when value->>'id' = real_id then jsonb_build_object('protocolo', real_old, 'previousProtocols', real_process->'previousProtocols')
        else jsonb_build_object('protocolo', pilot_old, 'previousProtocols', pilot_process->'previousProtocols') end,
      'after', jsonb_build_object('protocolo', value->>'protocolo', 'previousProtocols', value->'previousProtocols'), 'timestamp', corrected_at))
    from jsonb_array_elements(next_payload->'processes')
  ));
  return public.portal_commit_runtime_state(current_revision, next_payload);
end;
$$;
