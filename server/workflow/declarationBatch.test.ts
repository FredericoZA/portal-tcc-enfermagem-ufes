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
test('revisão de lote preserva bloqueios de duplicação Asten, envio incerto e responsável cadastrado',()=>{
  const {process,settings,jobs}=fixture();
  for(const extra of [{provider:'ASTEN',status:'SENT'},{provider:'ASTEN',status:'PROVIDER_ERROR',providerCreationState:'UNCERTAIN'}] as Partial<SignatureJob>[]){
    assert.equal(inspectAstenDeclaration(process.id,process,[...jobs,{...jobs[0],documentType:'DECLARACAO',...extra}],settings).ready,false);
  }
  assert.equal(inspectAstenDeclaration(process.id,process,jobs,{...settings,commissionPresidentEmail:''}).ready,false);
  assert.equal(inspectAstenDeclaration('missing',undefined,jobs,settings).ready,false);
});

test('review shows current presidency rather than master and blocks a stale queued signer',()=>{
 const {process,settings,jobs}=fixture();const configured={...settings,masterEmail:'master-new@example.invalid',commissionPresidentEmail:'president-current@example.invalid'};
 const review=inspectAstenDeclaration(process.id,process,jobs,configured);assert.equal(review.recipientEmail,'president-current@example.invalid');assert.equal(review.ready,true);
 const queued={...jobs[0],documentType:'DECLARACAO',status:'QUEUED',signers:[{role:'PRESIDENT',email:'old@example.invalid',signingOrder:1}]} as SignatureJob;
 const blocked=inspectAstenDeclaration(process.id,process,[...jobs,queued],configured);assert.equal(blocked.ready,false);assert.match(blocked.reason,/destinatário.*mudou/);
 const sent={...queued,status:'SENT'} as SignatureJob;assert.equal(inspectAstenDeclaration(process.id,process,[...jobs,sent],configured).ready,false);
});


test('Gov.br pendente permite Asten, mas declaração arquivada bloqueia novo envio',()=>{
 const {process,settings,jobs}=fixture();
 for(const status of ['READY_FOR_REVIEW','ARCHIVED'] as const){
  const gov={...jobs[0],documentType:'DECLARACAO',provider:'GOV_BR',status} as SignatureJob;
  assert.equal(inspectAstenDeclaration(process.id,process,[...jobs,gov],settings).ready,status==='READY_FOR_REVIEW');
 }
});
