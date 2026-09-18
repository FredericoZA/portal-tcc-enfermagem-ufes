-- v10: separa ativos visuais pesados do estado operacional agregado.
-- O objetivo é impedir que imagens em data URI sejam duplicadas em settings/auditoria
-- e transportadas em todo cold start da aplicação.

create table if not exists public.portal_runtime_assets (
  asset_key text primary key,
  mime_type text not null,
  data_url text not null,
  byte_length bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_runtime_assets_key_format check (asset_key ~ '^[a-f0-9]{64}$'),
  constraint portal_runtime_assets_mime_image check (mime_type like 'image/%'),
  constraint portal_runtime_assets_data_url_image check (data_url like 'data:image/%;base64,%'),
  constraint portal_runtime_assets_byte_length_nonnegative check (byte_length >= 0)
);

alter table public.portal_runtime_assets enable row level security;
revoke all on table public.portal_runtime_assets from anon, authenticated;
grant select, insert, update, delete on table public.portal_runtime_assets to service_role;

create table if not exists public.portal_runtime_state_backups (
  backup_id bigint generated always as identity primary key,
  state_id text not null,
  revision bigint not null,
  payload jsonb not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.portal_runtime_state_backups enable row level security;
revoke all on table public.portal_runtime_state_backups from anon, authenticated;
grant select, insert, delete on table public.portal_runtime_state_backups to service_role;

comment on table public.portal_runtime_assets is 'Ativos visuais pesados externalizados do portal_runtime_state; acesso somente pelo backend.';
comment on table public.portal_runtime_state_backups is 'Backups explícitos do agregado antes de manutenções controladas.';
