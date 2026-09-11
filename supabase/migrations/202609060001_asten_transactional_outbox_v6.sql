begin;

-- Reserva transacional dos efeitos externos da Asten. Uma falha ambígua
-- depois da chamada ao provedor fica UNCERTAIN e nunca autoriza nova criação
-- automática do mesmo envelope.
create table if not exists public.portal_asten_dispatch_claims (
  idempotency_key text primary key check (idempotency_key ~ '^[0-9a-f]{64}$'),
  job_external_id text not null unique,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('CLAIMED','UNCERTAIN','ENVELOPE_CREATED','DISPATCHED')),
  claim_token_hash text check (claim_token_hash is null or claim_token_hash ~ '^[0-9a-f]{64}$'),
  lease_until timestamptz,
  provider_envelope_id text,
  provider_envelope_hash text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_asten_dispatch_state_idx
  on public.portal_asten_dispatch_claims (state, updated_at);

alter table public.portal_asten_dispatch_claims enable row level security;
alter table public.portal_asten_dispatch_claims force row level security;
revoke all on table public.portal_asten_dispatch_claims from public, anon, authenticated;
grant all on table public.portal_asten_dispatch_claims to service_role;

create or replace function public.portal_claim_asten_dispatch(
  p_idempotency_key text,
  p_job_external_id text,
  p_content_sha256 text,
  p_claim_token text,
  p_lease_seconds integer default 120
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_row public.portal_asten_dispatch_claims%rowtype;
begin
  if p_idempotency_key !~ '^[0-9a-f]{64}$' or p_content_sha256 !~ '^[0-9a-f]{64}$'
     or char_length(coalesce(p_claim_token,'')) < 20 then
    raise exception 'Reserva Asten inválida.' using errcode='22023';
  end if;
  select * into current_row from public.portal_asten_dispatch_claims
    where idempotency_key=p_idempotency_key for update;
  if not found then
    insert into public.portal_asten_dispatch_claims(
      idempotency_key,job_external_id,content_sha256,state,claim_token_hash,lease_until
    ) values (
      p_idempotency_key,p_job_external_id,p_content_sha256,'CLAIMED',
      encode(digest(p_claim_token,'sha256'),'hex'),
      now()+make_interval(secs=>least(greatest(p_lease_seconds,30),300))
    );
    return jsonb_build_object('outcome','CLAIMED');
  end if;
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
  end if;
  update public.portal_asten_dispatch_claims set
    state='UNCERTAIN',error_code='CLAIM_EXPIRED_WITHOUT_CONFIRMATION',updated_at=now()
    where idempotency_key=p_idempotency_key;
  return jsonb_build_object('outcome','UNCERTAIN');
end;
$$;

create or replace function public.portal_update_asten_dispatch(
  p_idempotency_key text,
  p_state text,
  p_claim_token text default null,
  p_provider_envelope_id text default null,
  p_provider_envelope_hash text default null,
  p_error_code text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_row public.portal_asten_dispatch_claims%rowtype;
begin
  select * into current_row from public.portal_asten_dispatch_claims
    where idempotency_key=p_idempotency_key for update;
  if not found then raise exception 'Reserva Asten não encontrada.' using errcode='P0002'; end if;
  if p_state in ('UNCERTAIN','ENVELOPE_CREATED') and (
    p_claim_token is null or current_row.claim_token_hash<>encode(digest(p_claim_token,'sha256'),'hex')
  ) then raise exception 'Token da reserva Asten inválido.' using errcode='28000'; end if;
  if p_state='ENVELOPE_CREATED' and coalesce(p_provider_envelope_id,'')='' then
    raise exception 'Envelope Asten não informado.' using errcode='22023';
  end if;
  if p_state='DISPATCHED' and (
    current_row.state not in ('ENVELOPE_CREATED','DISPATCHED') or
    current_row.provider_envelope_id is distinct from p_provider_envelope_id
  ) then raise exception 'Envelope Asten divergente.' using errcode='22023'; end if;
  if p_state not in ('UNCERTAIN','ENVELOPE_CREATED','DISPATCHED') then
    raise exception 'Estado Asten inválido.' using errcode='22023';
  end if;
  update public.portal_asten_dispatch_claims set
    state=p_state,
    provider_envelope_id=coalesce(p_provider_envelope_id,provider_envelope_id),
    provider_envelope_hash=coalesce(p_provider_envelope_hash,provider_envelope_hash),
    error_code=p_error_code,
    lease_until=null,
    updated_at=now()
  where idempotency_key=p_idempotency_key;
end;
$$;

create or replace function public.portal_runtime_capabilities()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select jsonb_build_object(
    'schema_version', 6,
    'transactional_runtime', true,
    'optimistic_concurrency', true,
    'normalized_core_projection', true,
    'academic_governance', true,
    'document_authenticity', true,
    'binary_storage', 'GOOGLE_DRIVE',
    'secure_file_transport', 'SUPABASE_PRIVATE_STORAGE',
    'asten_transactional_outbox', true
  );
$$;

revoke all on function public.portal_claim_asten_dispatch(text,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.portal_update_asten_dispatch(text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.portal_runtime_capabilities() from public, anon, authenticated;
grant execute on function public.portal_claim_asten_dispatch(text,text,text,text,integer) to service_role;
grant execute on function public.portal_update_asten_dispatch(text,text,text,text,text,text) to service_role;
grant execute on function public.portal_runtime_capabilities() to service_role;

commit;
