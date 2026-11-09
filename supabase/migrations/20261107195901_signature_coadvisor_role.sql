begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

alter table public.portal_signature_signers drop constraint portal_signature_signers_signer_role_check;
alter table public.portal_signature_signers add constraint portal_signature_signers_signer_role_check
  check(signer_role in ('STUDENT','ADVISOR','COMMISSION_PRESIDENT','EXAMINER','CO_ADVISOR'));

-- Preserve all installed preflight checks, adding only the new signer capability.
do $$
begin
  if to_regprocedure('public.portal_check_runtime_before_coadvisor_v1()') is null then
    alter function public.portal_check_runtime_v1() rename to portal_check_runtime_before_coadvisor_v1;
  end if;
end;
$$;
create or replace function public.portal_check_runtime_v1()
returns jsonb language sql stable security invoker set search_path=pg_catalog,pg_temp
as $$
  select public.portal_check_runtime_before_coadvisor_v1()
    || jsonb_build_object('signature_coadvisor_role_ready',exists(
      select 1 from pg_catalog.pg_constraint
      where conrelid=pg_catalog.to_regclass('public.portal_signature_signers')
        and conname='portal_signature_signers_signer_role_check'
        and pg_catalog.pg_get_constraintdef(oid) like '%''CO_ADVISOR''%'
    ));
$$;
revoke all on function public.portal_check_runtime_before_coadvisor_v1() from public,anon,authenticated;
revoke all on function public.portal_check_runtime_v1() from public,anon,authenticated;
grant execute on function public.portal_check_runtime_before_coadvisor_v1() to service_role;
grant execute on function public.portal_check_runtime_v1() to service_role;
commit;
