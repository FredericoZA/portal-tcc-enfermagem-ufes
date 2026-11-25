begin;
set local lock_timeout='5s';
-- Retain catalog identity and documented examiner roles in the service-only
-- read projection. The canonical historical records remain unchanged.
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
      where k=any(array['originalConsent','publicationWithdrawal','publicationOverride','publicationImportBaseline','pageUrl'])),'{}'::jsonb)
    ||jsonb_build_object('pageRecords',coalesce((
      select jsonb_agg(coalesce((select jsonb_object_agg(k,v)
        from jsonb_each(case when jsonb_typeof(pr)='object' then pr else '{}'::jsonb end) e(k,v)
        where k=any(array['legacyId','sourceFingerprint','sourceLinks','advisorOriginal','defenseDate','titleOriginal','authorsOriginal'])),'{}'::jsonb) order by pn)
      from jsonb_array_elements(case when jsonb_typeof(r#>'{provenance,pageRecords}')='array'
        then r#>'{provenance,pageRecords}' else '[]'::jsonb end) with ordinality a(pr,pn)
    ),'[]'::jsonb))
    ||jsonb_build_object('repositoryExaminerRoles',coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'examinadorInterno',case when length(w#>>'{peopleOriginal,examinadorInterno}')<=1000
          then w#>>'{peopleOriginal,examinadorInterno}' end,
        'examinadorExterno',case when length(w#>>'{peopleOriginal,examinadorExterno}')<=1000
          then w#>>'{peopleOriginal,examinadorExterno}' end
      )) order by wn)
      from jsonb_array_elements(case when jsonb_typeof(r#>'{provenance,submissionWorkbook,rows}')='array'
        then r#>'{provenance,submissionWorkbook,rows}' else '[]'::jsonb end) with ordinality a(w,wn)
      where jsonb_typeof(w->'peopleOriginal')='object'
    ),'[]'::jsonb))
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
