begin;

create table if not exists public.portal_runtime_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_integration_secrets (
  provider text primary key check (provider ~ '^[a-z0-9_-]{2,40}$'),
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_otp_challenges (
  id text primary key,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  max_attempts integer not null default 5 check (max_attempts between 1 and 5),
  consumed_at timestamptz,
  requested_ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists portal_otp_email_created_idx
  on public.portal_otp_challenges (email, created_at desc);
create index if not exists portal_otp_expiry_idx
  on public.portal_otp_challenges (expires_at)
  where consumed_at is null;
create index if not exists portal_otp_ip_created_idx
  on public.portal_otp_challenges (requested_ip_hash, created_at desc)
  where requested_ip_hash is not null;

alter table public.portal_runtime_state enable row level security;
alter table public.portal_runtime_state force row level security;
alter table public.portal_integration_secrets enable row level security;
alter table public.portal_integration_secrets force row level security;
alter table public.portal_otp_challenges enable row level security;
alter table public.portal_otp_challenges force row level security;

revoke all on table public.portal_runtime_state from anon, authenticated;
revoke all on table public.portal_integration_secrets from anon, authenticated;
revoke all on table public.portal_otp_challenges from anon, authenticated;
grant all on table public.portal_runtime_state to service_role;
grant all on table public.portal_integration_secrets to service_role;
grant all on table public.portal_otp_challenges to service_role;

comment on table public.portal_integration_secrets is 'Credenciais cifradas AES-256-GCM; descriptografia somente pelo backend.';
comment on table public.portal_otp_challenges is 'Códigos de acesso de uso único armazenados exclusivamente como HMAC.';

commit;
