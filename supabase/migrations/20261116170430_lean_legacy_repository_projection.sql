begin;
set local lock_timeout='5s';
-- This is a read projection only. The canonical payload and its provenance stay intact.
create or replace function public.portal_read_repository_v1()
returns table(revision bigint,payload jsonb)
language sql stable security definer set search_path=pg_catalog,pg_temp as $fn$
 select s.revision,jsonb_build_object(
  'processes',coalesce((
   select jsonb_agg((select jsonb_object_agg(k,v) from jsonb_each(p) e(k,v)
    where k=any(array['id','protocolo','titulo','etapaAtual','status','aluno1','aluno2','orientador','coorientador','banca','defesa','avaliacao','acervo','createdAt','updatedAt','dataRevision'])) order by n)
   from jsonb_array_elements(coalesce(s.payload->'processes','[]'::jsonb)) with ordinality a(p,n)
  ),'[]'::jsonb),
  'legacyAcademicRecords',coalesce((
   select jsonb_agg((r-'provenance')||jsonb_build_object('provenance',
    coalesce((select jsonb_object_agg(k,v) from jsonb_each(coalesce(r->'provenance','{}'::jsonb)) e(k,v)
      where k=any(array['originalConsent','publicationWithdrawal'])),'{}'::jsonb)
    ||jsonb_build_object('repositorySourceDigest',encode(sha256(convert_to(coalesce(r->'provenance','{}'::jsonb)::text,'UTF8')),'hex'))
   ) order by n)
   from jsonb_array_elements(coalesce(s.payload->'legacyAcademicRecords','[]'::jsonb)) with ordinality a(r,n)
  ),'[]'::jsonb)
 )
 from public.portal_runtime_state s where s.id='global';
$fn$;
revoke all on function public.portal_read_repository_v1() from public,anon,authenticated;
grant execute on function public.portal_read_repository_v1() to service_role;
commit;
