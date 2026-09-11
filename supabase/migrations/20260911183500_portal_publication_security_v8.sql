begin;

-- Portal TCC v8: fronteira backend-only + registro normalizado de publicações.
-- O navegador nunca acessa estas tabelas diretamente. Apenas a credencial
-- secreta do backend pode operar os dados do Portal.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public' and tablename like 'portal\_%' escape '\'
  loop
    execute format('alter table %I.%I enable row level security', r.schemaname, r.tablename);
    execute format('revoke all privileges on table %I.%I from anon, authenticated', r.schemaname, r.tablename);
    execute format('drop policy if exists portal_backend_only on %I.%I', r.schemaname, r.tablename);
    execute format(
      'create policy portal_backend_only on %I.%I for all to anon, authenticated using (false) with check (false)',
      r.schemaname, r.tablename
    );
  end loop;
end $$;

alter table public.portal_publications
  add column if not exists authorization_confirmed_at timestamptz,
  add column if not exists authorization_data_revision integer;

alter table public.portal_publications
  drop constraint if exists portal_publication_authorization_check;

alter table public.portal_publications
  add constraint portal_publication_authorization_check check (
    status <> 'PUBLISHED' or authorization_signature_job_id is not null
  );

alter table public.portal_publications
  drop constraint if exists portal_publication_explicit_consent_check;

alter table public.portal_publications
  add constraint portal_publication_explicit_consent_check check (
    status not in ('PENDING_AUTHORIZATION','PUBLISHED')
    or (
      (publish_full_work or publish_expanded_abstract)
      and authorization_confirmed_at is not null
      and authorization_data_revision is not null
      and authorization_data_revision > 0
    )
  );

comment on column public.portal_publications.authorization_confirmed_at is
  'Momento em que o aluno confirmou expressamente a seleção de artefatos para publicação.';
comment on column public.portal_publications.authorization_data_revision is
  'Revisão do processo que contém a seleção de publicação confirmada pelo aluno.';

create or replace function public.portal_project_publications_v8(next_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
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
  requested_at timestamptz;
  normalized_status text;
begin
  if next_payload is null or jsonb_typeof(next_payload) <> 'object' then
    raise exception 'O estado do portal precisa ser um objeto JSON.' using errcode='22023';
  end if;

  for process_row in
    select value from jsonb_array_elements(coalesce(next_payload->'processes','[]'::jsonb))
  loop
    select id, status, created_by
      into selected_process_id, selected_process_status, selected_requested_by
    from public.portal_processes
    where external_id = process_row->>'id';

    if selected_process_id is null then
      continue;
    end if;

    publish_full := coalesce((process_row#>>'{acervo,publishFullWork}')::boolean, false);
    publish_expanded := coalesce((process_row#>>'{acervo,publishExpandedAbstract}')::boolean, false);
    withdrawal_at := nullif(process_row#>>'{acervo,publicationWithdrawnAt}','')::timestamptz;
    authorization_at := nullif(process_row#>>'{acervo,authorizationConfirmedAt}','')::timestamptz;
    requested_at := coalesce(
      nullif(process_row#>>'{acervo,publicationRequestedAt}','')::timestamptz,
      nullif(process_row#>>'{acervo,submittedAt}','')::timestamptz,
      nullif(process_row->>'updatedAt','')::timestamptz,
      now()
    );

    selected_full_file_id := null;
    selected_expanded_file_id := null;
    selected_auth_job_id := null;
    selected_auth_job_status := null;
    selected_withdrawn_by := null;

    if coalesce(process_row#>>'{acervo,trabalhoCompletoFileId}','') <> '' then
      select id into selected_full_file_id
      from public.portal_files
      where process_id = selected_process_id
        and file_kind = 'FULL_WORK'
        and drive_file_id = process_row#>>'{acervo,trabalhoCompletoFileId}'
      order by version desc
      limit 1;
    end if;

    if coalesce(process_row#>>'{acervo,resumoExpandidoFileId}','') <> '' then
      select id into selected_expanded_file_id
      from public.portal_files
      where process_id = selected_process_id
        and file_kind = 'EXPANDED_ABSTRACT'
        and drive_file_id = process_row#>>'{acervo,resumoExpandidoFileId}'
      order by version desc
      limit 1;
    end if;

    select id, status into selected_auth_job_id, selected_auth_job_status
    from public.portal_signature_jobs
    where process_id = selected_process_id
      and document_type = 'PUBLICATION_AUTHORIZATION'
      and status <> 'CANCELLED'
    order by version desc, requested_at desc
    limit 1;

    if coalesce(process_row#>>'{acervo,publicationWithdrawnBy}','') <> '' then
      select id into selected_withdrawn_by
      from public.portal_users
      where email = lower(process_row#>>'{acervo,publicationWithdrawnBy}')
        and status <> 'ANONYMIZED'
      limit 1;
    end if;

    normalized_status := case
      when withdrawal_at is not null then 'WITHDRAWN'
      when publish_full or publish_expanded then
        case
          when selected_process_status = 'COMPLETED'
            and selected_auth_job_id is not null
            and selected_auth_job_status = 'SIGNED'
          then 'PUBLISHED'
          else 'PENDING_AUTHORIZATION'
        end
      else 'PRIVATE'
    end;

    insert into public.portal_publications(
      process_id,
      publish_full_work,
      publish_expanded_abstract,
      full_work_file_id,
      expanded_abstract_file_id,
      authorization_signature_job_id,
      authorization_confirmed_at,
      authorization_data_revision,
      status,
      requested_by,
      requested_at,
      published_at,
      withdrawn_at,
      withdrawn_by,
      withdrawal_reason,
      updated_at
    ) values (
      selected_process_id,
      publish_full,
      publish_expanded,
      selected_full_file_id,
      selected_expanded_file_id,
      selected_auth_job_id,
      authorization_at,
      nullif(process_row->>'dataRevision','')::integer,
      normalized_status,
      selected_requested_by,
      requested_at,
      case when normalized_status='PUBLISHED' then coalesce(nullif(process_row->>'completedAt','')::timestamptz, nullif(process_row->>'updatedAt','')::timestamptz, now()) else null end,
      withdrawal_at,
      selected_withdrawn_by,
      nullif(process_row#>>'{acervo,publicationWithdrawalReason}',''),
      coalesce(nullif(process_row->>'updatedAt','')::timestamptz, now())
    )
    on conflict(process_id) do update set
      publish_full_work = excluded.publish_full_work,
      publish_expanded_abstract = excluded.publish_expanded_abstract,
      full_work_file_id = excluded.full_work_file_id,
      expanded_abstract_file_id = excluded.expanded_abstract_file_id,
      authorization_signature_job_id = excluded.authorization_signature_job_id,
      authorization_confirmed_at = excluded.authorization_confirmed_at,
      authorization_data_revision = excluded.authorization_data_revision,
      status = excluded.status,
      requested_by = excluded.requested_by,
      requested_at = excluded.requested_at,
      published_at = case
        when excluded.status='PUBLISHED' then coalesce(portal_publications.published_at, excluded.published_at)
        else portal_publications.published_at
      end,
      withdrawn_at = excluded.withdrawn_at,
      withdrawn_by = excluded.withdrawn_by,
      withdrawal_reason = excluded.withdrawal_reason,
      updated_at = excluded.updated_at;
  end loop;
end;
$$;

revoke all on function public.portal_project_publications_v8(jsonb) from public, anon, authenticated;
grant execute on function public.portal_project_publications_v8(jsonb) to service_role;

create or replace function public.portal_commit_runtime_state(expected_revision bigint, next_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  current_revision bigint;
  next_revision bigint;
begin
  if next_payload is null or jsonb_typeof(next_payload) <> 'object' then
    raise exception 'O estado do portal precisa ser um objeto JSON.' using errcode='22023';
  end if;
  insert into public.portal_runtime_state(id,payload,revision,updated_at)
  values('global','{}'::jsonb,0,now()) on conflict(id) do nothing;
  select revision into current_revision from public.portal_runtime_state where id='global' for update;
  if current_revision <> expected_revision then
    raise exception 'Conflito de concorrência: revisão atual %, revisão esperada %.', current_revision, expected_revision using errcode='40001';
  end if;
  perform public.portal_project_runtime_state(next_payload);
  perform public.portal_project_runtime_state_v4(next_payload);
  perform public.portal_project_publications_v8(next_payload);
  next_revision := current_revision + 1;
  update public.portal_runtime_state set payload=next_payload,revision=next_revision,updated_at=now() where id='global';
  insert into public.portal_runtime_commits(revision,payload_sha256)
  values(next_revision,encode(digest(next_payload::text,'sha256'),'hex'));
  return next_revision;
end;
$$;

revoke all on function public.portal_commit_runtime_state(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.portal_commit_runtime_state(bigint,jsonb) to service_role;

create or replace view public.portal_student_tcc_compliance
with (security_invoker = true)
as
select
  ae.id as access_entry_id,
  ae.user_id,
  ae.email,
  ae.active,
  pa.process_id,
  p.external_id as process_external_id,
  p.code as process_code,
  p.status as process_status,
  (pa.process_id is not null) as has_tcc
from public.portal_access_entries ae
left join public.portal_process_authors pa on pa.user_id = ae.user_id
left join public.portal_processes p on p.id = pa.process_id
where ae.source = 'PREAUTHORIZED_STUDENT';

revoke all privileges on table public.portal_student_tcc_compliance from public, anon, authenticated;
grant select on table public.portal_student_tcc_compliance to service_role;

comment on view public.portal_student_tcc_compliance is
  'Controle administrativo: identifica alunos pré-autorizados ainda sem processo de TCC, sem expor o catálogo ao navegador.';

commit;
