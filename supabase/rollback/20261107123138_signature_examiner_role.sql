begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$begin
  if exists(select 1 from public.portal_signature_signers where signer_role='EXAMINER') then
    raise exception 'Rollback bloqueado: há signatários EXAMINER válidos. Não apagar signatários para reverter compatibilidade.';
  end if;
end;$$;
alter table public.portal_signature_signers drop constraint portal_signature_signers_signer_role_check;
alter table public.portal_signature_signers add constraint portal_signature_signers_signer_role_check
  check(signer_role in ('STUDENT','ADVISOR','COMMISSION_PRESIDENT'));
commit;
