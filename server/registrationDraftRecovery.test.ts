import test from 'node:test';
import assert from 'node:assert/strict';
import {RegistrationDraftRecovery,RegistrationDraftRecoveryConflict,type RegistrationDraftStep} from '../src/services/registrationDraftRecovery';
import {saveRegistrationDraft} from './workflow/drafts';
import type {RegistrationDraft} from '../src/types/workflowOperations';

const owner='aluno@example.invalid';
const step=():RegistrationDraftStep=>({answers:{ALUNO_1_NOME:'Aluno de Teste',TITULO:'Trabalho atual',ALUNO_1_EMAIL:owner},section:1,schemaRevision:8});
const busy=()=>Object.assign(Error('O Portal está ocupado.'),{status:503,code:'RUNTIME_BUSY'});
const draft=(input:RegistrationDraftStep,revision:number,ownerEmail=owner):RegistrationDraft=>({...structuredClone(input),ownerEmail,revision,updatedAt:'2026-11-07T12:00:00Z',expiresAt:'2026-12-07T12:00:00Z'});
function fixture(revision=0){
 let remote:RegistrationDraft|null=revision?draft(step(),revision):null;
 let mode:'ok'|'busy'|'lostAfter'|'lostBefore'='ok',readError:Error|undefined;
 const puts:Array<Parameters<ConstructorParameters<typeof RegistrationDraftRecovery>[0]['save']>[0]>=[];let gets=0;
 const recovery=new RegistrationDraftRecovery({ownerEmail:owner,revision,
  save:async input=>{
   puts.push(structuredClone(input));
   if(mode==='busy')throw busy();
   if(mode==='lostBefore')throw Error('Network timeout before acknowledgement');
   if(input.expectedRevision!==(remote?.revision||0))throw Object.assign(Error('Outra aba alterou o rascunho.'),{status:409});
   remote=saveRegistrationDraft(remote??undefined,input,owner,{revision:8},new Date('2026-11-07T12:00:00Z'));
   if(mode==='lostAfter')throw Error('Network timeout after commit');
   return structuredClone(remote);
  },
  getDraft:async()=>{gets++;if(readError)throw readError;return structuredClone(remote);},
 });
 return {recovery,puts,get gets(){return gets;},get remote(){return remote;},set remote(value:RegistrationDraft|null){remote=value;},set mode(value:typeof mode){mode=value;},set readError(value:Error|undefined){readError=value;}};
}

test('pre-handler busy leaves the revision retryable; only the next explicit save retries the PUT',async()=>{
 const f=fixture();f.mode='busy';
 await assert.rejects(f.recovery.saveStep(step()),error=>(error as any).code==='RUNTIME_BUSY');
 assert.equal(f.puts.length,1);assert.equal(f.recovery.revision,0);assert.equal(f.recovery.pendingAttempt,null);assert.equal(f.gets,0);
 f.mode='ok';const saved=await f.recovery.saveStep(step());
 assert.equal(saved.revision,1);assert.deepEqual(f.puts.map(input=>input.expectedRevision),[0,0]);assert.equal(f.gets,0);
});

test('lost ACK is adopted only by exact owner/revision/section/schema/answers readback, without a second PUT',async()=>{
 const f=fixture(),input=step();f.mode='lostAfter';
 await assert.rejects(f.recovery.saveStep(input),/timeout/);
 assert.equal(f.puts.length,1);assert.equal(f.recovery.pendingAttempt?.expectedRevision,0);assert.equal(f.recovery.revision,0);
 f.mode='ok';const saved=await f.recovery.saveStep(input);
 assert.equal(saved.revision,1);assert.equal(f.recovery.revision,1);assert.equal(f.recovery.pendingAttempt,null);
 assert.equal(f.puts.length,1);assert.equal(f.gets,1);
});

test('a readback at the unchanged revision permits one manual CAS, including null revision zero',async()=>{
 for(const revision of [0,3]){
  const f=fixture(revision);f.mode='lostBefore';
  await assert.rejects(f.recovery.saveStep(step()),/timeout/);
  assert.equal(f.puts.length,1);assert.ok(f.recovery.pendingAttempt);
  f.mode='ok';const saved=await f.recovery.saveStep(step());
  assert.equal(saved.revision,revision+1);assert.equal(f.gets,1);assert.equal(f.puts.length,2);
  assert.deepEqual(f.puts.map(input=>input.expectedRevision),[revision,revision]);
 }
});

test('another tab with different content or a later revision cannot be overwritten',async()=>{
 for(const revision of [1,2]){
  const f=fixture(),input=step(),before=structuredClone(input);f.mode='lostBefore';
  await assert.rejects(f.recovery.saveStep(input));
  f.remote=draft({...step(),answers:{...step().answers,TITULO:'Outra aba'}},revision);f.mode='ok';
  await assert.rejects(f.recovery.saveStep(input),RegistrationDraftRecoveryConflict);
  assert.equal(f.puts.length,1);assert.equal(f.recovery.revision,0);assert.ok(f.recovery.pendingAttempt);
  assert.equal(f.remote!.answers.TITULO,'Outra aba');assert.deepEqual(input,before);
 }
});

test('failed GET preserves the uncertain attempt and never sends a PUT during that call',async()=>{
 const f=fixture();f.mode='lostAfter';await assert.rejects(f.recovery.saveStep(step()));
 const pending=f.recovery.pendingAttempt;f.readError=busy();
 await assert.rejects(f.recovery.saveStep(step()),error=>(error as any).code==='RUNTIME_BUSY');
 assert.equal(f.puts.length,1);assert.deepEqual(f.recovery.pendingAttempt,pending);
 f.readError=undefined;await f.recovery.saveStep(step());assert.equal(f.puts.length,1);
});

test('active owner changes and foreign readbacks fail closed without copying fields to another account',async()=>{
 const f=fixture();
 await assert.rejects(f.recovery.saveStep(step(),'other@example.invalid'),RegistrationDraftRecoveryConflict);assert.equal(f.puts.length,0);
 await assert.rejects(f.recovery.saveStep({...step(),answers:{...step().answers,ALUNO_1_EMAIL:'other@example.invalid'}}),RegistrationDraftRecoveryConflict);assert.equal(f.puts.length,0);
 f.mode='lostBefore';await assert.rejects(f.recovery.saveStep(step()));
 f.remote=draft(step(),1,'other@example.invalid');
 await assert.rejects(f.recovery.saveStep(step()),RegistrationDraftRecoveryConflict);
 assert.equal(f.puts.length,1);assert.ok(f.recovery.pendingAttempt);
});

test('different schema, section or answers at expected plus one do not confirm the attempted step',async()=>{
 for(const changed of [
  {...step(),section:2},
  {...step(),schemaRevision:9},
  {...step(),answers:{...step().answers,TITULO:'Outro conteúdo'}},
 ]){
  const f=fixture();f.mode='lostBefore';await assert.rejects(f.recovery.saveStep(step()));f.remote=draft(changed,1);
  await assert.rejects(f.recovery.saveStep(step()),RegistrationDraftRecoveryConflict);assert.equal(f.puts.length,1);
 }
});

test('expired or missing remote draft cannot reset a previously issued revision silently',async()=>{
 const f=fixture(3);f.mode='lostBefore';await assert.rejects(f.recovery.saveStep(step()));f.remote=null;
 await assert.rejects(f.recovery.saveStep(step()),RegistrationDraftRecoveryConflict);assert.equal(f.puts.length,1);assert.equal(f.recovery.revision,3);
});

test('local edits after an uncertain attempt use the recovered revision and are saved once on the next manual action',async()=>{
 const f=fixture(),input=step();f.mode='lostAfter';await assert.rejects(f.recovery.saveStep(input));
 input.answers.TITULO='Edição posterior';f.mode='ok';
 const result=await f.recovery.saveStep(input);
 assert.equal(f.gets,1);assert.equal(f.puts.length,2);assert.deepEqual(f.puts.map(item=>item.expectedRevision),[0,1]);
 assert.equal(result.revision,2);assert.equal(result.answers.TITULO,'Edição posterior');
});

test('successful saves need no readback and defensive snapshots do not share mutable answer objects',async()=>{
 const f=fixture(),input=step();const result=await f.recovery.saveStep(input);
 result.answers.TITULO='Mutação da resposta';input.answers.TITULO='Próxima edição';
 assert.equal(f.remote!.answers.TITULO,'Trabalho atual');
 await f.recovery.saveStep(input);assert.equal(f.gets,0);assert.deepEqual(f.puts.map(item=>item.expectedRevision),[0,1]);
});

test('a malformed save response never confirms a step or increments the local revision',async()=>{
 let writes=0;
 const recovery=new RegistrationDraftRecovery({ownerEmail:owner,save:async input=>{writes++;assert.ok('answers' in input);return draft({...input,section:2},1);},getDraft:async()=>null});
 await assert.rejects(recovery.saveStep(step()),RegistrationDraftRecoveryConflict);
 assert.equal(writes,1);assert.equal(recovery.revision,0);assert.ok(recovery.pendingAttempt);
});

test('overlapping calls cannot issue a second write while the first response is pending',async()=>{
 let resolve!:(draft:RegistrationDraft)=>void,writes=0;
 const response=new Promise<RegistrationDraft>(yes=>{resolve=yes;});
 const recovery=new RegistrationDraftRecovery({ownerEmail:owner,save:async()=>{writes++;return response;},getDraft:async()=>null});
 const first=recovery.saveStep(step());
 await assert.rejects(recovery.saveStep(step()),error=>(error as any).code==='DRAFT_SAVE_IN_PROGRESS');
 assert.equal(writes,1);resolve(draft(step(),1));await first;assert.equal(recovery.revision,1);
});


test('only edited and removed answers cross the wire after a confirmed draft',async()=>{
 const f=fixture();
 await f.recovery.saveStep(step());
 const edited=step();
 edited.answers.ALUNO_1_NOME='Nome Corrigido';
 delete edited.answers.TITULO;
 const saved=await f.recovery.saveStep({...edited,section:2});
 assert.deepEqual(f.puts[1],{section:2,schemaRevision:8,expectedRevision:1,answerPatch:{ALUNO_1_NOME:'Nome Corrigido',TITULO:null}});
 assert.deepEqual(saved.answers,edited.answers);
});
