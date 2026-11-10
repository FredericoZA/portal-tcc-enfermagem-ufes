begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$
begin
  if exists(select 1 from public.portal_signature_signers where signer_role='CO_ADVISOR') then
    raise exception 'Existem signatários CO_ADVISOR: preserve esses registros e revise antes de reverter.';
  end if;
end;
$$;
drop function public.portal_check_runtime_v1();
alter function public.portal_check_runtime_before_coadvisor_v1() rename to portal_check_runtime_v1;
alter table public.portal_signature_signers drop constraint portal_signature_signers_signer_role_check;
alter table public.portal_signature_signers add constraint portal_signature_signers_signer_role_check
  check(signer_role in ('STUDENT','ADVISOR','COMMISSION_PRESIDENT','EXAMINER'));
commit;
