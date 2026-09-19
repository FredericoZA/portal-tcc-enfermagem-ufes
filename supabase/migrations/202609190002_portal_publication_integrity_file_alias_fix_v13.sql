-- Evita colisão entre variáveis PL/pgSQL e colunas da tabela portal_files.
create or replace function public.portal_validate_publication_integrity()
returns trigger
language plpgsql
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  selected_file_process_id uuid;
  selected_file_kind text;
  selected_file_lifecycle text;
  selected_auth_process_id uuid;
  selected_auth_document_type text;
  selected_auth_status text;
begin
  if new.full_work_file_id is not null then
    select f.process_id,f.file_kind,f.lifecycle into selected_file_process_id,selected_file_kind,selected_file_lifecycle
    from public.portal_files f where f.id=new.full_work_file_id;
    if selected_file_process_id is distinct from new.process_id or selected_file_kind is distinct from 'FULL_WORK' or selected_file_lifecycle='DELETED' then
      raise exception 'Arquivo de TCC inválido para esta publicação.' using errcode='23514';
    end if;
  end if;

  if new.expanded_abstract_file_id is not null then
    select f.process_id,f.file_kind,f.lifecycle into selected_file_process_id,selected_file_kind,selected_file_lifecycle
    from public.portal_files f where f.id=new.expanded_abstract_file_id;
    if selected_file_process_id is distinct from new.process_id or selected_file_kind is distinct from 'EXPANDED_ABSTRACT' or selected_file_lifecycle='DELETED' then
      raise exception 'Resumo expandido inválido para esta publicação.' using errcode='23514';
    end if;
  end if;

  if new.authorization_signature_job_id is not null then
    select j.process_id,j.document_type,j.status into selected_auth_process_id,selected_auth_document_type,selected_auth_status
    from public.portal_signature_jobs j where j.id=new.authorization_signature_job_id;
    if selected_auth_process_id is distinct from new.process_id or selected_auth_document_type is distinct from 'PUBLICATION_AUTHORIZATION' then
      raise exception 'Termo de autorização inválido para esta publicação.' using errcode='23514';
    end if;
    if new.status='PUBLISHED' and selected_auth_status is distinct from 'SIGNED' then
      raise exception 'A publicação exige termo de autorização assinado.' using errcode='23514';
    end if;
  elsif new.status='PUBLISHED' then
    raise exception 'A publicação exige termo de autorização assinado.' using errcode='23514';
  end if;

  return new;
end;
$function$;
