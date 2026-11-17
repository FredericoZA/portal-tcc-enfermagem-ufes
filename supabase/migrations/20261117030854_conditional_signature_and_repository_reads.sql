begin;
set local lock_timeout='5s';

-- Backend-only read projections. These never modify the canonical aggregate,
-- its CAS revision, audit evidence, public consent or normalized projections.
create function public.portal_read_signature_projection_v1(known_fingerprint text default null)
returns table(revision bigint,fingerprint text,payload jsonb)
language plpgsql stable security invoker set search_path=pg_catalog,pg_temp as $fn$
begin
 if known_fingerprint is not null and known_fingerprint!~'^[a-f0-9]{64}$' then
  raise exception 'Invalid signature projection fingerprint.' using errcode='22023';
 end if;
 return query with projected as materialized (
  select s.revision,jsonb_build_object(
   'settings',coalesce(s.payload->'settings','{}'::jsonb),
   'processes',coalesce(s.payload->'processes','[]'::jsonb),
   'memberships',coalesce(s.payload->'memberships','[]'::jsonb),
   'authorizedStudents',coalesce(s.payload->'authorizedStudents','[]'::jsonb),
   'removedAccessProcessKeys',coalesce(s.payload->'removedAccessProcessKeys','[]'::jsonb),
   'revokedSessionIds',coalesce(s.payload->'revokedSessionIds','[]'::jsonb),
   'signatureJobs',coalesce(s.payload->'signatureJobs','[]'::jsonb)
  ) value from public.portal_runtime_state s where s.id='global'
 ), identified as materialized (
  select p.revision,p.value,encode(sha256(convert_to(p.value::text,'UTF8')),'hex') content_hash from projected p
 ) select i.revision,i.content_hash,case when i.content_hash=known_fingerprint then null::jsonb else i.value end from identified i;
end;
$fn$;
revoke all on function public.portal_read_signature_projection_v1(text) from public,anon,authenticated;
grant execute on function public.portal_read_signature_projection_v1(text) to service_role;

-- Reuse the existing publication-safe repository projection. A global revision
-- caused by another collection does not force retransmission of the catalog.
create function public.portal_read_repository_projection_v1(known_fingerprint text default null)
returns table(revision bigint,fingerprint text,payload jsonb)
language plpgsql stable security invoker set search_path=pg_catalog,pg_temp as $fn$
begin
 if known_fingerprint is not null and known_fingerprint!~'^[a-f0-9]{64}$' then
  raise exception 'Invalid repository projection fingerprint.' using errcode='22023';
 end if;
 return query with projected as materialized (
  select * from public.portal_read_repository_v1()
 ), identified as materialized (
  select p.revision,p.payload,encode(sha256(convert_to(p.payload::text,'UTF8')),'hex') content_hash from projected p
 ) select i.revision,i.content_hash,case when i.content_hash=known_fingerprint then null::jsonb else i.payload end from identified i;
end;
$fn$;
revoke all on function public.portal_read_repository_projection_v1(text) from public,anon,authenticated;
grant execute on function public.portal_read_repository_projection_v1(text) to service_role;
notify pgrst,'reload schema';
commit;
