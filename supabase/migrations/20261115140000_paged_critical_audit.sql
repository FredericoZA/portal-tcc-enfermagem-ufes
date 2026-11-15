-- Backend-only, read-only page of the canonical journal. No copied history.
create function public.portal_audit_epoch_v1(value text) returns bigint
language plpgsql stable security invoker set search_path=pg_catalog,pg_temp as $$
begin return coalesce((extract(epoch from value::timestamptz)*1000)::bigint,0);
exception when invalid_datetime_format or datetime_field_overflow then return 0;
end; $$;
revoke all on function public.portal_audit_epoch_v1(text) from public,anon,authenticated;
grant execute on function public.portal_audit_epoch_v1(text) to service_role;

create function public.portal_read_critical_audit_page_v1(
 expected_revision bigint, process_id text default null, before_at bigint default null,
 before_id text default null, read_at bigint default null
) returns jsonb language plpgsql stable security invoker
set search_path=pg_catalog,pg_temp as $$
declare result jsonb;
begin
 if expected_revision is null or expected_revision<1 or length(process_id)>200
   or (before_at is null)<>(before_id is null) or length(before_id)>260 then
   raise exception 'Invalid audit page request.' using errcode='22023';
 end if;
 with state as materialized (
   select revision,payload from public.portal_runtime_state where id='global' and revision=expected_revision
 ), activity as (
   select 'activity'::text as source, item->>'id' as id, public.portal_audit_epoch_v1(item->>'timestamp') as at, item
   from state,jsonb_array_elements(coalesce(payload->'auditLogs','[]'::jsonb)) as item
   where (process_id is null or item->>'processId'=process_id or (item->>'entityId'=process_id and item->>'entityType'='processo'))
   and coalesce(item->>'action','')<>all(array[
    'EMAIL_CODIGO_ACESSO_SIMULADO','EMAIL_CODIGO_ACESSO_ACEITO_GMAIL','CONVITE_GERADO_PELO_FLUXO','FLUXO_CONVITE_CONCLUIDO',
    'PUBLICACAO_DRIVE_SINCRONIZADA','SINCRONIZACAO_CALENDARIO_GOOGLE','SINCRONIZACAO_GOOGLE_CALENDAR','VERIFICACAO_INTEGRIDADE_DRIVE',
    'CALLBACK_ASTEN_RECONCILIADO','CALLBACK_ASTEN_VERSAO_ENCERRADA','DETECCAO_VARIAVEIS_MODELO','SALVAMENTO_AUTOMATICO_ESTUDIO',
    'ALTERACAO_IMAGEM_ESTUDIO','PADRAO_PLANILHA_ATUALIZADO','BACKUP_CIFRADO_AUTOMATICO','COMPROVANTE_AGUARDA_CONVERSA_ORIGINAL',
    'COPIA_COMUNICACAO_EMAIL_SOLICITADA','SIGNATARIOS_CONFIRMADOS_PELO_PROVEDOR'])
 ), emails as (
   select 'email'::text as source,'email-delivery:'||(item->>'id') as id,
     public.portal_audit_epoch_v1(coalesce(nullif(item->>'updatedAt',''),item->>'createdAt')) as at,
     item - 'renderedHtml' - 'renderedText' - 'htmlBody' - 'textBody' as item
   from state,jsonb_array_elements(coalesce(payload->'emailDeliveries','[]'::jsonb)) as item
   where (process_id is null or item->>'processId'=process_id)
   and ((coalesce(item->>'status','')<>'ACCEPTED_BY_GMAIL' and coalesce(item->>'dispatchState','')<>'SENDING')
     or item->>'dispatchState'='UNCERTAIN'
     or (item->>'dispatchState'='SENDING' and public.portal_audit_epoch_v1(item->>'dispatchLeaseUntil')<=coalesce(read_at,(extract(epoch from statement_timestamp())*1000)::bigint)))
 ), all_rows as materialized (select * from activity union all select * from emails), page as materialized (
   select * from all_rows where before_at is null or at<before_at or (at=before_at and id collate "C">before_id collate "C")
   order by at desc,id collate "C" limit 101
 )
 select jsonb_build_object('revision',state.revision,'total',(select count(*) from all_rows),
  'logs',coalesce((select jsonb_agg(item order by at desc,id collate "C") from page where source='activity'),'[]'::jsonb),
  'deliveries',coalesce((select jsonb_agg(item order by at desc,id collate "C") from page where source='email'),'[]'::jsonb))
 into result from state;
 if result is null then raise exception 'Audit snapshot revision changed.' using errcode='40001'; end if;
 return result;
end; $$;
revoke all on function public.portal_read_critical_audit_page_v1(bigint,text,bigint,text,bigint) from public,anon,authenticated;
grant execute on function public.portal_read_critical_audit_page_v1(bigint,text,bigint,text,bigint) to service_role;
notify pgrst,'reload schema';
