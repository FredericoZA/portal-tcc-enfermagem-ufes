import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

async function retryCase(input:{archived?:boolean;invited?:boolean;resumeError?:boolean;blocker?:string}={}){
 const source=readFileSync('server.ts','utf8'),start=source.indexOf("  app.post('/api/admin/form-archives/:id/retry'");
 const end=source.indexOf("\n  app.get('/api/admin/studio-form-submissions'",start);
 assert.ok(start>=0&&end>start);
 const process:any={id:'p',dataRevision:4,defesa:{reservationRevision:1}};
 const job:any={id:'form',processId:'p',formType:'CONFIRMACAO_LOCAL',version:4,reservationRevision:1,status:input.archived===false?'FAILED':'ARCHIVED',artifactBase64:'must-not-leak',lastError:input.archived===false?'Drive indisponível.':undefined};
 let handler:Function|undefined,effects=0;
 vm.runInNewContext(ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{
  Error,app:{post:(...args:any[])=>{handler=args.at(-1);}},requireAuthenticated:()=>{},requireAdministrator:()=>{},
  getPortalIdentity:()=>({email:'master@example.invalid'}),formArchiveJobsStore:[job],processesStore:[process],signatureJobsStore:[],
  retryExistingFormArchiveJob:async()=>job,nativeFormRetryEvent:()=> 'LOCATION_CONFIRMED',workflowRetryBlocker:()=>input.blocker,
  resumeWorkflowAfterNativeFormArchive:async()=>{effects++;if(input.resumeError)throw Error('Continuação temporariamente indisponível.');if(input.invited){process.defesa.invitationSentAt='2026-11-07T18:50:30Z';process.defesa.invitationDriveFileId='confirmed-invitation';}},
 });
 const res={code:200,body:undefined as any,status(code:number){this.code=code;return this;},json(value:unknown){this.body=value;return this;}};
 await handler!({params:{id:'form'}},res);
 assert.doesNotMatch(JSON.stringify(res.body),/must-not-leak|artifactBase64/);
 return{...res,effects};
}
test('archive response only confirms invitation when its current process records the sent invitation',async()=>{
 const completed=await retryCase({invited:true});assert.equal(completed.code,200);assert.equal(completed.body.workflowPending,false);
 assert.match(completed.body.confirmationMessage,/convite enviado/);assert.equal(completed.effects,1);
 const pending=await retryCase();assert.equal(pending.code,202);assert.equal(pending.body.workflowPending,true);
 assert.match(pending.body.confirmationMessage,/aguarda confirmação/);assert.doesNotMatch(pending.body.confirmationMessage,/convite enviado/);assert.equal(pending.effects,1);
});
test('a persisted archive with a failed continuation returns pending feedback without replaying its executor',async()=>{
 const result=await retryCase({resumeError:true});assert.equal(result.code,202);assert.equal(result.body.status,'ARCHIVED');
 assert.equal(result.body.workflowPending,true);assert.match(result.body.workflowError,/temporariamente indisponível/);assert.equal(result.effects,1);
});
test('failed archive and preexisting workflow guards never execute the continuation or claim a sent invitation',async()=>{
 const failed=await retryCase({archived:false});assert.equal(failed.code,409);assert.equal(failed.effects,0);assert.match(failed.body.error,/Drive indisponível/);
 const blocked=await retryCase({blocker:'O processo mudou.'});assert.equal(blocked.code,409);assert.equal(blocked.effects,0);assert.equal(blocked.body.code,'WORKFLOW_RETRY_NOT_ELIGIBLE');
});
