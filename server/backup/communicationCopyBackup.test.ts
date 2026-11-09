import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createVerifiedPortalBackup} from './verifiedBackup';
import {mergeOperationalMetadata} from './operationalMetadata';
import {decryptPortalBackupPayload} from '../integrations/integrationSecrets';
import {initialEmailDelivery} from '../integrations/trackedGmail';
import type {EmailDeliveryRecord} from '../../src/types/automation';

test('backup/restauração preserva manifesto e cópia consciente; rollback de código não exige rollback do livro de e-mail',async()=>{
 const names=['PORTAL_SECRET_ENCRYPTION_KEY','PORTAL_SECRET_ENCRYPTION_KEY_V2'];const old=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 process.env.PORTAL_SECRET_ENCRYPTION_KEY='ab'.repeat(32);delete process.env.PORTAL_SECRET_ENCRYPTION_KEY_V2;
 try{
  const original:EmailDeliveryRecord=initialEmailDelivery({processId:'p',protocol:'TCC - 00002',sourceDataRevision:5,studioRevision:7,recipient:'author@example.invalid',templateId:'email-convite',subject:'Convite fictício',text:'Documento para consulta.',idempotencyKey:'backup-original',attachments:[{fileName:'convite.pdf',mimeType:'application/pdf',content:Buffer.from('synthetic-pdf-bytes')}]});original.status='ACCEPTED_BY_GMAIL';
  const copy:EmailDeliveryRecord=initialEmailDelivery({processId:'p',protocol:'TCC - 00002',sourceDataRevision:5,studioRevision:7,recipient:'author@example.invalid',templateId:'communication-copy:email-aviso',subject:'Aviso fictício',text:'Mensagem original.',idempotencyKey:'backup-copy-operation',maxAttempts:1,communicationCopy:{sourceDeliveryId:original.id,sourceTemplateId:'email-aviso',operationId:'backup-operation-00001',reason:'Conferida a caixa Enviados e autorizada outra cópia.',confirmedBy:'master@example.invalid',confirmedAt:'2026-11-08T12:00:00Z'}});copy.status='ACCEPTED_BY_GMAIL';
  const pending=structuredClone(copy);pending.id='uncertain-copy';pending.status='FAILED';pending.dispatchState='UNCERTAIN';pending.idempotencyKey='another-operation';
  const snapshot={settings:{masterEmail:'master@example.invalid'},processes:[{id:'p',protocolo:'TCC - 00002',dataRevision:5}],emailDeliveries:[original,copy,pending],signatureJobs:[{id:'signed-ata',processId:'p',status:'ARCHIVED',driveSignedFileId:'private-original-reference'}]};
  const before=structuredClone(snapshot);let encrypted=Buffer.alloc(0);let stores=0,reads=0;
  const report=await createVerifiedPortalBackup(snapshot,'private-fixture-root',{
   token:async()=>'fixture-token',store:async(input:any)=>{stores++;encrypted=Buffer.from(input.content);assert.doesNotMatch(encrypted.toString(),/synthetic-pdf-bytes|master@example/);return{id:'fixture-backup',name:input.fileName,webViewLink:'https://drive.google.com/file/d/fixture-backup/view',folderId:'private-fixture-root'};},read:async()=>{reads++;return Buffer.from(encrypted);},
  },new Date('2026-11-08T12:01:00Z'));
  assert.equal(stores,1);assert.equal(reads,1);assert.equal(report.restorable,true);assert.equal(report.driveRoundTrip,true);assert.deepEqual(snapshot,before);
  const restored=JSON.parse(decryptPortalBackupPayload(encrypted));assert.deepEqual(restored,JSON.parse(JSON.stringify(before)));assert.equal(report.sourceSha256,createHash('sha256').update(JSON.stringify(restored)).digest('hex'));
  assert.equal(restored.emailDeliveries[0].attachmentManifest[0].byteLength,19);assert.equal(restored.emailDeliveries[1].communicationCopy.operationId,'backup-operation-00001');assert.deepEqual(restored.signatureJobs,before.signatureJobs);
  const ids=new Set(['p']),terminal=new Set(['ACCEPTED_BY_GMAIL','SENT','DELIVERED','CANCELED']);
  const restoredCompleted=mergeOperationalMetadata<EmailDeliveryRecord>([],restored.emailDeliveries.slice(0,2),ids,terminal);assert.deepEqual(restoredCompleted,JSON.parse(JSON.stringify([original,copy])));
  // An old backup lacks the new fields; current records remain authoritative and intact.
  const oldCopy={...copy};delete oldCopy.communicationCopy;delete oldCopy.attachmentManifest;
  const merged=mergeOperationalMetadata([original,copy,pending],[oldCopy],ids,terminal);assert.deepEqual(merged,[original,copy,pending]);
  assert.equal(merged.find(item=>item.id===pending.id)?.dispatchState,'UNCERTAIN');
  assert.throws(()=>mergeOperationalMetadata<EmailDeliveryRecord>([],[restored.emailDeliveries[2]],ids,terminal),/pendentes desconhecidas/,'restore cannot enqueue an unknown uncertain copy');
 }finally{for(const name of names){if(old[name]===undefined)delete process.env[name];else process.env[name]=old[name];}}
});
