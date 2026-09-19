-- Corrige ambiguidade PL/pgSQL revelada ao projetar o primeiro conjunto real de processos.
create or replace function public.portal_project_publications_v8(next_payload jsonb)
returns void
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  process_row jsonb;
  selected_process_id uuid;
  selected_process_status text;
  selected_requested_by uuid;
  selected_withdrawn_by uuid;
  selected_full_file_id uuid;
  selected_expanded_file_id uuid;
  selected_auth_job_id uuid;
  selected_auth_job_status text;
  publish_full boolean;
  publish_expanded boolean;
  withdrawal_at timestamptz;
  authorization_at timestamptz;
  selected_requested_at timestamptz;
  normalized_status text;
begin
  if next_payload is null or jsonb_typeof(next_payload) <> 'object' then
    raise exception 'O estado do portal precisa ser um objeto JSON.' using errcode='22023';
  end if;

  for process_row in select value from jsonb_array_elements(coalesce(next_payload->'processes','[]'::jsonb)) loop
    select p.id, p.status, p.created_by into selected_process_id, selected_process_status, selected_requested_by
    from public.portal_processes p where p.external_id = process_row->>'id';
    if selected_process_id is null then continue; end if;

    publish_full := coalesce((process_row#>>'{acervo,publishFullWork}')::boolean, false);
    publish_expanded := coalesce((process_row#>>'{acervo,publishExpandedAbstract}')::boolean, false);
    withdrawal_at := nullif(process_row#>>'{acervo,publicationWithdrawnAt}','')::timestamptz;
    authorization_at := nullif(process_row#>>'{acervo,authorizationConfirmedAt}','')::timestamptz;
    selected_requested_at := coalesce(nullif(process_row#>>'{acervo,publicationRequestedAt}','')::timestamptz,nullif(process_row#>>'{acervo,submittedAt}','')::timestamptz,nullif(process_row->>'updatedAt','')::timestamptz,now());

    selected_full_file_id := null; selected_expanded_file_id := null; selected_auth_job_id := null; selected_auth_job_status := null; selected_withdrawn_by := null;
    if coalesce(process_row#>>'{acervo,trabalhoCompletoFileId}','') <> '' then
      select f.id into selected_full_file_id from public.portal_files f where f.process_id=selected_process_id and f.file_kind='FULL_WORK' and f.drive_file_id=process_row#>>'{acervo,trabalhoCompletoFileId}' order by f.version desc limit 1;
    end if;
    if coalesce(process_row#>>'{acervo,resumoExpandidoFileId}','') <> '' then
      select f.id into selected_expanded_file_id from public.portal_files f where f.process_id=selected_process_id and f.file_kind='EXPANDED_ABSTRACT' and f.drive_file_id=process_row#>>'{acervo,resumoExpandidoFileId}' order by f.version desc limit 1;
    end if;
    select j.id,j.status into selected_auth_job_id,selected_auth_job_status from public.portal_signature_jobs j where j.process_id=selected_process_id and j.document_type='PUBLICATION_AUTHORIZATION' and j.status<>'CANCELLED' order by j.version desc,j.requested_at desc limit 1;
    if coalesce(process_row#>>'{acervo,publicationWithdrawnBy}','') <> '' then
      select u.id into selected_withdrawn_by from public.portal_users u where u.email=lower(process_row#>>'{acervo,publicationWithdrawnBy}') and u.status<>'ANONYMIZED' limit 1;
    end if;

    normalized_status := case when withdrawal_at is not null then 'WITHDRAWN' when publish_full or publish_expanded then case when selected_process_status='COMPLETED' and selected_auth_job_id is not null and selected_auth_job_status='SIGNED' then 'PUBLISHED' else 'PENDING_AUTHORIZATION' end else 'PRIVATE' end;

    insert into public.portal_publications(process_id,publish_full_work,publish_expanded_abstract,full_work_file_id,expanded_abstract_file_id,authorization_signature_job_id,authorization_confirmed_at,authorization_data_revision,status,requested_by,requested_at,published_at,withdrawn_at,withdrawn_by,withdrawal_reason,updated_at)
    values(selected_process_id,publish_full,publish_expanded,selected_full_file_id,selected_expanded_file_id,selected_auth_job_id,authorization_at,nullif(process_row->>'dataRevision','')::integer,normalized_status,selected_requested_by,selected_requested_at,case when normalized_status='PUBLISHED' then coalesce(nullif(process_row->>'completedAt','')::timestamptz,nullif(process_row->>'updatedAt','')::timestamptz,now()) else null end,withdrawal_at,selected_withdrawn_by,nullif(process_row#>>'{acervo,publicationWithdrawalReason}',''),coalesce(nullif(process_row->>'updatedAt','')::timestamptz,now()))
    on conflict(process_id) do update set publish_full_work=excluded.publish_full_work,publish_expanded_abstract=excluded.publish_expanded_abstract,full_work_file_id=excluded.full_work_file_id,expanded_abstract_file_id=excluded.expanded_abstract_file_id,authorization_signature_job_id=excluded.authorization_signature_job_id,authorization_confirmed_at=excluded.authorization_confirmed_at,authorization_data_revision=excluded.authorization_data_revision,status=excluded.status,requested_by=excluded.requested_by,requested_at=excluded.requested_at,published_at=case when excluded.status='PUBLISHED' then coalesce(portal_publications.published_at,excluded.published_at) else portal_publications.published_at end,withdrawn_at=excluded.withdrawn_at,withdrawn_by=excluded.withdrawn_by,withdrawal_reason=excluded.withdrawal_reason,updated_at=excluded.updated_at;
  end loop;
end;
$function$;
