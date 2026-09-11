create or replace function public.portal_authorize_process_user()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  selected_user_id uuid;
  selected_process_id uuid;
  selected_email text;
begin
  selected_user_id := new.user_id;
  selected_process_id := new.process_id;

  select lower(email) into strict selected_email
  from public.portal_users
  where id = selected_user_id and status = 'ACTIVE';

  insert into public.portal_access_entries (
    email, user_id, source, source_process_id, active, granted_at,
    manual_revocation, revoked_by, revoked_at, updated_at
  ) values (
    selected_email, selected_user_id, 'PROCESS_PARTICIPANT', selected_process_id,
    true, now(), false, null, null, now()
  )
  on conflict (email) do update
  set user_id = excluded.user_id,
      updated_at = now(),
      source_process_id = coalesce(portal_access_entries.source_process_id, excluded.source_process_id);

  insert into public.portal_access_sources (access_entry_id, process_id, process_role, active, updated_at)
  select access.id, selected_process_id,
    case when tg_table_name = 'portal_process_authors' then 'STUDENT' else to_jsonb(new)->>'process_role' end,
    true, now()
  from public.portal_access_entries access
  where access.email = selected_email
  on conflict (access_entry_id, process_id, process_role) do update
  set active = true, updated_at = now();

  return new;
end;
$$;
