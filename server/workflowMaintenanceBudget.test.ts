import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {repositorySignatureEvent,safeRepositorySignatureError} from './workflow/automaticRepositorySignatureRecovery';

test('maintenance starts its work budget after confirming queued state', async()=>{
  const server=readFileSync(new URL('../server.ts',import.meta.url),'utf8');
  const start=server.indexOf('async function runWorkflowMaintenance(');
  assert.ok(start>=0,'maintenance function must be found before extracting its body');
  const source=server.slice(start,server.indexOf('\n}\n',start)+2);
  let clock=Date.parse('2026-11-07T03:00:00Z');
  let dispatched=0;
  class Clock extends Date {
    constructor(){super(clock);}
    static now(){return clock;}
  }
  const process={astenSignatureIntent:{documentType:'ATA',queuedAt:new Date(clock).toISOString()}};
  const ports={
    Date:Clock,currentSettings:{},workflowPolicy:()=>({}),configuredRoomReservationDepartmentEmail:()=>'department@example.invalid',
    registrationDraftsStore:{},pruneDrafts:(store:unknown)=>store,
    reminderRecordsStore:[],emailDeliveriesStore:[],signatureJobsStore:[],processesStore:[process],
    workflowRunsStore:[],formArchiveJobsStore:[],selectConfirmedInvitationRecovery:()=>undefined,
    persistPortalStateDurably:async()=>{clock+=21_000;},
    automaticAstenEnabled:()=>true,
    executeAutomaticAsten:async()=>{dispatched++;},
  };
  const run=(text:string)=>runInNewContext(ts.transpile('('+text+')',{target:ts.ScriptTarget.ES2022}),ports)();
  const previous=await run(source.replaceAll('Date.now()-workStartedAt','Date.now()-now.getTime()'));
  assert.equal(dispatched,0,'the previous timer deferred before any attempt');
  assert.equal(previous.deferred,true);
  clock=Date.parse('2026-11-07T03:00:00Z');
  const result=await run(source);
  assert.equal(dispatched,1,'slow preparation must not postpone the queued operation before its first attempt');
  assert.equal(result.deferred,false);
});

test('maintenance resumes repository workflow identity before dispatch and preserves failed actions',async()=>{
 const server=readFileSync(new URL('../server.ts',import.meta.url),'utf8');
 const start=server.indexOf('async function runWorkflowMaintenance(');
 const source=server.slice(start,server.indexOf('\n}\n',start)+2);
 async function run(options:{partial?:boolean;missingRun?:boolean;invalidRun?:boolean;studioChanged?:boolean;ineligible?:boolean;eligibilityDenied?:boolean;claimFailed?:boolean;type?:string}={}){
  const process:any={id:'fixture',protocolo:'TCC - 00002',dataRevision:4,acervo:{submittedBy:'author@example.invalid'},astenSignatureIntent:{documentType:options.type||'TERMO',revision:4,studioRevision:3,queuedAt:'2000-01-01T00:00:00Z'}};
  const original:any={processId:process.id,eventCode:repositorySignatureEvent(process.astenSignatureIntent.documentType),sourceDataRevision:4,studioRevision:options.studioChanged?2:3,actorEmail:'original@example.invalid',eventVariables:{original:'value'},startedAt:'2026-11-08',actions:[{status:'COMPLETED',idempotencyKey:'original-key'}]};
  let commits=0,actions=0,dispatches=0;let observed:any[]=[];
  const ports:any={Date,currentSettings:{integrationStudio:{revision:3}},workflowPolicy:()=>({}),configuredRoomReservationDepartmentEmail:()=>'department@example.invalid',registrationDraftsStore:{},pruneDrafts:(s:unknown)=>s,reminderRecordsStore:[],emailDeliveriesStore:[],signatureJobsStore:[],processesStore:[process],workflowRunsStore:[original],formArchiveJobsStore:[],selectConfirmedInvitationRecovery:()=>undefined,
   persistPortalStateDurably:async()=>{commits++;if(options.claimFailed&&commits===2)throw Error('CAS conflict');},automaticAstenEnabled:()=>true,
   canRecoverRepositorySignature:()=>!options.ineligible,repositorySignatureEvent,safeRepositorySignatureError,
   assertSignatureEligibility:()=>{if(options.eligibilityDenied)throw Error('Registered signature eligibility denied');},
   executeConfiguredWorkflowEvent:async(...args:any[])=>{actions++;observed=args;assert.ok(process.astenSignatureIntent.attemptedAt,'claim must precede workflow');assert.equal(commits,2);return options.missingRun?undefined:{status:options.invalidRun?'FAILED_VALIDATION':options.partial?'PARTIAL_FAILURE':'COMPLETED'};},
   executeAutomaticAsten:async()=>{dispatches++;assert.equal(actions,1,'no direct dispatch before original workflow');},
   validateCourseStudio:()=>({ready:true}),plannedDeadlines:()=>[],};
  const result=await runInNewContext(ts.transpile('('+source+')',{target:ts.ScriptTarget.ES2022}),ports)();
  return {process,original,result,actions,dispatches,observed,commits};
 }
 for(const type of ['TERMO','DECLARACAO']){
  const success=await run({type});assert.equal(success.dispatches,1);assert.equal(success.observed[2],success.original.actorEmail);assert.equal(success.observed[3],success.original.eventVariables);assert.equal(success.observed[4],success.original);
  const partial=await run({type,partial:true});assert.equal(partial.actions,1);assert.equal(partial.dispatches,0);assert.equal(partial.process.astenSignatureIntent.lastErrorCode,'WORKFLOW_PENDING');
  for(const failure of [{missingRun:true},{invalidRun:true}]){const blocked=await run({type,...failure});assert.equal(blocked.actions,1);assert.equal(blocked.dispatches,0);assert.equal(blocked.process.astenSignatureIntent.lastErrorCode,'WORKFLOW_PENDING');}
 }
 for(const options of [{studioChanged:true},{ineligible:true},{claimFailed:true}]){
  const blocked=await run(options);assert.equal(blocked.actions,0);assert.equal(blocked.dispatches,0);
 }
 const denied=await run({eligibilityDenied:true});assert.equal(denied.actions,0);assert.equal(denied.dispatches,0);assert.equal(denied.commits,1,'only existing maintenance housekeeping persists; no signature claim/error write');assert.equal(denied.process.astenSignatureIntent.attemptedAt,undefined);
});
