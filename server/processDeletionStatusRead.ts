import type {Express} from 'express';
import type {AuditLog,GlobalSettings,ProcessData} from '../src/types';
import {normalizeEmail} from '../src/utils/formatters';
import {attachPortalIdentity,clearPortalSessionCookie,getPortalIdentity,requireAuthenticated,type PortalIdentity} from './security/firebaseAuth';
import {processDeletionSummary,type ProcessDeletionTask,type ProcessDeletionSummary} from './workflow/processDeletion';
import {readProcessDeletionStatus} from './workflow/processDeletionStatus';
type DeletionSnapshot={settings?:GlobalSettings;revokedSessionIds?:string[];processes?:ProcessData[];processDeletionTasks?:ProcessDeletionTask[];auditLogs?:AuditLog[]};
interface StatusProjection {settings:Pick<GlobalSettings,'masterEmail'|'ownerEmail'|'sessionValidAfter'>;revokedSessionIds:string[];processes:Array<Pick<ProcessData,'id'|'protocolo'>>;tasks:ProcessDeletionSummary[];logs:AuditLog[];}
function project(snapshot:DeletionSnapshot):StatusProjection {
 if(!snapshot.settings||!Array.isArray(snapshot.processes))throw new Error('Estado administrativo não confirmado.');
 return {settings:{masterEmail:snapshot.settings.masterEmail,ownerEmail:snapshot.settings.ownerEmail,sessionValidAfter:snapshot.settings.sessionValidAfter},revokedSessionIds:[...(snapshot.revokedSessionIds||[])],processes:snapshot.processes.map(({id,protocolo})=>({id,protocolo})),
  tasks:(snapshot.processDeletionTasks||[]).map(processDeletionSummary),
  logs:(snapshot.auditLogs||[]).filter(log=>log.action==='EXCLUSAO_PROCESSO_TCC'&&log.entityType==='process_deletion').map(log=>({id:log.id,action:log.action,entityType:log.entityType,entityId:log.entityId,actorEmail:'',actorRoles:[],timestamp:log.timestamp,processProtocol:log.processProtocol,after:{deletedProcessId:log.after?.deletedProcessId,cleanupConfirmed:log.after?.cleanupConfirmed,cleanupStatus:log.after?.cleanupStatus}})),
 };
}
/** Same session revocation and Master/owner rules as the normal runtime, evaluated on this read's snapshot. */
export function deletionStatusAuthorization(identity:PortalIdentity,state:Pick<StatusProjection,'settings'|'revokedSessionIds'>):'MASTER'|'REVOKED'|'FORBIDDEN' {
 if(identity.issuedAt<Number(state.settings.sessionValidAfter||0)||state.revokedSessionIds.includes(identity.sessionId))return 'REVOKED';
 const email=normalizeEmail(identity.email);return [state.settings.masterEmail,state.settings.ownerEmail].map(value=>normalizeEmail(value||'')).filter(Boolean).includes(email)?'MASTER':'FORBIDDEN';
}
export function createDeletionStatusReader(ports:{durable:()=>boolean;readRevision:()=>Promise<number|null>;readDurable:(revision:number)=>Promise<DeletionSnapshot|null>;readLocal:()=>DeletionSnapshot}) {
 let pending:Promise<StatusProjection>|undefined;let cached:{revision:number;value:StatusProjection}|undefined;
 return async()=>{
  if(!pending){const task=Promise.resolve().then(async()=>{
   if(!ports.durable()){cached=undefined;return project(structuredClone(ports.readLocal()));}
   const revision=await ports.readRevision();if(revision===null||!Number.isSafeInteger(revision)||revision<1)throw new Error('Revisão administrativa não confirmada.');
   if(cached?.revision===revision)return cached.value;cached=undefined;
   const snapshot=await ports.readDurable(revision);if(!snapshot)throw new Error('Estado administrativo ausente.');const value=project(snapshot);
   if(await ports.readRevision()!==revision)throw new Error('A revisão administrativa mudou durante a consulta.');
   cached={revision,value};return value;
  });pending=task;void task.finally(()=>{if(pending===task)pending=undefined;}).catch(()=>undefined);}
  return structuredClone(await pending);
 };
}
/** Only this read uses a separate immutable snapshot. Mutations retain the runtime lock. */
export function installDeletionStatusRoute(app:Pick<Express,'get'>,read:()=>Promise<StatusProjection>):void {
 app.get('/api/admin/process-deletions/status',attachPortalIdentity,requireAuthenticated,async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');
  try{
   const state=await read();const auth=deletionStatusAuthorization(getPortalIdentity(req)!,state);
   if(auth==='REVOKED'){clearPortalSessionCookie(res);return res.status(401).json({error:'Autenticação institucional obrigatória.',code:'AUTHENTICATION_REQUIRED'});}
   if(auth!=='MASTER')return res.status(403).json({error:'Apenas o Master pode gerenciar exclusões.'});
   const processId=typeof req.query.processId==='string'?req.query.processId:'';const taskId=req.query.taskId===undefined?undefined:typeof req.query.taskId==='string'?req.query.taskId:'';
   if(!processId||processId.length>300||/[\x00-\x1f\x7f]/.test(processId)||taskId!==undefined&&(!taskId||taskId.length>400||/[\x00-\x1f\x7f]/.test(taskId)))return res.status(400).json({error:'Informe o processo e, quando disponível, a tarefa de exclusão válidos.'});
   return res.json(readProcessDeletionStatus({processId,taskId,processes:state.processes,tasks:state.tasks,logs:state.logs}));
  }catch{return res.status(503).setHeader('Retry-After','5').json({code:'DELETION_STATUS_UNAVAILABLE',error:'Não foi possível confirmar o andamento da exclusão. Tente novamente.'});}
 });
}
