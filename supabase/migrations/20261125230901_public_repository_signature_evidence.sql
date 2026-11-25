begin;
set local lock_timeout = '5s';

-- Include only the signature evidence used by the public link policy, in the
-- same snapshot as the catalog. The application never returns these jobs.
create function public.portal_read_repository_projection_v2(known_fingerprint text default null)
returns table(revision bigint, fingerprint text, payload jsonb)
language plpgsql stable security invoker set search_path = pg_catalog, pg_temp as $fn$
begin
  if known_fingerprint is not null and known_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid repository projection fingerprint.' using errcode = '22023';
  end if;
  return query
  with catalog as materialized (
    select * from public.portal_read_repository_v1()
  ), published as materialized (
    select distinct p->>'id' as id
    from catalog c
    cross join lateral jsonb_array_elements(c.payload->'processes') as entry(p)
    where p->>'status' = 'CONCLUIDO' and p#>>'{acervo,publicationState}' = 'PUBLIC'
  ), projected as materialized (
    select c.revision, c.payload || jsonb_build_object('repositorySignatures', coalesce((
      select jsonb_agg(j order by position)
      from jsonb_array_elements(coalesce(s.payload->'signatureJobs', '[]'::jsonb))
        with ordinality as job(j, position)
      join published p on p.id = j->>'processId'
      where j->>'documentType' in ('ATA', 'TERMO')
    ), '[]'::jsonb)) as value
    from catalog c
    join public.portal_runtime_state s on s.id = 'global' and s.revision = c.revision
  ), identified as materialized (
    select p.revision, p.value, encode(sha256(convert_to(p.value::text, 'UTF8')), 'hex') as content_hash
    from projected p
  )
  select i.revision, i.content_hash, case when i.content_hash = known_fingerprint then null::jsonb else i.value end
  from identified i;
end;
$fn$;
revoke all on function public.portal_read_repository_projection_v2(text) from public, anon, authenticated;
grant execute on function public.portal_read_repository_projection_v2(text) to service_role;
notify pgrst, 'reload schema';
commit;
