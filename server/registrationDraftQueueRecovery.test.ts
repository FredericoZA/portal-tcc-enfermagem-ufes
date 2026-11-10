import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {RegistrationDraftRecovery,RegistrationDraftRecoveryConflict} from '../src/services/registrationDraftRecovery';

function queue(recovery:RegistrationDraftRecovery){
 const source=readFileSync('src/components/ConfigurableRegistration.tsx','utf8');
 const start=source.indexOf('  const queueSave='),end=source.indexOf('  const check=',start);
 const answers={ALUNO_1_EMAIL:'student@example.invalid',ALUNO_1_NOME:'Nome do Estudante',UNPUBLISHED:'omit'};
 const paused={current:false},revision={current:0},statuses:string[]=[];
 const context={Promise,Error,Object,Set,previewStudio:undefined,currentSection:0,eligibility:'ready',isMasterAdmin:false,
  localStorage:{},userEmail:answers.ALUNO_1_EMAIL,answers,paused,draftQueue:{current:Promise.resolve()},draftRevision:revision,
  draftRecovery:{current:recovery},fields:[{fieldKey:'ALUNO_1_EMAIL'},{fieldKey:'ALUNO_1_NOME'}],studio:{revision:21},
  saveRegistrationMemory:()=>{},registrationAnswersWithoutIdentifiers:(value:unknown)=>value,
  setDraftStatus:(message:string)=>statuses.push(message),setError:()=>{},setDraftConflict:()=>{},setLocalRecovery:()=>{},RegistrationDraftRecoveryConflict};
 const save=runInNewContext(ts.transpileModule(`(()=>{${source.slice(start,end)};return queueSave;})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {save,paused,answers,revision,statuses};
}
const stored=(input:any)=>({ownerEmail:'student@example.invalid',answers:input.answers,section:input.section,schemaRevision:input.schemaRevision,
 revision:input.expectedRevision+1,updatedAt:'2026-11-07T19:00:00Z',expiresAt:'2026-12-07T19:00:00Z'});

test('fila real do cadastro não fica pausada após RUNTIME_BUSY e permite nova ação manual',async()=>{
 let calls=0;
 const recovery=new RegistrationDraftRecovery({ownerEmail:'student@example.invalid',save:async(input)=>{calls++;if(calls===1)throw Object.assign(new Error('O Portal está ocupado.'),{status:503,code:'RUNTIME_BUSY'});return stored(input);},getDraft:async()=>{throw Error('Busy não exige readback');}});
 const form=queue(recovery),before=structuredClone(form.answers);
 assert.equal(await form.save(1),false);assert.equal(form.paused.current,false);assert.equal(calls,1);assert.deepEqual(form.answers,before);
 assert.equal(await form.save(1),true);assert.equal(calls,2);assert.equal(form.revision.current,1);assert.equal(form.paused.current,false);
 assert.equal(form.statuses.at(-1),'Rascunho salvo no servidor.');
});
test('fila real confirma ACK perdido por leitura sem repetir PUT e sem mandar campos fora do formulário',async()=>{
 let calls=0,reads=0,remote:any=null;
 const recovery=new RegistrationDraftRecovery({ownerEmail:'student@example.invalid',save:async(input)=>{calls++;assert.ok('answers' in input);assert.equal(input.answers.UNPUBLISHED,undefined);remote=stored(input);throw Error('Resposta perdida');},getDraft:async()=>{reads++;return remote;}});
 const form=queue(recovery);
 assert.equal(await form.save(2),false);assert.equal(calls,1);assert.equal(form.paused.current,false);
 assert.equal(await form.save(2),true);assert.equal(calls,1);assert.equal(reads,1);assert.equal(form.revision.current,1);
});
