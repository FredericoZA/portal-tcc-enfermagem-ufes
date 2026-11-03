begin;
-- Only the server service role may invoke an explicitly scoped Master purge.
create or replace function public.portal_reject_audit_mutation() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' and current_setting('portal.master_purge_process',true)=old.process_id::text then return old; end if;
 raise exception 'portal_audit_events is append-only';
end; $$;
-- Scrub only objects explicitly bound to this process from application backups.
create or replace function public.portal_scrub_process_json(v jsonb, pid text, jobs text[])
returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare result jsonb; k text; item jsonb; clean jsonb;
begin
 if jsonb_typeof(v)='object' then
  if v->>'processId'=pid or v->>'entityId'=pid or v->>'id'=pid or v->>'matchedJobId'=any(jobs) then return null;end if;
  result='{}'::jsonb;
  for k,item in select * from jsonb_each(v) loop
   if k=pid then continue;end if;
   clean=public.portal_scrub_process_json(item,pid,jobs);
   if clean is not null then result=result||jsonb_build_object(k,clean);end if;
  end loop;return result;
 elsif jsonb_typeof(v)='array' then
  result='[]'::jsonb;
  for item in select * from jsonb_array_elements(v) loop
   if item=to_jsonb(pid) then continue;end if;
   clean=public.portal_scrub_process_json(item,pid,jobs);
   if clean is not null then result=result||jsonb_build_array(clean);end if;
  end loop;return result;
 end if;
 return v;
end; $$;
revoke all on function public.portal_scrub_process_json(jsonb,text,text[]) from public,anon,authenticated;
create or replace function public.portal_master_purge_process_history(p_external_id text,p_protocol text,p_job_ids text[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare target uuid;
begin
 if coalesce(p_external_id,'')='' or coalesce(p_protocol,'')='' then raise exception 'Process identity required';end if;
 select id into target from public.portal_processes where external_id=p_external_id and code=p_protocol for update;
 if target is null then return;end if;
 -- A live process must first be removed from the authoritative aggregate by the API.
 if exists(select 1 from public.portal_runtime_state s, jsonb_array_elements(coalesce(s.payload->'processes','[]'::jsonb)) p where p->>'id'=p_external_id) then raise exception 'Process is still active';end if;
 perform set_config('portal.master_purge_process',target::text,true);
 delete from public.portal_audit_events where process_id=target;
 delete from public.portal_publications where process_id=target;
 delete from public.portal_workflow_runs where process_id=target;
 delete from public.portal_email_deliveries where process_id=target;
 delete from public.portal_signature_jobs where process_id=target;
 delete from public.portal_files where process_id=target;
 delete from public.portal_process_authors where process_id=target;
 delete from public.portal_processes where id=target;
 delete from public.portal_asten_dispatch_claims where job_external_id=any(p_job_ids);
 delete from public.portal_asten_webhook_inbox where event->>'matchedJobId'=any(p_job_ids);
 update public.portal_runtime_state_backups set payload=public.portal_scrub_process_json(payload,p_external_id,p_job_ids);
 perform set_config('portal.master_purge_process','',true);
end; $$;
revoke all on function public.portal_master_purge_process_history(text,text,text[]) from public,anon,authenticated;
grant execute on function public.portal_master_purge_process_history(text,text,text[]) to service_role;
commit;
