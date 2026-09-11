begin;

-- Portal TCC v4: governança de uma instalação por curso. Os binários continuam
-- exclusivamente no Google Drive; o Supabase armazena estado, índices e auditoria.
create table if not exists public.portal_installation_config (
  id text primary key default 'global' check (id = 'global'),
  installation_profile jsonb not null default '{}'::jsonb check (jsonb_typeof(installation_profile) = 'object'),
  feature_flags jsonb not null default '[]'::jsonb check (jsonb_typeof(feature_flags) = 'array'),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_academic_cycles (
  external_id text primary key,
  label text not null check (char_length(btrim(label)) between 2 and 160),
  academic_year integer not null check (academic_year between 2000 and 2200),
  term text not null check (char_length(btrim(term)) between 1 and 40),
  submission_open_at timestamptz not null,
  submission_close_at timestamptz not null,
  defense_start_at timestamptz not null,
  defense_end_at timestamptz not null,
  status text not null check (status in ('DRAFT','OPEN','CLOSED','ARCHIVED')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_academic_cycle_windows_check check (
    submission_open_at < submission_close_at
    and defense_start_at < defense_end_at
  )
);

create unique index if not exists portal_one_active_cycle_idx
  on public.portal_academic_cycles (active) where active;
create index if not exists portal_academic_cycles_window_idx
  on public.portal_academic_cycles (status, submission_open_at, submission_close_at);

alter table public.portal_processes
  add column if not exists academic_cycle_external_id text references public.portal_academic_cycles(external_id) on delete set null;
create index if not exists portal_processes_cycle_status_idx
  on public.portal_processes (academic_cycle_external_id, status, defense_at);

alter table public.portal_process_authors
  add column if not exists acceptance_status text not null default 'ACCEPTED'
    check (acceptance_status in ('NOT_REQUIRED','PENDING','ACCEPTED','REJECTED')),
  add column if not exists accepted_at timestamptz,
  add column if not exists rejected_at timestamptz;

alter table public.portal_signature_jobs
  add column if not exists signed_sha256 text check (signed_sha256 is null or signed_sha256 ~ '^[0-9a-f]{64}$'),
  add column if not exists verification_code text;
create unique index if not exists portal_signature_verification_code_idx
  on public.portal_signature_jobs (verification_code) where verification_code is not null;

create table if not exists public.portal_administration_transfers (
  external_id text primary key,
  role text not null check (role in ('MASTER_ADMIN','COMMISSION_PRESIDENT')),
  target_email text not null check (target_email = lower(btrim(target_email))),
  requested_by_email_hash text not null check (requested_by_email_hash ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('PENDING_TARGET_ACCEPTANCE','COMPLETED','CANCELED','EXPIRED')),
  requested_at timestamptz not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  canceled_at timestamptz,
  google_reconnect_required boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists portal_admin_transfers_pending_idx
  on public.portal_administration_transfers (target_email, expires_at)
  where status = 'PENDING_TARGET_ACCEPTANCE';

alter table public.portal_installation_config enable row level security;
alter table public.portal_academic_cycles enable row level security;
alter table public.portal_administration_transfers enable row level security;
alter table public.portal_installation_config force row level security;
alter table public.portal_academic_cycles force row level security;
alter table public.portal_administration_transfers force row level security;
revoke all on table public.portal_installation_config, public.portal_academic_cycles, public.portal_administration_transfers from public, anon, authenticated;
grant all on table public.portal_installation_config, public.portal_academic_cycles, public.portal_administration_transfers to service_role;

create or replace function public.portal_project_runtime_state_v4(next_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  settings_row jsonb := coalesce(next_payload->'settings', '{}'::jsonb);
  cycle_row jsonb;
  process_row jsonb;
  job_row jsonb;
  transfer_row jsonb;
  selected_process_id uuid;
begin
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

  for process_row in select value from jsonb_array_elements(coalesce(next_payload->'processes','[]'::jsonb)) loop
    select id into selected_process_id from public.portal_processes where external_id=process_row->>'id';
    if selected_process_id is null then continue; end if;
    update public.portal_processes set academic_cycle_external_id=nullif(process_row->>'academicCycleId','') where id=selected_process_id;
    update public.portal_process_authors a set
      acceptance_status=case when a.author_order=1 then 'ACCEPTED' else coalesce(process_row#>>'{coauthorAcceptance,status}','PENDING') end,
      accepted_at=case when a.author_order=2 and process_row#>>'{coauthorAcceptance,status}'='ACCEPTED' then nullif(process_row#>>'{coauthorAcceptance,respondedAt}','')::timestamptz else null end,
      rejected_at=case when a.author_order=2 and process_row#>>'{coauthorAcceptance,status}'='REJECTED' then nullif(process_row#>>'{coauthorAcceptance,respondedAt}','')::timestamptz else null end
    where a.process_id=selected_process_id;
  end loop;

  for job_row in select value from jsonb_array_elements(coalesce(next_payload->'signatureJobs','[]'::jsonb)) loop
    update public.portal_signature_jobs set
      signed_sha256=nullif(lower(job_row->>'signedSha256'),''),
      verification_code=nullif(job_row->>'verificationCode','')
    where external_id=job_row->>'id';
  end loop;

  for transfer_row in select value from jsonb_array_elements(coalesce(next_payload->'administrationTransfers','[]'::jsonb)) loop
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
  values('global','{}'::jsonb,0,now()) on conflict(id) do nothing;
  select revision into current_revision from public.portal_runtime_state where id='global' for update;
  if current_revision <> expected_revision then
    raise exception 'Conflito de concorrência: revisão atual %, revisão esperada %.', current_revision, expected_revision using errcode='40001';
  end if;
  perform public.portal_project_runtime_state(next_payload);
  perform public.portal_project_runtime_state_v4(next_payload);
  next_revision := current_revision + 1;
  update public.portal_runtime_state set payload=next_payload,revision=next_revision,updated_at=now() where id='global';
  insert into public.portal_runtime_commits(revision,payload_sha256)
  values(next_revision,encode(digest(next_payload::text,'sha256'),'hex'));
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
    'schema_version', 4,
    'transactional_runtime', true,
    'optimistic_concurrency', true,
    'normalized_core_projection', true,
    'academic_governance', true,
    'document_authenticity', true,
    'binary_storage', 'GOOGLE_DRIVE'
  );
$$;

revoke all on function public.portal_project_runtime_state_v4(jsonb) from public, anon, authenticated;
revoke all on function public.portal_commit_runtime_state(bigint,jsonb) from public, anon, authenticated;
revoke all on function public.portal_runtime_capabilities() from public, anon, authenticated;
grant execute on function public.portal_project_runtime_state_v4(jsonb) to service_role;
grant execute on function public.portal_commit_runtime_state(bigint,jsonb) to service_role;
grant execute on function public.portal_runtime_capabilities() to service_role;

commit;
