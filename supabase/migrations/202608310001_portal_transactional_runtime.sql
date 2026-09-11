begin;

-- Commit log for the portal aggregate. The JSON aggregate is retained for fast,
-- deterministic boot while the operational data is projected into the
-- normalized tables in the same PostgreSQL transaction.
create table if not exists public.portal_runtime_commits (
  revision bigint primary key,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  committed_at timestamptz not null default now()
);

alter table public.portal_runtime_commits enable row level security;
alter table public.portal_runtime_commits force row level security;
revoke all on table public.portal_runtime_commits from public, anon, authenticated;
grant all on table public.portal_runtime_commits to service_role;

-- A queued signature can exist before its generated PDF has reached Drive.
-- Once it is sent, the application records source_file_id in the next commit.
alter table public.portal_signature_jobs alter column source_file_id drop not null;

create or replace function public.portal_upsert_runtime_user(
  user_email text,
  user_name text,
  registration text default null,
  selected_global_role text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text := lower(btrim(coalesce(user_email, '')));
  selected_id uuid;
begin
  if normalized_email = '' then
    return null;
  end if;

  insert into public.portal_users (email, full_name, institutional_registration, global_role, status, updated_at)
  values (
    normalized_email,
    coalesce(nullif(btrim(user_name), ''), split_part(normalized_email, '@', 1)),
    nullif(btrim(registration), ''),
    selected_global_role,
    'ACTIVE',
    now()
  )
  on conflict (lower(email)) where status <> 'ANONYMIZED'
  do update set
    full_name = coalesce(nullif(btrim(excluded.full_name), ''), portal_users.full_name),
    institutional_registration = coalesce(excluded.institutional_registration, portal_users.institutional_registration),
    global_role = coalesce(excluded.global_role, portal_users.global_role),
    status = 'ACTIVE',
    updated_at = now()
  returning id into selected_id;

  return selected_id;
end;
$$;

create or replace function public.portal_project_runtime_state(next_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

  -- Authorization list. Manual revocation is never undone by a process sync.
  for access_row in select value from jsonb_array_elements(coalesce(next_payload->'authorizedStudents', '[]'::jsonb)) loop
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
  for process_row in select value from jsonb_array_elements(coalesce(next_payload->'processes', '[]'::jsonb)) loop
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
  for job_row in select value from jsonb_array_elements(coalesce(next_payload->'signatureJobs', '[]'::jsonb)) loop
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
  for mail_row in select value from jsonb_array_elements(coalesce(next_payload->'emailDeliveries','[]'::jsonb)) loop
    select id into selected_process_id from public.portal_processes where external_id=mail_row->>'processId';
    insert into public.portal_email_deliveries(external_id,process_id,message_type,recipient_email,idempotency_key,status,attempts,next_attempt_at,accepted_at,created_at,updated_at)
    values(mail_row->>'id',selected_process_id,coalesce(mail_row->>'templateId','PORTAL_EMAIL'),lower(mail_row->>'recipient'),mail_row->>'idempotencyKey',case mail_row->>'status' when 'ACCEPTED_BY_GMAIL' then 'ACCEPTED_BY_PROVIDER' when 'FAILED' then 'FAILED' else 'QUEUED' end,jsonb_array_length(coalesce(mail_row->'attempts','[]'::jsonb)),nullif(mail_row->>'nextRetryAt','')::timestamptz,nullif(mail_row->>'acceptedAt','')::timestamptz,coalesce((mail_row->>'createdAt')::timestamptz,now()),coalesce((mail_row->>'updatedAt')::timestamptz,now()))
    on conflict (external_id) do update set status=excluded.status,attempts=excluded.attempts,next_attempt_at=excluded.next_attempt_at,accepted_at=excluded.accepted_at,updated_at=excluded.updated_at;
  end loop;
  for workflow_row in select value from jsonb_array_elements(coalesce(next_payload->'workflowRuns','[]'::jsonb)) loop
    select id into selected_process_id from public.portal_processes where external_id=workflow_row->>'processId';
    if selected_process_id is null then continue; end if;
    insert into public.portal_workflow_runs(external_id,process_id,workflow_key,workflow_version,current_stage,status,context,started_at,updated_at,completed_at)
    values(workflow_row->>'id',selected_process_id,coalesce(workflow_row->>'eventCode','WORKFLOW')||':'||(workflow_row->>'id'),1,coalesce(workflow_row->>'eventCode','WORKFLOW'),case workflow_row->>'status' when 'COMPLETED' then 'COMPLETED' else 'FAILED' end,workflow_row,coalesce((workflow_row->>'startedAt')::timestamptz,now()),coalesce((workflow_row->>'completedAt')::timestamptz,now()),nullif(workflow_row->>'completedAt','')::timestamptz)
    on conflict (external_id) do update set current_stage=excluded.current_stage,status=excluded.status,context=excluded.context,updated_at=excluded.updated_at,completed_at=excluded.completed_at;
  end loop;

  -- Append-only audit projection. Existing events are never updated.
  for audit_row in select value from jsonb_array_elements(coalesce(next_payload->'auditLogs','[]'::jsonb)) loop
    select id into selected_process_id from public.portal_processes where external_id=audit_row->>'processId';
    insert into public.portal_audit_events(external_id,occurred_at,actor_email_hash,process_id,process_code,event_type,entity_type,entity_id,details)
    values(audit_row->>'id',coalesce((audit_row->>'timestamp')::timestamptz,now()),case when coalesce(audit_row->>'actorEmail','')='' then null else encode(digest(lower(audit_row->>'actorEmail'),'sha256'),'hex') end,selected_process_id,(select code from public.portal_processes where id=selected_process_id),coalesce(audit_row->>'action','UNKNOWN'),coalesce(audit_row->>'entityType','unknown'),audit_row->>'entityId',jsonb_build_object('before',audit_row->'before','after',audit_row->'after'))
    on conflict (external_id) do nothing;
  end loop;
end;
$$;

create or replace function public.portal_commit_runtime_state(expected_revision bigint, next_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_revision bigint;
  next_revision bigint;
begin
  if next_payload is null or jsonb_typeof(next_payload) <> 'object' then
    raise exception 'O estado do portal precisa ser um objeto JSON.' using errcode='22023';
  end if;

  insert into public.portal_runtime_state(id,payload,revision,updated_at)
  values('global','{}'::jsonb,0,now())
  on conflict (id) do nothing;

  select revision into current_revision from public.portal_runtime_state where id='global' for update;
  if current_revision <> expected_revision then
    raise exception 'Conflito de concorrência: revisão atual %, revisão esperada %.', current_revision, expected_revision using errcode='40001';
  end if;

  perform public.portal_project_runtime_state(next_payload);
  next_revision := current_revision + 1;
  update public.portal_runtime_state set payload=next_payload,revision=next_revision,updated_at=now() where id='global';
  insert into public.portal_runtime_commits(revision,payload_sha256) values(next_revision,encode(digest(next_payload::text,'sha256'),'hex'));
  return next_revision;
end;
$$;

create or replace function public.portal_runtime_capabilities()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select jsonb_build_object(
    'schema_version', 3,
    'transactional_runtime', true,
    'optimistic_concurrency', true,
    'normalized_core_projection', true,
    'binary_storage', 'GOOGLE_DRIVE'
  );
$$;

revoke all on function public.portal_upsert_runtime_user(text,text,text,text) from public, anon, authenticated;
revoke all on function public.portal_project_runtime_state(jsonb) from public, anon, authenticated;
revoke all on function public.portal_commit_runtime_state(bigint,jsonb) from public, anon, authenticated;
revoke all on function public.portal_runtime_capabilities() from public, anon, authenticated;
grant execute on function public.portal_upsert_runtime_user(text,text,text,text) to service_role;
grant execute on function public.portal_project_runtime_state(jsonb) to service_role;
grant execute on function public.portal_commit_runtime_state(bigint,jsonb) to service_role;
grant execute on function public.portal_runtime_capabilities() to service_role;

comment on function public.portal_commit_runtime_state(bigint,jsonb) is 'Commit otimista atômico do agregado do portal e de suas projeções relacionais normalizadas.';
comment on table public.portal_runtime_commits is 'Histórico mínimo de revisões e hashes; não contém documentos nem segredos.';

commit;
