-- Applied through Supabase migration API on 2026-11-03; version read back from migration history.
-- Add metadata without removing any legacy bytes; deploy readers before backfill.
begin;

alter table public.portal_runtime_assets
  alter column data_url drop not null,
  add column if not exists drive_file_id text,
  add column if not exists content_sha256 text;
alter table public.portal_runtime_assets drop constraint if exists portal_runtime_assets_drive_reference;
alter table public.portal_runtime_assets add constraint portal_runtime_assets_drive_reference check (
  (drive_file_id is null and content_sha256 is null)
  or (drive_file_id is not null and content_sha256 is not null and drive_file_id ~ '^[a-zA-Z0-9_-]{10,}$' and content_sha256 ~ '^[a-f0-9]{64}$')
);
alter table public.portal_runtime_assets drop constraint if exists portal_runtime_assets_has_content;
alter table public.portal_runtime_assets add constraint portal_runtime_assets_has_content check (
  data_url is not null or (drive_file_id is not null and content_sha256 is not null)
);

alter table public.portal_feedback
  add column if not exists image_drive_file_id text,
  add column if not exists image_sha256 text;
alter table public.portal_feedback drop constraint if exists portal_feedback_image_integrity;
alter table public.portal_feedback add constraint portal_feedback_image_integrity check (
  (image_mime is null and image_base64 is null and image_size is null and image_drive_file_id is null and image_sha256 is null)
  or (
    image_mime is not null and image_size is not null
    and (image_base64 is not null or (image_drive_file_id is not null and image_sha256 is not null))
    and ((image_drive_file_id is null and image_sha256 is null) or (image_drive_file_id is not null and image_sha256 is not null and image_drive_file_id ~ '^[a-zA-Z0-9_-]{10,}$' and image_sha256 ~ '^[a-f0-9]{64}$'))
  )
);

-- These remain backend-only. No browser-facing grants or policies are added.
revoke all on public.portal_runtime_assets,public.portal_feedback from public,anon,authenticated;
alter table public.portal_runtime_assets enable row level security;
alter table public.portal_runtime_assets force row level security;
alter table public.portal_feedback enable row level security;
alter table public.portal_feedback force row level security;
comment on column public.portal_runtime_assets.data_url is 'Legacy rollback copy only. New writes archive bytes in private Drive; clear only after verified backfill.';
comment on column public.portal_runtime_assets.drive_file_id is 'Private Drive archive reference. Never exposed through the public image route.';
comment on column public.portal_feedback.image_drive_file_id is 'Private screenshot archive in Drive. Read only through the Master-authorized API.';
commit;
