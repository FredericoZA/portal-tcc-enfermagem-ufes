begin;

-- O backend e o banco usam UUIDs aleatórios. Nenhuma extensão é fixada em uma
-- versão específica para manter compatibilidade com a política atual do Supabase.
create extension if not exists pgcrypto;

create table if not exists public.portal_users (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 200),
  institutional_registration text,
  global_role text check (global_role is null or global_role in ('MASTER_ADMIN', 'COMMISSION_PRESIDENT')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'REVOKED', 'ANONYMIZED')),
  last_authenticated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  anonymized_at timestamptz
);

create unique index if not exists portal_users_email_unique_idx
  on public.portal_users (lower(email))
  where status <> 'ANONYMIZED';
create index if not exists portal_users_role_status_idx
  on public.portal_users (global_role, status)
  where global_role is not null;

create table if not exists public.portal_processes (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9._/-]{2,79}$'),
  title text not null check (char_length(btrim(title)) between 3 and 500),
  degree_level text not null default 'GRADUACAO' check (degree_level = 'GRADUACAO'),
  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'AWAITING_LOCATION', 'SCHEDULED', 'AWAITING_EVALUATION',
    'AWAITING_FINAL_DATA', 'AWAITING_SIGNATURES', 'COMPLETED', 'CANCELLED'
  )),
  defense_at timestamptz,
  defense_location text,
  created_by uuid not null references public.portal_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  constraint portal_process_completion_dates_check check (
    (status = 'COMPLETED' and completed_at is not null)
    or (status <> 'COMPLETED')
  )
);

create index if not exists portal_processes_status_defense_idx
  on public.portal_processes (status, defense_at);
create index if not exists portal_processes_created_by_idx
  on public.portal_processes (created_by, created_at desc);

-- A restrição parcial impede que a mesma pessoa seja autora de dois TCCs de
-- graduação. Ela não impede que essa pessoa participe de outros processos.
create table if not exists public.portal_process_authors (
  process_id uuid not null references public.portal_processes(id) on delete restrict,
  user_id uuid not null references public.portal_users(id) on delete restrict,
  author_order smallint not null default 1 check (author_order between 1 and 10),
  degree_level text not null default 'GRADUACAO' check (degree_level = 'GRADUACAO'),
  created_at timestamptz not null default now(),
  primary key (process_id, user_id),
  unique (process_id, author_order)
);

create unique index if not exists portal_one_graduation_tcc_per_author_idx
  on public.portal_process_authors (user_id)
  where degree_level = 'GRADUACAO';

create table if not exists public.portal_process_memberships (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.portal_processes(id) on delete cascade,
  user_id uuid not null references public.portal_users(id) on delete restrict,
  process_role text not null check (process_role in (
    'ADVISOR', 'CO_ADVISOR', 'EXAMINER', 'EXTERNAL_MEMBER', 'COMMISSION_PRESIDENT'
  )),
  institution text,
  created_at timestamptz not null default now(),
  unique (process_id, user_id, process_role)
);

create index if not exists portal_memberships_user_process_idx
  on public.portal_process_memberships (user_id, process_id);
create index if not exists portal_memberships_process_role_idx
  on public.portal_process_memberships (process_id, process_role);

create table if not exists public.portal_access_entries (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email))),
  user_id uuid references public.portal_users(id) on delete set null,
  source text not null check (source in ('PREAUTHORIZED_STUDENT', 'PROCESS_PARTICIPANT', 'ADMINISTRATOR')),
  source_process_id uuid references public.portal_processes(id) on delete set null,
  active boolean not null default true,
  manual_revocation boolean not null default false,
  granted_by uuid references public.portal_users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.portal_users(id) on delete set null,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint portal_access_revocation_check check (
    (active and revoked_at is null) or (not active and revoked_at is not null)
  )
);

-- Uma pessoa pode participar de vários TCCs. As fontes ficam separadas da
-- decisão administrativa principal; revogação manual nunca é desfeita por um
-- novo vínculo de processo sem ação explícita do Master ou Presidente.
create table if not exists public.portal_access_sources (
  id uuid primary key default gen_random_uuid(),
  access_entry_id uuid not null references public.portal_access_entries(id) on delete cascade,
  process_id uuid references public.portal_processes(id) on delete cascade,
  process_role text not null check (process_role in ('STUDENT','ADVISOR','CO_ADVISOR','EXAMINER')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (access_entry_id, process_id, process_role)
);

create index if not exists portal_access_sources_process_idx
  on public.portal_access_sources (process_id, process_role)
  where active;

create index if not exists portal_access_active_email_idx
  on public.portal_access_entries (lower(email))
  where active;
create index if not exists portal_access_process_idx
  on public.portal_access_entries (source_process_id)
  where source_process_id is not null;

create table if not exists public.portal_files (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  process_id uuid not null references public.portal_processes(id) on delete restrict,
  file_kind text not null check (file_kind in (
    'FORM_INITIAL', 'FORM_LOCATION', 'FORM_EVALUATION', 'FORM_FINAL',
    'FULL_WORK', 'EXPANDED_ABSTRACT', 'INVITATION', 'DEFENSE_MINUTES',
    'PUBLICATION_AUTHORIZATION', 'COMMITTEE_DECLARATION', 'ASTEN_RECEIPT'
  )),
  lifecycle text not null default 'GENERATED' check (lifecycle in ('MODEL', 'GENERATED', 'SIGNED', 'SUPERSEDED', 'DELETED')),
  drive_file_id text not null,
  drive_parent_id text,
  file_name text not null,
  mime_type text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint check (byte_size is null or byte_size >= 0),
  version integer not null default 1 check (version > 0),
  visibility text not null default 'PRIVATE' check (visibility in ('PRIVATE', 'PUBLIC_PORTAL')),
  created_by uuid references public.portal_users(id) on delete set null,
  created_at timestamptz not null default now(),
  superseded_at timestamptz,
  unique (drive_file_id),
  unique (process_id, file_kind, version)
);

create index if not exists portal_files_process_kind_idx
  on public.portal_files (process_id, file_kind, version desc);
create index if not exists portal_files_public_idx
  on public.portal_files (process_id, file_kind)
  where visibility = 'PUBLIC_PORTAL' and lifecycle <> 'DELETED';
create index if not exists portal_files_hash_idx
  on public.portal_files (sha256);

create table if not exists public.portal_signature_jobs (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  process_id uuid not null references public.portal_processes(id) on delete restrict,
  document_type text not null check (document_type in ('DEFENSE_MINUTES', 'PUBLICATION_AUTHORIZATION', 'COMMITTEE_DECLARATION')),
  source_file_id uuid not null references public.portal_files(id) on delete restrict,
  signed_file_id uuid references public.portal_files(id) on delete restrict,
  provider text not null default 'ASTEN' check (provider = 'ASTEN'),
  provider_envelope_id text,
  idempotency_key text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'PENDING' check (status in (
    'PENDING', 'SUBMITTING', 'SENT', 'PARTIALLY_SIGNED', 'SIGNED', 'FAILED', 'CANCELLED'
  )),
  requested_by uuid not null references public.portal_users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  unique (idempotency_key),
  unique (process_id, document_type, version)
);

create unique index if not exists portal_signature_provider_envelope_idx
  on public.portal_signature_jobs (provider, provider_envelope_id)
  where provider_envelope_id is not null;
create index if not exists portal_signature_status_retry_idx
  on public.portal_signature_jobs (status, last_error_at)
  where status in ('PENDING', 'FAILED');

create table if not exists public.portal_signature_signers (
  id uuid primary key default gen_random_uuid(),
  signature_job_id uuid not null references public.portal_signature_jobs(id) on delete cascade,
  user_id uuid references public.portal_users(id) on delete set null,
  signer_name text not null,
  signer_email text not null check (signer_email = lower(btrim(signer_email))),
  signer_role text not null check (signer_role in ('STUDENT', 'ADVISOR', 'COMMISSION_PRESIDENT')),
  signing_priority smallint not null default 1 check (signing_priority between 1 and 50),
  provider_signer_id text,
  status text not null default 'PENDING' check (status in ('PENDING', 'NOTIFIED', 'SIGNED', 'REFUSED', 'FAILED')),
  signed_at timestamptz,
  unique (signature_job_id, signer_email, signer_role)
);

create index if not exists portal_signature_signers_pending_idx
  on public.portal_signature_signers (signature_job_id, signing_priority, status);

create table if not exists public.portal_publications (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null unique references public.portal_processes(id) on delete restrict,
  publish_full_work boolean not null default false,
  publish_expanded_abstract boolean not null default false,
  full_work_file_id uuid references public.portal_files(id) on delete restrict,
  expanded_abstract_file_id uuid references public.portal_files(id) on delete restrict,
  authorization_signature_job_id uuid references public.portal_signature_jobs(id) on delete restrict,
  status text not null default 'PRIVATE' check (status in ('PRIVATE', 'PENDING_AUTHORIZATION', 'PUBLISHED', 'WITHDRAWN')),
  requested_by uuid not null references public.portal_users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  published_at timestamptz,
  withdrawn_at timestamptz,
  withdrawn_by uuid references public.portal_users(id) on delete set null,
  withdrawal_reason text,
  updated_at timestamptz not null default now(),
  constraint portal_publication_selection_check check (
    (not publish_full_work or full_work_file_id is not null)
    and (not publish_expanded_abstract or expanded_abstract_file_id is not null)
  ),
  constraint portal_publication_authorization_check check (
    status in ('PRIVATE', 'PENDING_AUTHORIZATION')
    or authorization_signature_job_id is not null
  ),
  constraint portal_publication_dates_check check (
    (status <> 'PUBLISHED' or published_at is not null)
    and (status <> 'WITHDRAWN' or withdrawn_at is not null)
  )
);

create index if not exists portal_publications_public_idx
  on public.portal_publications (published_at desc)
  where status = 'PUBLISHED';

create table if not exists public.portal_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  process_id uuid references public.portal_processes(id) on delete set null,
  workflow_run_id uuid,
  message_type text not null,
  recipient_email text not null check (recipient_email = lower(btrim(recipient_email))),
  provider text not null default 'GMAIL' check (provider = 'GMAIL'),
  provider_message_id text,
  idempotency_key text not null unique,
  status text not null default 'QUEUED' check (status in ('QUEUED', 'SENDING', 'ACCEPTED_BY_PROVIDER', 'FAILED', 'CANCELLED')),
  attempts smallint not null default 0 check (attempts between 0 and 20),
  next_attempt_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_email_retry_idx
  on public.portal_email_deliveries (next_attempt_at, created_at)
  where status in ('QUEUED', 'FAILED');
create index if not exists portal_email_process_idx
  on public.portal_email_deliveries (process_id, created_at desc);

create table if not exists public.portal_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  process_id uuid not null references public.portal_processes(id) on delete restrict,
  workflow_key text not null,
  workflow_version integer not null check (workflow_version > 0),
  current_stage text not null,
  status text not null default 'RUNNING' check (status in ('RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  context jsonb not null default '{}'::jsonb,
  started_by uuid references public.portal_users(id) on delete set null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (process_id, workflow_key, workflow_version)
);

alter table public.portal_email_deliveries
  add constraint portal_email_workflow_run_fk
  foreign key (workflow_run_id) references public.portal_workflow_runs(id) on delete set null;

create index if not exists portal_workflow_active_idx
  on public.portal_workflow_runs (process_id, status, updated_at desc)
  where status in ('RUNNING', 'WAITING', 'FAILED');

create table if not exists public.portal_audit_events (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references public.portal_users(id) on delete set null,
  actor_email_hash text check (actor_email_hash is null or actor_email_hash ~ '^[0-9a-f]{64}$'),
  process_id uuid references public.portal_processes(id) on delete set null,
  process_code text,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  request_id text,
  ip_hash text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  details jsonb not null default '{}'::jsonb,
  retention_until date not null default ((now() + interval '2 years')::date),
  constraint portal_audit_details_object_check check (jsonb_typeof(details) = 'object')
);

create index if not exists portal_audit_process_time_idx
  on public.portal_audit_events (process_id, occurred_at desc);
create index if not exists portal_audit_process_code_idx
  on public.portal_audit_events (process_code, occurred_at desc)
  where process_code is not null;
create index if not exists portal_audit_actor_time_idx
  on public.portal_audit_events (actor_user_id, occurred_at desc)
  where actor_user_id is not null;
create index if not exists portal_audit_event_type_time_idx
  on public.portal_audit_events (event_type, occurred_at desc);
create index if not exists portal_audit_retention_idx
  on public.portal_audit_events (retention_until);
create index if not exists portal_audit_details_gin_idx
  on public.portal_audit_events using gin (details jsonb_path_ops);

-- Inserir um autor ou participante libera o seu e-mail para autenticação por
-- código. A função usa os direitos do chamador e não contorna RLS.
create or replace function public.portal_authorize_process_user()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  selected_user_id uuid;
  selected_process_id uuid;
  selected_email text;
begin
  selected_user_id := new.user_id;
  selected_process_id := new.process_id;

  select lower(email) into strict selected_email
  from public.portal_users
  where id = selected_user_id and status = 'ACTIVE';

  insert into public.portal_access_entries (
    email, user_id, source, source_process_id, active, granted_at,
    manual_revocation, revoked_by, revoked_at, updated_at
  ) values (
    selected_email, selected_user_id, 'PROCESS_PARTICIPANT', selected_process_id,
    true, now(), false, null, null, now()
  )
  on conflict (email) do update
  set user_id = excluded.user_id,
      updated_at = now(),
      source_process_id = coalesce(portal_access_entries.source_process_id, excluded.source_process_id);

  insert into public.portal_access_sources (access_entry_id, process_id, process_role, active, updated_at)
  select access.id, selected_process_id,
    case when tg_table_name = 'portal_process_authors' then 'STUDENT' else new.process_role end,
    true, now()
  from public.portal_access_entries access
  where access.email = selected_email
  on conflict (access_entry_id, process_id, process_role) do update
  set active = true, updated_at = now();

  return new;
end;
$$;

create or replace function public.portal_reject_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  raise exception 'portal_audit_events is append-only';
end;
$$;

drop trigger if exists portal_authorize_process_author on public.portal_process_authors;
create trigger portal_authorize_process_author
after insert on public.portal_process_authors
for each row execute function public.portal_authorize_process_user();

drop trigger if exists portal_authorize_process_member on public.portal_process_memberships;
create trigger portal_authorize_process_member
after insert on public.portal_process_memberships
for each row execute function public.portal_authorize_process_user();

drop trigger if exists portal_audit_append_only on public.portal_audit_events;
create trigger portal_audit_append_only
before update or delete on public.portal_audit_events
for each row execute function public.portal_reject_audit_mutation();

-- Todas as tabelas permanecem inacessíveis para os clientes. A aplicação deve
-- usar a service role somente no backend, depois de autenticar e autorizar o
-- usuário. O Drive, e não o Supabase Storage, guarda os documentos binários.
alter table public.portal_users enable row level security;
alter table public.portal_users force row level security;
alter table public.portal_processes enable row level security;
alter table public.portal_processes force row level security;
alter table public.portal_process_authors enable row level security;
alter table public.portal_process_authors force row level security;
alter table public.portal_process_memberships enable row level security;
alter table public.portal_process_memberships force row level security;
alter table public.portal_access_entries enable row level security;
alter table public.portal_access_entries force row level security;
alter table public.portal_access_sources enable row level security;
alter table public.portal_access_sources force row level security;
alter table public.portal_files enable row level security;
alter table public.portal_files force row level security;
alter table public.portal_signature_jobs enable row level security;
alter table public.portal_signature_jobs force row level security;
alter table public.portal_signature_signers enable row level security;
alter table public.portal_signature_signers force row level security;
alter table public.portal_publications enable row level security;
alter table public.portal_publications force row level security;
alter table public.portal_email_deliveries enable row level security;
alter table public.portal_email_deliveries force row level security;
alter table public.portal_workflow_runs enable row level security;
alter table public.portal_workflow_runs force row level security;
alter table public.portal_audit_events enable row level security;
alter table public.portal_audit_events force row level security;

revoke all on table public.portal_users from public, anon, authenticated;
revoke all on table public.portal_processes from public, anon, authenticated;
revoke all on table public.portal_process_authors from public, anon, authenticated;
revoke all on table public.portal_process_memberships from public, anon, authenticated;
revoke all on table public.portal_access_entries from public, anon, authenticated;
revoke all on table public.portal_access_sources from public, anon, authenticated;
revoke all on table public.portal_files from public, anon, authenticated;
revoke all on table public.portal_signature_jobs from public, anon, authenticated;
revoke all on table public.portal_signature_signers from public, anon, authenticated;
revoke all on table public.portal_publications from public, anon, authenticated;
revoke all on table public.portal_email_deliveries from public, anon, authenticated;
revoke all on table public.portal_workflow_runs from public, anon, authenticated;
revoke all on table public.portal_audit_events from public, anon, authenticated;

grant all on table public.portal_users to service_role;
grant all on table public.portal_processes to service_role;
grant all on table public.portal_process_authors to service_role;
grant all on table public.portal_process_memberships to service_role;
grant all on table public.portal_access_entries to service_role;
grant all on table public.portal_access_sources to service_role;
grant all on table public.portal_files to service_role;
grant all on table public.portal_signature_jobs to service_role;
grant all on table public.portal_signature_signers to service_role;
grant all on table public.portal_publications to service_role;
grant all on table public.portal_email_deliveries to service_role;
grant all on table public.portal_workflow_runs to service_role;
grant all on table public.portal_audit_events to service_role;

revoke all on function public.portal_authorize_process_user() from public, anon, authenticated;
revoke all on function public.portal_reject_audit_mutation() from public, anon, authenticated;
grant execute on function public.portal_authorize_process_user() to service_role;
grant execute on function public.portal_reject_audit_mutation() to service_role;

comment on table public.portal_users is 'Identidades do portal. Papéis administrativos globais permitidos: Master e Presidente da Comissão.';
comment on table public.portal_process_authors is 'Autoria de TCC; índice único garante no máximo um TCC de graduação por pessoa.';
comment on table public.portal_process_memberships is 'Participações por processo sem limite global: orientador, coorientador, examinador ou presidente.';
comment on table public.portal_files is 'Metadados e hashes; o conteúdo binário permanece no Google Drive privado do Master.';
comment on table public.portal_audit_events is 'Trilha append-only. Não armazenar segredos, conteúdo integral de documentos ou dados pessoais desnecessários em details.';

commit;
