begin;
set local lock_timeout = '2s';
set local statement_timeout = '5s';

-- PREPARED proves that no creation request is permitted yet. Legacy CLAIMED
-- rows retain their conservative semantics and are never made retryable here.
alter table public.portal_asten_dispatch_claims
  drop constraint portal_asten_dispatch_claims_state_check;
alter table public.portal_asten_dispatch_claims
  add constraint portal_asten_dispatch_claims_state_check
  check (state in ('PREPARED','CLAIMED','UNCERTAIN','ENVELOPE_CREATED','DISPATCHED'));

create or replace function public.portal_prepare_asten_dispatch(
  p_idempotency_key text, p_job_external_id text, p_content_sha256 text,
  p_claim_token text, p_lease_seconds integer default 120
) returns jsonb language plpgsql security invoker
set search_path = public, extensions, pg_temp as $$
declare current_row public.portal_asten_dispatch_claims%rowtype;
begin
  if coalesce(p_idempotency_key,'') !~ '^[0-9a-f]{64}$'
     or coalesce(p_content_sha256,'') !~ '^[0-9a-f]{64}$'
     or char_length(coalesce(p_claim_token,'')) < 20
     or char_length(coalesce(p_job_external_id,'')) not between 1 and 200 then
    raise exception 'Preparação Asten inválida.' using errcode='22023';
  end if;
  insert into public.portal_asten_dispatch_claims
    (idempotency_key,job_external_id,content_sha256,state,claim_token_hash,lease_until)
  values (p_idempotency_key,p_job_external_id,p_content_sha256,'PREPARED',
    encode(digest(p_claim_token,'sha256'),'hex'),
    now()+make_interval(secs=>least(greatest(coalesce(p_lease_seconds,120),30),300)))
  on conflict (idempotency_key) do nothing returning * into current_row;
  if found then return jsonb_build_object('outcome','PREPARED'); end if;
  select * into strict current_row from public.portal_asten_dispatch_claims
    where idempotency_key=p_idempotency_key for update;
  if current_row.job_external_id<>p_job_external_id or current_row.content_sha256<>p_content_sha256 then
    raise exception 'Conflito na chave idempotente da Asten.' using errcode='23505';
  end if;
  if current_row.state='DISPATCHED' then
    return jsonb_build_object('outcome','DISPATCHED','providerEnvelopeId',current_row.provider_envelope_id,'providerEnvelopeHash',current_row.provider_envelope_hash);
  elsif current_row.state='ENVELOPE_CREATED' then
    return jsonb_build_object('outcome','ALREADY_CREATED','providerEnvelopeId',current_row.provider_envelope_id,'providerEnvelopeHash',current_row.provider_envelope_hash);
  elsif current_row.state='UNCERTAIN' then
    return jsonb_build_object('outcome','UNCERTAIN');
  elsif current_row.lease_until>now() then
    return jsonb_build_object('outcome','BUSY');
  elsif current_row.state='PREPARED' then
    update public.portal_asten_dispatch_claims set
      claim_token_hash=encode(digest(p_claim_token,'sha256'),'hex'),
      lease_until=now()+make_interval(secs=>least(greatest(coalesce(p_lease_seconds,120),30),300)),
      error_code=null,updated_at=now()
      where idempotency_key=p_idempotency_key;
    return jsonb_build_object('outcome','PREPARED');
  end if;
  -- An old worker might already have contacted the provider. Never rotate its token.
  update public.portal_asten_dispatch_claims set state='UNCERTAIN',
    error_code='CLAIM_EXPIRED_WITHOUT_CONFIRMATION',updated_at=now()
    where idempotency_key=p_idempotency_key;
  return jsonb_build_object('outcome','UNCERTAIN');
end;
$$;

create or replace function public.portal_start_prepared_asten_dispatch(
  p_idempotency_key text, p_job_external_id text, p_content_sha256 text,
  p_claim_token text
) returns jsonb language plpgsql security invoker
set search_path = public, extensions, pg_temp as $$
declare current_row public.portal_asten_dispatch_claims%rowtype;
begin
  if char_length(coalesce(p_claim_token,''))<20 then
    raise exception 'Token de preparação Asten inválido.' using errcode='28000';
  end if;
  select * into current_row from public.portal_asten_dispatch_claims
    where idempotency_key=p_idempotency_key for update;
  if not found then raise exception 'Preparação Asten não encontrada.' using errcode='P0002'; end if;
  if current_row.job_external_id is distinct from p_job_external_id
     or current_row.content_sha256 is distinct from p_content_sha256
     or current_row.claim_token_hash is distinct from encode(digest(p_claim_token,'sha256'),'hex') then
    raise exception 'Identidade da preparação Asten divergente.' using errcode='28000';
  end if;
  if current_row.state<>'PREPARED' or current_row.lease_until is null or current_row.lease_until<=now() then
    raise exception 'A preparação Asten não está ativa. Nenhum envelope pode ser criado.' using errcode='55000';
  end if;
  update public.portal_asten_dispatch_claims set state='CLAIMED',updated_at=now()
    where idempotency_key=p_idempotency_key;
  return jsonb_build_object('outcome','STARTED');
end;
$$;

-- The existing claim RPC is intentionally unchanged: old deployments cannot
-- mistake a PREPARED reservation for permission to invoke the provider.
revoke all on function public.portal_prepare_asten_dispatch(text,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.portal_start_prepared_asten_dispatch(text,text,text,text) from public, anon, authenticated;
grant execute on function public.portal_prepare_asten_dispatch(text,text,text,text,integer) to service_role;
grant execute on function public.portal_start_prepared_asten_dispatch(text,text,text,text) to service_role;
notify pgrst, 'reload schema';
commit;
