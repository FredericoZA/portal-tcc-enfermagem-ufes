begin;
-- Physical storage only: preserve the canonical JSONB, revision, commit hashes,
-- triggers, projections, ACL and RLS. Existing rows are not rewritten here.
set local lock_timeout = '2s';
set local statement_timeout = '5s';
do $$
begin
  if exists (
    select 1 from pg_settings
    where name = 'default_toast_compression' and 'lz4' = any(enumvals)
  ) then
    alter table public.portal_runtime_state alter column payload set compression lz4;
  else
    -- PostgreSQL builds without LZ4 retain their supported storage codec.
    raise notice 'LZ4 unavailable; retaining the existing payload compression.';
  end if;
end;
$$;
commit;
