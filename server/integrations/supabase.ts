import { createHash, createHmac, randomUUID } from 'node:crypto';
import { storePrivatePortalImage, readPrivatePortalImage, normalizePortalImage, type PrivatePortalImage } from './googleDriveImages';

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
let knownRevision:number|null=null;
/** Revisão do estado operacional confirmada pelo banco, após a leitura/commit da requisição. */
export function currentPortalRuntimeRevision():number|null { return knownRevision; }

/** Sinal opaco de revisão: não revela registros privados nem o contador de operações. */
export async function publicPortalRevisionToken():Promise<string> {
  if(!getSupabaseRuntimeStatus().durablePersistenceReady)return 'local';
  const response=await fetch(stateEndpoint()+'?id=eq.global&select=revision&limit=1',{
    headers:adminHeaders(),signal:AbortSignal.timeout(12_000),
  });
  if(!response.ok)throw new Error('Não foi possível verificar a revisão do portal.');
  const rows=await response.json() as Array<{revision:number}>;
  const revision=Number(rows?.[0]?.revision||0);
  return createHmac('sha256',supabaseSecret()).update('portal-public-sync-v1:'+revision).digest('hex').slice(0,24);
}
export const buildSupabaseAdminHeaders = () => {
  const secret = supabaseSecret();
  const headers:Record<string,string>={ apikey: secret, 'Content-Type': 'application/json', Accept: 'application/json' };
  if(!secret.startsWith('sb_secret_'))headers.Authorization=`Bearer ${secret}`;
  return headers;
};
const adminHeaders = buildSupabaseAdminHeaders;

function parseRuntimeImage(value:string):{mimeType:string;base64:string}|null{
  const match=/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(value);
  return match?{mimeType:match[1],base64:match[2]}:null;
}

function runtimeAssetReference(assetKey:string){return `/api/public/runtime-assets/${assetKey}`;}

type RuntimeAsset={assetKey:string;mimeType:string;dataUrl:string;byteLength:number};

function collectAndExternalizeRuntimeImages(value:unknown,assets:Map<string,RuntimeAsset>):unknown{
  if(typeof value==='string'){
    const image=parseRuntimeImage(value);
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

async function upsertRuntimeAsset(asset:RuntimeAsset,archive=storePrivatePortalImage,academicRootId?:string):Promise<void>{
  // Check the additive migration before creating a file. Missing columns fail closed.
  const prior=await fetch(`${runtimeAssetsEndpoint()}?select=drive_file_id,content_sha256&limit=0`,{headers:adminHeaders(),signal:AbortSignal.timeout(15_000)});
  if(!prior.ok)throw new Error('O armazenamento de imagens no Drive ainda não está preparado.');
  const stored=await archive({bytes:Buffer.from(asset.dataUrl.split(',')[1],'base64'),mimeType:asset.mimeType,kind:'RUNTIME_ASSET',key:asset.assetKey,...(academicRootId!==undefined?{academicRootId}:{})});
  const response=await fetch(`${runtimeAssetsEndpoint()}?on_conflict=asset_key`,{
    method:'POST',
    headers:{...adminHeaders(),Prefer:'resolution=merge-duplicates,return=minimal'},
    // Omit data_url: upsert must preserve legacy bytes until verified migration.
    body:JSON.stringify({asset_key:asset.assetKey,mime_type:stored.mimeType,byte_length:stored.byteLength,drive_file_id:stored.driveFileId,content_sha256:stored.contentSha256,updated_at:new Date().toISOString()}),
    signal:AbortSignal.timeout(20_000)
  });
  if(!response.ok){
    const detail=await response.text().catch(()=>'');
    throw new Error(`Falha ao externalizar ativo visual do runtime (${response.status})${detail?`: ${detail.slice(0,160)}`:''}.`);
  }
}

export async function externalizeRuntimeImages(payload:object,archive=storePrivatePortalImage):Promise<object>{
  const assets=new Map<string,RuntimeAsset>();
  const sanitized=collectAndExternalizeRuntimeImages(payload,assets) as object;
  const academicRootId=(payload as {settings?:{driveRootFolderId?:string}}).settings?.driveRootFolderId;
  for(const asset of assets.values())await upsertRuntimeAsset(asset,archive,academicRootId);
  return sanitized;
}

// E-mail clients need an HTTPS image even when its optimized bytes are small.
export async function persistStudioRuntimeImage(dataUrl:string,archive=storePrivatePortalImage):Promise<string>{
  const match=dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match||dataUrl.length>4*1024*1024)throw new Error('Imagem inválida.');
  const assetKey=createHash('sha256').update(dataUrl).digest('hex');
  await upsertRuntimeAsset({assetKey,mimeType:match[1],dataUrl,byteLength:Buffer.from(match[2],'base64').length},archive);
  return runtimeAssetReference(assetKey);
}

/** Legacy reads remain available while verified Drive references are backfilled. */
export async function loadRuntimeImage(assetKey:string,read=readPrivatePortalImage):Promise<{bytes:Buffer;mimeType:string}|null>{
  if(!/^[a-f0-9]{64}$/.test(assetKey))return null;
  const response=await fetch(`${runtimeAssetsEndpoint()}?asset_key=eq.${assetKey}&select=*&limit=1`,{headers:adminHeaders(),signal:AbortSignal.timeout(15_000)});
  if(!response.ok)throw new Error(`O banco não confirmou a leitura da imagem (${response.status}).`);
  const item=(await response.json() as Array<Record<string,unknown>>)[0];
  if(!item)return null;
  if(item.drive_file_id){
    const ref:PrivatePortalImage={driveFileId:String(item.drive_file_id),contentSha256:String(item.content_sha256||''),mimeType:String(item.mime_type||''),byteLength:Number(item.byte_length)};
    return {bytes:await read(ref,'RUNTIME_ASSET'),mimeType:ref.mimeType};
  }
  const match=/^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(item.data_url||''));
  if(!match)return null;
  const bytes=Buffer.from(match[2],'base64');
  if(!bytes.length||bytes.length>4*1024*1024||bytes.toString('base64')!==match[2])throw new Error('Imagem inválida.');
  if(match[1]==='image/gif'||match[1]==='image/svg+xml')return normalizePortalImage(bytes,match[1]);
  return {bytes,mimeType:match[1]};
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

/** Leitura idempotente: a extração simultânea do JSONB pode atingir o limite
 * de consulta do PostgREST (57014 / HTTP 500) durante partidas a frio.
 * Tentativas estritamente limitadas e desencontradas; nunca repetir escritas,
 * nunca ocultar 401/403, nunca aceitar um estado antigo como substituto.
 */
async function fetchPortalStateSnapshot(): Promise<Response> {
  const url = `${stateEndpoint()}?id=eq.global&select=payload,revision&limit=1`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { headers: adminHeaders(), signal: AbortSignal.timeout(20_000) });
    if (response.ok || ![500, 502, 503, 504].includes(response.status) || attempt === 2) return response;
    await new Promise<void>(resolve => setTimeout(resolve, 250 * (attempt + 1) + Math.floor(Math.random() * 250)));
  }
  throw new Error('Leitura do estado não retornou resposta.');
}

/** Consulta somente a revisão antes de reidratar a instância.
 * Cada requisição autenticada verifica o banco; não há TTL que possa
 * manter permissões ou revogações desatualizadas.
 * No cold start (revisão desconhecida), força leitura integral.
 */
export async function portalRuntimeStateNeedsRefresh():Promise<boolean>{
  if(!getSupabaseRuntimeStatus().durablePersistenceReady)return false;
  if(knownRevision===null)return true;
  const response=await fetch(`${stateEndpoint()}?id=eq.global&select=revision&limit=1`,{
    headers:adminHeaders(),signal:AbortSignal.timeout(12_000),
  });
  if(!response.ok)throw new Error(`Falha ao verificar a revisão do Supabase (${response.status}).`);
  const rows=await response.json();
  if(!Array.isArray(rows)||rows.length!==1){
    throw new Error('Revisão do estado indisponível; acesso bloqueado preventivamente.');
  }
  const revision=Number(rows[0]?.revision);
  if(!Number.isSafeInteger(revision)||revision<1){
    throw new Error('Revisão do estado inválida; acesso bloqueado preventivamente.');
  }
  return revision!==knownRevision;
}

export async function loadPortalRuntimeState<T extends object>(trackRevision=true): Promise<T | null> {
  if (!getSupabaseRuntimeStatus().durablePersistenceReady) return null;
  const response = await fetchPortalStateSnapshot();
  if (!response.ok) throw new Error(`Falha ao carregar o estado do Supabase (${response.status}).`);
  const rows = await response.json();
  if(trackRevision)knownRevision=rows?.[0]?Number(rows[0].revision||1):0;
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
    let errorCode='';
    try{errorCode=String(JSON.parse(detail)?.code||'');}catch{}
    // PT409 is a business revision conflict, not a PostgreSQL serialization
    // failure. Keep legacy 40001 compatibility, but never retry either here:
    // the caller must reload the authoritative state and review its change.
    if(errorCode==='PT409'||errorCode==='40001'||detail.toLowerCase().includes('conflito de concorr'))throw new Error('Conflito de concorrência: outra instância atualizou o portal. Recarregue antes de tentar novamente.');
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

type DiagnosticCacheEntry={key:string;expiresAt:number;value:SupabaseRuntimeStatus};
let diagnosticCache:DiagnosticCacheEntry|null=null;
let diagnosticPending:{key:string;promise:Promise<SupabaseRuntimeStatus>}|null=null;

/** Short-lived administrative diagnostics only. Authorization, mutations and
 * startup validation continue to read/test the database directly. */
export async function getSupabaseRuntimeConnectionStatus():Promise<SupabaseRuntimeStatus>{
  const key=createHash('sha256').update(`${supabaseUrl()}|${String(process.env.PORTAL_PERSISTENCE_PROVIDER||'')}|${supabaseSecret()}`).digest('hex');
  if(diagnosticCache?.key===key&&diagnosticCache.expiresAt>Date.now())return {...diagnosticCache.value};
  if(diagnosticPending?.key===key)return {...await diagnosticPending.promise};
  const promise=testSupabaseRuntimeConnection();
  diagnosticPending={key,promise};
  try{
    const value=await promise;
    if(value.connected&&value.transactionalRuntimeReady){
      diagnosticCache={key,value:{...value},expiresAt:Date.now()+30_000};
    }
    return {...value};
  }finally{
    if(diagnosticPending?.promise===promise)diagnosticPending=null;
  }
}

export async function purgeSupabaseProcessHistory(processId:string,protocol:string,jobIds:string[]):Promise<void>{
 if(!getSupabaseRuntimeStatus().durablePersistenceReady)return;
 const response=await fetch(`${supabaseUrl()}/rest/v1/rpc/portal_master_purge_process_history`,{method:'POST',headers:adminHeaders(),body:JSON.stringify({p_external_id:processId,p_protocol:protocol,p_job_ids:jobIds}),signal:AbortSignal.timeout(20000)});
 if(!response.ok){const detail=await response.json().catch(()=>({}));const code=String(detail?.code||'UNKNOWN').replace(/[^A-Z0-9_]/gi,'').slice(0,24);throw Error(code==='PGRST202'?'Supabase: a atualização da rotina de limpeza ainda não foi instalada.':`Supabase: limpeza pendente (HTTP ${response.status}; código ${code}).`);}
}
