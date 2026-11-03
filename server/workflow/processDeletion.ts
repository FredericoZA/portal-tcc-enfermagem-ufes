import type {ProcessData,SignatureJob} from '../../src/types';
export interface ProcessDeletionTask {id:string;processId:string;protocol:string;rootFolderId:string;calendarId?:string;calendarCleaned?:boolean;storageCleaned?:boolean;folderId?:string;fileIds:string[];protectedIds:string[];envelopes:string[];jobIds:string[];clearHistory:boolean;deleteFiles:boolean;status:'PENDING'|'COMPLETED';errors:string[];createdAt:string;}
export function processDeletionTask(p:ProcessData,jobs:SignatureJob[],forms:Array<{processId:string;driveFileId?:string}>,options:{deleteFiles:boolean;clearHistory:boolean;rootFolderId:string;protectedIds:string[]}):ProcessDeletionTask{
 const ids=new Set<string>();const visit=(value:unknown)=>{if(!value||typeof value!=='object')return;for(const [key,v] of Object.entries(value)){if(typeof v==='string'&&/FileId$/.test(key)&&v)ids.add(v);else if(typeof v==='object')visit(v);}};
 visit(p);jobs.forEach(visit);forms.forEach(visit);
 return {id:`delete_${p.id}_${Date.now()}`,processId:p.id,protocol:p.protocolo,folderId:p.driveFolderId,rootFolderId:options.rootFolderId,fileIds:[...ids],protectedIds:options.protectedIds,envelopes:jobs.map(j=>j.provider==='ASTEN'?j.providerEnvelopeId:'').filter(Boolean) as string[],jobIds:jobs.map(j=>j.id),...options,status:'PENDING',errors:[],createdAt:new Date().toISOString()};
}
