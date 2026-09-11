-- Referência revisável; não é uma migração aplicada.
-- Depois de vincular o projeto, crie a migração com:
--   supabase migration new portal_runtime_state
-- e copie este conteúdo para o arquivo gerado pela CLI.

create table if not exists public.portal_runtime_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.portal_runtime_state enable row level security;
alter table public.portal_runtime_state force row level security;

revoke all on table public.portal_runtime_state from anon, authenticated;
grant all on table public.portal_runtime_state to service_role;

comment on table public.portal_runtime_state is
  'Estado operacional privado do Portal TCC. Acesso exclusivo do backend com chave secreta.';

