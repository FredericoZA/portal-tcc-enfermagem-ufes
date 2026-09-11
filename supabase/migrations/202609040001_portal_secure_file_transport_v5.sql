begin;

-- O Google Drive permanece como repositório definitivo. Este bucket privado é
-- usado somente para: (a) receber binários diretamente do navegador antes da
-- validação/arquivamento no Drive; e (b) entregar downloads grandes por URL
-- assinada de vida curta, sem transportar o binário na resposta da Function.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portal-secure-transfer',
  'portal-secure-transfer',
  false,
  115343360,
  array[
    'application/pdf',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.portal_upload_staging (
  id uuid primary key,
  purpose text not null check (purpose in (
    'DOCUMENT_MODEL',
    'PROCESS_FULL_WORK',
    'PROCESS_EXPANDED_ABSTRACT',
    'VERIFICATION_PDF'
  )),
  requester_hash text not null check (requester_hash ~ '^[0-9a-f]{64}$'),
  process_external_id text,
  verification_code_hash text check (
    verification_code_hash is null or verification_code_hash ~ '^[0-9a-f]{64}$'
  ),
  object_path text not null unique check (object_path like 'pending/%'),
  original_file_name text not null check (char_length(original_file_name) between 1 and 240),
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  expected_size bigint not null check (expected_size between 1 and 52428800),
  expected_sha256 text not null check (expected_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null check (status in (
    'PENDING','CONSUMING','CONSUMED','CLEANUP_PENDING','REJECTED','EXPIRED'
  )),
  error_code text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_upload_staging_cleanup_idx
  on public.portal_upload_staging (status, expires_at);
create index if not exists portal_upload_staging_process_idx
  on public.portal_upload_staging (process_external_id, created_at desc)
  where process_external_id is not null;

create table if not exists public.portal_download_transfers (
  id uuid primary key,
  object_path text not null unique check (object_path like 'downloads/%'),
  file_name text not null check (char_length(file_name) between 1 and 180),
  mime_type text not null check (mime_type in ('application/pdf','application/zip')),
  size_bytes bigint not null check (size_bytes between 1 and 115343360),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  requester_hash text not null check (requester_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','EXPIRED')),
  expires_at timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists portal_download_transfers_cleanup_idx
  on public.portal_download_transfers (status, expires_at);

-- Nenhum cliente acessa as tabelas de controle nem o bucket com uma chave
-- pública. O servidor usa exclusivamente a secret/service role e entrega
-- apenas URLs assinadas específicas e temporárias.
alter table public.portal_upload_staging enable row level security;
alter table public.portal_download_transfers enable row level security;
alter table public.portal_upload_staging force row level security;
alter table public.portal_download_transfers force row level security;
revoke all on table public.portal_upload_staging, public.portal_download_transfers
  from public, anon, authenticated;
grant all on table public.portal_upload_staging, public.portal_download_transfers
  to service_role;

create or replace function public.portal_runtime_capabilities()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select jsonb_build_object(
    'schema_version', 5,
    'transactional_runtime', true,
    'optimistic_concurrency', true,
    'normalized_core_projection', true,
    'academic_governance', true,
    'document_authenticity', true,
    'binary_storage', 'GOOGLE_DRIVE',
    'secure_file_transport', 'SUPABASE_PRIVATE_STORAGE'
  );
$$;

revoke all on function public.portal_runtime_capabilities() from public, anon, authenticated;
grant execute on function public.portal_runtime_capabilities() to service_role;

commit;
