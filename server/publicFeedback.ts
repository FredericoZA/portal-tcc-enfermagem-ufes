import { createHmac, randomUUID } from 'node:crypto';
import { buildSupabaseAdminHeaders, getSupabaseRuntimeStatus } from './integrations/supabase';
import { storePrivatePortalImage, readPrivatePortalImage } from './integrations/googleDriveImages';

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
  reviewed_by: string | null;
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

async function fetchFeedback(url:string, options:RequestInit):Promise<Response> {
  try{
    return await fetch(url,{...options,signal:AbortSignal.timeout(12_000)});
  }catch{
    throw new FeedbackError(503,'Não foi possível conectar ao recebimento de sugestões. Tente novamente.');
  }
}

async function feedbackRequest(url:string, options:RequestInit):Promise<Response> {
  const response=await fetchFeedback(url,options);
  if(!response.ok){
    throw new FeedbackError(503,'Não foi possível confirmar o armazenamento da sugestão. Tente novamente.');
  }
  return response;
}

const endpoint=()=>String(process.env.SUPABASE_URL||'').trim().replace(/\/$/,'')+'/rest/v1/'+TABLE;

export async function submitPublicFeedback(
  input:unknown,ip:string,secret:string,archive=storePrivatePortalImage,
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
  let imageReference:{image_drive_file_id:string;image_sha256:string}|undefined;
  if(validated.image){
    // The screenshot is archived privately; only its reference reaches Postgres.
    await feedbackRequest(endpoint()+'?select=image_drive_file_id,image_sha256&limit=0',{headers});
    const image=await archive({bytes:Buffer.from(validated.image.base64,'base64'),mimeType:validated.image.mime,kind:'FEEDBACK_IMAGE',key:id});
    imageReference={image_drive_file_id:image.driveFileId,image_sha256:image.contentSha256};
  }
  const payload={
    id,description:validated.description,image_mime:validated.image?.mime||null,
    image_size:validated.image?.size||null,...imageReference,
    ip_fingerprint:visitor,status:'NEW',
  };
  const stored=await feedbackRequest(endpoint()+'?select=id%2Ccreated_at',{
    method:'POST',headers:{...headers,Prefer:'return=representation'},
    body:JSON.stringify(payload),
  });
  const data=await stored.json() as Array<{id:string;created_at:string}>;
  if(!data?.[0]?.id)throw new FeedbackError(503,'O banco não confirmou a gravação da sugestão.');
  return {id:data[0].id,createdAt:data[0].created_at};
}

const FEEDBACK_SELECT='id,description,image_mime,image_size,status,created_at,reviewed_at,reviewed_by';
const FEEDBACK_PAGE_SIZE=100;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FeedbackPage {items:FeedbackRecord[];nextCursor:string|null;}

/** Opaque keyset cursor; timestamp and UUID are validated before PostgREST filtering. */
function decodeFeedbackCursor(value:unknown):{createdAt:string;id:string}|null {
  if(value===undefined)return null;
  if(typeof value!=='string'||!value||value.length>240||!/^[A-Za-z0-9_-]+$/.test(value))throw new FeedbackError(400,'Página de sugestões inválida.');
  try{
    const bytes=Buffer.from(value,'base64url');
    if(bytes.toString('base64url')!==value)throw Error('Noncanonical cursor');
    const data=JSON.parse(bytes.toString('utf8'));
    if(!data||typeof data.createdAt!=='string'||data.createdAt.length>40||!Number.isFinite(Date.parse(data.createdAt))||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(data.createdAt)||typeof data.id!=='string'||!uuidPattern.test(data.id))throw Error('Invalid cursor data');
    return {createdAt:data.createdAt,id:data.id};
  }catch{throw new FeedbackError(400,'Página de sugestões inválida.');}
}

export async function listFeedbackForAdmins():Promise<FeedbackRecord[]> {
  const query=new URLSearchParams({select:FEEDBACK_SELECT,order:'created_at.desc,id.desc',limit:String(FEEDBACK_PAGE_SIZE)});
  const response=await feedbackRequest(endpoint()+'?'+query,{headers:credentialHeaders()});
  return (await response.json()) as FeedbackRecord[];
}

export async function listFeedbackPageForAdmin(before?:unknown):Promise<FeedbackPage> {
  const cursor=decodeFeedbackCursor(before);
  const query=new URLSearchParams({select:FEEDBACK_SELECT,order:'created_at.desc,id.desc',limit:String(FEEDBACK_PAGE_SIZE+1)});
  if(cursor)query.set('or',`(created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id}))`);
  const response=await feedbackRequest(endpoint()+'?'+query,{headers:credentialHeaders()});
  const rows=await response.json() as FeedbackRecord[];
  const items=rows.slice(0,FEEDBACK_PAGE_SIZE),last=items[items.length-1];
  return {items,nextCursor:rows.length>FEEDBACK_PAGE_SIZE&&last
    ?Buffer.from(JSON.stringify({createdAt:last.created_at,id:last.id})).toString('base64url'):null};
}

export async function feedbackImageForAdmin(id:string,read=readPrivatePortalImage):Promise<{bytes:Buffer;mime:string}|null> {
  if(!uuidPattern.test(id))throw new FeedbackError(400,'Identificador inválido.');
  const headers=credentialHeaders();
  const query=new URLSearchParams({select:'image_mime,image_size,image_drive_file_id,image_sha256',id:'eq.'+id,limit:'1'});
  const url=()=>endpoint()+'?'+query;
  const response=await fetchFeedback(url(),{headers});
  if(response.ok){
    const [item]=await response.json() as Array<{image_mime:string|null;image_size:number|null;image_drive_file_id:string|null;image_sha256:string|null}>;
    if(!item?.image_mime)return null;
    if(item.image_drive_file_id){
      const bytes=await read({driveFileId:item.image_drive_file_id,contentSha256:String(item.image_sha256||''),mimeType:item.image_mime,byteLength:Number(item.image_size)},'FEEDBACK_IMAGE');
      return {bytes,mime:item.image_mime};
    }
  }else{
    // PostgREST reports undefined columns with PostgreSQL code 42703 on the pre-Drive schema.
    const error=response.status===400 ? await response.json().catch(()=>null) : null;
    if(error?.code!=='42703')throw new FeedbackError(503,'Não foi possível consultar a imagem da sugestão. Tente novamente.');
  }

  query.set('select','image_mime,image_base64');
  const legacy=await feedbackRequest(url(),{headers});
  const [item]=await legacy.json() as Array<{image_mime:string|null;image_base64:string|null}>;
  if(!item?.image_mime||!item.image_base64)return null;
  const found=checkFeedbackImage(`data:${item.image_mime};base64,${item.image_base64}`);
  return found?{bytes:Buffer.from(found.base64,'base64'),mime:found.mime}:null;
}

export async function markFeedbackReviewed(id:string,actorEmail:string):Promise<FeedbackRecord|null> {
  if(!uuidPattern.test(id))throw new FeedbackError(400,'Identificador inválido.');
  const query=new URLSearchParams({id:'eq.'+id,status:'eq.NEW',select:FEEDBACK_SELECT});
  const response=await feedbackRequest(endpoint()+'?'+query,{
    method:'PATCH',
    headers:{...credentialHeaders(),Prefer:'return=representation'},
    body:JSON.stringify({status:'REVIEWED',reviewed_at:new Date().toISOString(),reviewed_by:actorEmail}),
  });
  const updated=await response.json() as FeedbackRecord[];
  if(updated.length===1)return updated[0];
  // Repeated clicks never replace the original reviewer or review timestamp.
  const existingQuery=new URLSearchParams({select:FEEDBACK_SELECT,id:'eq.'+id,limit:'1'});
  const existing=await feedbackRequest(endpoint()+'?'+existingQuery,{headers:credentialHeaders()});
  const record=(await existing.json() as FeedbackRecord[])[0];
  return record?.status==='REVIEWED'?record:null;
}
