-- Operacao UNICA e reversivel: compactar somente auditoria administrativa
-- que tem copia IGUAL na tabela normalizada imutavel (portal_audit_events).
-- Executar manualmente SOMENTE APOS publicar suporte a archivedAuditId no backend.
-- Preserva historico de TCC, processos, documentos, assinaturas e demais seções.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';
do $$
declare
  state_row public.portal_runtime_state%rowtype;
  converted jsonb;
  eligible_count integer;
begin
  select * into state_row from public.portal_runtime_state where id='global' for update;
  if not found then raise exception 'Estado operacional indisponível; nenhuma alteração executada'; end if;
  select count(*) into eligible_count
  from jsonb_array_elements(state_row.payload->'auditLogs') event(value)
  join public.portal_audit_events archive
    on archive.external_id=event.value->>'id'
    and archive.event_type='ALTERACAO_CONFIGURACOES'
    and archive.details->'before'=event.value->'before'
    and archive.details->'after'=event.value->'after'
  where event.value->>'action'='ALTERACAO_CONFIGURACOES'
    and event.value->>'id' ~ '^log-[0-9]{10,16}$'
    and jsonb_typeof(event.value->'before')='object'
    and jsonb_typeof(event.value->'after')='object';
  if eligible_count=0 then
    raise notice 'Nenhum registro elegível: sem alterações';
    return;
  end if;
  if eligible_count>100 then
    raise exception 'Lote acima do limite de segurança: %',eligible_count;
  end if;
  select jsonb_agg(
    case when event.value->>'action'='ALTERACAO_CONFIGURACOES'
      and event.value->>'id' ~ '^log-[0-9]{10,16}$'
      and jsonb_typeof(event.value->'before')='object'
      and jsonb_typeof(event.value->'after')='object'
      and exists(
        select 1 from public.portal_audit_events archived
        where archived.external_id=event.value->>'id'
        and archived.event_type='ALTERACAO_CONFIGURACOES'
        and archived.details->'before'=event.value->'before'
        and archived.details->'after'=event.value->'after'
      )
      then (event.value - 'before' - 'after') || jsonb_build_object(
        'before',jsonb_build_object('archivedAuditId',event.value->>'id'),
        'after',jsonb_build_object(
          'archivedAuditId',event.value->>'id',
          'changedPaths',(
            select coalesce(jsonb_agg(changed.key order by changed.key),'[]'::jsonb)
            from (
              select k.key from jsonb_object_keys(event.value->'before') k(key)
              union select k.key from jsonb_object_keys(event.value->'after') k(key)
            ) changed
            where event.value->'before'->changed.key
              is distinct from event.value->'after'->changed.key
          ),
          'truncated',false
        )
      )
      else event.value end
    order by event.ordinality
  ) into converted
  from jsonb_array_elements(state_row.payload->'auditLogs')
       with ordinality as event(value,ordinality);
  if converted is null then raise exception 'Histórico de auditoria inválido'; end if;
  -- Cópia integral de recuperação ANTES da mudança, na mesma transação.
  insert into public.portal_runtime_state_backups(state_id,revision,payload,reason)
  values('global',state_row.revision,state_row.payload,
         'PRE_SETTINGS_AUDIT_COMPACTION_20261111');
  perform public.portal_commit_runtime_state(
    state_row.revision,jsonb_set(state_row.payload,'{auditLogs}',converted,false)
  );
  raise notice 'Eventos administrativos compactados: %',eligible_count;
end $$;
commit;
