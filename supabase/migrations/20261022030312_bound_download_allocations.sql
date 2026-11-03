create or replace function public.portal_bound_download_allocations()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare global_count integer; requester_count integer; global_bytes bigint; requester_bytes bigint;
begin
  perform pg_advisory_xact_lock(184731,45);
  select count(*),coalesce(sum(size_bytes),0),
         count(*) filter(where requester_hash=new.requester_hash),
         coalesce(sum(size_bytes) filter(where requester_hash=new.requester_hash),0)
  into global_count,global_bytes,requester_count,requester_bytes
  from public.portal_download_transfers
  where status='ACTIVE' or created_at>clock_timestamp()-interval '5 minutes';
  if global_count>=256 or global_bytes+new.size_bytes>536870912
     or requester_count>=32 or requester_bytes+new.size_bytes>134217728 then
    raise exception 'Limite temporário de downloads atingido. Tente novamente após a limpeza dos arquivos temporários.' using errcode='PT429';
  end if;
  new.created_at:=clock_timestamp();
  return new;
end $$;
revoke all on function public.portal_bound_download_allocations() from public,anon,authenticated;
grant execute on function public.portal_bound_download_allocations() to service_role;
create trigger portal_bound_download_allocations_before_insert before insert on public.portal_download_transfers for each row execute function public.portal_bound_download_allocations();
