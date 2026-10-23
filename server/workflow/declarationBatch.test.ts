import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../../src/services/demoSeed';
import type {SignatureJob} from '../../src/types';
import {inspectAstenDeclaration} from './declarationBatch';

function fixture(){
  const process=structuredClone(DEMO_PROCESSES[0]);
  process.dataRevision=3;process.avaliacao.status='CONCLUIDO';
  process.acervo={palavrasChave:['a','b','c','d','e'],resumoSintese:'Resumo',trabalhoCompletoFileUrl:'/private/work.pdf',submittedAt:'2026-10-17T00:00:00Z',publishFullWork:false,publishExpandedAbstract:false};
  const settings={...INITIAL_SETTINGS,commissionPresidentName:'Presidente de teste',documentModels:{DECLARACAO:{id:'declaration-model',type:'DECLARACAO',label:'Declaração',fileName:'fixture.docx',templateContentText:'',driveFileId:'model-fixture',driveFileUrl:'',variables:[],uploadedAt:'2026-10-17T00:00:00Z',uploadedBy:'master@portal.local'}}};
  const jobs=[{processId:process.id,documentType:'ATA',provider:'ASTEN',status:'ARCHIVED',driveSignedFileId:'ata',sourceDataRevision:3,documentVersion:1}] as SignatureJob[];
  return {process,settings,jobs};
}
test('revisão de lote distingue declaração pronta de Ata e Termo pendentes sem alterar o processo',()=>{
  const {process,settings,jobs}=fixture();const before=JSON.stringify(process);
  assert.equal(inspectAstenDeclaration(process.id,process,[],settings).ready,false);
  assert.equal(inspectAstenDeclaration(process.id,process,jobs,settings).ready,true);
  assert.equal(JSON.stringify(process),before);
  process.acervo!.publishFullWork=true;
  assert.match(inspectAstenDeclaration(process.id,process,jobs,settings).reason,/Ata e o Termo/);
  jobs.push({...jobs[0],documentType:'TERMO'});
  assert.equal(inspectAstenDeclaration(process.id,process,jobs,settings).ready,true);
});
test('revisão de lote preserva conflitos de provedor, envio incerto e responsável cadastrado',()=>{
  const {process,settings,jobs}=fixture();
  for(const extra of [{provider:'GOV_BR',status:'READY_FOR_REVIEW'},{provider:'ASTEN',status:'SENT'},{provider:'ASTEN',status:'PROVIDER_ERROR',providerCreationState:'UNCERTAIN'}] as Partial<SignatureJob>[]){
    assert.equal(inspectAstenDeclaration(process.id,process,[...jobs,{...jobs[0],documentType:'DECLARACAO',...extra}],settings).ready,false);
  }
  assert.equal(inspectAstenDeclaration(process.id,process,jobs,{...settings,commissionPresidentEmail:''}).ready,false);
  assert.equal(inspectAstenDeclaration('missing',undefined,jobs,settings).ready,false);
});
