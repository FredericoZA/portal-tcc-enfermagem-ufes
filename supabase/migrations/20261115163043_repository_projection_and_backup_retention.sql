begin;
set local lock_timeout='5s';
-- Only metadata needed by the public repository is transferred to the server.
-- Consent and public-field sanitization remain in the application.
create function public.portal_read_repository_v1()
returns table(revision bigint,payload jsonb) language sql stable security definer set search_path=pg_catalog,pg_temp as $fn$
 select s.revision,jsonb_build_object('processes',coalesce((select jsonb_agg((select jsonb_object_agg(k,v) from jsonb_each(p) e(k,v) where k=any(array['id','protocolo','titulo','etapaAtual','status','aluno1','aluno2','orientador','coorientador','banca','defesa','avaliacao','acervo','createdAt','updatedAt','dataRevision']))) from jsonb_array_elements(coalesce(s.payload->'processes','[]'::jsonb)) p),'[]'::jsonb),'legacyAcademicRecords',coalesce(s.payload->'legacyAcademicRecords','[]'::jsonb))
 from public.portal_runtime_state s where s.id='global';
$fn$;
revoke all on function public.portal_read_repository_v1() from public,anon,authenticated;
grant execute on function public.portal_read_repository_v1() to service_role;

create table public.portal_backup_archives(
 backup_id bigint primary key,revision bigint not null,reason text not null,original_created_at timestamptz not null,
 payload_sha256 text not null check(payload_sha256~'^[a-f0-9]{64}$'),
 drive_file_id text not null,encrypted_sha256 text not null check(encrypted_sha256~'^[a-f0-9]{64}$'),
 source_sha256 text not null check(source_sha256~'^[a-f0-9]{64}$'),archived_at timestamptz not null default now()
);
alter table public.portal_backup_archives enable row level security;
revoke all on table public.portal_backup_archives from public,anon,authenticated;
grant select,insert on table public.portal_backup_archives to service_role;
create function public.portal_list_retirable_backups_v1()
returns table(backup_id bigint,revision bigint,reason text,created_at timestamptz,payload jsonb,payload_sha256 text)
language sql stable security definer set search_path=pg_catalog,pg_temp as $fn$
 select b.backup_id,b.revision,b.reason,b.created_at,b.payload,encode(sha256(convert_to(b.payload::text,'UTF8')),'hex')
 from public.portal_runtime_state_backups b
 where b.state_id='global' and b.created_at<now()-interval '30 days'
 and (select count(*) from public.portal_runtime_state_backups newer where newer.state_id=b.state_id and (newer.created_at,newer.backup_id)>(b.created_at,b.backup_id))>=3
 order by b.created_at,b.backup_id limit 2;
$fn$;
create function public.portal_finalize_backup_archive_v1(backup_id_input bigint,payload_sha256_input text,drive_file_id_input text,encrypted_sha256_input text,source_sha256_input text)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $fn$
declare b public.portal_runtime_state_backups%rowtype;
begin
 if drive_file_id_input!~'^[a-zA-Z0-9_-]{10,}$' or encrypted_sha256_input!~'^[a-f0-9]{64}$' or source_sha256_input!~'^[a-f0-9]{64}$' then raise exception 'Invalid archive proof';end if;
 select * into b from public.portal_runtime_state_backups where backup_id=backup_id_input for update;
 if not found then return exists(select 1 from public.portal_backup_archives where backup_id=backup_id_input and payload_sha256=payload_sha256_input);end if;
 if b.state_id<>'global' or b.created_at>=now()-interval '30 days' or encode(sha256(convert_to(b.payload::text,'UTF8')),'hex')<>payload_sha256_input or (select count(*) from public.portal_runtime_state_backups newer where newer.state_id=b.state_id and (newer.created_at,newer.backup_id)>(b.created_at,b.backup_id))<3 then raise exception 'Backup retention precondition changed';end if;
 insert into public.portal_backup_archives(backup_id,revision,reason,original_created_at,payload_sha256,drive_file_id,encrypted_sha256,source_sha256) values(b.backup_id,b.revision,b.reason,b.created_at,payload_sha256_input,drive_file_id_input,encrypted_sha256_input,source_sha256_input);
 delete from public.portal_runtime_state_backups where backup_id=b.backup_id;
 return true;
end;
$fn$;
revoke all on function public.portal_list_retirable_backups_v1() from public,anon,authenticated;
revoke all on function public.portal_finalize_backup_archive_v1(bigint,text,text,text,text) from public,anon,authenticated;
grant execute on function public.portal_list_retirable_backups_v1() to service_role;
grant execute on function public.portal_finalize_backup_archive_v1(bigint,text,text,text,text) to service_role;
commit;
