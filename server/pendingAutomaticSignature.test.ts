import test from 'node:test';
import assert from 'node:assert/strict';
import type {ProcessData,SignatureJob} from '../src/types';
import {hasPendingAutomaticSignature} from '../src/utils/pendingAutomaticSignature';
import {createSignatureUpdateWatcher} from '../src/utils/signatureUpdates';
import {automaticAstenDocumentStatus} from '../src/utils/signatureGuidance';

function process(type:'TERMO'|'DECLARACAO'):ProcessData{
 return {id:'fixture',dataRevision:8,status:'AGUARDANDO_ASSINATURA',avaliacao:{status:'CONCLUIDO',documentRevision:6},acervo:{submittedAt:'2026-11-08T12:00:00Z'},astenSignatureIntent:{documentType:type,revision:8,queuedAt:'2026-11-08T12:00:00Z'}} as ProcessData;
}
for(const type of ['TERMO','DECLARACAO'] as const)test(`${type} is observed before its first job, without watching withdrawn or superseded requests`,()=>{
 const p=process(type);assert.equal(hasPendingAutomaticSignature(p,[]),true);
 const job={id:'job',processId:p.id,documentType:type,sourceDataRevision:8,status:'QUEUED'} as SignatureJob;
 assert.equal(hasPendingAutomaticSignature(p,[job]),false,'existing jobs use the ordinary job watcher');
 assert.equal(hasPendingAutomaticSignature({...p,astenSignatureIntent:undefined},[]),false);
 assert.equal(hasPendingAutomaticSignature({...p,dataRevision:9},[]),false);
 assert.equal(hasPendingAutomaticSignature({...p,signatureProviderPreferences:{[type]:'GOV_BR'}},[]),false);
 assert.equal(hasPendingAutomaticSignature({...p,status:'CONCLUIDO'},[]),false);
});
test('term without a job discovers the job through the existing bounded Portal watcher',async()=>{
 const p=process('TERMO');let jobs:SignatureJob[]=[];let timer:(()=>void)|undefined,reads=0,changes=0;
 const queued={id:'new-term',processId:p.id,documentType:'TERMO',sourceDataRevision:8,status:'SENT',updatedAt:'2026-11-08T12:02:00Z',signers:[]} as SignatureJob;
 const watcher=createSignatureUpdateWatcher({getKnownJobs:()=>jobs,watchWithoutJobs:()=>hasPendingAutomaticSignature(p,jobs),isActive:()=>true,
  fetchJobs:async()=>{reads++;return[queued];},onChange:next=>{changes++;jobs=next;},schedule:(callback,delay)=>{assert.equal(delay,10_000);timer=callback;return callback;},cancel:()=>{timer=undefined;}});
 watcher.start();assert.ok(timer);timer();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(reads,1);assert.equal(changes,1);assert.equal(jobs[0].id,'new-term');watcher.stop();
});
test('pre-job failure is pending rather than falsely claiming that ASTEN sent an email',()=>{
 const message=automaticAstenDocumentStatus(undefined,true,false,true,'A preparação do documento não foi concluída.');
 assert.match(message,/Envio pendente/);assert.match(message,/preparação/);assert.doesNotMatch(message,/E-mail enviado/);
 assert.match(automaticAstenDocumentStatus(undefined,true,false,true),/tentativa automática/);
 assert.doesNotMatch(automaticAstenDocumentStatus(undefined,true,true,true,'older failure'),/older failure/);
});
