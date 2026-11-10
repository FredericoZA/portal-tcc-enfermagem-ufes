import {isDeepStrictEqual} from 'node:util';

const IDENTITY=['id','processId','documentType','documentVersion','idempotencyKey','createdBy','createdAt','sourceDataRevision'] as const;
/** Existing identities stay fixed; newly prepared ASTEN jobs may only be appended. */
export function existingSignatureJobPatch(before:object,after:object):Record<string,unknown>[]|null{
 if(!before||typeof before!=='object'||Array.isArray(before)||!after||typeof after!=='object'||Array.isArray(after))return null;
 const previous=before as Record<string,unknown>,next=after as Record<string,unknown>;
 if(!isDeepStrictEqual({...previous,signatureJobs:undefined},{...next,signatureJobs:undefined}))return null;
 if(!Array.isArray(previous.signatureJobs)||!Array.isArray(next.signatureJobs)||previous.signatureJobs.length>next.signatureJobs.length)return null;
 const changed:Record<string,unknown>[]=[];const ids=new Set<string>();
 for(let i=0;i<previous.signatureJobs.length;i++){
  const a=previous.signatureJobs[i],b=next.signatureJobs[i];
  if(!a||typeof a!=='object'||!b||typeof b!=='object'||typeof a.id!=='string'||!a.id||ids.has(a.id)||a.id!==b.id)return null;
  ids.add(a.id);
  if(IDENTITY.some(key=>!isDeepStrictEqual(a[key],b[key])))return null;
  if(!isDeepStrictEqual(a,b)){
   if(Buffer.byteLength(JSON.stringify(b))>200_000)return null;
   changed.push(b);if(changed.length>10)return null;
  }
 }
 for(let i=previous.signatureJobs.length;i<next.signatureJobs.length;i++){
  const b=next.signatureJobs[i];
  if(!b||typeof b!=='object'||Array.isArray(b)||typeof b.id!=='string'||!b.id||ids.has(b.id)
    ||b.provider!=='ASTEN'||b.status!=='QUEUED'||b.providerCreationState!=='PENDING'
    ||typeof b.idempotencyKey!=='string'||!/^[a-f0-9]{64}$/.test(b.idempotencyKey)
    ||next.signatureJobs.some((other,index)=>index!==i&&other?.idempotencyKey===b.idempotencyKey)
    ||Buffer.byteLength(JSON.stringify(b))>200_000)return null;
  ids.add(b.id);changed.push(b);if(changed.length>10)return null;
 }
 return changed.length?changed:null;
}
