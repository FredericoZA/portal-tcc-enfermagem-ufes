import {isDeepStrictEqual} from 'node:util';
const record=(value:unknown):value is Record<string,any>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
export interface DocumentModelPatch {document_models:Record<string,unknown>;settings_updated_at:string;audit_append:Record<string,unknown>[]}
/** Models are metadata only. Any unrelated change, history rewrite or pruning uses the full writer. */
export function documentModelPublicationPatch(before:object,after:object):DocumentModelPatch|null{
 if(!record(before)||!record(after)||!record(before.settings)||!record(after.settings))return null;
 const strip=(value:Record<string,unknown>,keys:string[])=>Object.fromEntries(Object.entries(value).filter(([key])=>!keys.includes(key)));
 if(!isDeepStrictEqual(strip(before,['settings','auditLogs']),strip(after,['settings','auditLogs']))
   ||!isDeepStrictEqual(strip(before.settings,['documentModels','updatedAt']),strip(after.settings,['documentModels','updatedAt'])))return null;
 const models=after.settings.documentModels;
 if(!record(models)||typeof after.settings.updatedAt!=='string'||!after.settings.updatedAt||isDeepStrictEqual(before.settings.documentModels,models))return null;
 const old=before.auditLogs,next=after.auditLogs;
 if(!Array.isArray(old)||!Array.isArray(next)||next.length<old.length||next.length>5000||next.length-old.length>20)return null;
 if(!old.every((event,index)=>isDeepStrictEqual(event,next[index])))return null;
 const added=next.slice(old.length),ids=new Set(old.map(event=>event?.id));
 for(const event of added){
  if(!record(event)||typeof event.id!=='string'||!event.id||ids.has(event.id))return null;
  ids.add(event.id);
 }
 const patch={document_models:models,settings_updated_at:after.settings.updatedAt,audit_append:added};
 return Buffer.byteLength(JSON.stringify(patch))<=2_000_000?patch:null;
}
