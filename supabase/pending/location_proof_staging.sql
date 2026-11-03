-- Pending next authorized release. CLI migration creation was killed by the local host.
-- Preserve private storage policies and all existing upload purposes.
begin;
set local lock_timeout = '5s';
alter table public.portal_upload_staging drop constraint portal_upload_staging_purpose_check;
alter table public.portal_upload_staging add constraint portal_upload_staging_purpose_check check (purpose in ('DOCUMENT_MODEL','PROCESS_FULL_WORK','PROCESS_EXPANDED_ABSTRACT','VERIFICATION_PDF','GOV_BR_SIGNED_PDF','LOCATION_PROOF'));
commit;
