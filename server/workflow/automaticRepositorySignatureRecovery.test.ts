import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {canRecoverRepositorySignature,repositorySignatureEvent,safeRepositorySignatureError} from './automaticRepositorySignatureRecovery';

function fixture(){
 const process:any={id:'recovery-fixture',dataRevision:2,status:'AGUARDANDO_ASSINATURA',avaliacao:{status:'CONCLUIDO',documentRevision:1},acervo:{submittedAt:'2026-11-08T12:00:00Z',submittedBy:'author@example.invalid',trabalhoCompletoFileUrl:'/private.pdf',palavrasChave:['a','b','c','d','e'],resumoSintese:'Resumo',publishFullWork:true,authorizationConfirmedAt:'2026-11-08T12:00:00Z'},signatureProviderPreferences:{TERMO:'ASTEN'},astenSignatureIntent:{documentType:'TERMO',revision:2,queuedAt:'2026-11-08T12:00:00Z'}};
 process.astenSignatureIntent.queuedAt='2000-01-01T00:00:00Z';
 const jobs:any[]=[{id:'ata',processId:process.id,documentType:'ATA',sourceDataRevision:1,documentVersion:1,status:'ARCHIVED',driveSignedFileId:'private-signed-ata',signers:[{role:'ADVISOR',status:'SIGNED',email:'advisor@example.invalid'},{role:'EXAMINER',status:'SIGNED',email:'one@example.invalid'},{role:'EXAMINER',status:'SIGNED',email:'two@example.invalid'}]}];
 return {process,jobs};
}
test('eligibility respects the durable cooldown, current academic gates and every no-replay state',()=>{
 const {process,jobs}=fixture(),now=Date.parse('2026-11-08T13:00:00Z');
 assert.equal(canRecoverRepositorySignature(process,jobs,true,now),true);
 for(const edit of [(p:any)=>p.astenSignatureIntent.revision--,(p:any)=>p.signatureProviderPreferences.TERMO='GOV_BR',(p:any)=>p.acervo.submittedAt=undefined,(p:any)=>p.status='CONCLUIDO',(p:any)=>p.astenSignatureIntent.documentType='ATA',(p:any)=>p.astenSignatureIntent.attemptedAt=new Date(now-119999).toISOString(),(p:any)=>p.astenSignatureIntent.attemptedAt='invalid']){
  const p=structuredClone(process);edit(p);assert.equal(canRecoverRepositorySignature(p,jobs,true,now),false);
 }
 assert.equal(canRecoverRepositorySignature(process,jobs,false,now),false);
 const initial=structuredClone(process);initial.astenSignatureIntent.queuedAt=new Date(now-119999).toISOString();assert.equal(canRecoverRepositorySignature(initial,jobs,true,now),false,'leave the original deferred sender its preparation window');
 const current:any={id:'term',processId:process.id,documentType:'TERMO',sourceDataRevision:2,status:'PROVIDER_ERROR',provider:'ASTEN'};
 assert.equal(canRecoverRepositorySignature(process,[...jobs,current],true,now),true);
 for(const patch of [{provider:'GOV_BR'},{status:'CANCELED'},{status:'SENDING'},{status:'SENT'},{providerCreationState:'UNCERTAIN'},{providerDispatchState:'UNCERTAIN'},{providerDispatchState:'SENDING'},{removedFromLogsAt:'2026-11-08'}])assert.equal(canRecoverRepositorySignature(process,[...jobs,{...current,...patch}],true,now),false);
 const declaration=structuredClone(process);declaration.astenSignatureIntent.documentType='DECLARACAO';assert.equal(canRecoverRepositorySignature(declaration,jobs,true,now),false,'term remains mandatory');
 declaration.acervo.publishFullWork=false;assert.equal(canRecoverRepositorySignature(declaration,jobs,true,now),true);
});
const server=readFileSync('server.ts','utf8');
const begin=server.indexOf('  const scheduledRepositorySignatureRecoveries=new Set<string>();');
const source=server.slice(begin,server.indexOf('  const astenStatusChecks=',begin))+'\nthis.schedule=scheduleRepositorySignatureRecovery;';
function worker(state:{process:any;jobs:any[];revision:number},options:{deny?:boolean;conflict?:boolean;partial?:boolean;missingRun?:boolean;invalidRun?:boolean;changedStudio?:boolean}={}){
 const tasks:Promise<void>[]=[],calls={actions:0,dispatch:0,commits:0,releases:0};let revision=state.revision;
 const ports:any={Set,Date,Promise,console:{error:()=>{}},process:{env:{VERCEL:'fixture'}},currentSettings:{integrationStudio:{revision:1}},processesStore:[structuredClone(state.process)],signatureJobsStore:state.jobs,workflowRunsStore:[],remotePersistenceQueue:Promise.resolve(),
  canRecoverRepositorySignature,repositorySignatureEvent,safeRepositorySignatureError,automaticAstenEnabled:()=>true,acquireRuntimeRequest:async()=>()=>{calls.releases++;},settlePreviousRuntimeWrites:(q:Promise<void>)=>q,getSupabaseRuntimeStatus:()=>({durablePersistenceReady:true}),refreshPortalRuntimeState:async()=>{revision=state.revision;return structuredClone(state.process);},applyPersistedState:(p:any)=>{ports.processesStore=[p];},canAccessProcess:()=>!options.deny,assertSignatureEligibility:()=>{},
  persistPortalStateDurably:async()=>{calls.commits++;if(options.conflict||revision!==state.revision)throw Error('CAS conflict');state.process=structuredClone(ports.processesStore[0]);revision=++state.revision;},
  executeConfiguredWorkflowEvent:async()=>{calls.actions++;return options.missingRun?undefined:{status:options.invalidRun?'FAILED_VALIDATION':options.partial?'PARTIAL_FAILURE':'COMPLETED'};},executeAutomaticAsten:async(p:any)=>{calls.dispatch++;p.astenSignatureIntent=undefined;await ports.persistPortalStateDurably();},waitUntil:(task:Promise<void>)=>tasks.push(task)};
 if(options.changedStudio)ports.workflowRunsStore=[{processId:state.process.id,eventCode:'REPOSITORY_SUBMITTED',sourceDataRevision:2,studioRevision:0,startedAt:'2026-11-08'}];
 runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ports);
 return {calls,start:()=>ports.schedule(ports.processesStore[0],'author@example.invalid'),done:()=>Promise.all(tasks)};
}
test('actual scheduler refreshes and claims attemptedAt durably; another worker cannot repeat its workflow',async()=>{
 const {process,jobs}=fixture(),state={process,jobs,revision:1};
 const one=worker(state,{partial:true});one.start();one.start();await one.done();
 assert.equal(one.calls.actions,1);assert.equal(one.calls.dispatch,0);assert.ok(state.process.astenSignatureIntent.attemptedAt);assert.equal(state.process.astenSignatureIntent.lastErrorCode,'WORKFLOW_PENDING');
 const two=worker(state);two.start();await two.done();assert.equal(two.calls.actions,0);assert.equal(two.calls.dispatch,0);
});
test('actual scheduler never invokes actions after a CAS failure, access loss or changed workflow',async()=>{
 for(const options of [{conflict:true},{deny:true},{changedStudio:true}]){const f=fixture(),w=worker({...f,revision:1},options);w.start();await w.done();assert.equal(w.calls.actions,0);assert.equal(w.calls.dispatch,0);assert.equal(w.calls.releases,1);}
 const f=fixture(),state={...f,revision:1},w=worker(state);w.start();await w.done();assert.equal(w.calls.actions,1);assert.equal(w.calls.dispatch,1);assert.equal(state.process.astenSignatureIntent,undefined);
});

test('actual scheduler keeps missing or invalid configured workflow pending without dispatch',async()=>{
 for(const options of [{missingRun:true},{invalidRun:true}]){
  const f=fixture(),state={...f,revision:1},w=worker(state,options);w.start();await w.done();
  assert.equal(w.calls.actions,1);assert.equal(w.calls.dispatch,0);assert.equal(state.process.astenSignatureIntent.lastErrorCode,'WORKFLOW_PENDING');
 }
});
