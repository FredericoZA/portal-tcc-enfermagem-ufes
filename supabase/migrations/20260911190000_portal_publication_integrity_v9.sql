begin;

create or replace function public.portal_validate_publication_integrity()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  file_process_id uuid;
  file_kind text;
  file_lifecycle text;
  auth_process_id uuid;
  auth_document_type text;
  auth_status text;
begin
  if new.full_work_file_id is not null then
    select process_id, file_kind, lifecycle
      into file_process_id, file_kind, file_lifecycle
    from public.portal_files
    where id = new.full_work_file_id;

    if file_process_id is distinct from new.process_id
       or file_kind is distinct from 'FULL_WORK'
       or file_lifecycle = 'DELETED' then
      raise exception 'Arquivo de TCC inválido para esta publicação.' using errcode='23514';
    end if;
  end if;

  if new.expanded_abstract_file_id is not null then
    select process_id, file_kind, lifecycle
      into file_process_id, file_kind, file_lifecycle
    from public.portal_files
    where id = new.expanded_abstract_file_id;

    if file_process_id is distinct from new.process_id
       or file_kind is distinct from 'EXPANDED_ABSTRACT'
       or file_lifecycle = 'DELETED' then
      raise exception 'Resumo expandido inválido para esta publicação.' using errcode='23514';
    end if;
  end if;

  if new.authorization_signature_job_id is not null then
    select process_id, document_type, status
      into auth_process_id, auth_document_type, auth_status
    from public.portal_signature_jobs
    where id = new.authorization_signature_job_id;

    if auth_process_id is distinct from new.process_id
       or auth_document_type is distinct from 'PUBLICATION_AUTHORIZATION' then
      raise exception 'Termo de autorização inválido para esta publicação.' using errcode='23514';
    end if;

    if new.status = 'PUBLISHED' and auth_status is distinct from 'SIGNED' then
      raise exception 'A publicação exige termo de autorização assinado.' using errcode='23514';
    end if;
  elsif new.status = 'PUBLISHED' then
    raise exception 'A publicação exige termo de autorização assinado.' using errcode='23514';
  end if;

  return new;
end;
$$;

revoke all on function public.portal_validate_publication_integrity() from public, anon, authenticated;
grant execute on function public.portal_validate_publication_integrity() to service_role;

drop trigger if exists portal_publication_integrity_guard on public.portal_publications;
create trigger portal_publication_integrity_guard
before insert or update of process_id, publish_full_work, publish_expanded_abstract,
  full_work_file_id, expanded_abstract_file_id, authorization_signature_job_id, status
on public.portal_publications
for each row
execute function public.portal_validate_publication_integrity();

create or replace function public.portal_validate_completed_tcc()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  if new.status = 'COMPLETED' and not exists (
    select 1
    from public.portal_files f
    where f.process_id = new.id
      and f.file_kind = 'FULL_WORK'
      and f.lifecycle <> 'DELETED'
  ) then
    raise exception 'Um processo concluído precisa possuir o TCC completo arquivado.' using errcode='23514';
  end if;
  return null;
end;
$$;

revoke all on function public.portal_validate_completed_tcc() from public, anon, authenticated;
grant execute on function public.portal_validate_completed_tcc() to service_role;

drop trigger if exists portal_completed_tcc_guard on public.portal_processes;
create constraint trigger portal_completed_tcc_guard
after insert or update of status
on public.portal_processes
deferrable initially deferred
for each row
execute function public.portal_validate_completed_tcc();

comment on function public.portal_validate_publication_integrity() is
  'Impede associação cruzada entre processos, tipos de arquivo e termos de autorização na publicação.';
comment on function public.portal_validate_completed_tcc() is
  'Garante no commit que nenhum TCC de graduação seja concluído sem o PDF integral arquivado.';

commit;
