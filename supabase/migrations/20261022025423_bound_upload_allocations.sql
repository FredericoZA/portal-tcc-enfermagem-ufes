-- Bound every signed object, including a consumed URL that remains reusable until provider expiry.
-- Supabase upload URLs live for two hours; retain reservations for 135 minutes.
alter table public.portal_upload_staging add column if not exists principal_hash text;
alter table public.portal_upload_staging add constraint portal_upload_principal_hash_shape check (principal_hash is null or principal_hash ~ '^[a-f0-9]{64}$');
create index if not exists portal_upload_staging_principal_window_idx on public.portal_upload_staging(principal_hash,created_at);
create or replace function public.portal_bound_upload_allocations()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare principal_count integer; process_count integer; global_count integer;
begin
  -- One shared lock makes the reservation atomic across Vercel instances.
  perform pg_advisory_xact_lock(184731,44);
  select count(*),count(*) filter(where coalesce(principal_hash,requester_hash)=coalesce(new.principal_hash,new.requester_hash)),
    count(*) filter(where process_external_id=new.process_external_id)
  into global_count,principal_count,process_count
  from public.portal_upload_staging
  where created_at>clock_timestamp()-interval '135 minutes'
     or status in('PENDING','CONSUMING','CLEANUP_PENDING','REJECTED','EXPIRED');
  -- Reserve the bucket's worst-case 110 MiB per URL, not the untrusted declared size.
  -- At most 660 MiB per principal, 1760 MiB per process and 14080 MiB globally.
  if principal_count>=6 or (new.process_external_id is not null and process_count>=16) or global_count>=128 then
    raise exception 'Limite temporário de uploads atingido. Aguarde a expiração das autorizações anteriores.' using errcode='PT429';
  end if;
  new.created_at:=clock_timestamp();
  return new;
end $$;
revoke all on function public.portal_bound_upload_allocations() from public,anon,authenticated;
grant execute on function public.portal_bound_upload_allocations() to service_role;
create trigger portal_bound_upload_allocations_before_insert before insert on public.portal_upload_staging for each row execute function public.portal_bound_upload_allocations();
