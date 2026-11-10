import type {AuditLog,ProcessData} from '../../src/types';
import {processDeletionSummary,type ProcessDeletionSummary,type ProcessDeletionTask} from './processDeletion';

export interface ProcessDeletionStatusResult {
  state:'NOT_STARTED'|'PENDING'|'COMPLETED'|'UNKNOWN';
  processId:string;
  protocol?:string;
  taskId?:string;
  cleanup?:ProcessDeletionSummary;
  message?:string;
}

/** A missing task is not proof of completion: require the exact durable deletion record. */
export function readProcessDeletionStatus(input:{
  processId:string;taskId?:string;
  processes:Pick<ProcessData,'id'|'protocolo'>[];
  tasks:Array<ProcessDeletionTask|ProcessDeletionSummary>;
  logs:AuditLog[];
}):ProcessDeletionStatusResult {
  const {processId,taskId}=input;
  const result=(state:ProcessDeletionStatusResult['state'],extra:Omit<ProcessDeletionStatusResult,'state'|'processId'>={}):ProcessDeletionStatusResult=>({state,processId,...extra});
  const ownTasks=input.tasks.filter(task=>task.processId===processId);
  const ownLogs=input.logs.filter(log=>{
    const prefix=`delete_${processId}_`;
    return log.action==='EXCLUSAO_PROCESSO_TCC'&&log.entityType==='process_deletion'&&typeof log.entityId==='string'
      &&log.entityId.startsWith(prefix)&&/^\d+$/.test(log.entityId.slice(prefix.length))
      &&(!log.after?.deletedProcessId||log.after.deletedProcessId===processId);
  });
  const active=input.processes.find(process=>process.id===processId);
  if(active){
    return ownTasks.length||ownLogs.length||taskId
      ?result('UNKNOWN',{protocol:active.protocolo,message:'O processo está presente no Portal. A exclusão não pode ser considerada concluída.'})
      :result('NOT_STARTED',{protocol:active.protocolo,message:'O processo ainda não foi excluído.'});
  }
  if(taskId&&ownTasks.some(task=>task.status==='PENDING'&&task.id!==taskId))return result('UNKNOWN',{message:'A tarefa informada não corresponde à limpeza pendente deste processo.'});
  const tasks=ownTasks.filter(task=>!taskId||task.id===taskId);
  const logs=ownLogs.filter(log=>!taskId||log.entityId===taskId);
  const pending=tasks.filter(task=>task.status==='PENDING');
  if(pending.length===1){
    const task=pending[0];
    return result('PENDING',{protocol:task.protocol,taskId:task.id,cleanup:'envelopes' in task?processDeletionSummary(task):task,message:'O TCC foi excluído. A limpeza dos recursos ainda está pendente.'});
  }
  if(pending.length>1)return result('UNKNOWN',{message:'Há mais de uma limpeza vinculada ao processo. É necessário conferir o registro exato.'});
  const completed=logs.filter(log=>log.after?.cleanupConfirmed===true||log.after?.cleanupStatus==='Limpeza do Portal concluída');
  if(logs.length===1&&completed.length===1){
    const log=completed[0];
    return result('COMPLETED',{protocol:log.processProtocol,taskId:log.entityId,message:'Exclusão do Portal e limpeza confirmadas.'});
  }
  return result('UNKNOWN',{message:'Ainda não há confirmação suficiente da exclusão e da limpeza. Atualize a consulta antes de repetir a operação.'});
}
