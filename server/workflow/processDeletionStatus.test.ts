import test from 'node:test';
import assert from 'node:assert/strict';
import type {AuditLog} from '../../src/types';
import {processDeletionSummary,type ProcessDeletionTask} from './processDeletion';
import {readProcessDeletionStatus} from './processDeletionStatus';

const processId='proc-original_1',taskId=`delete_${processId}_1794050000000`;
const task:ProcessDeletionTask={id:taskId,processId,protocol:'TCC - 00002',rootFolderId:'private-root',fileIds:['private-pdf'],protectedIds:[],envelopes:['private-envelope'],jobIds:[],clearHistory:true,deleteFiles:true,status:'PENDING',errors:[],createdAt:'2026-11-07T12:00:00Z'};
const log:AuditLog={id:'log-'+taskId,entityId:taskId,entityType:'process_deletion',processProtocol:task.protocol,action:'EXCLUSAO_PROCESSO_TCC',actorEmail:'master@example.invalid',actorRoles:['MASTER_ADMIN'],timestamp:task.createdAt,after:{cleanupStatus:'Limpeza do Portal concluída'}};
const read=(patch:Partial<Parameters<typeof readProcessDeletionStatus>[0]>={})=>readProcessDeletionStatus({processId,processes:[],tasks:[],logs:[],...patch});

test('missing task never implies completion; an active untouched process has not started deletion',()=>{
 assert.equal(read().state,'UNKNOWN');
 assert.equal(read({processes:[{id:processId,protocolo:task.protocol}]}).state,'NOT_STARTED');
 assert.equal(read({logs:[{...log,after:{deleteFiles:true}}]}).state,'UNKNOWN');
 assert.equal(read({tasks:[{...task,status:'COMPLETED'}]}).state,'UNKNOWN');
});

test('only a matching completed durable deletion event proves completion',()=>{
 assert.equal(read({logs:[log]}).state,'COMPLETED');
 assert.equal(read({taskId,logs:[log]}).taskId,taskId);
 assert.equal(read({logs:[{...log,after:{cleanupConfirmed:true,deletedProcessId:processId}}]}).state,'COMPLETED');
 for(const changed of [
  {...log,action:'EDICAO_DADOS_PROCESSO'},
  {...log,entityType:'processo'},
  {...log,entityId:taskId+'-suffix'},
  {...log,entityId:'delete_other_1794050000000'},
  {...log,after:{...log.after,deletedProcessId:'other'}},
 ])assert.equal(read({logs:[changed]}).state,'UNKNOWN');
 assert.equal(read({taskId:'delete_other_1794050000000',logs:[log]}).state,'UNKNOWN');
 assert.equal(read({logs:[log,{...log,id:'different-event',entityId:`delete_${processId}_1794050000001`}]}).state,'UNKNOWN');
 assert.equal(read({logs:[log,{...log,id:'pending-event',entityId:`delete_${processId}_1794050000002`,after:{deleteFiles:true}}]}).state,'UNKNOWN');
});

test('pending cleanup overrides historical completion and exposes no file or envelope IDs',()=>{
 const before=structuredClone({task,log});
 const value=read({taskId,tasks:[task],logs:[log]});
 assert.equal(value.state,'PENDING');assert.equal(value.cleanup?.id,taskId);
 assert.equal(value.protocol,task.protocol);
 assert.doesNotMatch(JSON.stringify(value),/private-root|private-pdf|private-envelope/);
 assert.deepEqual({task,log},before);
 assert.equal(read({taskId:'delete_other_1',tasks:[task],logs:[log]}).state,'UNKNOWN');
});

test('a reintroduced original process cannot be reported completed, while serial reuse by a new ID is preserved',()=>{
 assert.equal(read({processes:[{id:processId,protocolo:task.protocol}],logs:[log]}).state,'UNKNOWN');
 assert.equal(read({processes:[{id:processId,protocolo:task.protocol}],tasks:[task]}).state,'UNKNOWN');
 assert.equal(read({processes:[{id:'new-owner',protocolo:task.protocol}],logs:[log]}).state,'COMPLETED');
});

test('native deletion summaries preserve exact task status, errors and external progress without private arrays',()=>{
 const detailed:ProcessDeletionTask={...task,errors:['ASTEN aguarda conferência'],attemptCount:2,lastAttemptAt:'2026-11-08T01:00:00Z',nextRetryAt:'2026-11-08T02:00:00Z',astenReconciliation:[{id:'private-envelope',state:'REVIEW'},{id:'signed-preserved',state:'PRESERVED'}]};
 const summary=processDeletionSummary(detailed);
 assert.deepEqual(read({taskId,tasks:[summary]}),read({taskId,tasks:[detailed]}));
 const cleanup=read({taskId,tasks:[summary]}).cleanup!;assert.equal(cleanup.status,'PENDING');assert.equal(cleanup.externalPending,1);assert.deepEqual(cleanup.errors,detailed.errors);assert.equal(cleanup.attemptCount,2);assert.equal('envelopes' in cleanup,false);assert.equal('astenReconciliation' in cleanup,false);
 const completed={...detailed,status:'COMPLETED' as const};assert.deepEqual(read({tasks:[processDeletionSummary(completed)],logs:[log]}),read({tasks:[completed],logs:[log]}));
});
