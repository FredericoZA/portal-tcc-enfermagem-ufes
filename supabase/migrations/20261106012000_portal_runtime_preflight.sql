begin;

create or replace function public.portal_check_runtime_v1()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  normalized_tables_ready boolean;
begin
  perform id from public.portal_runtime_state limit 1;

  select bool_and(coalesce(has_table_privilege(to_regclass('public.' || table_name), 'SELECT'), false))
    into normalized_tables_ready
    from unnest(array[
      'portal_users', 'portal_processes', 'portal_process_authors', 'portal_process_memberships',
      'portal_access_entries', 'portal_access_sources', 'portal_files', 'portal_signature_jobs',
      'portal_signature_signers', 'portal_publications', 'portal_email_deliveries', 'portal_workflow_runs',
      'portal_audit_events', 'portal_runtime_commits', 'portal_installation_config', 'portal_academic_cycles',
      'portal_administration_transfers', 'portal_upload_staging', 'portal_download_transfers',
      'portal_asten_dispatch_claims'
    ]) as required(table_name);

  return public.portal_runtime_capabilities()
    || jsonb_build_object('normalized_tables_ready', normalized_tables_ready);
end;
$$;

revoke all on function public.portal_check_runtime_v1() from public, anon, authenticated;
grant execute on function public.portal_check_runtime_v1() to service_role;

commit;
