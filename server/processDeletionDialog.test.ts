import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderToStaticMarkup} from 'react-dom/server';
import React from 'react';
import {ApiRequestError} from '../src/services/apiClient';
import {ProcessDeletionProgress} from '../src/components/ProcessDeletionDialog';
import {createDeletionStatusWatcher,createProcessDeletionSession,type DeletionDialogState,type ProcessDeletionResponse} from '../src/utils/processDeletionDialog';
import type {ProcessDeletionSummary} from './workflow/processDeletion';
import type {ProcessDeletionStatusResult} from './workflow/processDeletionStatus';

const target={id:'p-original',protocol:'TCC - 00003',title:'Trabalho fictício',authors:'Pessoa fictícia'};
const taskId=`delete_${target.id}_123`;
function cleanup(status:'PENDING'|'COMPLETED'='PENDING'):ProcessDeletionSummary{return{id:taskId,processId:target.id,protocol:target.protocol,deleteFiles:true,clearHistory:true,status,errors:[],envelopeCount:1,externalPending:status==='PENDING'?1:0,attemptCount:1,lastAttemptAt:undefined,nextRetryAt:undefined,processingUntil:undefined};}
const pending:ProcessDeletionStatusResult={state:'PENDING',processId:target.id,protocol:target.protocol,taskId,cleanup:cleanup()};
const completed:ProcessDeletionStatusResult={state:'COMPLETED',processId:target.id,protocol:target.protocol,taskId};
function reply(status:'PENDING'|'COMPLETED'):ProcessDeletionResponse{return {processId:target.id,protocol:target.protocol,message:'Resultado',cleanupTaskId:taskId,cleanupPending:status==='PENDING',cleanup:cleanup(status)};}
function fixture(options:Partial<{remove:()=>Promise<ProcessDeletionResponse>;read:(id:string,tid:string|undefined,signal:AbortSignal)=>Promise<ProcessDeletionStatusResult>;retry:()=>Promise<ProcessDeletionSummary>}>={}){
 const writes:string[]=[],reads:string[]=[];const states:DeletionDialogState[]=[];
 const session=createProcessDeletionSession(target,{
  remove:async id=>{writes.push('DELETE:'+id);return options.remove?options.remove():reply('PENDING');},
  read:async(id,tid,signal)=>{reads.push(id);return options.read?options.read(id,tid,signal):pending;},
  retry:async id=>{writes.push('POST:'+id);return options.retry?options.retry():cleanup('COMPLETED');},
  change:state=>states.push(state),now:()=>1000,
  rejectsBeforeDelete:error=>error instanceof ApiRequestError&&error.status===409&&error.code==='PROCESS_OPERATION_IN_PROGRESS',
 });
 return{session,writes,reads,states};
}

test('confirmation is mandatory, 202 remains in the dialog and completion requires explicit checking',async()=>{
 const f=fixture();await f.session.run('delete','wrong');assert.equal(f.writes.length,0);
 await f.session.run('delete','Excluir');assert.equal(f.session.snapshot().phase,'pending');assert.equal(f.writes.length,1);assert.equal(f.reads.length,0);
 await f.session.run('delete','Excluir');assert.equal(f.writes.length,1,'pending phase never repeats DELETE');
});

test('successful deletion stays confirmed and cannot be submitted a second time',async()=>{
 const f=fixture({remove:async()=>reply('COMPLETED')});await f.session.run('delete','EXCLUIR');
 assert.equal(f.session.snapshot().phase,'completed');await f.session.run('delete','EXCLUIR');await f.session.run('retry');assert.equal(f.writes.length,1);
});

test('lost DELETE response is resolved by one exact read without repeating any write',async()=>{
 const f=fixture({remove:async()=>{throw new Error('Timeout');},read:async()=>completed});await f.session.run('delete','Excluir');
 assert.equal(f.session.snapshot().phase,'completed');assert.deepEqual(f.writes,['DELETE:'+target.id]);assert.deepEqual(f.reads,[target.id]);
});

test('missing/failed readback remains uncertain and disables another DELETE',async()=>{
 const f=fixture({remove:async()=>{throw new Error('Timeout');},read:async()=>{throw new Error('404');}});
 await f.session.run('delete','Excluir');assert.equal(f.session.snapshot().phase,'uncertain');await f.session.run('delete','Excluir');
 assert.equal(f.writes.length,1);await f.session.run('check');assert.equal(f.reads.length,2,'each explicit check is only one GET');assert.equal(f.writes.length,1);
});

test('a confirmed NOT_STARTED result permits a manual fresh confirmation',async()=>{
 let denied=true;
 const f=fixture({remove:async()=>{if(denied)throw new ApiRequestError('Operação em andamento',409,'PROCESS_OPERATION_IN_PROGRESS');return reply('COMPLETED');},read:async()=>({state:'NOT_STARTED',processId:target.id,protocol:target.protocol})});
 await f.session.run('delete','Excluir');assert.equal(f.session.snapshot().phase,'confirm');denied=false;await f.session.run('delete','Excluir');assert.equal(f.session.snapshot().phase,'completed');assert.equal(f.writes.length,2);
});

test('another process with the same protocol never authorizes cleanup or completion',async()=>{
 const f=fixture({read:async()=>({...completed,processId:'another'})});await f.session.run('delete','Excluir');await f.session.run('check');
 assert.equal(f.session.snapshot().phase,'uncertain');assert.equal(f.writes.length,1);
});

test('an active cleanup lease prevents another POST; otherwise one retry uses the original task',async()=>{
 let busy=true;
 const f=fixture({read:async()=>({...pending,cleanup:{...cleanup(),processingUntil:busy?new Date(5000).toISOString():undefined}})});
 await f.session.run('delete','Excluir');await f.session.run('retry');assert.equal(f.writes.length,1);
 busy=false;await f.session.run('retry');assert.deepEqual(f.writes,['DELETE:'+target.id,'POST:'+taskId]);assert.equal(f.session.snapshot().phase,'completed');
});

test('double clicks during an in-flight deletion produce one DELETE',async()=>{
 let finish!:(value:ProcessDeletionResponse)=>void;
 const f=fixture({remove:()=>new Promise(resolve=>{finish=resolve;})});
 const first=f.session.run('delete','Excluir');await f.session.run('delete','Excluir');assert.equal(f.writes.length,1);finish(reply('PENDING'));await first;assert.equal(f.session.snapshot().phase,'pending');
});

test('a retry response lost after sending performs only a readback',async()=>{
 let reads=0;const f=fixture({read:async()=>++reads===1?pending:completed,retry:async()=>{throw new Error('Timeout');}});
 await f.session.run('delete','Excluir');await f.session.run('retry');assert.equal(f.session.snapshot().phase,'completed');assert.equal(f.writes.filter(v=>v.startsWith('POST')).length,1);
});

test('unmount or identity change aborts reads and ignores late mutation results',async()=>{
 let finish!:(value:ProcessDeletionResponse)=>void;
 const f=fixture({remove:()=>new Promise(resolve=>{finish=resolve;})});const action=f.session.run('delete','Excluir');const before=f.states.length;
 f.session.dispose();finish(reply('COMPLETED'));await action;assert.equal(f.states.length,before);assert.equal(f.reads.length,0);
 const g=fixture({read:(_id,_tid,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))))});
 await g.session.run('delete','Excluir');const reading=g.session.run('check');g.session.dispose();await reading;assert.equal(g.writes.length,1);
});

test('pending signed envelopes never render a false conclusion or raw resource IDs',()=>{
 const state:DeletionDialogState={phase:'pending',busy:false,message:'Ainda pendente',taskId,cleanup:{...cleanup(),errors:['private-folder-id']}};
 const html=renderToStaticMarkup(React.createElement(ProcessDeletionProgress,{target,state}));
 assert.match(html,/numeração continua protegida/i);assert.doesNotMatch(html,/private-folder-id|TCC excluído e limpeza concluída/);
});

test('detail lifecycle pauses only its own refresh and renders deletion ahead of loading/404 exits',async()=>{
 const detail=await readFile('src/pages/ProcessoDetailPage.tsx','utf8');
 assert.match(detail,/if\(deletionDialogRef\.current\)return/);
 assert.match(detail,/requestScope !== legacyAccessScope\.current \|\| deletionDialogRef\.current/);
 assert.match(detail,/active&&!deletionDialogRef\.current&&err instanceof ApiRequestError/);
 assert.match(detail,/enabled: activeTab==='docs' && !deletionDialogActive/);
 assert.ok(detail.indexOf('return <ProcessDeletionDialog')<detail.indexOf('if (isLoading)'));
 assert.doesNotMatch(detail,/Configurações → Integrações e Plataforma/);
});


test('timeout plus NOT_STARTED remains uncertain across later checks and never releases another DELETE',async()=>{
 const f=fixture({remove:async()=>{throw new ApiRequestError('Tempo excedido',0,'REQUEST_TIMEOUT');},read:async()=>({state:'NOT_STARTED',processId:target.id,protocol:target.protocol})});
 await f.session.run('delete','Excluir');assert.equal(f.session.snapshot().phase,'uncertain');
 await f.session.run('check');assert.equal(f.session.snapshot().phase,'uncertain');
 await f.session.run('delete','Excluir');assert.equal(f.writes.length,1);
});

test('unclassified 5xx and malformed acknowledgements never treat absence as cancellation',async()=>{
 for(const failure of ['5xx','invalid'] as const){
  const f=fixture({remove:async()=>{if(failure==='5xx')throw new ApiRequestError('Falha',503);return {...reply('COMPLETED'),processId:'other'};},read:async()=>({state:'NOT_STARTED',processId:target.id,protocol:target.protocol})});
  await f.session.run('delete','Excluir');await f.session.run('check');await f.session.run('delete','Excluir');assert.equal(f.session.snapshot().phase,'uncertain');assert.equal(f.writes.length,1);
 }
});


test('a late read after scope disposal cannot clear uncertainty in a reactivated session',async()=>{
 let resolveRead!:(value:ProcessDeletionStatusResult)=>void,startRead!:()=>void,calls=0;
 const started=new Promise<void>(resolve=>{startRead=resolve;});
 const f=fixture({remove:async()=>{throw new ApiRequestError('Timeout',0);},read:async()=>{
  if(++calls===1){startRead();return new Promise(resolve=>{resolveRead=resolve;});}
  return {state:'NOT_STARTED',processId:target.id,protocol:target.protocol};
 }});
 const deletion=f.session.run('delete','Excluir');await started;f.session.dispose();f.session.activate();resolveRead(completed);await deletion;
 await f.session.run('check');assert.equal(f.session.snapshot().phase,'uncertain');await f.session.run('delete','Excluir');assert.equal(f.writes.length,1);
});

function watcherClock(){
 let time=0,id=0;const timers=new Map<number,{at:number;callback:()=>void}>();
 return {now:()=>time,schedule:(callback:()=>void,delay:number)=>{const key=++id;timers.set(key,{at:time+delay,callback});return key as any;},cancel:(key:any)=>{timers.delete(key);},
  advance:async(ms:number)=>{const end=time+ms;for(;;){const next=[...timers.entries()].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].callback();await new Promise(resolve=>setImmediate(resolve));}time=end;},size:()=>timers.size};
}

test('automatic deletion observation performs at most six checks per dialog, never another write',async()=>{
 const clock=watcherClock();const f=fixture({remove:async()=>{throw new Error('lost acknowledgement');},read:async()=>{throw new Error('read unavailable');}});
 await f.session.run('delete','EXCLUIR');assert.equal(f.session.snapshot().phase,'uncertain');const initialReads=f.reads.length;
 const watcher=createDeletionStatusWatcher({snapshot:f.session.snapshot,check:signal=>f.session.run('check','',signal),...clock});watcher.start();
 await clock.advance(60_000);assert.equal(f.reads.length-initialReads,6);assert.deepEqual(f.writes,['DELETE:'+target.id]);
 await f.session.run('check');assert.equal(f.reads.length-initialReads,7,'manual check remains possible after automatic budget ends');watcher.update();await clock.advance(60_000);assert.equal(f.reads.length-initialReads,7);
});

test('automatic checks observe active cleanup and stop immediately on confirmed completion',async()=>{
 const clock=watcherClock();let state:DeletionDialogState={phase:'pending',busy:false,message:'Pending',cleanup:{...cleanup(),processingUntil:new Date(60_000).toISOString()}};let reads=0;
 const watcher=createDeletionStatusWatcher({snapshot:()=>state,check:async()=>{if(++reads===2)state={phase:'completed',busy:false,message:'Confirmed'};},...clock});
 watcher.start();await clock.advance(30_000);assert.equal(reads,2);assert.equal(clock.size(),0);
});

test('pending cleanup without active lease does not auto-retry, and disposal aborts only its active status read',async()=>{
 const clock=watcherClock();let state:DeletionDialogState={phase:'pending',busy:false,message:'Pending',cleanup:cleanup()};let reads=0,signal:AbortSignal|undefined;
 const watcher=createDeletionStatusWatcher({snapshot:()=>state,check:async current=>{reads++;signal=current;return new Promise<void>((_resolve,reject)=>current.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));},...clock});
 watcher.start();await clock.advance(10_000);assert.equal(reads,0);
 state={...state,phase:'uncertain'};watcher.update();await clock.advance(3_000);assert.equal(reads,1);watcher.stop();assert.equal(signal?.aborted,true);await clock.advance(60_000);assert.equal(reads,1);assert.equal(clock.size(),0);
});

test('the thirty-second observation window aborts an unfinished status check and never overlaps reads',async()=>{
 const clock=watcherClock();let signal:AbortSignal|undefined,reads=0;
 const watcher=createDeletionStatusWatcher({snapshot:()=>({phase:'uncertain',busy:false,message:'Unknown'}),check:async current=>{reads++;signal=current;return new Promise<void>((_resolve,reject)=>current.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));},...clock});
 watcher.start();await clock.advance(3_000);watcher.update();await clock.advance(27_000);assert.equal(signal?.aborted,true);assert.equal(reads,1);assert.equal(clock.size(),0);
});

test('new 202 acknowledgement without attemptCount or a cleanup lease starts bounded status observation',async()=>{
 const clock=watcherClock();const initial=cleanup();delete initial.attemptCount;delete initial.processingUntil;
 let state:DeletionDialogState={phase:'pending',busy:false,message:'Accepted',cleanup:initial};let reads=0;
 const watcher=createDeletionStatusWatcher({snapshot:()=>state,check:async()=>{reads++;state={phase:'completed',busy:false,message:'Confirmed'};},...clock});
 watcher.start();await clock.advance(3_000);assert.equal(reads,1);assert.equal(clock.size(),0);
});
