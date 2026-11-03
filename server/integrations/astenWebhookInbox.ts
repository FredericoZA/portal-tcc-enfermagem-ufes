import type {AstenWebhookEvent} from '../../src/types/automation';
import {buildSupabaseAdminHeaders,getSupabaseRuntimeStatus} from './supabase';
function endpoint():string {
  const url=new URL(String(process.env.SUPABASE_URL||''));
  if(url.protocol!=='https:'||url.username||url.password)throw new Error('Inbox Asten exige Supabase HTTPS.');
  return `${url.origin}/rest/v1/portal_asten_webhook_inbox`;
}
/** A callback URL alone does not prove that the durable queue migration exists. */
export async function astenWebhookInboxReady():Promise<boolean> {
  if(!getSupabaseRuntimeStatus().durablePersistenceReady)return false;
  try{
    const response=await fetch(`${endpoint()}?select=fingerprint&limit=0`,{headers:buildSupabaseAdminHeaders(),redirect:'error',signal:AbortSignal.timeout(12000)});
    if(!response.ok)return false;
    return Array.isArray(await response.json());
  }catch{return false;}
}
export async function enqueueAstenWebhook(event:AstenWebhookEvent):Promise<boolean> {
  const response=await fetch(`${endpoint()}?on_conflict=fingerprint`,{method:'POST',headers:{...buildSupabaseAdminHeaders(),Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({fingerprint:event.fingerprint,event}),redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('Não foi possível registrar o retorno Asten na fila durável.');
  return (await response.json()).length>0;
}
export async function pendingAstenWebhooks(limit:number,eventId?:string):Promise<AstenWebhookEvent[]> {
  if(!getSupabaseRuntimeStatus().durablePersistenceReady)return[];
  const query=new URLSearchParams({processed_at:'is.null',select:'event',order:'received_at.asc,fingerprint.asc',limit:String(Math.min(200,Math.max(1,limit)))});
  if(eventId)query.set('event->>id',`eq.${eventId}`);
  const response=await fetch(`${endpoint()}?${query}`,{headers:buildSupabaseAdminHeaders(),redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('Não foi possível consultar a fila de retornos Asten.');
  return (await response.json()).map((row:{event:AstenWebhookEvent})=>row.event);
}
export async function confirmAstenWebhookProcessed(event:AstenWebhookEvent):Promise<void> {
  if(!getSupabaseRuntimeStatus().durablePersistenceReady||!event.processedAt)return;
  const response=await fetch(`${endpoint()}?${new URLSearchParams({fingerprint:`eq.${event.fingerprint}`})}`,{method:'PATCH',headers:buildSupabaseAdminHeaders(),body:JSON.stringify({processed_at:event.processedAt}),redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('O processamento Asten não pôde ser confirmado na fila.');
}
