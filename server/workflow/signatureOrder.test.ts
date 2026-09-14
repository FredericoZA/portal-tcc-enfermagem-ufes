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
