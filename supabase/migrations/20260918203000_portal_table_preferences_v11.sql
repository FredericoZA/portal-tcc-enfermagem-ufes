-- v11: preferências de exibição das planilhas por usuário e padrão global do Master.
create table if not exists public.portal_table_preferences (
  table_key text not null,
  preference_scope text not null check (preference_scope in ('USER','DEFAULT')),
  owner_email text not null,
  config jsonb not null default '{}'::jsonb,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  primary key (table_key, preference_scope, owner_email),
  constraint portal_table_preferences_table_key check (table_key ~ '^[a-z0-9_-]{1,80}$'),
  constraint portal_table_preferences_owner check (length(owner_email) between 1 and 320),
  constraint portal_table_preferences_config_object check (jsonb_typeof(config) = 'object')
);

alter table public.portal_table_preferences enable row level security;
revoke all on table public.portal_table_preferences from anon, authenticated;
grant select, insert, update, delete on table public.portal_table_preferences to service_role;

create index if not exists portal_table_preferences_updated_idx
  on public.portal_table_preferences(updated_at desc);

comment on table public.portal_table_preferences is
  'Preferências duráveis de colunas, ordem, paginação e período; USER sobrescreve DEFAULT do Master.';
