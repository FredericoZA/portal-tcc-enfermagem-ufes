import { createHmac, randomUUID } from 'node:crypto';
import { buildSupabaseAdminHeaders, getSupabaseRuntimeStatus } from './integrations/supabase';

const TABLE = 'portal_feedback';
const MAX_IMAGE_BYTES = 1_500_000;
const MAX_TEXT_CHARS = 4_000;
const MIN_TEXT_CHARS = 20;
const allowedMimes = new Set(['image/png', 'image/jpeg', 'image/webp']);

export interface PublicFeedbackInput {
  description?: unknown;
  imageDataUrl?: unknown;
  extraField?: unknown;
}

export interface FeedbackRecord {
  id: string;
  description: string;
  image_mime: string | null;
  image_size: number | null;
  status: 'NEW' | 'REVIEWED';
  created_at: string;
  reviewed_at: string | null;
}

export class FeedbackError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function credentialHeaders(): Record<string,string> {
  if (!getSupabaseRuntimeStatus().durablePersistenceReady) throw new FeedbackError(503, 'O recebimento de sugestões está temporariamente indisponível.');
  return buildSupabaseAdminHeaders();
}

export function checkFeedbackImage(raw: unknown): {mime:string;base64:string;size:number}|null {
  if(raw===undefined || raw===null || raw==='')return null;
  if(typeof raw!=='string' || raw.length>2_100_000)throw new FeedbackError(400,'A imagem deve ter até 1,5 MB.');
  const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(raw);
  if(!match || !allowedMimes.has(match[1]))throw new FeedbackError(400,'Envie uma imagem PNG, JPEG ou WebP.');
  const bytes=Buffer.from(match[2],'base64');
  if(!bytes.length||bytes.length>MAX_IMAGE_BYTES)throw new FeedbackError(400,'A imagem deve ter até 1,5 MB.');
  const isPng=bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isJpeg=bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const isWebp=bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!((match[1]==='image/png'&&isPng)||(match[1]==='image/jpeg'&&isJpeg)||(match[1]==='image/webp'&&isWebp))) {
    throw new FeedbackError(400,'O arquivo não corresponde a uma imagem válida do tipo informado.');
  }
  // Evita strings base64 com bytes extras ou conteúdo não canônico.
  if(bytes.toString('base64')!==match[2])throw new FeedbackError(400,'Codificação da imagem inválida.');
  return {mime:match[1],base64:match[2],size:bytes.length};
}

export function validatePublicFeedback(input: unknown): {description:string;image:ReturnType<typeof checkFeedbackImage>;suppressed:boolean} {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new FeedbackError(400,'Informe uma descrição da sugestão.');
  const form=input as PublicFeedbackInput;
  if(typeof form.extraField==='string' && form.extraField.trim())return {description:'',image:null,suppressed:true};
  if(typeof form.description!=='string')throw new FeedbackError(400,'Informe uma descrição da sugestão.');
  const description=form.description.normalize('NFC').trim();
  if(description.length<MIN_TEXT_CHARS||description.length>MAX_TEXT_CHARS) {
    throw new FeedbackError(400,'Descreva a sugestão com 20 a 4.000 caracteres.');
  }
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(description))throw new FeedbackError(400,'O texto contém caracteres de controle inválidos.');
  return {description,image:checkFeedbackImage(form.imageDataUrl),suppressed:false};
}

export function fingerprintFeedbackVisitor(ip:string,secret:string):string {
  return createHmac('sha256',secret).update(ip).digest('hex');
}

async function feedbackRequest(url:string, options:RequestInit):Promise<Response> {
  let response:Response;
  try{
    response=await fetch(url,{...options,signal:AbortSignal.timeout(12_000)});
  }catch{
    throw new FeedbackError(503,'Não foi possível conectar ao recebimento de sugestões. Tente novamente.');
  }
  if(!response.ok){
    throw new FeedbackError(503,'Não foi possível confirmar o armazenamento da sugestão. Tente novamente.');
  }
  return response;
}

const endpoint=()=>String(process.env.SUPABASE_URL||'').trim().replace(/\/$/,'')+'/rest/v1/'+TABLE;

export async function submitPublicFeedback(
  input:unknown,ip:string,secret:string,
):Promise<{id:string;createdAt:string}> {
  const validated=validatePublicFeedback(input);
  if(validated.suppressed)return {id:'',createdAt:new Date().toISOString()};
  const headers=credentialHeaders();
  if(!secret||secret.length<32)throw new FeedbackError(503,'A proteção do formulário ainda não foi configurada.');
  const visitor=fingerprintFeedbackVisitor(ip,secret);
  // Limite durável, compartilhado entre instâncias Vercel, e não só em memória.
  const since=new Date(Date.now()-15*60_000).toISOString();
  const query=new URLSearchParams({select:'id',ip_fingerprint:'eq.'+visitor,created_at:'gte.'+since,limit:'3'});
  const prior=await feedbackRequest(endpoint()+'?'+query,{headers});
  const count=await prior.json() as Array<{id:string}>;
  if(count.length>=3)throw new FeedbackError(429,'Muitas sugestões em pouco tempo. Tente novamente mais tarde.');
  const id=randomUUID();
  const payload={
    id,description:validated.description,image_mime:validated.image?.mime||null,
    image_base64:validated.image?.base64||null,image_size:validated.image?.size||null,
    ip_fingerprint:visitor,status:'NEW',
  };
  const stored=await feedbackRequest(endpoint(),{
    method:'POST',headers:{...headers,Prefer:'return=representation'},
    body:JSON.stringify(payload),
  });
  const data=await stored.json() as Array<{id:string;created_at:string}>;
  if(!data?.[0]?.id)throw new FeedbackError(503,'O banco não confirmou a gravação da sugestão.');
  return {id:data[0].id,createdAt:data[0].created_at};
}

export async function listFeedbackForAdmins():Promise<FeedbackRecord[]> {
  const query=new URLSearchParams({
    select:'id,description,image_mime,image_size,status,created_at,reviewed_at',
    order:'created_at.desc',limit:'100',
  });
  const response=await feedbackRequest(endpoint()+'?'+query,{headers:credentialHeaders()});
  return (await response.json()) as FeedbackRecord[];
}

export async function feedbackImageForAdmin(id:string):Promise<{bytes:Buffer;mime:string}|null> {
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new FeedbackError(400,'Identificador inválido.');
  const query=new URLSearchParams({select:'image_mime,image_base64',id:'eq.'+id,limit:'1'});
  const response=await feedbackRequest(endpoint()+'?'+query,{headers:credentialHeaders()});
  const items=await response.json() as Array<{image_mime:string|null;image_base64:string|null}>;
  const item=items[0];
  if(!item?.image_mime||!item.image_base64)return null;
  const found=checkFeedbackImage(`data:${item.image_mime};base64,${item.image_base64}`);
  return found?{bytes:Buffer.from(found.base64,'base64'),mime:found.mime}:null;
}

export async function markFeedbackReviewed(id:string,actorEmail:string):Promise<boolean> {
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new FeedbackError(400,'Identificador inválido.');
  const response=await feedbackRequest(endpoint()+'?id=eq.'+encodeURIComponent(id),{
    method:'PATCH',
    headers:{...credentialHeaders(),Prefer:'return=representation'},
    body:JSON.stringify({status:'REVIEWED',reviewed_at:new Date().toISOString(),reviewed_by:actorEmail}),
  });
  return (await response.json() as Array<{id:string}>).length===1;
}
