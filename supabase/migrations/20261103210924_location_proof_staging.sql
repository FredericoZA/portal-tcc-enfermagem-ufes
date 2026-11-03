-- Applied through Supabase migration API on 2026-11-03; version read back from migration history.
-- Add only the missing reservation-proof purpose to the existing private staging.
-- Preserve RLS, grants, MIME/size constraints and every previously allowed purpose.
begin;
set local lock_timeout = '5s';
alter table public.portal_upload_staging drop constraint portal_upload_staging_purpose_check;
alter table public.portal_upload_staging add constraint portal_upload_staging_purpose_check check (purpose in ('DOCUMENT_MODEL','PROCESS_FULL_WORK','PROCESS_EXPANDED_ABSTRACT','VERIFICATION_PDF','GOV_BR_SIGNED_PDF','LOCATION_PROOF'));
commit;
