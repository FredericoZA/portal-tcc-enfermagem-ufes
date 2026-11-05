import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSignatureCompleted} from '../src/utils/documentSignatureState';
import {assertDocumentSignatureOpen,signatureJobMatchesCurrentRevision} from './workflow/signaturePolicy';
import {canSendDeclarationToAsten,canReviewDeclarationWithGovbr} from '../src/utils/coordinatorSignatureActions';
const process={id:'p1',dataRevision:2} as any;
for(const type of ['ATA','TERMO','DECLARACAO'] as const)for(const provider of ['ASTEN','GOV_BR'] as const)test(`${type} signed by ${provider} closes both provider actions`,()=>{
 for(const status of ['SIGNED','DRIVE_SYNC_PENDING','ARCHIVED'] as const){
  const jobs=[{processId:'p1',documentType:type,provider,status,sourceDataRevision:2}] as any;
  assert.equal(documentSignatureCompleted(jobs,'p1',type,2),true);
  assert.throws(()=>assertDocumentSignatureOpen(process,type,jobs),/já está assinado/);
  assert.doesNotThrow(()=>assertDocumentSignatureOpen({...process,dataRevision:3},type,jobs));
  if(type==='DECLARACAO'){
   assert.equal(canReviewDeclarationWithGovbr(jobs,'p1',2),false);
   assert.equal(canSendDeclarationToAsten([],jobs,'p1'),false);
  }
 }
});
test('pending signature does not block the other provider; canceled and older revisions do not close current document',()=>{
 for(const status of ['SENT','PARTIALLY_SIGNED','READY_FOR_REVIEW','CANCELED']){
  const jobs=[{processId:'p1',documentType:'DECLARACAO',provider:'ASTEN',status,sourceDataRevision:2}] as any;
  assert.doesNotThrow(()=>assertDocumentSignatureOpen(process,'DECLARACAO',jobs));
  assert.equal(canReviewDeclarationWithGovbr(jobs,'p1',2),true);
 }
});

test('a concluded process cannot restart an older signed ata after repository revision changes',()=>{
 const jobs=[{processId:'p1',documentType:'ATA',provider:'ASTEN',status:'ARCHIVED',sourceDataRevision:1}] as any;
 assert.throws(()=>assertDocumentSignatureOpen({...process,status:'CONCLUIDO'},'ATA',jobs),/já está assinado/);
 assert.throws(()=>assertDocumentSignatureOpen({...process,etapaAtual:'CONCLUIDO'},'ATA',jobs),/já está assinado/);
});

test('a repository edit preserves the ATA revision; reopening the evaluation retires its old provider request',()=>{
 const withEvaluation={...process,dataRevision:5,avaliacao:{status:'CONCLUIDO',documentRevision:2}};
 const job={processId:'p1',documentType:'ATA',provider:'ASTEN',status:'ARCHIVED',sourceDataRevision:2} as const;
 assert.equal(signatureJobMatchesCurrentRevision(withEvaluation,job),true);
 assert.throws(()=>assertDocumentSignatureOpen(withEvaluation,'ATA',[job] as any),/já está assinado/);
 assert.equal(signatureJobMatchesCurrentRevision(withEvaluation,{...job,status:'CANCELED'}),false);
 assert.equal(signatureJobMatchesCurrentRevision(withEvaluation,{...job,removedFromLogsAt:'2026-11-05'}),false);
 const reopened={...withEvaluation,avaliacao:{status:'PENDENTE',documentRevision:6},dataRevision:6};
 assert.equal(signatureJobMatchesCurrentRevision(reopened,job),false);
 assert.doesNotThrow(()=>assertDocumentSignatureOpen(reopened,'ATA',[job] as any));
 assert.equal(signatureJobMatchesCurrentRevision(withEvaluation,{...job,documentType:'TERMO'}),false);
});
