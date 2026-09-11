-- Índices de suporte às chaves estrangeiras identificadas pelo advisor de performance do Supabase.
-- Migração aditiva e idempotente; não altera dados nem regras de negócio.

create index if not exists portal_access_entries_granted_by_idx
  on public.portal_access_entries (granted_by);

create index if not exists portal_access_entries_revoked_by_idx
  on public.portal_access_entries (revoked_by);

create index if not exists portal_access_entries_user_id_idx
  on public.portal_access_entries (user_id);

create index if not exists portal_email_deliveries_workflow_run_id_idx
  on public.portal_email_deliveries (workflow_run_id);

create index if not exists portal_files_created_by_idx
  on public.portal_files (created_by);

create index if not exists portal_publications_authorization_signature_job_id_idx
  on public.portal_publications (authorization_signature_job_id);

create index if not exists portal_publications_expanded_abstract_file_id_idx
  on public.portal_publications (expanded_abstract_file_id);

create index if not exists portal_publications_full_work_file_id_idx
  on public.portal_publications (full_work_file_id);

create index if not exists portal_publications_requested_by_idx
  on public.portal_publications (requested_by);

create index if not exists portal_publications_withdrawn_by_idx
  on public.portal_publications (withdrawn_by);

create index if not exists portal_signature_jobs_requested_by_idx
  on public.portal_signature_jobs (requested_by);

create index if not exists portal_signature_jobs_signed_file_id_idx
  on public.portal_signature_jobs (signed_file_id);

create index if not exists portal_signature_jobs_source_file_id_idx
  on public.portal_signature_jobs (source_file_id);

create index if not exists portal_signature_signers_user_id_idx
  on public.portal_signature_signers (user_id);

create index if not exists portal_workflow_runs_started_by_idx
  on public.portal_workflow_runs (started_by);
