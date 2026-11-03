-- Gov.br returns use the same private, session-bound staging transport as other PDFs.
-- Add the new purpose without changing RLS, grants, quotas, MIME or size checks.
begin;
set local lock_timeout = '5s';
alter table public.portal_upload_staging
  drop constraint portal_upload_staging_purpose_check;
alter table public.portal_upload_staging
  add constraint portal_upload_staging_purpose_check check (purpose in (
    'DOCUMENT_MODEL',
    'PROCESS_FULL_WORK',
    'PROCESS_EXPANDED_ABSTRACT',
    'VERIFICATION_PDF',
    'GOV_BR_SIGNED_PDF'
  ));
commit;
