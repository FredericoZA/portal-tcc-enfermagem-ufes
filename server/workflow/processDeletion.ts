import type {AuditLog,ProcessData,SignatureJob} from '../../src/types';
import {SERIAL_PROCESS_PROTOCOL} from '../../src/utils/installationProfile';
import type {DeletionEnvelope} from './astenDeletion';
export interface ProcessDeletionTask {id:string;processId:string;protocol:string;protocolAliases?:string[];rootFolderId:string;calendarId?:string;calendarCleaned?:boolean;storageCleaned?:boolean;driveCleaned?:boolean;folderId?:string;fileIds:string[];protectedIds:string[];envelopes:string[];astenReconciliation?:DeletionEnvelope[];externalReviewRequired?:boolean;jobIds:string[];clearHistory:boolean;deleteFiles:boolean;status:'PENDING'|'COMPLETED';errors:string[];createdAt:string;attemptCount?:number;lastAttemptAt?:string;nextRetryAt?:string;processingUntil?:string;}
export function processDeletionSummary(task: ProcessDeletionTask) {
 const {id, processId, protocol, deleteFiles, clearHistory, status, errors, attemptCount, lastAttemptAt, nextRetryAt, processingUntil} = task;
 const envelopes = task.astenReconciliation;
 return {
  id, processId, protocol, deleteFiles, clearHistory, status, errors, attemptCount, lastAttemptAt, nextRetryAt, processingUntil,
  envelopeCount: task.envelopes.length,
  externalPending: envelopes?.filter(envelope => envelope.state === 'PENDING' || envelope.state === 'REVIEW').length ?? task.envelopes.length,
 };
}

export type ProcessDeletionSummary = ReturnType<typeof processDeletionSummary>;

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
 const astenReconciliation = new Map<string, DeletionEnvelope>();
 for (const job of ownJobs) {
  const id = job.provider === 'ASTEN' ? job.providerEnvelopeId?.trim() : undefined;
  if (!id) continue;
  const state = 'PENDING';
  const previous = astenReconciliation.get(id);
  if (previous?.state === 'REVIEW') continue;
  const hasKnownSignature=previous?.hasKnownSignature || job.status==='PARTIALLY_SIGNED';
  if(previous && (previous.repositoryId!==job.providerRepositoryId || previous.folderId!==job.providerFolderId || previous.hash!==job.providerEnvelopeHash)){
    astenReconciliation.set(id,{id,state:'REVIEW',hasKnownSignature,purgeRequired:true});
  }else{
    astenReconciliation.set(id,{id,state,repositoryId:job.providerRepositoryId,folderId:job.providerFolderId,hash:job.providerEnvelopeHash,signerCount:job.signers?.length,hasKnownSignature,purgeRequired:true});
  }
 }
 const protocolAliases=[...new Set((p.previousProtocols||[]).filter(alias=>alias!==p.protocolo))];
 return {id:`delete_${p.id}_${Date.now()}`,processId:p.id,protocol:p.protocolo,...(protocolAliases.length?{protocolAliases}:{}),folderId:p.driveFolderId,rootFolderId:options.rootFolderId,fileIds:collectProcessDriveFileIds(p,ownJobs,ownForms),protectedIds:[...new Set(options.protectedIds.filter(Boolean))],envelopes:[...astenReconciliation.keys()],astenReconciliation:[...astenReconciliation.values()],jobIds:[...new Set(ownJobs.map(job=>job.id))],deleteFiles:options.deleteFiles,clearHistory:options.clearHistory,status:'PENDING',errors:[],createdAt:new Date().toISOString()};
}

export function restoresDeletedProcess(
 restored:Pick<ProcessData,'id'|'protocolo'>[],
 current:Pick<ProcessData,'id'>[],
 tasks:Pick<ProcessDeletionTask,'processId'|'protocol'>[],
 logs:Pick<AuditLog,'action'|'entityId'|'processProtocol'>[],
):boolean {
 const normalize=(value:string|undefined)=>String(value||'').trim().toUpperCase();
 const currentIds=new Set(current.map(process=>process.id));
 const deletedIds=new Set(tasks.map(task=>task.processId));
 const deletedProtocols=new Set(tasks.map(task=>normalize(task.protocol)).filter(Boolean));
 for(const log of logs){
  if(log.action!=='EXCLUSAO_PROCESSO_TCC')continue;
  const id=/^delete_(.+)_\d+$/.exec(log.entityId)?.[1];
  if(id)deletedIds.add(id);
  const protocol=normalize(log.processProtocol);
  // Serial codes may belong to a later TCC once cleanup finishes. The deletion ID identifies the original.
  if(protocol&&(!id||!SERIAL_PROCESS_PROTOCOL.test(protocol)))deletedProtocols.add(protocol);
 }
 return restored.some(process=>!currentIds.has(process.id)&&(deletedIds.has(process.id)||deletedProtocols.has(normalize(process.protocolo))));
}

const maxAutomaticDeletionAttempts = 7;
export const processDeletionLeaseMs = 15 * 60_000;

export function isProcessDeletionInProgress(task: ProcessDeletionTask, now = Date.now()): boolean {
 return Date.parse(task.processingUntil || '') > now;
}

export function selectDueProcessDeletions(tasks: ProcessDeletionTask[], now = Date.now(), limit = 2): ProcessDeletionTask[] {
 const dueAt = (task: ProcessDeletionTask) => Date.parse(task.nextRetryAt || task.createdAt) || 0;
 return tasks.filter(task => task.status === 'PENDING'
   && !task.externalReviewRequired
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
