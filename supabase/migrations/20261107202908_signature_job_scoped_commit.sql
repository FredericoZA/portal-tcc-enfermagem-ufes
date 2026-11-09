begin;

-- Existing-job-only projection. Mirrors the canonical core/v4 job fields exactly.
-- No process/auth/access loops and no process-cancellation side effects.
create function public.portal_project_signature_jobs_v1(changed_jobs jsonb)
returns void language plpgsql security invoker
set search_path=public,extensions,pg_temp as $$
declare
 job_row jsonb; signer_row jsonb;
 selected_process_id uuid; selected_user_id uuid; selected_file_id uuid; selected_job_id uuid;
 selected_drive_id text; selected_hash text; selected_status text;
begin
  -- Asten jobs and their ordered signers.
  for job_row in select value from jsonb_array_elements(changed_jobs) loop
    select id into selected_process_id from public.portal_processes where external_id=job_row->>'processId';
    if selected_process_id is null then raise exception 'Processo da assinatura não projetado.' using errcode='PT409'; end if;
    selected_user_id := public.portal_upsert_runtime_user(job_row->>'createdBy',job_row->>'createdBy',null,null);
    selected_file_id := null;
    selected_drive_id := job_row->>'driveUnsignedFileId';
    selected_hash := lower(coalesce(job_row->>'contentSha256',''));
    if coalesce(selected_drive_id,'')<>'' and selected_hash ~ '^[0-9a-f]{64}$' then
      insert into public.portal_files(external_id,process_id,file_kind,lifecycle,drive_file_id,file_name,mime_type,sha256,version,visibility,created_by)
      values('unsigned:'||(job_row->>'id'),selected_process_id,case job_row->>'documentType' when 'ATA' then 'DEFENSE_MINUTES' when 'TERMO' then 'PUBLICATION_AUTHORIZATION' else 'COMMITTEE_DECLARATION' end,'GENERATED',selected_drive_id,job_row->>'fileName','application/pdf',selected_hash,greatest(1,coalesce((job_row->>'documentVersion')::integer,1)),'PRIVATE',selected_user_id)
      on conflict (external_id) do update set drive_file_id=excluded.drive_file_id,file_name=excluded.file_name,sha256=excluded.sha256
      returning id into selected_file_id;
    end if;
    selected_status := case job_row->>'status' when 'SENDING' then 'SUBMITTING' when 'SENT' then 'SENT' when 'PARTIALLY_SIGNED' then 'PARTIALLY_SIGNED' when 'SIGNED' then 'SIGNED' when 'DRIVE_SYNC_PENDING' then 'SIGNED' when 'ARCHIVED' then 'SIGNED' when 'CANCELED' then 'CANCELLED' when 'DECLINED' then 'FAILED' when 'EXPIRED' then 'FAILED' when 'PROVIDER_ERROR' then 'FAILED' else 'PENDING' end;
    insert into public.portal_signature_jobs(external_id,process_id,document_type,source_file_id,provider_envelope_id,idempotency_key,version,status,requested_by,requested_at,sent_at,completed_at,last_error_code,last_error_at)
    values(job_row->>'id',selected_process_id,case job_row->>'documentType' when 'ATA' then 'DEFENSE_MINUTES' when 'TERMO' then 'PUBLICATION_AUTHORIZATION' else 'COMMITTEE_DECLARATION' end,selected_file_id,nullif(job_row->>'providerEnvelopeId',''),job_row->>'idempotencyKey',greatest(1,coalesce((job_row->>'documentVersion')::integer,1)),selected_status,selected_user_id,coalesce((job_row->>'createdAt')::timestamptz,now()),nullif(job_row->>'sentAt','')::timestamptz,nullif(job_row->>'completedAt','')::timestamptz,nullif(job_row->>'lastError',''),case when coalesce(job_row->>'lastError','')<>'' then coalesce((job_row->>'updatedAt')::timestamptz,now()) else null end)
    on conflict (external_id) do update set source_file_id=excluded.source_file_id,provider_envelope_id=excluded.provider_envelope_id,status=excluded.status,sent_at=excluded.sent_at,completed_at=excluded.completed_at,last_error_code=excluded.last_error_code,last_error_at=excluded.last_error_at
    returning id into selected_job_id;
    delete from public.portal_signature_signers where signature_job_id=selected_job_id;
    for signer_row in select value from jsonb_array_elements(coalesce(job_row->'signers','[]'::jsonb)) loop
      selected_user_id := public.portal_upsert_runtime_user(signer_row->>'email',signer_row->>'name',null,null);
      insert into public.portal_signature_signers(signature_job_id,user_id,signer_name,signer_email,signer_role,signing_priority,status,signed_at)
      values(selected_job_id,selected_user_id,signer_row->>'name',lower(signer_row->>'email'),case signer_row->>'role' when 'PRESIDENT' then 'COMMISSION_PRESIDENT' else signer_row->>'role' end,greatest(1,coalesce((signer_row->>'signingOrder')::integer,1)),case signer_row->>'status' when 'SIGNED' then 'SIGNED' when 'VIEWED' then 'NOTIFIED' when 'DECLINED' then 'REFUSED' else 'PENDING' end,nullif(signer_row->>'signedAt','')::timestamptz);
    end loop;
    update public.portal_signature_jobs set signed_sha256=nullif(lower(job_row->>'signedSha256'),''),verification_code=nullif(job_row->>'verificationCode','') where external_id=job_row->>'id';
  end loop;

end;
$$;
revoke all on function public.portal_project_signature_jobs_v1(jsonb) from public,anon,authenticated;
grant execute on function public.portal_project_signature_jobs_v1(jsonb) to service_role;

create function public.portal_commit_signature_jobs(expected_revision bigint,changed_jobs jsonb)
returns bigint language plpgsql security invoker
set search_path=public,extensions,pg_temp as $$
declare
 current_revision bigint; current_payload jsonb; next_payload jsonb;
 job jsonb; previous_job jsonb; matched integer;
begin
 if changed_jobs is null or jsonb_typeof(changed_jobs)<>'array'
    or jsonb_array_length(changed_jobs) not between 1 and 10
    or octet_length(changed_jobs::text)>2000000 then
   raise exception 'Atualização de assinatura inválida.' using errcode='22023';
 end if;
 select revision,payload into current_revision,current_payload from public.portal_runtime_state where id='global' for update;
 if not found or current_revision is distinct from expected_revision then
   raise exception 'Conflito de concorrência: a revisão do portal mudou.' using errcode='PT409';
 end if;
 if jsonb_typeof(current_payload->'signatureJobs') is distinct from 'array' then
   raise exception 'Estado de assinaturas inválido.' using errcode='22023';
 end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(changed_jobs))<>jsonb_array_length(changed_jobs) then
   raise exception 'Assinaturas duplicadas ou sem identidade.' using errcode='22023';
 end if;
 for job in select value from jsonb_array_elements(changed_jobs) loop
   if jsonb_typeof(job)<>'object' or coalesce(job->>'id','')='' or octet_length(job::text)>200000 then
     raise exception 'Assinatura inválida.' using errcode='22023';
   end if;
   select count(*) into matched from jsonb_array_elements(current_payload->'signatureJobs') old where old->>'id'=job->>'id';
   if matched<>1 then raise exception 'A assinatura existente não foi confirmada.' using errcode='PT409'; end if;
   select old into previous_job from jsonb_array_elements(current_payload->'signatureJobs') old where old->>'id'=job->>'id';
   if exists(select 1 from unnest(array['id','processId','documentType','documentVersion','idempotencyKey','createdBy','createdAt','sourceDataRevision']) key
       where previous_job->key is distinct from job->key) then
     raise exception 'A identidade da assinatura mudou.' using errcode='PT409';
   end if;
   if not exists(select 1 from public.portal_signature_jobs j join public.portal_processes p on p.id=j.process_id
       where j.external_id=job->>'id' and p.external_id=job->>'processId') then
     raise exception 'A assinatura e seu processo precisam estar projetados.' using errcode='PT409';
   end if;
 end loop;
 next_payload:=jsonb_set(current_payload,'{signatureJobs}',(
   select jsonb_agg(coalesce(patch.value,old.value) order by old.ordinality)
   from jsonb_array_elements(current_payload->'signatureJobs') with ordinality old(value,ordinality)
   left join jsonb_array_elements(changed_jobs) patch(value) on patch.value->>'id'=old.value->>'id'
 ));
 perform public.portal_project_signature_jobs_v1(changed_jobs);
 -- A TERMO job may change publication status even when its process JSON is unchanged.
 perform public.portal_project_publications_v8(jsonb_build_object('processes',coalesce((
   select jsonb_agg(p.value) from jsonb_array_elements(coalesce(next_payload->'processes','[]'::jsonb)) p(value)
   where p.value->>'id' in(select value->>'processId' from jsonb_array_elements(changed_jobs))
 ),'[]'::jsonb)));
 update public.portal_runtime_state set payload=next_payload,revision=current_revision+1,updated_at=now() where id='global';
 insert into public.portal_runtime_commits(revision,payload_sha256) values(current_revision+1,encode(digest(next_payload::text,'sha256'),'hex'));
 return current_revision+1;
end;
$$;
revoke all on function public.portal_commit_signature_jobs(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.portal_commit_signature_jobs(bigint,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
