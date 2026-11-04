import test from 'node:test';
import assert from 'node:assert/strict';
import type {SignatureJob} from '../../src/types';
import {removeSignatureRecord} from './signatureRemoval';
import {documentSignatureArchived} from '../../src/utils/documentSignatureState';
const now='2026-11-04T12:00:00Z',actorEmail='master@example.invalid';
const fixture=(patch:Partial<SignatureJob>={})=>({id:'job',processId:'process',documentType:'ATA',provider:'ASTEN',status:'SENT',providerEnvelopeId:'123',sourceDataRevision:1,documentVersion:1,...patch} as SignatureJob);
test('pending provider request is removed only after verified cancellation, without mutating the original',async()=>{
 const job=fixture();const calls:string[]=[];
 const result=await removeSignatureRecord(job,{now,actorEmail,cancelAndVerify:async(id)=>{calls.push(id);return true;}});
 assert.deepEqual(calls,['123']);assert.equal(result.status,'CANCELED');assert.equal(result.removedFromLogsAt,now);assert.equal(result.removedFromLogsBy,actorEmail);assert.equal(job.status,'SENT');assert.equal(job.removedFromLogsAt,undefined);
 for(const cancelAndVerify of [async()=>false,async()=>{throw Error('unavailable');}])await assert.rejects(removeSignatureRecord(job,{now,actorEmail,cancelAndVerify}));
 assert.equal(job.removedFromLogsAt,undefined);
});
test('archived evidence remains valid while its operational log is removed',async()=>{
 const job=fixture({status:'ARCHIVED',driveSignedFileId:'signed-original',signedSha256:'original-hash'});
 const result=await removeSignatureRecord(job,{now,actorEmail,cancelAndVerify:async()=>{throw Error('must not cancel completed document');}});
 assert.equal(result.status,'ARCHIVED');assert.equal(result.driveSignedFileId,'signed-original');assert.equal(result.signedSha256,'original-hash');assert.equal(documentSignatureArchived([result],'process','ATA'),true);
 assert.equal(await removeSignatureRecord(result,{now,actorEmail,cancelAndVerify:async()=>false}),result);
});
test('in-flight and uncertain requests cannot be hidden before their provider outcome is known',async()=>{
 for(const patch of [{status:'SENDING'},{status:'SIGNED'},{status:'DRIVE_SYNC_PENDING'},{providerCreationState:'CREATING'},{providerDispatchState:'SENDING'},{providerCreationState:'UNCERTAIN',providerEnvelopeId:undefined}] as Partial<SignatureJob>[]){
  const job=fixture(patch);await assert.rejects(removeSignatureRecord(job,{now,actorEmail,cancelAndVerify:async()=>true}));assert.equal(job.removedFromLogsAt,undefined);
 }
});
test('Gov.br drafts and queued unsent requests need no provider call',async()=>{
 for(const patch of [{provider:'GOV_BR',status:'READY_FOR_REVIEW',providerEnvelopeId:undefined},{status:'QUEUED',providerEnvelopeId:undefined}] as Partial<SignatureJob>[]){
  const result=await removeSignatureRecord(fixture(patch),{now,actorEmail,cancelAndVerify:async()=>{throw Error('unexpected provider call');}});assert.equal(result.status,'CANCELED');assert.equal(result.removedFromLogsAt,now);
 }
});
