import test from 'node:test';import assert from 'node:assert/strict';
import {documentSignatureProgress,signatureProgressDescription} from '../src/utils/documentSignatureProgress';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {publicProcessDetail} from '../src/utils/publicProcessDetail';
const p=structuredClone(DEMO_PROCESSES[0]);p.avaliacao.documentRevision=3;
const doc:any={type:'ATA',requiresSignature:true,currentVersion:2,status:'AGUARDANDO_ASSINATURA'};
const job:any={id:'private-job',processId:p.id,documentType:'ATA',documentVersion:2,sourceDataRevision:3,provider:'ASTEN',status:'SENT',driveUnsignedFileId:'private-file',updatedAt:'2026-11-08T12:00:00Z',providerEnvelopeId:'private-envelope',providerDispatchState:'SENT',signers:Array.from({length:6},(_,i)=>({id:'secret-'+i,name:'PRIVATE NAME',email:'private-'+i+'@example.invalid',status:i<2?'SIGNED':'WAITING'}))};
test('signature progress counts the current version and exposes no identities or artifacts',()=>{
 const result=documentSignatureProgress(p,doc,[job,{...job,documentVersion:1,updatedAt:'2026-11-09'}])!;
 assert.equal(result.signed,2);assert.equal(result.total,6);assert.equal(result.emailSent,true);
 assert.match(signatureProgressDescription(result),/2 de 6.*enviada por e-mail \(ASTEN\)/);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE|private-|@|signers|envelope|drive|name|email":/);
 assert.equal(documentSignatureProgress(p,doc,[{...job,sourceDataRevision:2}]),undefined);
 assert.equal(documentSignatureProgress(p,doc,[{...job,status:'CANCELED'}]),undefined);
});
test('failed and queued dispatch never claims an email was sent; Gov.br remains distinct',()=>{
 for(const status of ['QUEUED','PROVIDER_ERROR','SENDING']){
  const result=documentSignatureProgress(p,doc,[{...job,status,providerDispatchState:'PENDING'}])!;
  assert.equal(result.emailSent,false);assert.doesNotMatch(signatureProgressDescription(result),/enviada por e-mail/);
 }
 assert.match(signatureProgressDescription({...documentSignatureProgress(p,doc,[job])!,provider:'GOV_BR'}),/Gov.br/);
});
test('public card receives only aggregate pending state without granting a document download',()=>{
 const progress=documentSignatureProgress(p,doc,[job]);
 const view=publicProcessDetail({...p,documents:[],documentProgress:{ATA:progress}});
 const ata=view.documents.find(d=>d.type==='ATA')!;
 assert.equal(ata.signatureProgress?.signed,2);assert.equal(ata.status,'AGUARDANDO_ASSINATURA');assert.equal(ata.driveDownloadUrl,undefined);
 assert.equal(publicProcessDetail({...p,documents:[]}).documents.find(d=>d.type==='ATA')!.status,'NAO_DISPONIVEL');
});
