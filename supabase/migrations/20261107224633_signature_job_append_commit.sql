begin;
set local lock_timeout = '2s';
set local statement_timeout = '5s';

-- Append only newly prepared jobs; all previously confirmed identities remain immutable.
create or replace function public.portal_commit_signature_jobs(expected_revision bigint,changed_jobs jsonb)
returns bigint language plpgsql security invoker
set search_path=public,extensions,pg_temp as $$
declare
 current_revision bigint; current_payload jsonb; next_payload jsonb;
 job jsonb; previous_job jsonb; matched integer; source_process jsonb; source_revision integer;
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
   if matched=0 then
     -- No provider operation or signature history can be introduced by this path.
     if job->>'provider' is distinct from 'ASTEN' or job->>'status' is distinct from 'QUEUED'
        or job->>'providerCreationState' is distinct from 'PENDING'
        or coalesce(job->>'idempotencyKey','') !~ '^[0-9a-f]{64}$'
        or coalesce(job->>'contentSha256','') !~ '^[0-9a-f]{64}$'
        or coalesce(job->>'driveUnsignedFileId','')=''
        or coalesce(job->>'documentType','') not in ('ATA','TERMO','DECLARACAO')
        or exists(select 1 from unnest(array['providerEnvelopeId','providerEnvelopeHash','providerDispatchState','signedSha256','driveSignedFileId','sentAt','completedAt','removedFromLogsAt','canceledAt']) key where coalesce(job->>key,'')<>'')
        or jsonb_typeof(job->'signers') is distinct from 'array'
        or jsonb_array_length(job->'signers')=0
        or exists(select 1 from jsonb_array_elements(job->'signers') signer where signer->>'status' is distinct from 'PENDING' or coalesce(signer->>'signedAt','')<>'') then
       raise exception 'Somente uma assinatura nova preparada pode ser adicionada.' using errcode='22023';
     end if;
     if (select count(*) from jsonb_array_elements(coalesce(current_payload->'processes','[]'::jsonb)) p where p->>'id'=job->>'processId')<>1 then
       raise exception 'Processo atual da nova assinatura não confirmado.' using errcode='PT409';
     end if;
     select p into source_process from jsonb_array_elements(current_payload->'processes') p where p->>'id'=job->>'processId';
     source_revision:=case when job->>'documentType'='ATA' then coalesce((source_process#>>'{avaliacao,documentRevision}')::integer,(source_process->>'dataRevision')::integer) else (source_process->>'dataRevision')::integer end;
     if source_revision is null or source_revision<1 or (job->>'sourceDataRevision')::integer is distinct from source_revision
        or not exists(select 1 from public.portal_processes p where p.external_id=job->>'processId' and p.cancelled_at is null)
        or exists(select 1 from public.portal_signature_jobs j where j.external_id=job->>'id' or j.idempotency_key=job->>'idempotencyKey')
        or exists(select 1 from jsonb_array_elements(current_payload->'signatureJobs') old where old->>'idempotencyKey'=job->>'idempotencyKey')
        or (select count(*) from jsonb_array_elements(changed_jobs) patch where patch->>'idempotencyKey'=job->>'idempotencyKey')<>1
        or (job->>'documentVersion')::integer is distinct from (select coalesce(max((old->>'documentVersion')::integer),0)+1 from jsonb_array_elements(current_payload->'signatureJobs') old where old->>'processId'=job->>'processId' and old->>'documentType'=job->>'documentType')
        or (select count(*) from jsonb_array_elements(changed_jobs) patch where patch->>'processId'=job->>'processId' and patch->>'documentType'=job->>'documentType' and not exists(select 1 from jsonb_array_elements(current_payload->'signatureJobs') old where old->>'id'=patch->>'id'))<>1 then
       raise exception 'Identidade, versão ou processo da nova assinatura divergente.' using errcode='PT409';
     end if;
     continue;
   elsif matched<>1 then raise exception 'A assinatura existente não foi confirmada.' using errcode='PT409'; end if;
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
   select coalesce(jsonb_agg(coalesce(patch.value,old.value) order by old.ordinality),'[]'::jsonb)
   from jsonb_array_elements(current_payload->'signatureJobs') with ordinality old(value,ordinality)
   left join jsonb_array_elements(changed_jobs) patch(value) on patch.value->>'id'=old.value->>'id'
 ) || coalesce((select jsonb_agg(patch.value order by patch.ordinality)
   from jsonb_array_elements(changed_jobs) with ordinality patch(value,ordinality)
   where not exists(select 1 from jsonb_array_elements(current_payload->'signatureJobs') old where old->>'id'=patch.value->>'id')),'[]'::jsonb));
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
