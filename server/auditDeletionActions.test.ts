import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProcessDeletionRetryAction} from '../src/components/AuditLogDetails';
import {auditDeletionTaskId,resumeDeletionFromAudit} from '../src/utils/processDeletionRecovery';
import type {ReadableAuditLog} from '../src/utils/auditLogPresentation';
import type {ProcessDeletionSummary} from './workflow/processDeletion';

const id='delete_proc-fixture_1794050000000';
const log:ReadableAuditLog={id:'log-'+id,action:'EXCLUSAO_PROCESSO_TCC',entityType:'process_deletion',entityId:id,processProtocol:'TCC - 00002',actorEmail:'master@example.invalid',actorRoles:['MASTER_ADMIN'],timestamp:'2026-11-07T12:00:00Z',after:{cleanupTaskId:id,cleanupPending:true}};
const task:ProcessDeletionSummary={id,processId:'proc-fixture',protocol:log.processProtocol!,deleteFiles:true,clearHistory:true,status:'PENDING',errors:[],attemptCount:1,lastAttemptAt:undefined,nextRetryAt:undefined,processingUntil:undefined,envelopeCount:0,externalPending:0};
const render=(entry=log,isMaster=true,working=false)=>renderToStaticMarkup(React.createElement(ProcessDeletionRetryAction,{log:entry,isMaster,working,onRetry:()=>{throw Error('Não executar limpeza ao renderizar.');}}));

test('audit offers cleanup continuation only to Master on the live bound deletion record',()=>{
 assert.match(render(),/Retomar limpeza/);
 assert.equal(render(log,false),'');
 for(const entry of [
  {...log,action:'EDICAO_DADOS_PROCESSO'},
  {...log,entityType:'processo'},
  {...log,after:{cleanupPending:true}},
  {...log,after:{...log.after,cleanupTaskId:'delete_another_1'}},
  {...log,after:{...log.after,cleanupPending:false}},
  {...log,processProtocol:undefined},
 ]){assert.equal(auditDeletionTaskId(entry),undefined);assert.equal(render(entry),'');}
 assert.match(render(log,true,true),/disabled=""/);
 assert.match(render({...log,after:{...log.after,processingUntil:'2099-01-01T00:00:00Z'}}),/disabled=""/);
});

test('resume refreshes identity and lease before one confirmed retry; never mutates source records',async()=>{
 const events:string[]=[],before=structuredClone({log,task});
 const message=await resumeDeletionFromAudit(log,{isMaster:true,
  load:async()=>{events.push('read');return[task];},
  confirm:async text=>{events.push('confirm');assert.match(text,/TCC - 00002/);return true;},
  retry:async actual=>{events.push('retry');assert.equal(actual,id);return{...task,status:'COMPLETED'};},
 });
 assert.deepEqual(events,['read','confirm','retry']);assert.match(message,/Limpeza concluída/);
 assert.deepEqual({log,task},before);
});

test('no provider retry for another role, missing task, changed protocol, active lease, or declined confirmation',async()=>{
 for(const scenario of ['role','missing','otherProtocol','lease','decline'] as const){
  let reads=0,confirmations=0,retries=0;
  const ports={isMaster:scenario!=='role',now:()=>Date.parse('2026-11-07T12:00:00Z'),
   load:async()=>{reads++;return scenario==='missing'?[]:[{...task,...(scenario==='otherProtocol'?{protocol:'TCC - 00003'}:{}),...(scenario==='lease'?{processingUntil:'2026-11-07T12:15:00Z'}:{})}];},
   confirm:async()=>{confirmations++;return scenario!=='decline';},retry:async()=>{retries++;return task;},
  };
  if(scenario==='role')await assert.rejects(resumeDeletionFromAudit(log,ports),/Master/);
  else await resumeDeletionFromAudit(log,ports);
  assert.equal(retries,0,scenario);assert.equal(reads,scenario==='role'?0:1);
  assert.equal(confirmations,scenario==='decline'?1:0,scenario);
 }
});

test('a failed read or ambiguous retry never causes an automatic second request',async()=>{
 for(const failedRead of [true,false]){
  let retries=0;
  await assert.rejects(resumeDeletionFromAudit(log,{isMaster:true,
   load:async()=>{if(failedRead)throw Error('Consulta indisponível.');return[task];},
   confirm:async()=>true,retry:async()=>{retries++;throw Error('Resultado não confirmado.');},
  }),failedRead?/Consulta/:/não confirmado/);
  assert.equal(retries,failedRead?0:1);
 }
});

test('a still pending retry remains pending and a mismatched response cannot claim completion',async()=>{
 const ports={isMaster:true,load:async()=>[task],confirm:async()=>true,retry:async()=>task};
 assert.match(await resumeDeletionFromAudit(log,ports),/continua pendente/);
 await assert.rejects(resumeDeletionFromAudit(log,{...ports,retry:async()=>({...task,id:'delete_other_1',status:'COMPLETED'})}),/não corresponde/);
});
