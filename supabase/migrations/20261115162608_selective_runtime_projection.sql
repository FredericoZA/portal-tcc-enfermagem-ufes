begin;
set local lock_timeout='5s';
create function public.portal_projection_rows_v1(next_payload jsonb, section_name text)
returns setof jsonb language sql stable security invoker set search_path=pg_catalog,pg_temp as $fn$
 with prior as materialized (select payload from public.portal_runtime_state where id='global'),
 old_rows as materialized (select value from prior,jsonb_array_elements(coalesce(payload->section_name,'[]'::jsonb))),
 changed_people as (
 select coalesce((select jsonb_agg(jsonb_build_array(p->'aluno1',p->'aluno2',p->'orientador',p->'coorientador',p->'banca') order by p->>'id') from jsonb_array_elements(coalesce(next_payload->'processes','[]'::jsonb)) p),'[]'::jsonb)
 is distinct from coalesce((select jsonb_agg(jsonb_build_array(p->'aluno1',p->'aluno2',p->'orientador',p->'coorientador',p->'banca') order by p->>'id') from prior,jsonb_array_elements(coalesce(payload->'processes','[]'::jsonb)) p),'[]'::jsonb) as changed
 )
 select incoming.value from jsonb_array_elements(coalesce(next_payload->section_name,'[]'::jsonb)) with ordinality incoming(value,position)
 where current_setting('portal.force_full_projection',true)='on' or not exists(select 1 from prior)
 or (section_name='processes' and ((select changed from changed_people)
   or (select next_payload->'settings' is distinct from payload->'settings' or next_payload->'signatureJobs' is distinct from payload->'signatureJobs' from prior)))
 or (section_name<>'processes' and section_name<>'authorizedStudents' and (select next_payload->'processes' is distinct from payload->'processes' from prior))
 or not exists (select 1 from old_rows where value=incoming.value)
 order by incoming.position;
$fn$;
revoke all on function public.portal_projection_rows_v1(jsonb,text) from public,anon,authenticated;
grant execute on function public.portal_projection_rows_v1(jsonb,text) to service_role;
do $guard$ begin if (select md5(prosrc) from pg_proc where oid='public.portal_project_publications_v8(jsonb)'::regprocedure)<>'d51deab4ec192e65ec6d683bebae9ffc' then raise exception 'Unexpected projector portal_project_publications_v8; review before replacing'; end if; end $guard$;
CREATE OR REPLACE FUNCTION public.portal_project_publications_v8(next_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  process_row jsonb;
  selected_process_id uuid;
  selected_process_status text;
  selected_requested_by uuid;
  selected_withdrawn_by uuid;
  selected_full_file_id uuid;
  selected_expanded_file_id uuid;
  selected_auth_job_id uuid;
  selected_auth_job_status text;
  publish_full boolean;
  publish_expanded boolean;
  withdrawal_at timestamptz;
  authorization_at timestamptz;
  selected_requested_at timestamptz;
  normalized_status text;
begin
  if next_payload is null or jsonb_typeof(next_payload) <> 'object' then
    raise exception 'O estado do portal precisa ser um objeto JSON.' using errcode='22023';
  end if;

  for process_row in select * from public.portal_projection_rows_v1(next_payload,'processes') loop
    select id, status, created_by
      into selected_process_id, selected_process_status, selected_requested_by
    from public.portal_processes
    where external_id = process_row->>'id';

    if selected_process_id is null then
      continue;
    end if;

    publish_full := coalesce((process_row#>>'{acervo,publishFullWork}')::boolean, false);
    publish_expanded := coalesce((process_row#>>'{acervo,publishExpandedAbstract}')::boolean, false);
    withdrawal_at := nullif(process_row#>>'{acervo,publicationWithdrawnAt}','')::timestamptz;
    authorization_at := nullif(process_row#>>'{acervo,authorizationConfirmedAt}','')::timestamptz;
    selected_requested_at := coalesce(
      nullif(process_row#>>'{acervo,publicationRequestedAt}','')::timestamptz,
      nullif(process_row#>>'{acervo,submittedAt}','')::timestamptz,
      nullif(process_row->>'updatedAt','')::timestamptz,
      now()
    );

    selected_full_file_id := null;
    selected_expanded_file_id := null;
    selected_auth_job_id := null;
    selected_auth_job_status := null;
    selected_withdrawn_by := null;

    if coalesce(process_row#>>'{acervo,trabalhoCompletoFileId}','') <> '' then
      select f.id into selected_full_file_id
      from public.portal_files f
      where f.process_id = selected_process_id
        and f.file_kind = 'FULL_WORK'
        and f.drive_file_id = process_row#>>'{acervo,trabalhoCompletoFileId}'
      order by f.version desc
      limit 1;
    end if;

    if coalesce(process_row#>>'{acervo,resumoExpandidoFileId}','') <> '' then
      select f.id into selected_expanded_file_id
      from public.portal_files f
      where f.process_id = selected_process_id
        and f.file_kind = 'EXPANDED_ABSTRACT'
        and f.drive_file_id = process_row#>>'{acervo,resumoExpandidoFileId}'
      order by f.version desc
      limit 1;
    end if;

    select j.id, j.status into selected_auth_job_id, selected_auth_job_status
    from public.portal_signature_jobs j
    where j.process_id = selected_process_id
      and j.document_type = 'PUBLICATION_AUTHORIZATION'
      and j.status <> 'CANCELLED'
    order by j.version desc, j.requested_at desc
    limit 1;

    if coalesce(process_row#>>'{acervo,publicationWithdrawnBy}','') <> '' then
      select u.id into selected_withdrawn_by
      from public.portal_users u
      where u.email = lower(process_row#>>'{acervo,publicationWithdrawnBy}')
        and u.status <> 'ANONYMIZED'
      limit 1;
    end if;

    normalized_status := case
      when withdrawal_at is not null then 'WITHDRAWN'
      when publish_full or publish_expanded then
        case
          when selected_process_status = 'COMPLETED'
            and selected_auth_job_id is not null
            and selected_auth_job_status = 'SIGNED'
          then 'PUBLISHED'
          else 'PENDING_AUTHORIZATION'
        end
      else 'PRIVATE'
    end;

    insert into public.portal_publications(
      process_id,publish_full_work,publish_expanded_abstract,full_work_file_id,
      expanded_abstract_file_id,authorization_signature_job_id,authorization_confirmed_at,
      authorization_data_revision,status,requested_by,requested_at,published_at,
      withdrawn_at,withdrawn_by,withdrawal_reason,updated_at
    ) values (
      selected_process_id,publish_full,publish_expanded,selected_full_file_id,
      selected_expanded_file_id,selected_auth_job_id,authorization_at,
      nullif(process_row->>'dataRevision','')::integer,normalized_status,
      selected_requested_by,selected_requested_at,
      case when normalized_status='PUBLISHED' then coalesce(nullif(process_row->>'completedAt','')::timestamptz, nullif(process_row->>'updatedAt','')::timestamptz, now()) else null end,
      withdrawal_at,selected_withdrawn_by,nullif(process_row#>>'{acervo,publicationWithdrawalReason}',''),
      coalesce(nullif(process_row->>'updatedAt','')::timestamptz, now())
    )
    on conflict(process_id) do update set
      publish_full_work = excluded.publish_full_work,
      publish_expanded_abstract = excluded.publish_expanded_abstract,
      full_work_file_id = excluded.full_work_file_id,
      expanded_abstract_file_id = excluded.expanded_abstract_file_id,
      authorization_signature_job_id = excluded.authorization_signature_job_id,
      authorization_confirmed_at = excluded.authorization_confirmed_at,
      authorization_data_revision = excluded.authorization_data_revision,
      status = excluded.status,
      requested_by = excluded.requested_by,
      requested_at = excluded.requested_at,
      published_at = case
        when excluded.status='PUBLISHED' then coalesce(portal_publications.published_at, excluded.published_at)
        else portal_publications.published_at
      end,
      withdrawn_at = excluded.withdrawn_at,
      withdrawn_by = excluded.withdrawn_by,
      withdrawal_reason = excluded.withdrawal_reason,
      updated_at = excluded.updated_at;
  end loop;
end;
$function$;

do $guard$ begin if (select md5(prosrc) from pg_proc where oid='public.portal_project_runtime_state(jsonb)'::regprocedure)<>'ad995934dac0c275a58f715a26704034' then raise exception 'Unexpected projector portal_project_runtime_state; review before replacing'; end if; end $guard$;
CREATE OR REPLACE FUNCTION public.portal_project_runtime_state(next_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  settings_row jsonb := coalesce(next_payload->'settings', '{}'::jsonb);
  access_row jsonb;
  process_row jsonb;
  member_row jsonb;
  bank_row jsonb;
  job_row jsonb;
  signer_row jsonb;
  mail_row jsonb;
  workflow_row jsonb;
  audit_row jsonb;
  selected_user_id uuid;
  selected_process_id uuid;
  selected_access_id uuid;
  selected_file_id uuid;
  selected_signed_file_id uuid;
  selected_job_id uuid;
  selected_email text;
  selected_role text;
  selected_status text;
  selected_version integer;
  selected_hash text;
  selected_drive_id text;
begin
  if settings_row is distinct from (select payload->'settings' from public.portal_runtime_state where id='global') or current_setting('portal.force_full_projection',true)='on' then
-- Global administrators.
  update public.portal_users
  set global_role=null, updated_at=now()
  where global_role in ('MASTER_ADMIN','COMMISSION_PRESIDENT')
    and lower(email) not in (
      lower(coalesce(settings_row->>'masterEmail','')),
      lower(coalesce(settings_row->>'commissionPresidentEmail',''))
    );
  perform public.portal_upsert_runtime_user(settings_row->>'masterEmail', coalesce(settings_row->>'masterName', 'Usuário Master'), null, 'MASTER_ADMIN');
  perform public.portal_upsert_runtime_user(settings_row->>'commissionPresidentEmail', coalesce(settings_row->>'commissionPresidentName', 'Presidente da Comissão'), null, 'COMMISSION_PRESIDENT');

  end if;
  -- Authorization list. Manual revocation is never undone by a process sync.
  for access_row in select * from public.portal_projection_rows_v1(next_payload,'authorizedStudents') loop
    selected_email := lower(btrim(coalesce(access_row->>'email', '')));
    if selected_email = '' then continue; end if;
    selected_user_id := public.portal_upsert_runtime_user(selected_email, access_row->>'nome', access_row->>'matricula', null);

    insert into public.portal_access_entries (
      email, user_id, source, active, manual_revocation, granted_at,
      revoked_at, updated_at
    ) values (
      selected_email,
      selected_user_id,
      case when access_row->>'origin' = 'MASTER_LIST' then 'PREAUTHORIZED_STUDENT' else 'PROCESS_PARTICIPANT' end,
      coalesce((access_row->>'active')::boolean, true),
      coalesce((access_row->>'manualRevocation')::boolean, false),
      coalesce((access_row->>'createdAt')::timestamptz, now()),
      case when coalesce((access_row->>'active')::boolean, true) then null else coalesce((access_row->>'revokedAt')::timestamptz, now()) end,
      coalesce((access_row->>'updatedAt')::timestamptz, now())
    )
    on conflict (email) do update set
      user_id = excluded.user_id,
      source = excluded.source,
      active = case when portal_access_entries.manual_revocation and excluded.active then false else excluded.active end,
      manual_revocation = portal_access_entries.manual_revocation or excluded.manual_revocation,
      revoked_at = case when portal_access_entries.manual_revocation and excluded.active then portal_access_entries.revoked_at else excluded.revoked_at end,
      updated_at = excluded.updated_at
    returning id into selected_access_id;
  end loop;

  -- Processes, authors and memberships.
  for process_row in select * from public.portal_projection_rows_v1(next_payload,'processes') loop
    selected_email := lower(btrim(coalesce(process_row->>'createdByEmail', process_row#>>'{aluno1,email}')));
    selected_user_id := public.portal_upsert_runtime_user(selected_email, process_row#>>'{aluno1,nome}', process_row#>>'{aluno1,matricula}', null);
    selected_status := case process_row->>'status'
      when 'EM_RASCUNHO' then 'DRAFT'
      when 'AGUARDANDO_CONFIRMACAO_LOCAL' then 'AWAITING_LOCATION'
      when 'AGUARDANDO_DEFESA' then 'SCHEDULED'
      when 'EM_AVALIACAO' then 'AWAITING_EVALUATION'
      when 'AGUARDANDO_DADOS_FINAIS' then 'AWAITING_FINAL_DATA'
      when 'AGUARDANDO_ASSINATURA' then 'AWAITING_SIGNATURES'
      when 'CONCLUIDO' then 'COMPLETED'
      else 'DRAFT' end;

    insert into public.portal_processes (
      external_id, code, title, status, defense_at, defense_location,
      created_by, created_at, updated_at, completed_at, cancelled_at
    ) values (
      process_row->>'id', process_row->>'protocolo', process_row->>'titulo', selected_status,
      nullif(process_row#>>'{defesa,startAt}', '')::timestamptz,
      nullif(process_row#>>'{defesa,local}', ''),
      selected_user_id,
      coalesce((process_row->>'createdAt')::timestamptz, now()),
      coalesce((process_row->>'updatedAt')::timestamptz, now()),
      case when selected_status = 'COMPLETED' then coalesce((process_row->>'updatedAt')::timestamptz, now()) else null end,
      null
    )
    on conflict (external_id) do update set
      code = excluded.code, title = excluded.title, status = excluded.status,
      defense_at = excluded.defense_at, defense_location = excluded.defense_location,
      updated_at = excluded.updated_at, completed_at = excluded.completed_at,
      cancelled_at = null
    returning id into selected_process_id;

    delete from public.portal_process_authors where process_id = selected_process_id;
    selected_user_id := public.portal_upsert_runtime_user(process_row#>>'{aluno1,email}', process_row#>>'{aluno1,nome}', process_row#>>'{aluno1,matricula}', null);
    insert into public.portal_process_authors(process_id,user_id,author_order) values(selected_process_id,selected_user_id,1) on conflict do nothing;
    if coalesce(process_row#>>'{aluno2,email}', '') <> '' then
      selected_user_id := public.portal_upsert_runtime_user(process_row#>>'{aluno2,email}', process_row#>>'{aluno2,nome}', process_row#>>'{aluno2,matricula}', null);
      insert into public.portal_process_authors(process_id,user_id,author_order) values(selected_process_id,selected_user_id,2) on conflict do nothing;
    end if;

    delete from public.portal_process_memberships where process_id = selected_process_id;
    selected_user_id := public.portal_upsert_runtime_user(process_row#>>'{orientador,email}', process_row#>>'{orientador,nome}', null, null);
    if selected_user_id is not null then
      insert into public.portal_process_memberships(process_id,user_id,process_role,institution)
      values(selected_process_id,selected_user_id,'ADVISOR',nullif(process_row#>>'{orientador,instituicao}','')) on conflict do nothing;
    end if;
    if coalesce(process_row#>>'{coorientador,email}', '') <> '' then
      selected_user_id := public.portal_upsert_runtime_user(process_row#>>'{coorientador,email}', process_row#>>'{coorientador,nome}', null, null);
      insert into public.portal_process_memberships(process_id,user_id,process_role,institution)
      values(selected_process_id,selected_user_id,'CO_ADVISOR',nullif(process_row#>>'{coorientador,instituicao}','')) on conflict do nothing;
    end if;
    for bank_row in select value from jsonb_array_elements(coalesce(process_row->'banca', '[]'::jsonb)) loop
      if bank_row->>'funcao' = 'ORIENTADOR' then continue; end if;
      selected_user_id := public.portal_upsert_runtime_user(bank_row->>'email', bank_row->>'nome', null, null);
      if selected_user_id is not null then
        insert into public.portal_process_memberships(process_id,user_id,process_role,institution)
        values(selected_process_id,selected_user_id,'EXAMINER',nullif(bank_row->>'instituicao','')) on conflict do nothing;
      end if;
    end loop;

    -- Source PDFs stored privately in Drive.
    selected_drive_id := process_row#>>'{acervo,trabalhoCompletoFileId}';
    selected_hash := lower(coalesce(process_row#>>'{acervo,trabalhoCompletoSha256}', ''));
    if coalesce(selected_drive_id,'') <> '' and selected_hash ~ '^[0-9a-f]{64}$' then
      selected_version := greatest(1,coalesce((process_row#>>'{acervo,trabalhoCompletoVersion}')::integer,1));
      insert into public.portal_files(external_id,process_id,file_kind,lifecycle,drive_file_id,drive_parent_id,file_name,mime_type,sha256,version,visibility,created_by)
      values('full:'||(process_row->>'id')||':'||selected_version,selected_process_id,'FULL_WORK','GENERATED',selected_drive_id,nullif(process_row->>'driveFolderId',''),coalesce(process_row#>>'{acervo,trabalhoCompletoFileName}','trabalho.pdf'),'application/pdf',selected_hash,selected_version,case when coalesce((process_row#>>'{acervo,publishFullWork}')::boolean,false) then 'PUBLIC_PORTAL' else 'PRIVATE' end,selected_user_id)
      on conflict (external_id) do update set drive_file_id=excluded.drive_file_id,file_name=excluded.file_name,sha256=excluded.sha256,visibility=excluded.visibility,lifecycle='GENERATED';
    end if;
    selected_drive_id := process_row#>>'{acervo,resumoExpandidoFileId}';
    selected_hash := lower(coalesce(process_row#>>'{acervo,resumoExpandidoSha256}', ''));
    if coalesce(selected_drive_id,'') <> '' and selected_hash ~ '^[0-9a-f]{64}$' then
      selected_version := greatest(1,coalesce((process_row#>>'{acervo,resumoExpandidoVersion}')::integer,1));
      insert into public.portal_files(external_id,process_id,file_kind,lifecycle,drive_file_id,drive_parent_id,file_name,mime_type,sha256,version,visibility,created_by)
      values('expanded:'||(process_row->>'id')||':'||selected_version,selected_process_id,'EXPANDED_ABSTRACT','GENERATED',selected_drive_id,nullif(process_row->>'driveFolderId',''),coalesce(process_row#>>'{acervo,resumoExpandidoFileName}','resumo-expandido.pdf'),'application/pdf',selected_hash,selected_version,case when coalesce((process_row#>>'{acervo,publishExpandedAbstract}')::boolean,false) then 'PUBLIC_PORTAL' else 'PRIVATE' end,selected_user_id)
      on conflict (external_id) do update set drive_file_id=excluded.drive_file_id,file_name=excluded.file_name,sha256=excluded.sha256,visibility=excluded.visibility,lifecycle='GENERATED';
    end if;
  end loop;

  update public.portal_processes set status='CANCELLED',cancelled_at=coalesce(cancelled_at,now()),updated_at=now()
  where external_id not in (select value->>'id' from jsonb_array_elements(coalesce(next_payload->'processes','[]'::jsonb)));

  -- Asten jobs and their ordered signers.
  for job_row in select * from public.portal_projection_rows_v1(next_payload,'signatureJobs') loop
    select id into selected_process_id from public.portal_processes where external_id=job_row->>'processId';
    if selected_process_id is null then continue; end if;
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
  end loop;

  -- Delivery and workflow operational projections.
  for mail_row in select * from public.portal_projection_rows_v1(next_payload,'emailDeliveries') loop
    select id into selected_process_id from public.portal_processes where external_id=mail_row->>'processId';
    insert into public.portal_email_deliveries(external_id,process_id,message_type,recipient_email,idempotency_key,status,attempts,next_attempt_at,accepted_at,created_at,updated_at)
    values(mail_row->>'id',selected_process_id,coalesce(mail_row->>'templateId','PORTAL_EMAIL'),lower(mail_row->>'recipient'),mail_row->>'idempotencyKey',case mail_row->>'status' when 'ACCEPTED_BY_GMAIL' then 'ACCEPTED_BY_PROVIDER' when 'FAILED' then 'FAILED' else 'QUEUED' end,jsonb_array_length(coalesce(mail_row->'attempts','[]'::jsonb)),nullif(mail_row->>'nextRetryAt','')::timestamptz,nullif(mail_row->>'acceptedAt','')::timestamptz,coalesce((mail_row->>'createdAt')::timestamptz,now()),coalesce((mail_row->>'updatedAt')::timestamptz,now()))
    on conflict (external_id) do update set status=excluded.status,attempts=excluded.attempts,next_attempt_at=excluded.next_attempt_at,accepted_at=excluded.accepted_at,updated_at=excluded.updated_at;
  end loop;
  for workflow_row in select * from public.portal_projection_rows_v1(next_payload,'workflowRuns') loop
    select id into selected_process_id from public.portal_processes where external_id=workflow_row->>'processId';
    if selected_process_id is null then continue; end if;
    insert into public.portal_workflow_runs(external_id,process_id,workflow_key,workflow_version,current_stage,status,context,started_at,updated_at,completed_at)
    values(workflow_row->>'id',selected_process_id,coalesce(workflow_row->>'eventCode','WORKFLOW')||':'||(workflow_row->>'id'),1,coalesce(workflow_row->>'eventCode','WORKFLOW'),case workflow_row->>'status' when 'COMPLETED' then 'COMPLETED' else 'FAILED' end,workflow_row,coalesce((workflow_row->>'startedAt')::timestamptz,now()),coalesce((workflow_row->>'completedAt')::timestamptz,now()),nullif(workflow_row->>'completedAt','')::timestamptz)
    on conflict (external_id) do update set current_stage=excluded.current_stage,status=excluded.status,context=excluded.context,updated_at=excluded.updated_at,completed_at=excluded.completed_at;
  end loop;

  -- Append-only audit projection. Existing events are never updated.
  for audit_row in
    select incoming.value
    from jsonb_array_elements(coalesce(next_payload->'auditLogs','[]'::jsonb)) with ordinality as incoming(value,ordinality)
    where not exists (
      select 1 from public.portal_audit_events as existing
      where existing.external_id=incoming.value->>'id'
    )
    order by incoming.ordinality
  loop
    select id into selected_process_id from public.portal_processes where external_id=audit_row->>'processId';
    insert into public.portal_audit_events(external_id,occurred_at,actor_email_hash,process_id,process_code,event_type,entity_type,entity_id,details)
    values(audit_row->>'id',coalesce((audit_row->>'timestamp')::timestamptz,now()),case when coalesce(audit_row->>'actorEmail','')='' then null else encode(digest(lower(audit_row->>'actorEmail'),'sha256'),'hex') end,selected_process_id,(select code from public.portal_processes where id=selected_process_id),coalesce(audit_row->>'action','UNKNOWN'),coalesce(audit_row->>'entityType','unknown'),audit_row->>'entityId',jsonb_build_object('before',audit_row->'before','after',audit_row->'after'))
    on conflict (external_id) do nothing;
  end loop;
end;
$function$;

do $guard$ begin if (select md5(prosrc) from pg_proc where oid='public.portal_project_runtime_state_v4(jsonb)'::regprocedure)<>'135b908b356719905a9089398365c8f7' then raise exception 'Unexpected projector portal_project_runtime_state_v4; review before replacing'; end if; end $guard$;
CREATE OR REPLACE FUNCTION public.portal_project_runtime_state_v4(next_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  settings_row jsonb := coalesce(next_payload->'settings', '{}'::jsonb);
  cycle_row jsonb;
  process_row jsonb;
  job_row jsonb;
  transfer_row jsonb;
  selected_process_id uuid;
begin
  if settings_row is distinct from (select payload->'settings' from public.portal_runtime_state where id='global') or current_setting('portal.force_full_projection',true)='on' then
insert into public.portal_installation_config(id, installation_profile, feature_flags, updated_at)
  values('global', coalesce(settings_row->'installationProfile','{}'::jsonb), coalesce(settings_row->'featureFlags','[]'::jsonb), now())
  on conflict(id) do update set
    installation_profile=excluded.installation_profile,
    feature_flags=excluded.feature_flags,
    updated_at=excluded.updated_at;

  for cycle_row in select value from jsonb_array_elements(coalesce(settings_row->'academicCycles','[]'::jsonb)) loop
    insert into public.portal_academic_cycles(
      external_id,label,academic_year,term,submission_open_at,submission_close_at,
      defense_start_at,defense_end_at,status,active,created_at,updated_at
    ) values (
      cycle_row->>'id',cycle_row->>'label',(cycle_row->>'year')::integer,cycle_row->>'term',
      (cycle_row->>'submissionOpenAt')::timestamptz,(cycle_row->>'submissionCloseAt')::timestamptz,
      (cycle_row->>'defenseStartAt')::timestamptz,(cycle_row->>'defenseEndAt')::timestamptz,
      cycle_row->>'status',coalesce((cycle_row->>'active')::boolean,false),
      coalesce((cycle_row->>'createdAt')::timestamptz,now()),coalesce((cycle_row->>'updatedAt')::timestamptz,now())
    ) on conflict(external_id) do update set
      label=excluded.label,academic_year=excluded.academic_year,term=excluded.term,
      submission_open_at=excluded.submission_open_at,submission_close_at=excluded.submission_close_at,
      defense_start_at=excluded.defense_start_at,defense_end_at=excluded.defense_end_at,
      status=excluded.status,active=excluded.active,updated_at=excluded.updated_at;
  end loop;

  end if;
  for process_row in select * from public.portal_projection_rows_v1(next_payload,'processes') loop
    select id into selected_process_id from public.portal_processes where external_id=process_row->>'id';
    if selected_process_id is null then continue; end if;
    update public.portal_processes set academic_cycle_external_id=nullif(process_row->>'academicCycleId','') where id=selected_process_id;
    update public.portal_process_authors a set
      acceptance_status=case when a.author_order=1 then 'ACCEPTED' else coalesce(process_row#>>'{coauthorAcceptance,status}','PENDING') end,
      accepted_at=case when a.author_order=2 and process_row#>>'{coauthorAcceptance,status}'='ACCEPTED' then nullif(process_row#>>'{coauthorAcceptance,respondedAt}','')::timestamptz else null end,
      rejected_at=case when a.author_order=2 and process_row#>>'{coauthorAcceptance,status}'='REJECTED' then nullif(process_row#>>'{coauthorAcceptance,respondedAt}','')::timestamptz else null end
    where a.process_id=selected_process_id;
  end loop;

  for job_row in select * from public.portal_projection_rows_v1(next_payload,'signatureJobs') loop
    update public.portal_signature_jobs set
      signed_sha256=nullif(lower(job_row->>'signedSha256'),''),
      verification_code=nullif(job_row->>'verificationCode','')
    where external_id=job_row->>'id';
  end loop;

  for transfer_row in select * from public.portal_projection_rows_v1(next_payload,'administrationTransfers') loop
    insert into public.portal_administration_transfers(
      external_id,role,target_email,requested_by_email_hash,status,requested_at,expires_at,
      accepted_at,canceled_at,google_reconnect_required,updated_at
    ) values (
      transfer_row->>'id',transfer_row->>'role',lower(transfer_row->>'targetEmail'),
      encode(digest(lower(transfer_row->>'requestedBy'),'sha256'),'hex'),transfer_row->>'status',
      (transfer_row->>'requestedAt')::timestamptz,(transfer_row->>'expiresAt')::timestamptz,
      nullif(transfer_row->>'acceptedAt','')::timestamptz,nullif(transfer_row->>'canceledAt','')::timestamptz,
      coalesce((transfer_row->>'googleReconnectRequired')::boolean,false),now()
    ) on conflict(external_id) do update set
      status=excluded.status,accepted_at=excluded.accepted_at,canceled_at=excluded.canceled_at,
      google_reconnect_required=excluded.google_reconnect_required,updated_at=now();
  end loop;
end;
$function$;

notify pgrst,'reload schema';
commit;
