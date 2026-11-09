import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {DraftConflict,saveRegistrationDraft} from './workflow/drafts';
import {registrationRequestTiming} from './registrationTiming';

const source=readFileSync('server.ts','utf8');
const start=source.indexOf("  app.put('/api/registration/draft'");
const route=source.slice(start,source.indexOf("  app.delete('/api/registration/draft'",start));
const owner='student@example.invalid';
function setup(durable:boolean,outcome:'ok'|'missing'|'failure'='ok'){
  let handler:(req:any,res:any)=>Promise<void>;
  let resolve!:()=>void;
  const pending=new Promise<void>(done=>{resolve=done;});
  const calls={scoped:0,snapshot:0};
  const context={Error,registrationRequestTiming,app:{put:(path:string,auth:unknown,applicant:unknown,callback:typeof handler)=>{
    assert.equal(path,'/api/registration/draft');assert.equal(auth,'authenticated');assert.equal(applicant,'applicant');handler=callback;
  }},requireAuthenticated:'authenticated',requireRegistrationApplicant:'applicant',getPortalIdentity:()=>({email:owner}),processesStore:[],registrationDraftsStore:{} as Record<string,unknown>,currentSettings:{integrationStudio:{revision:9}},saveRegistrationDraft,DraftConflict,getSupabaseRuntimeStatus:()=>({durablePersistenceReady:durable}),currentPortalRuntimeRevision:()=>40,remotePersistenceQueue:Promise.resolve(),
  saveRegistrationDraftRuntimeState:async(email:string,draft:any,expected:number,authorized:number)=>{
    calls.scoped++;assert.equal(email,owner);assert.equal(draft.ownerEmail,owner);assert.equal(expected,0);assert.equal(authorized,40);
    await pending;if(outcome==='failure')throw Error('commit not confirmed');return outcome!=='missing';
  },persistPortalStateDurably:async()=>{calls.snapshot++;}};
  runInNewContext(ts.transpileModule(route,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  const response={code:200,body:undefined as any,status(code:number){this.code=code;return this;},json(body:unknown){this.body=body;return this;},setHeader:()=>{}};
  return {context,calls,response,resolve,request:(body:any={expectedRevision:0,schemaRevision:9,answers:{ALUNO_1_EMAIL:'spoof@example.invalid',ALUNO_1_NOME:'Pessoa'},section:1})=>handler!({body},response)};
}
test('draft route keeps durable confirmation before success and excludes unrelated snapshot writes',async()=>{
  const fixture=setup(true);const operation=fixture.request();await Promise.resolve();await Promise.resolve();
  assert.equal(fixture.calls.scoped,1);assert.equal(fixture.response.body,undefined);assert.deepEqual(fixture.context.registrationDraftsStore,{});
  fixture.resolve();await operation;
  assert.equal(fixture.calls.snapshot,0);assert.equal(fixture.response.code,200);assert.equal(fixture.response.body.answers.ALUNO_1_EMAIL,owner);
  assert.equal(fixture.context.registrationDraftsStore[owner],fixture.response.body);
});
test('unconfirmed scoped write neither changes the local draft nor reports success',async()=>{
  const fixture=setup(true,'failure');const operation=fixture.request();fixture.resolve();await operation;
  assert.equal(fixture.response.code,400);assert.match(fixture.response.body.error,/not confirmed/);assert.deepEqual(fixture.context.registrationDraftsStore,{});assert.equal(fixture.calls.snapshot,0);
  await assert.rejects(fixture.context.remotePersistenceQueue,/not confirmed/);
});
test('local_file and a definitely missing additive RPC retain the existing persistence path',async()=>{
  for(const durable of [false,true]){
    const fixture=setup(durable,'missing');const operation=fixture.request();fixture.resolve();await operation;
    assert.equal(fixture.response.code,200);assert.equal(fixture.calls.snapshot,1);assert.equal(fixture.calls.scoped,durable?1:0);
  }
});
test('schema revision conflicts still fail before either persistence path',async()=>{
  const fixture=setup(true);await fixture.request({expectedRevision:0,schemaRevision:8,answers:{}});
  assert.equal(fixture.response.code,409);assert.equal(fixture.calls.scoped,0);assert.equal(fixture.calls.snapshot,0);
});
