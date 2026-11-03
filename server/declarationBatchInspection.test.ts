import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectAstenDeclaration} from './workflow/declarationBatch';
import type {ProcessData,SignatureJob,GlobalSettings} from '../src/types';
const process={id:'p',protocolo:'TCC-TESTE',dataRevision:6} as ProcessData;
const settings={commissionPresidentEmail:'presidente@example.org',commissionPresidentName:'Presidente'} as GlobalSettings;
test('sent declaration explains existing invitation instead of presenting an unusable new-send checkbox',()=>{
 const job={id:'j',processId:'p',documentType:'DECLARACAO',sourceDataRevision:6,documentVersion:1,provider:'ASTEN',status:'SENT',sentAt:'2026-10-27T21:18:36Z',providerEnvelopeId:'93108',providerCreationState:'CONFIRMED',providerDispatchState:'SENT',signers:[{name:'Presidente original',email:'original@example.org'}]} as SignatureJob;
 const result=inspectAstenDeclaration('p',process,[job],settings);
 assert.equal(result.ready,false);assert.equal(result.jobId,'j');assert.equal(result.status,'SENT');assert.equal(result.sentAt,job.sentAt);assert.equal(result.recipientEmail,'original@example.org');assert.match(result.reason,/link recebido no e-mail/);
 for(const status of ['PARTIALLY_SIGNED'] as const){const next=inspectAstenDeclaration('p',process,[{...job,status}],settings);assert.equal(next.ready,false);assert.equal(next.jobId,'j');}
 for(const status of ['SIGNED','DRIVE_SYNC_PENDING','ARCHIVED'] as const){const next=inspectAstenDeclaration('p',process,[{...job,status}],settings);assert.equal(next.ready,false);assert.match(next.reason,/já está assinado/);}
});
test('uncertain dispatch cannot be treated as a confirmed invitation or sent again',()=>{
 const job={id:'j',processId:'p',documentType:'DECLARACAO',sourceDataRevision:6,documentVersion:1,provider:'ASTEN',status:'PROVIDER_ERROR',providerDispatchState:'UNCERTAIN'} as SignatureJob;
 const result=inspectAstenDeclaration('p',process,[job],settings);assert.equal(result.ready,false);assert.match(result.reason,/reconciliação/);
});
test('an eligible declaration remains selectable even when Gov.br has already been prepared',()=>{
 const p={...process,avaliacao:{status:'CONCLUIDO'},acervo:{palavrasChave:['a','b','c','d','e'],resumoSintese:'Resumo',trabalhoCompletoFileUrl:'/arquivo',submittedAt:'2026-10-27T12:00:00Z',publishFullWork:false,publishExpandedAbstract:false}} as ProcessData;
 const ata={processId:'p',documentType:'ATA',documentVersion:1,sourceDataRevision:6,status:'ARCHIVED',driveSignedFileId:'ata'} as SignatureJob;
 const gov={processId:'p',documentType:'DECLARACAO',documentVersion:1,sourceDataRevision:6,status:'READY_FOR_REVIEW',provider:'GOV_BR'} as SignatureJob;
 const config:GlobalSettings={...settings,documentModels:{DECLARACAO:{id:'modelo',type:'DECLARACAO',label:'Declaração',fileName:'modelo.docx',templateContentText:'',driveFileId:'modelo',driveFileUrl:'',variables:[],uploadedAt:'2026-10-27T12:00:00Z',uploadedBy:'master@example.org'}}};
 const result=inspectAstenDeclaration('p',p,[ata,gov],config);assert.equal(result.ready,true,result.reason);
});
