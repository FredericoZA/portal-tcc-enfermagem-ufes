begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
-- Only document-model metadata, its timestamp and append-only audit evidence.
-- No process, access, presidency, membership or publication projection is touched.
create function public.portal_commit_document_models(expected_revision bigint,document_models jsonb,settings_updated_at text,audit_append jsonb)
returns bigint language plpgsql security invoker
set search_path=public,extensions,pg_temp as $$
declare
 current_revision bigint; current_payload jsonb; next_payload jsonb; previous_audit jsonb;
 audit_row jsonb; selected_process_id uuid;
begin
 if jsonb_typeof(document_models) is distinct from 'object' or coalesce(settings_updated_at,'')=''
   or jsonb_typeof(audit_append) is distinct from 'array' or jsonb_array_length(audit_append)>20
   or octet_length(document_models::text)+octet_length(audit_append::text)>2000000 then
   raise exception 'Metadados documentais inválidos.' using errcode='22023';
 end if;
 select revision,payload into current_revision,current_payload from public.portal_runtime_state where id='global' for update;
 if not found or current_revision is distinct from expected_revision then
   raise exception 'Conflito de concorrência: a revisão do portal mudou.' using errcode='PT409';
 end if;
 if jsonb_typeof(current_payload->'settings') is distinct from 'object'
   or current_payload ? 'auditLogs' and jsonb_typeof(current_payload->'auditLogs') is distinct from 'array' then
   raise exception 'Estado documental inválido.' using errcode='22023';
 end if;
 previous_audit:=coalesce(current_payload->'auditLogs','[]'::jsonb);
 if jsonb_array_length(previous_audit)+jsonb_array_length(audit_append)>5000
   or exists(select 1 from jsonb_array_elements(audit_append) entry where jsonb_typeof(entry)<>'object' or coalesce(entry->>'id','')='')
   or (select count(distinct entry->>'id') from jsonb_array_elements(audit_append) entry)<>jsonb_array_length(audit_append)
   or exists(select 1 from jsonb_array_elements(audit_append) fresh join jsonb_array_elements(previous_audit) old on fresh->>'id'=old->>'id') then
   raise exception 'A auditoria deve apenas acrescentar eventos novos, sem alterar o histórico.' using errcode='22023';
 end if;
 -- The API cannot name any other key: merge into the locked canonical state.
 next_payload:=jsonb_set(jsonb_set(current_payload,'{settings,documentModels}',document_models,true),'{settings,updatedAt}',to_jsonb(settings_updated_at),true);
 next_payload:=jsonb_set(next_payload,'{auditLogs}',previous_audit||audit_append,true);
 -- Exact append-only normalized audit semantics from the installed core projector.
 for audit_row in select value from jsonb_array_elements(audit_append) loop
   select id into selected_process_id from public.portal_processes where external_id=audit_row->>'processId';
   insert into public.portal_audit_events(external_id,occurred_at,actor_email_hash,process_id,process_code,event_type,entity_type,entity_id,details)
   values(audit_row->>'id',coalesce((audit_row->>'timestamp')::timestamptz,now()),case when coalesce(audit_row->>'actorEmail','')='' then null else encode(digest(lower(audit_row->>'actorEmail'),'sha256'),'hex') end,selected_process_id,(select code from public.portal_processes where id=selected_process_id),coalesce(audit_row->>'action','UNKNOWN'),coalesce(audit_row->>'entityType','unknown'),audit_row->>'entityId',jsonb_build_object('before',audit_row->'before','after',audit_row->'after'))
   on conflict (external_id) do nothing;
 end loop;
 update public.portal_runtime_state set payload=next_payload,revision=current_revision+1,updated_at=now() where id='global';
 insert into public.portal_runtime_commits(revision,payload_sha256) values(current_revision+1,encode(digest(next_payload::text,'sha256'),'hex'));
 return current_revision+1;
end;
$$;
revoke all on function public.portal_commit_document_models(bigint,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.portal_commit_document_models(bigint,jsonb,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
