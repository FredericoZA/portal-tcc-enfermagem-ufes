import {runtimeCommitPayloadHash} from './runtimeCommitHash';
import {isDeepStrictEqual} from 'node:util';
import {existingSignatureJobPatch} from './signatureJobPatch';
import {documentModelPublicationPatch} from './documentModelPatch';
import {RuntimeSnapshotReadBudget,readSnapshotWithTransportRecovery,snapshotTransportFailure} from './runtimeSnapshotRead';
import type {GlobalSettings, ProcessData} from '../../src/types';
import type {RegistrationDraft} from '../../src/types/workflowOperations';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { storePrivatePortalImage, readPrivatePortalImage, normalizePortalImage, type PrivatePortalImage } from './googleDriveImages';

export interface SupabaseRuntimeStatus {
  configured: boolean;
  connected: boolean;
  durablePersistenceReady: boolean;
  normalizedSchemaReady: boolean;
  signatureSignerRolesReady?: boolean;
  signatureCoadvisorRoleReady?: boolean;
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
type AuditChunks = Map<string, readonly unknown[]>;
let cachedSnapshot: {revision: number; payload: object; auditChunks?: AuditChunks; endpoint: string} | undefined;
let auditRpcBackoff: {endpoint:string; retryAfter:number} | undefined;
/** Revisão do estado operacional confirmada pelo banco, após a leitura/commit da requisição. */
export function currentPortalRuntimeRevision():number|null { return knownRevision; }

/** Preserve a bounded diagnostic signal, never the private PostgREST response. */
export async function runtimeReadFailure(response:Response,stage:'REVISION'|'SNAPSHOT'):Promise<Error>{
  const detail=await response.json().catch(()=>null);
  const databaseCode=typeof detail?.code==='string'&&/^[A-Z0-9]{5}$/.test(detail.code)?detail.code:undefined;
  return Object.assign(new Error(stage==='REVISION'
    ? `Não foi possível verificar a revisão do portal (${response.status}).`
    : `Falha ao carregar o estado do Supabase (${response.status}).`),{
    code:databaseCode?`SUPABASE_${databaseCode}`:`SUPABASE_HTTP_${response.status}`,
    stage,httpStatus:response.status,
  });
}

export async function readPortalRuntimeRevision(): Promise<number | null> {
  const response = await fetchPortalState('revision', 12_000);
  if (!response.ok) throw await runtimeReadFailure(response,'REVISION');
  const rows: unknown = await response.json();
  if (Array.isArray(rows) && rows.length === 0) return null;
  const revision = Array.isArray(rows) ? rows[0]?.revision : undefined;
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('Revisão inválida no Supabase.');
  return revision;
}

let publicRevisionRead: {endpoint: string; pending: Promise<number | null>} | undefined;

/** Sinal opaco de revisão: não revela registros privados nem o contador de operações. */
export async function publicPortalRevisionToken():Promise<string> {
  if(!getSupabaseRuntimeStatus().durablePersistenceReady)return 'local';
  const endpoint = stateEndpoint();
  if (publicRevisionRead?.endpoint !== endpoint) {
    publicRevisionRead = {endpoint, pending: readPortalRuntimeRevision()};
  }
  const {pending} = publicRevisionRead;
  try {
    const revision = await pending ?? 0;
    return createHmac('sha256',supabaseSecret()).update('portal-public-sync-v1:'+revision).digest('hex').slice(0,24);
  } finally {
    if (publicRevisionRead?.pending === pending) publicRevisionRead = undefined;
  }
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
  const query=(fields:string)=>fetch(`${runtimeAssetsEndpoint()}?asset_key=eq.${assetKey}&select=${fields}&limit=1`,{
    headers:adminHeaders(),signal:AbortSignal.timeout(15_000),
  });
  const metadata=await query('drive_file_id,content_sha256,mime_type,byte_length');
  if(metadata.ok){
    const item=(await metadata.json() as Array<Record<string,unknown>>)[0];
    if(!item)return null;
    if(item.drive_file_id){
      const ref:PrivatePortalImage={driveFileId:String(item.drive_file_id),contentSha256:String(item.content_sha256||''),mimeType:String(item.mime_type||''),byteLength:Number(item.byte_length)};
      return {bytes:await read(ref,'RUNTIME_ASSET'),mimeType:ref.mimeType};
    }
  }else{
    const code=metadata.status===400?(await metadata.json().catch(()=>null))?.code:undefined;
    if(code!=='42703'&&code!=='PGRST204')throw new Error(`O banco não confirmou a leitura da imagem (${metadata.status}).`);
  }
  const legacy=await query('data_url');
  if(!legacy.ok)throw new Error(`O banco não confirmou a leitura da imagem (${legacy.status}).`);
  const item=(await legacy.json() as Array<{data_url?:string}>)[0];
  const match=/^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/]+={0,2})$/.exec(item?.data_url||'');
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
  outcome: 'PREPARED'|'BUSY'|'UNCERTAIN'|'ALREADY_CREATED'|'DISPATCHED';
  claimToken?: string;
  providerEnvelopeId?: string;
  providerEnvelopeHash?: string;
};

export async function claimAstenEnvelopeDispatch(input:{idempotencyKey:string;jobId:string;contentSha256:string}):Promise<AstenDispatchClaim>{
  if(!getSupabaseRuntimeStatus().durablePersistenceReady)return{outcome:'PREPARED'};
  const claimToken=randomUUID();
  const response=await fetch(`${supabaseUrl()}/rest/v1/rpc/portal_prepare_asten_dispatch`,{
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
  if(!['PREPARED','BUSY','UNCERTAIN','ALREADY_CREATED','DISPATCHED'].includes(outcome))throw new Error('O Supabase não confirmou a preparação transacional da Asten.');
  if(['ALREADY_CREATED','DISPATCHED'].includes(outcome)&&!payload?.providerEnvelopeId)throw new Error('A preparação Asten não confirmou a identidade do envelope existente.');
  return{outcome,...(outcome==='PREPARED'?{claimToken}:{}),providerEnvelopeId:String(payload?.providerEnvelopeId||'')||undefined,providerEnvelopeHash:String(payload?.providerEnvelopeHash||'')||undefined};
}

export async function startPreparedAstenEnvelopeDispatch(input:{idempotencyKey:string;jobId:string;contentSha256:string;claimToken?:string}):Promise<void>{
  if(!getSupabaseRuntimeStatus().durablePersistenceReady)return;
  if(!input.claimToken)throw new Error('A preparação Asten não possui um token de reserva confirmado.');
  const response=await fetch(`${supabaseUrl()}/rest/v1/rpc/portal_start_prepared_asten_dispatch`,{
    method:'POST',headers:adminHeaders(),body:JSON.stringify({p_idempotency_key:input.idempotencyKey,p_job_external_id:input.jobId,p_content_sha256:input.contentSha256,p_claim_token:input.claimToken}),signal:AbortSignal.timeout(12_000)
  });
  if(!response.ok)throw new Error(`O Supabase não confirmou o início exclusivo da criação Asten (${response.status}).`);
  const value:unknown=await response.json();
  const payload=Array.isArray(value)?value[0]:value;
  if(!payload||typeof payload!=='object'||(payload as {outcome?:unknown}).outcome!=='STARTED')throw new Error('O Supabase não confirmou o início exclusivo da criação Asten.');
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
async function readSupabase(url: string, timeout: number, body?: string, fallbackOnStatementTimeout = false,budget?:RuntimeSnapshotReadBudget,accept?:string): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      headers: {...adminHeaders(),...(accept?{Accept:accept}:{})}, cache: 'no-store', signal: AbortSignal.timeout(budget?budget.timeout(url,timeout):timeout),
      ...(body === undefined ? {} : {method:'POST',body}),
    });
    if (response.ok || ![500, 502, 503, 504].includes(response.status) || attempt === 2 || (budget&&!budget.canAttempt(url))) return response;
    // RPC readers have a current canonical fallback. Reserve the shared budget
    // for that path rather than spending it retrying a failing gateway.
    if (fallbackOnStatementTimeout && [502,503,504].includes(response.status)) return response;
    if (fallbackOnStatementTimeout && response.status === 500) {
      const error = await response.clone().json().catch(() => null);
      if (error?.code === '57014') return response;
    }
    const delay=250*(attempt+1)+Math.floor(Math.random()*250);
    if(budget)await budget.backoff(delay);else await new Promise<void>(resolve=>setTimeout(resolve,delay));
  }
  throw new Error('Leitura do estado não retornou resposta.');
}

function fetchPortalState(selection: 'revision' | 'payload,revision', timeout: number,budget?:RuntimeSnapshotReadBudget): Promise<Response> {
  return readSupabase(`${stateEndpoint()}?id=eq.global&select=${selection}&limit=1`,timeout,undefined,false,budget);
}

/** A restricted deletion can retain a canceled row with a unique protocol. */
export async function loadRetainedProcessProtocols(): Promise<string[]> {
  if (!getSupabaseRuntimeStatus().durablePersistenceReady) return [];
  const protocols: string[] = [];
  const pageSize = 250;
  while (true) {
    const query = new URLSearchParams({select:'code',status:'eq.CANCELLED',order:'code.asc',limit:String(pageSize)});
    const previous = protocols.at(-1);
    if (previous) query.set('code', `gt.${previous}`);
    const response = await readSupabase(`${supabaseUrl()}/rest/v1/portal_processes?${query}`, 12_000);
    if (!response.ok) throw new Error('Não foi possível conferir os protocolos reservados no banco.');
    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.some(row => typeof row?.code !== 'string')) {
      throw new Error('Lista de protocolos reservados inválida no banco.');
    }
    protocols.push(...rows.map(row => row.code));
    if (rows.length < pageSize) return protocols;
  }
}

/** Read the calendar inputs from one committed row without transferring the audit or archive. */
export async function loadPortalCalendarSnapshot(timeoutMs=12_000): Promise<{
  revision: number;
  processes: ProcessData[];
  settings?: Pick<GlobalSettings, 'installationProfile'>;
} | null> {
  if (!getSupabaseRuntimeStatus().durablePersistenceReady) return null;
  const query = new URLSearchParams({
    id: 'eq.global',
    select: 'revision,processes:payload->processes,installationProfile:payload->settings->installationProfile',
    limit: '1',
  });
  const response = await readSupabase(`${stateEndpoint()}?${query}`, timeoutMs);
  if (!response.ok) throw await runtimeReadFailure(response, 'SNAPSHOT');
  const rows = await response.json();
  if (!Array.isArray(rows) || !Array.isArray(rows[0]?.processes)) {
    throw new Error('O Supabase retornou dados inválidos para o calendário.');
  }
  const {revision, processes, installationProfile} = rows[0];
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('Revisão do calendário inválida.');
  return {revision, processes, settings: installationProfile ? {installationProfile} : undefined};
}

/** Resolve an image's Drive location without reading the private academic snapshot. */
export async function loadRuntimeDriveRootId(): Promise<string | null> {
  if(!getSupabaseRuntimeStatus().durablePersistenceReady)return null;
  const query=new URLSearchParams({id:'eq.global',select:'driveRootFolderId:payload->settings->>driveRootFolderId',limit:'1'});
  const response=await readSupabase(`${stateEndpoint()}?${query}`,12_000);
  if(!response.ok)throw new Error(`Não foi possível consultar a raiz do Drive no Supabase (${response.status}).`);
  const rows:unknown=await response.json();
  if(!Array.isArray(rows))throw new Error('Configuração da raiz do Drive inválida no Supabase.');
  const value=rows[0]?.driveRootFolderId;
  return typeof value==='string'&&value.trim()?value:null;
}

async function fetchPortalSnapshot(endpoint:string, knownChunks?:AuditChunks,budget?:RuntimeSnapshotReadBudget):Promise<{response:Response;delta:boolean}> {
  // Cold workers reuse the atomically serialized current row. PostgREST need not
  // convert the entire JSONB history again for each simultaneous cold request.
  // Raw bytea also bypasses PostgREST JSON aggregation/reparsing of that envelope.
  // These bytes contain the same current metadata JSON, never document files.
  // Warm workers retain audit deltas, avoiding a full download on every refresh.
  // After the first confirmed snapshot, keep the RPC path: its first refresh
  // establishes chunk hashes and subsequent changed revisions reuse the delta.
  if(cachedSnapshot?.endpoint!==endpoint){
    const wireEnabled=process.env.PORTAL_RUNTIME_WIRE_SNAPSHOT ?? (process.env.NODE_ENV==='production'?'true':'false');
    if(wireEnabled==='true'){
      try {
        const response=await readSupabase(`${supabaseUrl()}/rest/v1/rpc/portal_read_runtime_wire_bytes_v1`,20_000,'{}',true,budget,'application/octet-stream');
        const detail=response.ok?null:await response.clone().json().catch(()=>null);
        const missing=response.status===404&&detail?.code==='PGRST202';
        const transient=detail?.code!=='PT503'&&(
          (response.status===500&&detail?.code==='57014')||[502,503,504].includes(response.status)
        );
        // A transient serialization failure may use the SAME current canonical row.
        // Never reuse cache, accept denied access, or hide an explicitly stale projection.
        if(!missing&&!transient)return {response,delta:false};
      } catch(error) {
        if(snapshotTransportFailure(error)!=='TIMEOUT')throw error;
        const canonicalUrl=`${endpoint}?id=eq.global&select=payload,revision&limit=1`;
        if(budget&&!budget.consumeTransportRetry(error,canonicalUrl))throw error;
      }
    }
    return {response:await fetchPortalState('payload,revision',20_000,budget),delta:false};
  }
  const enabled=process.env.PORTAL_RUNTIME_AUDIT_DELTA ?? (process.env.NODE_ENV==='production'?'true':'false');
  if(enabled==='true' && (auditRpcBackoff?.endpoint!==endpoint || auditRpcBackoff.retryAfter<=Date.now())){
    try {
      const response = await readSupabase(
        `${supabaseUrl()}/rest/v1/rpc/portal_read_runtime_snapshot_v1`, 20_000,
        JSON.stringify({known_audit_chunks:Array.from(knownChunks?.keys() ?? []).slice(0,5000)}),
        // Se o banco já cancelou a RPC pelo prazo, a leitura canônica é a próxima tentativa.
        true,
        budget,
      );
      const detail=response.ok?null:await response.clone().json().catch(()=>null);
      const missing = response.status === 404 && detail?.code === 'PGRST202';
      const unavailable = detail?.code!=='PT503'&&[500, 502, 503, 504].includes(response.status);
      if (!missing && !unavailable) return {response,delta:true};
    } catch (error) {
      if (snapshotTransportFailure(error)!=='TIMEOUT') throw error;
      const canonicalUrl=`${stateEndpoint()}?id=eq.global&select=payload,revision&limit=1`;
      if(budget&&!budget.consumeTransportRetry(error,canonicalUrl))throw error;
    }
    // Use the canonical table after a temporary RPC failure or during schema rollout.
    auditRpcBackoff = {endpoint,retryAfter:Date.now()+60_000};
  }
  return {response:await fetchPortalState('payload,revision',20_000,budget),delta:false};
}

function restoreAuditChunks(payload:object,value:unknown,knownChunks?:AuditChunks):AuditChunks|undefined {
  if(value===null)return undefined;
  if(!Array.isArray(value)||Object.hasOwn(payload,'auditLogs'))throw new Error('Histórico de auditoria inválido no Supabase.');
  const chunks:AuditChunks=new Map();
  const auditLogs:unknown[]=[];
  for(const chunk of value){
    if(!chunk||typeof chunk.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(chunk.fingerprint)){
      throw new Error('Identificador inválido no histórico de auditoria do Supabase.');
    }
    const events=Object.hasOwn(chunk,'events') ? chunk.events : knownChunks?.get(chunk.fingerprint);
    if(!Array.isArray(events)||!events.length)throw new Error('Bloco do histórico de auditoria ausente no Supabase.');
    chunks.set(chunk.fingerprint,events);
    for(const event of events)auditLogs.push(event);
  }
  Object.assign(payload,{auditLogs});
  return chunks;
}

export async function loadPortalRuntimeState<T extends object>(trackRevision=true): Promise<T | null> {
  if (!getSupabaseRuntimeStatus().durablePersistenceReady) return null;
  const endpoint=stateEndpoint();
  const knownChunks=cachedSnapshot?.endpoint===endpoint ? cachedSnapshot.auditChunks : undefined;
  const {rows,delta}=await readSnapshotWithTransportRecovery(async budget=>{
    const {response,delta}=await fetchPortalSnapshot(endpoint,knownChunks,budget);
    if(!response.ok)throw await runtimeReadFailure(response,'SNAPSHOT');
    const rows:unknown=await response.json();
    return {rows,delta};
  });
  if (!Array.isArray(rows)) throw new Error('O Supabase retornou um estado inválido.');
  const row = rows[0];
  if (!row) {
    if (rows.length > 0 || (knownRevision !== null && knownRevision > 0)) {
      throw new Error('O estado persistido não foi encontrado no Supabase.');
    }
    if (trackRevision) knownRevision = 0;
    return null;
  }
  const {payload, revision} = row;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Number.isSafeInteger(revision) || revision < 1) {
    throw new Error('O Supabase retornou um estado ou uma revisão inválida.');
  }
  const auditChunks=delta?restoreAuditChunks(payload,row.audit_chunks,knownChunks):undefined;
  if (trackRevision) {
    cachedSnapshot = {revision,payload,endpoint,auditChunks};
    knownRevision = revision;
  }
  // The RPC may share verified chunks with the cache even for untracked reads.
  return (trackRevision||delta?structuredClone(payload):payload) as T;
}

export function readCachedPortalRuntimeState<T extends object>(revision:number):T|null {
  const snapshot=cachedSnapshot;
  return snapshot?.revision===revision&&snapshot.endpoint===stateEndpoint()
    ? structuredClone(snapshot.payload) as T
    : null;
}

/** Chamado sob a fila do runtime, depois que as escritas anteriores terminam. */
export async function refreshPortalRuntimeState<T extends object>(): Promise<T | null> {
  if (!getSupabaseRuntimeStatus().durablePersistenceReady) return null;
  if (cachedSnapshot?.endpoint===stateEndpoint() && cachedSnapshot.revision === knownRevision) {
    const revision = await readPortalRuntimeRevision();
    if (revision === null) throw new Error('O estado persistido não foi encontrado no Supabase.');
    // Cada requisição recebe uma cópia para isolar mutações não confirmadas.
    if (revision === cachedSnapshot.revision) return structuredClone(cachedSnapshot.payload) as T;
  }
  return loadPortalRuntimeState<T>();
}

/**
 * Pequeno snapshot autenticado e somente-leitura. Não altera o cache canônico,
 * que exige auditoria integral antes de qualquer escrita ou leitura de logs.
 * Omissão de RPC só ocorre durante implantação gradual; 401/403/5xx não
 * autorizam usar estado antigo ou dispensar verificações de acesso.
 */
let cachedLiteSnapshot: {endpoint:string;revision:number;payload:object}|undefined;

export async function loadPortalRuntimeLiteState<T extends object>():Promise<T|null>{
  if(!getSupabaseRuntimeStatus().durablePersistenceReady)return null;
  const endpoint=stateEndpoint();
  const response=await readSupabase(
    `${supabaseUrl()}/rest/v1/rpc/portal_read_runtime_lite_v1`,
    20_000, '{}', true
  );
  if(response.status===404){
    const detail=await response.clone().json().catch(()=>null);
    if(detail?.code==='PGRST202')return loadPortalRuntimeState<T>();
  }
  if(!response.ok)throw await runtimeReadFailure(response,'SNAPSHOT');
  const rows:unknown=await response.json();
  if(!Array.isArray(rows)||rows.length>1)throw new Error('A projeção reduzida retornou um estado inválido.');
  const row=rows[0];
  if(!row){
    if(knownRevision!==null&&knownRevision>0)throw new Error('O estado persistido não foi encontrado no Supabase.');
    return null;
  }
  const {payload,revision}=row;
  if(!payload||typeof payload!=='object'||Array.isArray(payload)
    ||Object.hasOwn(payload,'auditLogs')
    ||!Number.isSafeInteger(revision)||revision<1){
    throw new Error('A projeção reduzida retornou uma revisão ou um payload inválido.');
  }
  // Apenas revisão confirmada + leitura isolada da mesma linha do banco.
  cachedLiteSnapshot={endpoint,revision,payload};
  return structuredClone(payload) as T;
}

/** Mesmo GET de revisão existente; uma atualização não reutiliza snapshot antigo. */
export async function refreshPortalRuntimeLiteState<T extends object>():Promise<T|null>{
  if(!getSupabaseRuntimeStatus().durablePersistenceReady)return null;
  const cached=cachedLiteSnapshot;
  if(cached?.endpoint===stateEndpoint()){
    const revision=await readPortalRuntimeRevision();
    if(revision===null)throw new Error('O estado persistido não foi encontrado no Supabase.');
    if(revision===cached.revision)return structuredClone(cached.payload) as T;
  }
  return loadPortalRuntimeLiteState<T>();
}

/**
 * Lean reads are used only on explicitly whitelisted GETs. The omitted legacy
 * catalogue stays hydrated from the bootstrap; it is never written or replaced
 * from an incomplete payload. Full snapshot and CAS remain mandatory on writes.
 */
let cachedLeanSnapshot:{endpoint:string;revision:number;payload:object}|undefined;
export async function loadPortalRuntimeLeanState<T extends object>():Promise<T|null>{
  if(!getSupabaseRuntimeStatus().durablePersistenceReady)return null;
  const endpoint=stateEndpoint();
  const response=await readSupabase(
    `${supabaseUrl()}/rest/v1/rpc/portal_read_runtime_lean_v1`,20_000,'{}',true
  );
  if(response.status===404){
    const detail=await response.clone().json().catch(()=>null);
    if(detail?.code==='PGRST202')return loadPortalRuntimeLiteState<T>();
  }
  if(!response.ok)throw await runtimeReadFailure(response,'SNAPSHOT');
  const rows:unknown=await response.json();
  if(!Array.isArray(rows)||rows.length>1)throw new Error('A projeção mínima retornou um estado inválido.');
  const row=rows[0];
  if(!row){
    const revision=await readPortalRuntimeRevision();
    if(revision!==null)throw new Error('O estado operacional atual não foi encontrado.');
    return null;
  }
  const {payload,revision}=row;
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
    Object.hasOwn(payload,'auditLogs')||Object.hasOwn(payload,'legacyAcademicRecords')||
    !Number.isSafeInteger(revision)||revision<1)throw new Error('A projeção mínima retornou dados ou revisão inválidos.');
  cachedLeanSnapshot={endpoint,revision,payload};
  return structuredClone(payload) as T;
}
export async function refreshPortalRuntimeLeanState<T extends object>():Promise<T|null>{
  if(!getSupabaseRuntimeStatus().durablePersistenceReady)return null;
  const cached=cachedLeanSnapshot;
  if(cached?.endpoint===stateEndpoint()){
    const revision=await readPortalRuntimeRevision();
    if(revision===null)throw new Error('O estado persistido não foi encontrado.');
    if(revision===cached.revision)return structuredClone(cached.payload) as T;
  }
  return loadPortalRuntimeLeanState<T>();
}

/** A historical settings snapshot is recoverable only on a private, authorized
 * admin rollback. The normalized immutable audit event is its source of truth.
 */
export async function readArchivedSettingsBefore(externalId:string):Promise<Record<string,unknown>|null>{
  if(!/^log-[0-9]{10,16}$/.test(externalId))throw new Error('Identificador de auditoria arquivada inválido.');
  if(!getSupabaseRuntimeStatus().durablePersistenceReady)throw new Error('Histórico arquivado indisponível no modo local.');
  const url=`${supabaseUrl()}/rest/v1/portal_audit_events?external_id=eq.${encodeURIComponent(externalId)}&event_type=eq.ALTERACAO_CONFIGURACOES&select=details&limit=1`;
  const response=await readSupabase(url,12_000);
  if(!response.ok)throw await runtimeReadFailure(response,'SNAPSHOT');
  const rows:unknown=await response.json();
  if(!Array.isArray(rows)||rows.length>1)throw new Error('Auditoria arquivada inválida.');
  const value=rows[0]?.details?.before;
  return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
}

/** Resolve an ambiguous acknowledgement by reading the database, never by repeating a write. */
async function confirmAmbiguousRuntimeCommit(endpoint:string,expected:number,nextPayload:object):Promise<boolean>{
  try{
    // Intentionally bypass revision/local/delta caches: require a database proof.
    if(stateEndpoint()!==endpoint)return false;
    // Every canonical CAS commit already records this backend-only digest in
    // the same transaction. An exact revision+content proof is much smaller
    // than downloading the whole runtime (including its audit history) again.
    try{
      const query=new URLSearchParams({revision:`eq.${expected+1}`,select:'revision,payload_sha256',limit:'1'});
      const proof=await fetch(`${supabaseUrl()}/rest/v1/portal_runtime_commits?${query}`,{
        headers:adminHeaders(),cache:'no-store',signal:AbortSignal.timeout(5_000),
      });
      if(proof.ok&&stateEndpoint()===endpoint){
        const receipts:unknown=await proof.json();
        if(Array.isArray(receipts)&&receipts.length===1&&receipts[0]?.revision===expected+1&&receipts[0]?.payload_sha256===runtimeCommitPayloadHash(nextPayload)){
          const auditChunks=cachedSnapshot?.endpoint===endpoint?cachedSnapshot.auditChunks:undefined;
          cachedSnapshot={revision:expected+1,payload:nextPayload,endpoint,auditChunks};knownRevision=expected+1;
          return true;
        }
      }
    }catch{/* Legacy/full-state proof remains the safe fallback; never replay the write. */}
    // One bounded canonical fallback for legacy/missing receipts, not three
    // repeated full downloads after a write whose outcome is already unknown.
    const response=await fetch(`${endpoint}?id=eq.global&select=payload,revision&limit=1`,{
      headers:adminHeaders(),cache:'no-store',signal:AbortSignal.timeout(10_000),
    });
    if(!response.ok||stateEndpoint()!==endpoint)return false;
    const rows:unknown=await response.json();
    if(!Array.isArray(rows)||rows.length!==1)return false;
    const row=rows[0];
    if(row?.revision!==expected+1||!isDeepStrictEqual(row.payload,nextPayload))return false;
    const auditChunks=cachedSnapshot?.endpoint===endpoint?cachedSnapshot.auditChunks:undefined;
    cachedSnapshot={revision:row.revision,payload:row.payload,endpoint,auditChunks};
    knownRevision=row.revision;
    return true;
  }catch{return false;}
}

/** Missing additive RPC is the only safe fallback; ambiguous writes are read back, never replayed. */
async function commitExistingSignatureJobs(expected:number,nextPayload:object,endpoint:string):Promise<boolean>{
  const baseline=cachedSnapshot;
  if(!baseline||baseline.endpoint!==endpoint||baseline.revision!==expected||knownRevision!==expected)return false;
  const changed=existingSignatureJobPatch(baseline.payload,nextPayload);
  if(!changed)return false;
  const body=JSON.stringify({expected_revision:expected,changed_jobs:changed});
  const deadline=Date.now()+30_000;
  for(let attempt=0;attempt<2;attempt++){
    if(attempt&&Date.now()>=deadline)throw new Error('Falha no commit de assinaturas do Supabase (500): 57014.');
    let response:Response;
    try{response=await fetch(`${supabaseUrl()}/rest/v1/rpc/portal_commit_signature_jobs`,{
      method:'POST',headers:{...adminHeaders(),Prefer:'return=representation'},
      body,signal:AbortSignal.timeout(Math.max(1,Math.min(20_000,deadline-Date.now()))),
    });}catch(error){if(await confirmAmbiguousRuntimeCommit(endpoint,expected,nextPayload))return true;throw error;}
    if(!response.ok){
      const detail=await response.json().catch(()=>null),code=String(detail?.code||'');
      if(response.status===404&&code==='PGRST202')return false;
      if(['PT409','40001'].includes(code))throw new Error('Conflito de concorrência: outra instância atualizou o portal. Recarregue antes de tentar novamente.');
      // PostgreSQL explicitly rolled back this transaction. Retry only the same
      // CAS/body, never a provider operation, unknown outcome or new revision.
      if(attempt===0&&response.status===500&&code==='57014'&&/statement timeout/i.test(String(detail?.message||''))&&deadline-Date.now()>250){
        await new Promise(resolve=>setTimeout(resolve,250));continue;
      }
      if(response.status>=500&&!code&&await confirmAmbiguousRuntimeCommit(endpoint,expected,nextPayload))return true;
      throw new Error(`Falha no commit de assinaturas do Supabase (${response.status})${code?`: ${code}`:''}.`);
    }
    const value=await response.json().catch(()=>null),revision=Number(Array.isArray(value)?value[0]:value);
    if(!Number.isSafeInteger(revision)||revision!==expected+1){
      if(await confirmAmbiguousRuntimeCommit(endpoint,expected,nextPayload))return true;
      throw new Error('O Supabase não confirmou a revisão do registro de assinatura.');
    }
    cachedSnapshot={revision,payload:nextPayload,endpoint,auditChunks:baseline.auditChunks};
    knownRevision=revision;
    return true;
  }
  throw new Error('O Supabase não confirmou o registro de assinatura.');
}

async function commitDocumentModelMetadata(expected:number,nextPayload:object,endpoint:string):Promise<boolean>{
  const baseline=cachedSnapshot;
  if(!baseline||baseline.endpoint!==endpoint||baseline.revision!==expected||knownRevision!==expected)return false;
  const patch=documentModelPublicationPatch(baseline.payload,nextPayload);
  if(!patch)return false;
  const body=JSON.stringify({expected_revision:expected,...patch});
  const deadline=Date.now()+30_000;
  for(let attempt=0;attempt<2;attempt++){
    if(attempt&&Date.now()>=deadline)throw new Error('Falha no commit dos modelos documentais do Supabase (500): 57014.');
    let response:Response;
    try{response=await fetch(`${supabaseUrl()}/rest/v1/rpc/portal_commit_document_models`,{
      method:'POST',headers:{...adminHeaders(),Prefer:'return=representation'},
      body,signal:AbortSignal.timeout(Math.max(1,Math.min(20_000,deadline-Date.now()))),
    });}catch(error){if(await confirmAmbiguousRuntimeCommit(endpoint,expected,nextPayload))return true;throw error;}
    if(!response.ok){
      const detail=await response.json().catch(()=>null),code=String(detail?.code||'');
      if(response.status===404&&code==='PGRST202')return false;
      if(['PT409','40001'].includes(code))throw new Error('Conflito de concorrência: outra instância atualizou o portal. Recarregue antes de tentar novamente.');
      // PostgreSQL explicitly rolled back this transaction. Retry only the same
      // CAS/body, never a provider operation, unknown outcome or new revision.
      if(attempt===0&&response.status===500&&code==='57014'&&/statement timeout/i.test(String(detail?.message||''))&&deadline-Date.now()>250){
        await new Promise(resolve=>setTimeout(resolve,250));continue;
      }
      if(response.status>=500&&!code&&await confirmAmbiguousRuntimeCommit(endpoint,expected,nextPayload))return true;
      throw new Error(`Falha no commit dos modelos documentais do Supabase (${response.status})${code?`: ${code}`:''}.`);
    }
    const value=await response.json().catch(()=>null),revision=Number(Array.isArray(value)?value[0]:value);
    if(!Number.isSafeInteger(revision)||revision!==expected+1){
      if(await confirmAmbiguousRuntimeCommit(endpoint,expected,nextPayload))return true;
      throw new Error('O Supabase não confirmou a revisão dos modelos documentais.');
    }
    cachedSnapshot={revision,payload:nextPayload,endpoint,auditChunks:baseline.auditChunks};
    knownRevision=revision;
    return true;
  }
  throw new Error('O Supabase não confirmou o registro dos modelos documentais.');
}


// Positions are safe because the database applies them only to the exact
// revision used here. Shortened or substantially reordered collections are
// cheaper to replace as a section and preserve the caller's ordering.
export function buildRuntimePatch(expected: number, before: Record<string, unknown>, after: Record<string, unknown>): string | null {
  if (Object.keys(before).some(key => !Object.hasOwn(after, key))) return null;
  const sections: Record<string, unknown> = Object.create(null);
  const items: Record<string, Record<number, unknown>> = Object.create(null);
  for (const [key, value] of Object.entries(after)) {
    const previous = before[key];
    if (isDeepStrictEqual(previous, value)) continue;
    if (Array.isArray(previous) && Array.isArray(value) && value.length >= previous.length) {
      const changed: Record<number, unknown> = Object.create(null);
      for (let index = 0; index < value.length; index++) {
        if (!isDeepStrictEqual(previous[index], value[index])) changed[index] = value[index];
      }
      // Keep database work bounded for bulk replacements.
      if (Object.keys(changed).length <= 16 && JSON.stringify(changed).length < JSON.stringify(value).length) {
        items[key] = changed;
        continue;
      }
    }
    sections[key] = value;
  }
  return JSON.stringify({expected_revision:expected,changed_sections:sections,changed_items:items});
}

export async function savePortalRuntimeState(payload: object): Promise<void> {
  if (!getSupabaseRuntimeStatus().durablePersistenceReady) return;
  if(knownRevision===null)await loadPortalRuntimeState();
  const expected=knownRevision||0;
  const compactPayload=await externalizeRuntimeImages(payload);
  const endpoint=stateEndpoint();
  const nextPayload=JSON.parse(JSON.stringify(compactPayload));
  // Repeated durable barriers often follow a workflow that already committed.
  // Confirm the authoritative revision instead of uploading/reindexing 4 MB
  // unchanged metadata. A changed or unavailable revision still fails closed.
  const baseline=cachedSnapshot;
  if(baseline?.endpoint===endpoint&&baseline.revision===expected&&isDeepStrictEqual(baseline.payload,nextPayload)){
    const revision=await readPortalRuntimeRevision();
    if(stateEndpoint()!==endpoint||knownRevision!==expected||revision!==expected)throw new Error('Conflito de concorrência: outra instância atualizou o portal. Recarregue antes de tentar novamente.');
    return;
  }
  if(await commitExistingSignatureJobs(expected,nextPayload,endpoint))return;
  if(await commitDocumentModelMetadata(expected,nextPayload,endpoint))return;
  let patch=process.env.PORTAL_RUNTIME_PATCH==='1'&&baseline?.endpoint===endpoint&&baseline.revision===expected
    ? buildRuntimePatch(expected,baseline.payload as Record<string,unknown>,nextPayload)
    : null;
  for(let attempt=0;attempt<2;attempt++){
    let response:Response;
    const routine=patch?'portal_commit_runtime_patch_v1':'portal_commit_runtime_state';
    try{response=await fetch(`${supabaseUrl()}/rest/v1/rpc/${routine}`,{
      method:'POST',
      headers:{...adminHeaders(),Prefer:'return=representation'},
      body:patch??JSON.stringify({expected_revision:expected,next_payload:nextPayload}),
      signal:AbortSignal.timeout(20_000),
    });}catch(error){
      if(await confirmAmbiguousRuntimeCommit(endpoint,expected,nextPayload))return;
      throw error;
    }
    if(!response.ok){
      const detail=await response.text().catch(()=>'');
      let errorCode='';
      let message='';
      try{const error=JSON.parse(detail);errorCode=String(error?.code||'');message=String(error?.message||'');}catch{}
      if(patch&&response.status===404&&errorCode==='PGRST202'){
        patch=null;
        attempt--;
        continue;
      }
      if(errorCode==='PT409'||errorCode==='40001'||detail.toLowerCase().includes('conflito de concorr'))throw new Error('Conflito de concorrência: outra instância atualizou o portal. Recarregue antes de tentar novamente.');
      // PostgreSQL explicitly aborted this transaction. Reuse the same CAS revision,
      // without repeating any Drive or signature operation or retrying ambiguous I/O.
      if(attempt===0&&errorCode==='57014'&&/statement timeout/i.test(message)){
        await new Promise(resolve=>setTimeout(resolve,250));
        continue;
      }
      if(response.status>=500&&!errorCode&&await confirmAmbiguousRuntimeCommit(endpoint,expected,nextPayload))return;
      throw new Error(`Falha no commit transacional do Supabase (${response.status})${detail?`: ${detail.slice(0,180)}`:''}.`);
    }
    const result=await response.json().catch(()=>null);
    const revision=Number(Array.isArray(result)?result[0]:result);
    if(!Number.isFinite(revision)||revision!==expected+1){
      if(await confirmAmbiguousRuntimeCommit(endpoint,expected,nextPayload))return;
      throw new Error('O Supabase não confirmou a revisão transacional esperada.');
    }
    const auditChunks=cachedSnapshot?.endpoint===endpoint?cachedSnapshot.auditChunks:undefined;
    // The RPC stores next_payload verbatim. Keep the confirmed payload in this
    // worker; the next request still checks the revision before reusing it.
    cachedSnapshot={revision,payload:nextPayload,endpoint,auditChunks};
    knownRevision=revision;
    return;
  }
}

/** Under the existing request/write queues, with a freshly authorized baseline.
 * false means the additive RPC is not installed; no mutation was attempted. */
export async function saveRegistrationDraftRuntimeState(owner:string,draft:RegistrationDraft,expectedDraftRevision:number,authorizedRuntimeRevision:number|null):Promise<boolean>{
  const endpoint=stateEndpoint();
  const baseline=cachedSnapshot;
  if(!getSupabaseRuntimeStatus().durablePersistenceReady||!baseline||baseline.endpoint!==endpoint||baseline.revision!==knownRevision||baseline.revision!==authorizedRuntimeRevision)throw new Error('A revisão atual do portal precisa ser confirmada antes de salvar o rascunho.');
  if(owner!==owner.trim().toLowerCase()||draft.ownerEmail!==owner||draft.answers.ALUNO_1_EMAIL!==owner||!Number.isSafeInteger(expectedDraftRevision)||draft.revision!==expectedDraftRevision+1)throw new Error('Identidade ou revisão do rascunho inválida.');
  const expected=baseline.revision;
  const canonicalDraft=JSON.parse(JSON.stringify(draft)) as RegistrationDraft;
  const before=baseline.payload as {registrationDrafts?:Record<string,RegistrationDraft>};
  // Clone only this small record; retain the confirmed immutable baseline, never
  // caller-owned mutable runtime objects or unrelated uncommitted changes.
  const nextPayload={...before,registrationDrafts:{...before.registrationDrafts,[owner]:canonicalDraft}};
  const body=JSON.stringify({expected_revision:expected,draft_owner:owner,expected_draft_revision:expectedDraftRevision,next_draft:canonicalDraft});
  let response:Response;
  try{response=await fetch(`${supabaseUrl()}/rest/v1/rpc/portal_commit_registration_draft`,{method:'POST',headers:{...adminHeaders(),Prefer:'return=representation'},body,signal:AbortSignal.timeout(20_000)});}
  catch(error){if(await confirmAmbiguousRuntimeCommit(endpoint,expected,nextPayload))return true;throw error;}
  if(!response.ok){
    const detail=await response.json().catch(()=>null);
    const code=String(detail?.code||'');
    if(response.status===404&&code==='PGRST202')return false;
    if(['PT409','40001'].includes(code))throw new Error('Conflito de concorrência: outra instância atualizou o portal. Recarregue antes de tentar novamente.');
    if(response.status>=500&&!code&&await confirmAmbiguousRuntimeCommit(endpoint,expected,nextPayload))return true;
    throw new Error(`Falha ao confirmar o rascunho no Supabase (${response.status}).`);
  }
  const result=await response.json().catch(()=>null);
  const revision=Number(Array.isArray(result)?result[0]:result);
  if(!Number.isSafeInteger(revision)||revision!==expected+1){
    if(await confirmAmbiguousRuntimeCommit(endpoint,expected,nextPayload))return true;
    throw new Error('O Supabase não confirmou a revisão do rascunho.');
  }
  cachedSnapshot={revision,payload:nextPayload,endpoint,auditChunks:baseline.auditChunks};
  knownRevision=revision;
  return true;
}

function hasRuntimeCapabilities(payload: {transactional_runtime?: boolean; secure_file_transport?: string; asten_transactional_outbox?: boolean; schema_version?: number} | null): boolean {
  return payload?.transactional_runtime === true && payload.secure_file_transport === 'SUPABASE_PRIVATE_STORAGE'
    && payload.asten_transactional_outbox === true && Number(payload.schema_version) >= 6;
}

export async function testSupabaseRuntimeConnection(): Promise<SupabaseRuntimeStatus> {
  const base = getSupabaseRuntimeStatus();
  if (!base.configured) return { ...base, connected: false };
  try {
    const preflight = await fetch(`${supabaseUrl()}/rest/v1/rpc/portal_check_runtime_v1`, {
      method: 'POST', headers: adminHeaders(), body: '{}', signal: AbortSignal.timeout(12_000),
    });
    const result = await preflight.json().catch(() => null);
    if (preflight.ok) {
      const normalizedSchemaReady = result?.normalized_tables_ready === true;
      const transactionalRuntimeReady = normalizedSchemaReady && hasRuntimeCapabilities(result);
      return {
        ...base, connected: true, normalizedSchemaReady, transactionalRuntimeReady,
        signatureSignerRolesReady: result?.signature_examiner_role_ready===true,
        signatureCoadvisorRoleReady: result?.signature_coadvisor_role_ready===true,
        message: transactionalRuntimeReady ? 'Runtime transacional verificado no Supabase.' : 'Esquema ou permissões do runtime ainda não validados.',
      };
    }
    // Backward compatibility while the additive migration reaches PostgREST.
    if (preflight.status !== 404 || result?.code !== 'PGRST202') {
      throw new Error(`Supabase respondeu ${preflight.status}.`);
    }
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
      if(capability?.ok){const value=await capability.json().catch(()=>null);const payload=Array.isArray(value)?value[0]:value;transactionalRuntimeReady=hasRuntimeCapabilities(payload);}
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
