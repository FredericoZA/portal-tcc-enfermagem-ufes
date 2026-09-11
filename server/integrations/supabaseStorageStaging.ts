import { createHash, createHmac, randomUUID } from 'node:crypto';
import { buildSupabaseAdminHeaders, getSupabaseRuntimeStatus } from './supabase';

export type StagedUploadPurpose =
  | 'DOCUMENT_MODEL'
  | 'PROCESS_FULL_WORK'
  | 'PROCESS_EXPANDED_ABSTRACT'
  | 'VERIFICATION_PDF';

export interface StagedUploadDescriptor {
  purpose: StagedUploadPurpose;
  requesterBinding: string;
  processId?: string;
  verificationCode?: string;
  fileName: string;
  size: number;
  mimeType: string;
  sha256: string;
}

export interface StagedUploadTicket {
  uploadId: string;
  uploadUrl: string;
  expiresAt: string;
  maxSizeBytes: number;
}

interface StagedUploadRow {
  id: string;
  purpose: StagedUploadPurpose;
  requester_hash: string;
  process_external_id: string | null;
  verification_code_hash: string | null;
  object_path: string;
  original_file_name: string;
  mime_type: string;
  expected_size: number;
  expected_sha256: string;
  status: 'PENDING'|'CONSUMING'|'CONSUMED'|'CLEANUP_PENDING'|'REJECTED'|'EXPIRED';
  expires_at: string;
}

interface DownloadTransferRow {
  id: string;
  object_path: string;
  expires_at: string;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';
const MAX_BYTES:Record<StagedUploadPurpose,number> = {
  DOCUMENT_MODEL: 12 * 1024 * 1024,
  PROCESS_FULL_WORK: 24 * 1024 * 1024,
  PROCESS_EXPANDED_ABSTRACT: 24 * 1024 * 1024,
  VERIFICATION_PDF: 50 * 1024 * 1024
};
const MIME_TYPES:Record<StagedUploadPurpose,string> = {
  DOCUMENT_MODEL: DOCX_MIME,
  PROCESS_FULL_WORK: PDF_MIME,
  PROCESS_EXPANDED_ABSTRACT: PDF_MIME,
  VERIFICATION_PDF: PDF_MIME
};
const stagingBucket = () => String(
  process.env.SUPABASE_SECURE_FILES_BUCKET
  || process.env.SUPABASE_STAGING_BUCKET
  || 'portal-secure-transfer'
).trim();
const supabaseUrl = () => String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const storageBaseUrl = () => `${supabaseUrl()}/storage/v1`;
const dataBaseUrl = () => `${supabaseUrl()}/rest/v1`;
const hash = (value:string|Buffer) => createHash('sha256').update(value).digest('hex');
const uploadBindingSecret = () => String(
  process.env.PORTAL_UPLOAD_BINDING_SECRET
  || (process.env.NODE_ENV !== 'production' ? process.env.PORTAL_OTP_PEPPER || 'portal-upload-binding-development-only' : '')
).trim();
const uploadBindingSecretSeparated = () => process.env.NODE_ENV !== 'production' || ![
  process.env.PORTAL_SESSION_SECRET,
  process.env.PORTAL_OTP_PEPPER,
  process.env.GOOGLE_OAUTH_STATE_SECRET,
  process.env.PORTAL_SECRET_ENCRYPTION_KEY,
  process.env.PORTAL_VERIFICATION_SECRET,
  process.env.ASTEN_SESSION_ENCRYPTION_KEY,
  process.env.ASTEN_WEBHOOK_SECRET
].map((value) => String(value || '').trim()).filter(Boolean).includes(uploadBindingSecret());
const bindingHash = (value:string) => createHmac('sha256',uploadBindingSecret()).update(value).digest('hex');
const encodePath = (value:string) => value.split('/').map(encodeURIComponent).join('/');
const sanitizeDownloadName = (value:string) => value
  .normalize('NFKC')
  .replace(/[\u0000-\u001f\u007f]/g,'')
  .replace(/[\\/]/g,'_')
  .trim()
  .slice(0,180) || 'documento.pdf';

function assertConfigured():void {
  if(!getSupabaseRuntimeStatus().durablePersistenceReady){
    throw new Error('O staging seguro exige Supabase configurado como persistência de produção.');
  }
  if(uploadBindingSecret().length<32)throw new Error('PORTAL_UPLOAD_BINDING_SECRET precisa ter pelo menos 32 caracteres.');
  if(!uploadBindingSecretSeparated())throw new Error('PORTAL_UPLOAD_BINDING_SECRET deve ser exclusiva e diferente dos demais segredos em produção.');
  if(!/^[a-z0-9][a-z0-9-]{2,62}$/.test(stagingBucket()))throw new Error('SUPABASE_STAGING_BUCKET inválido.');
}

export function getSupabaseStagingSecurityStatus(){
  const bindingSecretStrong=uploadBindingSecret().length>=32;
  const bindingSecretSeparated=uploadBindingSecretSeparated();
  const bucketNameValid=/^[a-z0-9][a-z0-9-]{2,62}$/.test(stagingBucket());
  return{configured:getSupabaseRuntimeStatus().durablePersistenceReady&&bindingSecretStrong&&bindingSecretSeparated&&bucketNameValid,bindingSecretStrong,bindingSecretSeparated,bucketNameValid,bucket:stagingBucket()} as const;
}

export function validateStagedUploadDescriptor(input:StagedUploadDescriptor):void {
  if(!Object.hasOwn(MAX_BYTES,input.purpose))throw new Error('Finalidade de upload inválida.');
  if(!input.requesterBinding.trim()||input.requesterBinding.length>512)throw new Error('O upload precisa estar vinculado a uma sessão válida.');
  if(!/^[a-f0-9]{64}$/.test(input.sha256))throw new Error('Checksum SHA-256 inválido.');
  if(input.mimeType.toLowerCase()!==MIME_TYPES[input.purpose])throw new Error('MIME incompatível com a finalidade do upload.');
  if(!Number.isSafeInteger(input.size)||input.size<=0||input.size>MAX_BYTES[input.purpose])throw new Error('Tamanho do arquivo fora do limite autorizado.');
  if(input.fileName.length<1||input.fileName.length>240||/[\u0000-\u001f]/.test(input.fileName))throw new Error('Nome de arquivo inválido.');
  const expectedExtension=input.purpose==='DOCUMENT_MODEL'?'.docx':'.pdf';
  if(!input.fileName.toLowerCase().endsWith(expectedExtension))throw new Error(`A extensão esperada é ${expectedExtension}.`);
  if((input.purpose==='PROCESS_FULL_WORK'||input.purpose==='PROCESS_EXPANDED_ABSTRACT')&&!input.processId?.trim())throw new Error('O upload deve estar vinculado a um processo.');
  if(input.purpose==='VERIFICATION_PDF'&&!input.verificationCode?.trim())throw new Error('A verificação pública deve estar vinculada ao código consultado.');
  if((input.processId?.length||0)>200||(input.verificationCode?.length||0)>200)throw new Error('O vínculo do upload excede o limite permitido.');
}

export function buildStagingObjectPath(input:Pick<StagedUploadDescriptor,'purpose'|'requesterBinding'|'processId'|'fileName'>,id=randomUUID()):string {
  const extension=input.fileName.toLowerCase().endsWith('.docx')?'docx':'pdf';
  const requesterHash=bindingHash(input.requesterBinding.trim().toLowerCase()).slice(0,20);
  const processHash=input.processId?hash(input.processId).slice(0,20):'sem-processo';
  return `pending/${input.purpose.toLowerCase()}/${requesterHash}/${processHash}/${id}.${extension}`;
}

async function jsonOrThrow<T>(response:Response,operation:string):Promise<T>{
  if(!response.ok){
    const detail=await response.text().catch(()=>'');
    throw new Error(`${operation} falhou (HTTP ${response.status})${detail?`: ${detail.slice(0,160)}`:''}.`);
  }
  return response.json() as Promise<T>;
}

/**
 * Supabase returns paths relative to /storage/v1. Refuse redirects to any
 * other origin/path so a compromised or malformed response cannot turn the
 * portal into an SSRF/open-redirect primitive.
 */
export function resolveSupabaseStorageSignedUrl(value:string,downloadFileName?:string):string{
  const storageBase=new URL(`${storageBaseUrl()}/`);
  let resolved:URL;
  if(/^https:\/\//i.test(value))resolved=new URL(value);
  else if(value.startsWith('/storage/v1/'))resolved=new URL(value,storageBase.origin);
  else resolved=new URL(value.replace(/^\//,''),storageBase);
  if(resolved.protocol!=='https:'||resolved.origin!==storageBase.origin||!resolved.pathname.startsWith('/storage/v1/object/')){
    throw new Error('O Supabase devolveu uma URL assinada fora da origem de armazenamento autorizada.');
  }
  if(downloadFileName)resolved.searchParams.set('download',sanitizeDownloadName(downloadFileName));
  return resolved.toString();
}

async function updateTicket(id:string,status:StagedUploadRow['status'],errorCode?:string):Promise<void>{
  const response=await fetch(`${dataBaseUrl()}/portal_upload_staging?id=eq.${encodeURIComponent(id)}`,{
    method:'PATCH',
    headers:{...buildSupabaseAdminHeaders(),Prefer:'return=minimal'},
    body:JSON.stringify({status,error_code:errorCode||null,...(status==='CONSUMED'?{consumed_at:new Date().toISOString()}:{}),updated_at:new Date().toISOString()}),
    signal:AbortSignal.timeout(10_000)
  });
  if(!response.ok)throw new Error(`Falha ao atualizar o ticket de upload (${response.status}).`);
}

async function deleteTicket(id:string):Promise<void>{
  const response=await fetch(`${dataBaseUrl()}/portal_upload_staging?id=eq.${encodeURIComponent(id)}`,{
    method:'DELETE',headers:{...buildSupabaseAdminHeaders(),Prefer:'return=minimal'},signal:AbortSignal.timeout(10_000)
  });
  if(!response.ok)throw new Error(`Falha ao excluir o ticket temporário (${response.status}).`);
}

async function removeObject(path:string):Promise<void>{
  const response=await fetch(`${storageBaseUrl()}/object/${encodeURIComponent(stagingBucket())}`,{
    method:'DELETE',headers:buildSupabaseAdminHeaders(),body:JSON.stringify({prefixes:[path]}),signal:AbortSignal.timeout(15_000)
  });
  if(!response.ok&&response.status!==404)throw new Error(`Falha ao excluir o objeto temporário (${response.status}).`);
}

export async function ensurePrivateStagingBucket():Promise<void>{
  assertConfigured();
  const id=encodeURIComponent(stagingBucket());
  const current=await fetch(`${storageBaseUrl()}/bucket/${id}`,{headers:buildSupabaseAdminHeaders(),signal:AbortSignal.timeout(10_000)});
  if(current.ok){
    const bucket=await current.json() as {public?:boolean};
    if(bucket.public)throw new Error('O bucket de staging está público. Torne-o privado antes de aceitar uploads.');
    return;
  }
  if(current.status!==404)throw new Error(`Não foi possível validar o bucket de staging (${current.status}).`);
  const created=await fetch(`${storageBaseUrl()}/bucket`,{
    method:'POST',headers:buildSupabaseAdminHeaders(),
    body:JSON.stringify({id:stagingBucket(),name:stagingBucket(),public:false,file_size_limit:MAX_BYTES.VERIFICATION_PDF,allowed_mime_types:[PDF_MIME,DOCX_MIME]}),
    signal:AbortSignal.timeout(10_000)
  });
  if(!created.ok&&created.status!==409)throw new Error(`Não foi possível criar o bucket privado de staging (${created.status}).`);
}

export async function createSupabaseStagedUpload(input:StagedUploadDescriptor):Promise<StagedUploadTicket>{
  assertConfigured();
  validateStagedUploadDescriptor(input);
  await ensurePrivateStagingBucket();
  const uploadId=randomUUID();
  const objectPath=buildStagingObjectPath(input,uploadId);
  const expiresAt=new Date(Date.now()+15*60_000).toISOString();
  const row={
    id:uploadId,purpose:input.purpose,requester_hash:bindingHash(input.requesterBinding),
    process_external_id:input.processId||null,verification_code_hash:input.verificationCode?bindingHash(input.verificationCode):null,
    object_path:objectPath,original_file_name:input.fileName,mime_type:input.mimeType.toLowerCase(),
    expected_size:input.size,expected_sha256:input.sha256,status:'PENDING',expires_at:expiresAt
  };
  const inserted=await fetch(`${dataBaseUrl()}/portal_upload_staging`,{
    method:'POST',headers:{...buildSupabaseAdminHeaders(),Prefer:'return=minimal'},body:JSON.stringify(row),signal:AbortSignal.timeout(10_000)
  });
  if(!inserted.ok)throw new Error(`Não foi possível registrar o upload temporário (${inserted.status}).`);
  try{
    const signedResponse=await fetch(`${storageBaseUrl()}/object/upload/sign/${encodeURIComponent(stagingBucket())}/${encodePath(objectPath)}`,{
      method:'POST',headers:{...buildSupabaseAdminHeaders(),'x-upsert':'false'},body:'{}',signal:AbortSignal.timeout(10_000)
    });
    const signed=await jsonOrThrow<{url:string}>(signedResponse,'Criação da URL assinada');
    const uploadUrl=resolveSupabaseStorageSignedUrl(signed.url);
    return {uploadId,uploadUrl,expiresAt,maxSizeBytes:MAX_BYTES[input.purpose]};
  }catch(error){
    await updateTicket(uploadId,'REJECTED','SIGNING_FAILED').catch(()=>undefined);
    throw error;
  }
}

async function claimTicket(uploadId:string):Promise<StagedUploadRow>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadId))throw new Error('Identificador de upload inválido.');
  const response=await fetch(`${dataBaseUrl()}/portal_upload_staging?id=eq.${encodeURIComponent(uploadId)}&status=eq.PENDING&select=*`,{
    method:'PATCH',headers:{...buildSupabaseAdminHeaders(),Prefer:'return=representation'},
    body:JSON.stringify({status:'CONSUMING',updated_at:new Date().toISOString()}),signal:AbortSignal.timeout(10_000)
  });
  const rows=await jsonOrThrow<StagedUploadRow[]>(response,'Reserva do upload temporário');
  if(rows.length!==1)throw new Error('Upload inexistente, expirado, consumido ou já em processamento.');
  return rows[0];
}

export async function withSupabaseStagedUpload<T>(input:{
  uploadId:string;
  purpose:StagedUploadPurpose;
  requesterBinding:string;
  processId?:string;
  verificationCode?:string;
},consumer:(file:{bytes:Buffer;fileName:string;mimeType:string;sha256:string})=>Promise<T>):Promise<T>{
  assertConfigured();
  const row=await claimTicket(input.uploadId);
  const bindingMatches=row.requester_hash===bindingHash(input.requesterBinding);
  const processMatches=(row.process_external_id||'')===(input.processId||'');
  const verificationMatches=(row.verification_code_hash||'')===(input.verificationCode?bindingHash(input.verificationCode):'');
  if(row.purpose!==input.purpose||!bindingMatches||!processMatches||!verificationMatches||Date.parse(row.expires_at)<=Date.now()){
    await removeObject(row.object_path).catch(()=>undefined);
    await updateTicket(row.id,Date.parse(row.expires_at)<=Date.now()?'EXPIRED':'REJECTED','BINDING_MISMATCH');
    throw new Error('O upload não pertence a esta sessão, processo ou finalidade.');
  }
  let result:T;
  try{
    const downloaded=await fetch(`${storageBaseUrl()}/object/authenticated/${encodeURIComponent(stagingBucket())}/${encodePath(row.object_path)}`,{
      headers:buildSupabaseAdminHeaders(),cache:'no-store',signal:AbortSignal.timeout(30_000)
    });
    if(!downloaded.ok)throw new Error(`O binário temporário não foi localizado (${downloaded.status}).`);
    const bytes=Buffer.from(await downloaded.arrayBuffer());
    const actualMime=String(downloaded.headers.get('content-type')||'').split(';')[0].toLowerCase();
    const actualSha256=hash(bytes);
    if(bytes.byteLength!==row.expected_size||actualMime!==row.mime_type||actualSha256!==row.expected_sha256){
      await removeObject(row.object_path).catch(()=>undefined);
      await updateTicket(row.id,'REJECTED','INTEGRITY_MISMATCH');
      throw new Error('O arquivo recebido não corresponde ao tamanho, MIME ou checksum autorizado.');
    }
    result=await consumer({bytes,fileName:row.original_file_name,mimeType:row.mime_type,sha256:actualSha256});
  }catch(error){
    const message=error instanceof Error?error.message:'';
    if(!message.includes('não corresponde'))await updateTicket(row.id,'PENDING','CONSUMER_FAILED').catch(()=>undefined);
    throw error;
  }
  // Marque como consumido antes da limpeza. Se a exclusão falhar, o mesmo
  // binário não será processado de novo; apenas a limpeza será repetida.
  await updateTicket(row.id,'CONSUMED');
  try{await removeObject(row.object_path);}catch{await updateTicket(row.id,'CLEANUP_PENDING','DELETE_FAILED').catch(()=>undefined);}
  return result;
}

export async function cleanupExpiredStagedUploads(limit=100):Promise<number>{
  assertConfigured();
  const response=await fetch(`${dataBaseUrl()}/portal_upload_staging?status=in.(PENDING,CONSUMING,CONSUMED,CLEANUP_PENDING,REJECTED,EXPIRED)&expires_at=lt.${encodeURIComponent(new Date().toISOString())}&select=*&limit=${Math.min(Math.max(limit,1),500)}`,{
    headers:buildSupabaseAdminHeaders(),signal:AbortSignal.timeout(10_000)
  });
  const rows=await jsonOrThrow<StagedUploadRow[]>(response,'Listagem de uploads expirados');
  let cleaned=0;
  for(const row of rows){
    try{await removeObject(row.object_path);await deleteTicket(row.id);cleaned+=1;}catch{/* uma execução futura tentará novamente */}
  }
  return cleaned;
}

export function shouldUseSupabaseDownloadGateway():boolean{
  return Boolean(process.env.VERCEL||process.env.PORTAL_SECURE_DOWNLOAD_GATEWAY==='true')
    && getSupabaseRuntimeStatus().durablePersistenceReady;
}

async function uploadPrivateObject(path:string,bytes:Buffer,mimeType:string):Promise<void>{
  const response=await fetch(`${storageBaseUrl()}/object/${encodeURIComponent(stagingBucket())}/${encodePath(path)}`,{
    method:'POST',
    headers:{...buildSupabaseAdminHeaders(),'Content-Type':mimeType,'Cache-Control':'no-store','x-upsert':'false'},
    body:bytes,
    signal:AbortSignal.timeout(45_000)
  });
  if(!response.ok){const detail=await response.text().catch(()=>'');throw new Error(`Falha ao preparar o download protegido (${response.status})${detail?`: ${detail.slice(0,120)}`:''}.`);}
}

async function recordDownloadTransfer(row:{id:string;objectPath:string;fileName:string;mimeType:string;size:number;sha256:string;requesterBinding:string;expiresAt:string}):Promise<void>{
  const response=await fetch(`${dataBaseUrl()}/portal_download_transfers`,{
    method:'POST',headers:{...buildSupabaseAdminHeaders(),Prefer:'return=minimal'},
    body:JSON.stringify({id:row.id,object_path:row.objectPath,file_name:row.fileName,mime_type:row.mimeType,size_bytes:row.size,sha256:row.sha256,requester_hash:bindingHash(row.requesterBinding),status:'ACTIVE',expires_at:row.expiresAt}),
    signal:AbortSignal.timeout(10_000)
  });
  if(!response.ok)throw new Error(`Não foi possível registrar o download temporário (${response.status}).`);
}

export async function createSupabaseEphemeralDownload(input:{
  bytes:Buffer;
  fileName:string;
  mimeType:'application/pdf'|'application/zip';
  requesterBinding:string;
  expiresInSeconds?:number;
}):Promise<{url:string;expiresAt:string;sha256:string}>{
  assertConfigured();
  if(!input.requesterBinding.trim())throw new Error('O download precisa estar vinculado à solicitação autorizada.');
  if(!input.bytes.length||input.bytes.length>110*1024*1024)throw new Error('O arquivo de download deve ter entre 1 byte e 110 MB.');
  const fileName=sanitizeDownloadName(input.fileName);
  const extension=input.mimeType==='application/zip'?'zip':'pdf';
  if(!fileName.toLowerCase().endsWith(`.${extension}`))throw new Error(`O download deve usar a extensão .${extension}.`);
  if(input.mimeType==='application/pdf'&&!input.bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('O conteúdo de download não é um PDF válido.');
  if(input.mimeType==='application/zip'&&!input.bytes.subarray(0,2).equals(Buffer.from('PK')))throw new Error('O conteúdo de download não é um ZIP válido.');
  await ensurePrivateStagingBucket();
  const id=randomUUID();
  const sha256=hash(input.bytes);
  const objectPath=`downloads/${new Date().toISOString().slice(0,10)}/${sha256.slice(0,20)}/${id}.${extension}`;
  const expiresInSeconds=Math.min(Math.max(Number(input.expiresInSeconds||60),30),300);
  const expiresAt=new Date(Date.now()+expiresInSeconds*1000).toISOString();
  await uploadPrivateObject(objectPath,input.bytes,input.mimeType);
  try{
    await recordDownloadTransfer({id,objectPath,fileName,mimeType:input.mimeType,size:input.bytes.length,sha256,requesterBinding:input.requesterBinding,expiresAt});
    const signedResponse=await fetch(`${storageBaseUrl()}/object/sign/${encodeURIComponent(stagingBucket())}/${encodePath(objectPath)}`,{
      method:'POST',headers:buildSupabaseAdminHeaders(),body:JSON.stringify({expiresIn:expiresInSeconds}),signal:AbortSignal.timeout(10_000)
    });
    const signed=await jsonOrThrow<{signedURL?:string;signedUrl?:string}>(signedResponse,'Assinatura do download privado');
    const signedPath=String(signed.signedURL||signed.signedUrl||'');
    if(!signedPath)throw new Error('O Supabase não devolveu a URL assinada do download.');
    return{url:resolveSupabaseStorageSignedUrl(signedPath,fileName),expiresAt,sha256};
  }catch(error){
    await removeObject(objectPath).catch(()=>undefined);
    throw error;
  }
}

export async function cleanupExpiredDownloadTransfers(limit=100):Promise<number>{
  assertConfigured();
  const response=await fetch(`${dataBaseUrl()}/portal_download_transfers?status=eq.ACTIVE&expires_at=lt.${encodeURIComponent(new Date().toISOString())}&select=id,object_path,expires_at&limit=${Math.min(Math.max(limit,1),500)}`,{
    headers:buildSupabaseAdminHeaders(),signal:AbortSignal.timeout(10_000)
  });
  const rows=await jsonOrThrow<DownloadTransferRow[]>(response,'Listagem de downloads temporários');
  let cleaned=0;
  for(const row of rows){
    try{
      await removeObject(row.object_path);
      const updated=await fetch(`${dataBaseUrl()}/portal_download_transfers?id=eq.${encodeURIComponent(row.id)}`,{method:'PATCH',headers:{...buildSupabaseAdminHeaders(),Prefer:'return=minimal'},body:JSON.stringify({status:'EXPIRED',deleted_at:new Date().toISOString()}),signal:AbortSignal.timeout(10_000)});
      if(!updated.ok)throw new Error('Falha ao confirmar a limpeza.');
      cleaned+=1;
    }catch{/* uma execução futura tentará novamente */}
  }
  return cleaned;
}
