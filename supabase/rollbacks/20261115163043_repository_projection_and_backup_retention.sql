begin;
drop function if exists public.portal_read_repository_v1();
drop function if exists public.portal_list_retirable_backups_v1();
drop function if exists public.portal_finalize_backup_archive_v1(bigint,text,text,text,text);
-- Deliberately retain portal_backup_archives and all encrypted Drive copies.
-- A rollback never removes restoration evidence or recreates deleted backups silently.
commit;
