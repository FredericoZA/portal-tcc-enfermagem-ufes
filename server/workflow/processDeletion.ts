import type {ProcessData,SignatureJob} from '../../src/types';
export interface ProcessDeletionTask {id:string;processId:string;protocol:string;rootFolderId:string;calendarId?:string;calendarCleaned?:boolean;storageCleaned?:boolean;driveCleaned?:boolean;folderId?:string;fileIds:string[];protectedIds:string[];envelopes:string[];jobIds:string[];clearHistory:boolean;deleteFiles:boolean;status:'PENDING'|'COMPLETED';errors:string[];createdAt:string;attemptCount?:number;lastAttemptAt?:string;nextRetryAt?:string;processingUntil?:string;}
export function collectProcessDriveFileIds(...values:unknown[]):string[]{
 const ids=new Set<string>(),seen=new WeakSet<object>();
 const visit=(value:unknown)=>{
  if(!value||typeof value!=='object'||seen.has(value))return;
  seen.add(value);
  for(const [key,v] of Object.entries(value)){
   if(typeof v==='string'&&/(?:File|Pdf|Doc|Folder)Id$|^(?:fileId|folderId)$/.test(key)&&v.trim())ids.add(v.trim());
   else if(typeof v==='object')visit(v);
  }
 };
 values.forEach(visit);
 return [...ids];
}
export function processDeletionTask(p:ProcessData,jobs:SignatureJob[],forms:Array<{processId:string;driveFileId?:string}>,options:{deleteFiles:boolean;clearHistory:boolean;rootFolderId:string;protectedIds:string[]}):ProcessDeletionTask{
 const ownJobs=jobs.filter(job=>job.processId===p.id),ownForms=forms.filter(form=>form.processId===p.id);
 return {id:`delete_${p.id}_${Date.now()}`,processId:p.id,protocol:p.protocolo,folderId:p.driveFolderId,rootFolderId:options.rootFolderId,fileIds:collectProcessDriveFileIds(p,ownJobs,ownForms),protectedIds:[...new Set(options.protectedIds.filter(Boolean))],envelopes:[...new Set(ownJobs.filter(job=>job.provider==='ASTEN').map(job=>job.providerEnvelopeId?.trim()).filter(Boolean))] as string[],jobIds:[...new Set(ownJobs.map(job=>job.id))],deleteFiles:options.deleteFiles,clearHistory:options.clearHistory,status:'PENDING',errors:[],createdAt:new Date().toISOString()};
}

const maxAutomaticDeletionAttempts = 7;
export const processDeletionLeaseMs = 15 * 60_000;

export function isProcessDeletionInProgress(task: ProcessDeletionTask, now = Date.now()): boolean {
 return Date.parse(task.processingUntil || '') > now;
}

export function selectDueProcessDeletions(tasks: ProcessDeletionTask[], now = Date.now(), limit = 2): ProcessDeletionTask[] {
 const dueAt = (task: ProcessDeletionTask) => Date.parse(task.nextRetryAt || task.createdAt) || 0;
 return tasks.filter(task => task.status === 'PENDING'
   && (task.attemptCount || 0) < maxAutomaticDeletionAttempts
   && !isProcessDeletionInProgress(task, now)
   && dueAt(task) <= now)
  .sort((left, right) => dueAt(left) - dueAt(right))
  .slice(0, limit);
}

export function processDeletionNextRetryAt(attemptCount: number, now = Date.now()): string | undefined {
 if (attemptCount >= maxAutomaticDeletionAttempts) return;
 const delayDays = Math.min(7, 2 ** Math.max(0, attemptCount - 1));
 return new Date(now + delayDays * 86_400_000).toISOString();
}
