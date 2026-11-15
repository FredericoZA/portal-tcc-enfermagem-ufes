-- Read-only conditional projections; no additional copies of the runtime,
-- documents, audit records, or historical versions are stored.
-- An audit-only commit advances the global revision but need not transfer the
-- same permission/process/settings metadata to a warm backend again.
create function public.portal_read_runtime_projection_v1(
  projection_kind text,
  known_fingerprint text default null
)
returns table(revision bigint, fingerprint text, payload jsonb)
language plpgsql stable security invoker
set search_path = pg_catalog, pg_temp
as $$
begin
  if projection_kind is null or projection_kind not in ('LITE','LEAN') then
    raise exception 'Invalid runtime projection.' using errcode = '22023';
  end if;
  if known_fingerprint is not null and known_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid runtime projection fingerprint.' using errcode = '22023';
  end if;
  return query
    with projected as materialized (
      select state.revision,
        case when projection_kind = 'LEAN'
          then state.payload - 'auditLogs' - 'legacyAcademicRecords'
          else state.payload - 'auditLogs'
        end as value
      from public.portal_runtime_state as state
      where state.id = 'global'
    ), identified as materialized (
      select projected.revision, projected.value,
        pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(projected.value::text,'UTF8')),'hex') as content_hash
      from projected
    )
    select identified.revision, identified.content_hash,
      case when identified.content_hash = known_fingerprint then null::jsonb else identified.value end
    from identified;
end;
$$;
revoke all on function public.portal_read_runtime_projection_v1(text,text) from public, anon, authenticated;
grant execute on function public.portal_read_runtime_projection_v1(text,text) to service_role;
comment on function public.portal_read_runtime_projection_v1(text,text) is
  'Backend-only read-only LITE/LEAN projection. Current revision and SHA256 are always read from the same canonical row. Omits unchanged bytes, never permissions or CAS checks.';
notify pgrst, 'reload schema';
