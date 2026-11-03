import test from 'node:test';
import assert from 'node:assert/strict';
import { nextPendingSignatureSigner } from './signatureOrder';

test('escolhe o próximo signatário pela ordem e ignora quem já assinou',()=>{
  const signers=[
    {id:'advisor',status:'WAITING',signingOrder:2},
    {id:'student-2',status:'WAITING',signingOrder:1},
    {id:'student-1',status:'SIGNED',signingOrder:1},
  ];
  assert.equal(nextPendingSignatureSigner(signers)?.id,'student-2');
  signers[1].status='SIGNED';
  assert.equal(nextPendingSignatureSigner(signers)?.id,'advisor');
});

test('retorna vazio quando todos já assinaram',()=>{
  assert.equal(nextPendingSignatureSigner([{status:'SIGNED',signingOrder:1}]),undefined);
});

test('reutiliza a versão Asten após falha ou envio, sem contornar outbox com outro hash',async()=>{
  const {reusableAstenSignatureJob}=await import('./signatureOrder');
  const job={processId:'pilot',documentType:'ATA',sourceDataRevision:1,provider:'ASTEN',status:'PROVIDER_ERROR',documentVersion:1,providerCreationState:'UNCERTAIN'};
  assert.equal(reusableAstenSignatureJob([job],'pilot','ATA',1),job);
  assert.equal(reusableAstenSignatureJob([{...job,status:'SENT'}],'pilot','ATA',1)?.status,'SENT');
  assert.equal(reusableAstenSignatureJob([job],'pilot','ATA',2),undefined);
  assert.equal(reusableAstenSignatureJob([{...job,status:'CANCELED'}],'pilot','ATA',1),undefined);
  assert.equal(reusableAstenSignatureJob([{...job,provider:'GOV_BR'}],'pilot','ATA',1),undefined);
});
