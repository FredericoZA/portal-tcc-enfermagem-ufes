-- Mantém tabelas operacionais exclusivamente acessíveis pelo backend.
-- Esta migração já foi aplicada em produção antes de ser registrada no repositório.

alter table public.portal_runtime_assets force row level security;
alter table public.portal_runtime_state_backups force row level security;
alter table public.portal_table_preferences force row level security;

create policy portal_backend_only on public.portal_runtime_assets
for all to anon, authenticated
using (false)
with check (false);

create policy portal_backend_only on public.portal_runtime_state_backups
for all to anon, authenticated
using (false)
with check (false);

create policy portal_backend_only on public.portal_table_preferences
for all to anon, authenticated
using (false)
with check (false);
