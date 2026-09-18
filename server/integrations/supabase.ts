import { createHash, randomUUID } from 'node:crypto';

export interface SupabaseRuntimeStatus {
  configured: boolean;
  connected: boolean;
  durablePersistenceReady: boolean;
  normalizedSchemaReady: boolean;
  transactionalRuntimeReady: boolean;
  runtimeMode: 'TRANSACTIONAL_AGGREGATE' | 'LOCAL_FILE';
  keyMode: 'SECRET_KEY' | 'LEGACY_SERVICE_ROLE' | 'MISSING';
  message: string;
}

const supabaseUrl = () => String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const supabaseSecret = () => String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const providerEnabled = () => process.env.PORTAL_PERSISTENCE_PROVIDER === 'supabase';
const stateEndpoint = () => `${supabaseUrl()}/rest/v1/portal_runtime_state`;
const runtimeAssetsEndpoint = () => `${supabaseUrl()}/rest/v1/portal_runtime_assets`;
const LARGE_RUNTIME_IMAGE_THRESHOLD=32_768;
let knownRevision:number|null=null;
export const buildSupabaseAdminHeaders = () => {
  const secret = supabaseSecret();
  const headers:Record<string,string>={ apikey: secret, 'Content-Type': 'application/json', Accept: 'application/json' };
  if(!secret.startsWith('sb_secret_'))headers.Authorization=`Bearer ${secret}`;
  return headers;
};
const adminHeaders = buildSupabaseAdminHeaders;

function parseLargeRuntimeImage(value:string):{mimeType:string;base64:string}|null{
  if(value.length<LARGE_RUNTIME_IMAGE_THRESHOLD)return null;
  const match=/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(value);
  return match?{mimeType:match[1],base64:match[2]}:null;
}

function runtimeAssetReference(assetKey:string){return `/api/public/runtime-assets/${assetKey}`;}

type RuntimeAsset={assetKey:string;mimeType:string;dataUrl:string;byteLength:number};

function collectAndExternalizeRuntimeImages(value:unknown,assets:Map<string,RuntimeAsset>):unknown{
  if(typeof value==='string'){
    const image=parseLargeRuntimeImage(value);
    if(!image)return value;
    const assetKey=createHash('sha256').update(value).digest('hex');
    if(!assets.has(assetKey))assets.set(assetKey,{assetKey,mimeType:image.mimeType,dataUrl:value,byteLength:Buffer.from(image.base64,'base64').length});
    return runtimeAssetReference(assetKey);
  }
  if(Array.isArray(value))return value.map(item=>collectAndExternalizeRuntimeImages(item,assets));
  if(value&&typeof value==='object'){
    return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([key,item])=>[key,collectAndExternalizeRuntimeImages(item,assets)]));
  }
  return value;
}

async function upsertRuntimeAsset(asset:RuntimeAsset):Promise<void>{
  const response=await fetch(`${runtimeAssetsEndpoint()}?on_conflict=asset_key`,{
    method:'POST',
    headers:{...adminHeaders(),Prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify({asset_key:asset.assetKey,mime_type:asset.mimeType,data_url:asset.dataUrl,byte_length:asset.byteLength,updated_at:new Date().toISOString()}),
    signal:AbortSignal.timeout(20_000)
  });
  if(!response.ok){
    const detail=await response.text().catch(()=>'');
    throw new Error(`Falha ao externalizar ativo visual do runtime (${response.status})${detail?`: ${detail.slice(0,160)}`:''}.`);
  }
}

async function externalizeRuntimeImages(payload:object):Promise<object>{
  const assets=new Map<string,RuntimeAsset>();
  const sanitized=collectAndExternalizeRuntimeImages(payload,assets) as object;
  for(const asset of assets.values())await upsertRuntimeAsset(asset);
  return sanitized;
}

export async function appendSupabaseAuditEvent(input:{externalId:string;occurredAt:string;processCode?:string;eventType:string;entityType:string;entityId?:string;details?:Record<string,unknown>}):Promise<void>{
  if(!getSupabaseRuntimeStatus().durablePersistenceReady)return;
  const response=await fetch(`${supabaseUrl()}/rest/v1/portal_audit_events`,{method:'POST',headers:{...adminHeaders(),Prefer:'return=minimal'},body:JSON.stringify({external_id:input.externalId,occurred_at:input.occurredAt,process_code:input.processCode||null,event_type:input.eventType,entity_type:input.entityType,entity_id:input.entityId||null,details:input.details||{}}),signal:AbortSignal.timeout(8_000)});
  if(!response.ok)throw new Error(`Falha ao registrar auditoria append-only (${response.status}).`);
}

export type AstenDispatchClaim = {
  outcome: 'CLAIMED'|'BUSY'|'UNCERTAIN'|'ALREADY_CREATED'|'DISPATCHED';
  claimToken?: string;
  providerEnvelopeId?: string;
  providerEnvelopeHash?: string;
};

export async function claimAstenEnvelopeDispatch(input:{idempotencyKey:string;jobId:string;contentSha256:string}):Promise<AstenDispatchClaim>{
  if(!getSupabaseRuntimeStatus().durablePersistenceReady)return{outcome:'CLAIMED'};
  const claimToken=randomUUID();
  const response=await fetch(`${supabaseUrl()}/rest/v1/rpc/portal_claim_asten_dispatch`,{
    method:'POST',headers:adminHeaders(),body:JSON.stringify({
      p_idempotency_key:input.idempotencyKey,
      p_job_external_id:input.jobId,
      p_content_sha256:input.contentSha256,
      p_claim_token:claimToken,
      p_lease_seconds:120
    }),signal:AbortSignal.timeout(12_000)
  });
  if(!response.ok){const detail=await response.text().catch(()=>'');throw new Error(`Não foi possível reservar o envio Asten (${response.status})${detail?`: ${detail.slice(0,160)}`:''}.`);}
  const value=await response.json() as Record<string,unknown>;
  const payload=(Array.isArray(value)?value[0]:value) as Record<string,unknown>;
  const outcome=String(payload?.outcome||'') as AstenDispatchClaim['outcome'];
  if(!['CLAIMED','BUSY','UNCERTAIN','ALREADY_CREATED','DISPATCHED'].includes(outcome))throw new Error('O Supabase não confirmou a reserva transacional da Asten.');
  return{outcome,...(outcome==='CLAIMED'?{claimToken}:{}),providerEnvelopeId:String(payload?.providerEnvelopeId||'')||undefined,providerEnvelopeHash:String(payload?.providerEnvelopeHash||'')||undefined};
}

export async function updateAstenEnvelopeDispatch(input:{idempotencyKey:string;state:'UNCERTAIN'|'ENVELOPE_CREATED'|'DISPATCHED';claimToken?:string;providerEnvelopeId?:string;providerEnvelopeHash?:string;errorCode?:string}):Promise<void>{
  if(!getSupabaseRuntimeStatus().durablePersistenceReady)return;
  const response=await fetch(`${supabaseUrl()}/rest/v1/rpc/portal_update_asten_dispatch`,{
    method:'POST',headers:adminHeaders(),body:JSON.stringify({
      p_idempotency_key:input.idempotencyKey,
      p_state:input.state,
      p_claim_token:input.claimToken||null,
      p_provider_envelope_id:input.providerEnvelopeId||null,
      p_provider_envelope_hash:input.providerEnvelopeHash||null,
      p_error_code:input.errorCode||null
    }),signal:AbortSignal.timeout(12_000)
  });
  if(!response.ok){const detail=await response.text().catch(()=>'');throw new Error(`Não foi possível confirmar o estado do envio Asten (${response.status})${detail?`: ${detail.slice(0,160)}`:''}.`);}
}

export function getSupabaseRuntimeStatus(): Omit<SupabaseRuntimeStatus, 'connected'> {
  const url = supabaseUrl();
  const secret = supabaseSecret();
  const keyMode = process.env.SUPABASE_SECRET_KEY
    ? 'SECRET_KEY'
    : process.env.SUPABASE_SERVICE_ROLE_KEY
      ? 'LEGACY_SERVICE_ROLE'
      : 'MISSING';
  const configured = Boolean(url && secret);
  return {
    configured,
    durablePersistenceReady: configured && providerEnabled(),
    normalizedSchemaReady: false,
    transactionalRuntimeReady: false,
    runtimeMode: providerEnabled() ? 'TRANSACTIONAL_AGGREGATE' : 'LOCAL_FILE',
    keyMode,
    message: configured
      ? 'Credenciais exclusivas do servidor encontradas. Execute o teste para validar o commit transacional e as projeções normalizadas.'
      : 'Configure SUPABASE_URL e SUPABASE_SECRET_KEY somente no ambiente do servidor.'
  };
}

export async function loadPortalRuntimeState<T extends object>(): Promise<T | null> {
  if (!getSupabaseRuntimeStatus().durablePersistenceReady) return null;
  const response = await fetch(`${stateEndpoint()}?id=eq.global&select=payload,revision&limit=1`, { headers: adminHeaders(), signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Falha ao carregar o estado do Supabase (${response.status}).`);
  const rows = await response.json();
  knownRevision=rows?.[0]?Number(rows[0].revision||1):0;
  return rows?.[0]?.payload && typeof rows[0].payload === 'object' ? rows[0].payload as T : null;
}

export async function savePortalRuntimeState(payload: object): Promise<void> {
  if (!getSupabaseRuntimeStatus().durablePersistenceReady) return;
  if(knownRevision===null)await loadPortalRuntimeState();
  const expected=knownRevision||0;
  const compactPayload=await externalizeRuntimeImages(payload);
  const response = await fetch(`${supabaseUrl()}/rest/v1/rpc/portal_commit_runtime_state`, {
    method: 'POST',
    headers: { ...adminHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({ expected_revision: expected, next_payload: compactPayload }),
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) {
    const detail=await response.text().catch(()=>'');
    if(response.status===409||detail.includes('40001')||detail.toLowerCase().includes('concorr'))throw new Error('Conflito de concorrência: outra instância atualizou o portal. Recarregue antes de tentar novamente.');
    throw new Error(`Falha no commit transacional do Supabase (${response.status})${detail?`: ${detail.slice(0,180)}`:''}.`);
  }
  const result=await response.json().catch(()=>null);
  const revision=Number(Array.isArray(result)?result[0]:result);
  if(!Number.isFinite(revision)||revision!==expected+1)throw new Error('O Supabase não confirmou a revisão transacional esperada.');
  knownRevision=revision;
}

export async function testSupabaseRuntimeConnection(): Promise<SupabaseRuntimeStatus> {
  const base = getSupabaseRuntimeStatus();
  if (!base.configured) return { ...base, connected: false };
  const secret = supabaseSecret();
  try {
    const response = await fetch(`${supabaseUrl()}/rest/v1/portal_runtime_state?select=id&limit=1`, {
      headers: adminHeaders(),
      signal: AbortSignal.timeout(12_000)
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Supabase respondeu ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`);
    }
    const normalizedChecks=await Promise.all(['portal_users','portal_processes','portal_process_authors','portal_process_memberships','portal_access_entries','portal_access_sources','portal_files','portal_signature_jobs','portal_signature_signers','portal_publications','portal_email_deliveries','portal_workflow_runs','portal_audit_events','portal_runtime_commits','portal_installation_config','portal_academic_cycles','portal_administration_transfers','portal_upload_staging','portal_download_transfers','portal_asten_dispatch_claims'].map(async table=>{
      const check=await fetch(`${supabaseUrl()}/rest/v1/${table}?select=*&limit=0`,{headers:{...adminHeaders(),Prefer:'count=none'},signal:AbortSignal.timeout(12_000)}).catch(()=>null);
      return Boolean(check?.ok);
    }));
    const normalizedSchemaReady=normalizedChecks.every(Boolean);
    let transactionalRuntimeReady=false;
    if(normalizedSchemaReady){
      const capability=await fetch(`${supabaseUrl()}/rest/v1/rpc/portal_runtime_capabilities`,{method:'POST',headers:adminHeaders(),body:'{}',signal:AbortSignal.timeout(12_000)}).catch(()=>null);
      if(capability?.ok){const value=await capability.json().catch(()=>null);const payload=Array.isArray(value)?value[0]:value;transactionalRuntimeReady=Boolean(payload?.transactional_runtime&&payload?.secure_file_transport==='SUPABASE_PRIVATE_STORAGE'&&payload?.asten_transactional_outbox===true&&Number(payload?.schema_version)>=6);}
    }
    return { ...base, connected: true, normalizedSchemaReady, transactionalRuntimeReady, message: transactionalRuntimeReady?'Conexão validada: runtime transacional v6, transporte privado e outbox Asten estão ativos. Execute ainda o piloto real antes de abrir o portal.':normalizedSchemaReady?'Esquema normalizado detectado, mas a migração v6 da outbox Asten ainda não foi confirmada.':'Conexão básica validada. Aplique todas as migrações, inclusive a v6 da outbox Asten, antes da homologação.' };
  } catch (error) {
    return { ...base, connected: false, message: error instanceof Error ? error.message : 'Falha ao testar o Supabase.' };
  }
}
