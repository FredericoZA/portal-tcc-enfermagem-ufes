import assert from 'node:assert/strict';
import test from 'node:test';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';
import type {SignatureJob} from '../../src/types';
import {collectProcessDriveFileIds,processDeletionTask,restoresDeletedProcess} from './processDeletion';

test('coletor puro preserva referências de legados, versões e pastas compartilhadas',()=>{
 const legacy={driveFolderId:'legacy-process-folder',attachments:[{driveFileId:'academic-file'}],provenance:{administrativeDocuments:[{driveFileId:'admin-file',folderId:'legacy-admin-folder'}]}};
 const versioned={versions:[{driveDocId:'source-doc',drivePdfId:'source-pdf'},{govbrReview:{fileId:'gov-review'}}],otherId:'not-a-file',nested:{fileId:'academic-file'}};
 const before=structuredClone([legacy,versioned]);
 assert.deepEqual(collectProcessDriveFileIds(legacy,versioned),['legacy-process-folder','academic-file','admin-file','legacy-admin-folder','source-doc','source-pdf','gov-review']);
 assert.deepEqual([legacy,versioned],before);
});

test('inventário inclui todas as variantes de ID, versões e revisão Gov.br do próprio TCC',()=>{
 const process=structuredClone(DEMO_PROCESSES[0]);
 process.driveFolderId='process-folder';process.defesa.invitationDriveFileId='invitation';
 (process as any).documents=[{driveDocId:'render-doc',drivePdfId:'render-pdf',versions:[{signedDriveFileId:'old-signed'}]}];
 const jobs=[{id:'own-job',processId:process.id,provider:'ASTEN',providerEnvelopeId:'envelope-1',driveUnsignedFileId:'unsigned',driveSignedFileId:'signed',govbrReview:{fileId:'review-upload'}},{id:'own-job',processId:process.id,provider:'ASTEN',providerEnvelopeId:'envelope-1'},{id:'foreign-job',processId:'another-process',provider:'ASTEN',providerEnvelopeId:'foreign-envelope',driveSignedFileId:'foreign-signed'}] as SignatureJob[];
 const task=processDeletionTask(process,jobs,[{processId:process.id,driveFileId:'form'},{processId:'another-process',driveFileId:'foreign-form'}],{deleteFiles:true,clearHistory:true,rootFolderId:'root',protectedIds:['root','root','model']});
 for(const id of ['invitation','render-doc','render-pdf','old-signed','unsigned','signed','review-upload','form'])assert.ok(task.fileIds.includes(id),id);
 assert.ok(!task.fileIds.includes('foreign-signed'));assert.ok(!task.fileIds.includes('foreign-form'));
 assert.deepEqual(task.jobIds,['own-job']);assert.deepEqual(task.envelopes,['envelope-1']);
 assert.deepEqual(task.protectedIds,['root','model']);assert.equal(task.folderId,'process-folder');
});

test('restauração rejeita TCC removido com limpeza pendente ou já concluída',()=>{
 const process={id:'proc-original_1',protocolo:'TCC-2026-0004'};
 const task={processId:process.id,protocol:process.protocolo};
 const deletionLog={action:'EXCLUSAO_PROCESSO_TCC',entityId:'delete_proc-original_1_1735689600000',processProtocol:process.protocolo};
 assert.equal(restoresDeletedProcess([process],[],[task],[]),true);
 assert.equal(restoresDeletedProcess([{...process,protocolo:'TCC-2026-0005'}],[],[],[deletionLog]),true);
 assert.equal(restoresDeletedProcess([{id:'old-id',protocolo:' tcc-2026-0004 '}],[],[],[deletionLog]),true);
 assert.equal(restoresDeletedProcess([process],[process],[],[deletionLog]),false);
 assert.equal(restoresDeletedProcess([{id:'another-id',protocolo:'TCC-2026-0005'}],[],[task],[deletionLog]),false);
 const serialDeletionLog={...deletionLog,processProtocol:'TCC - 00002'};
 assert.equal(restoresDeletedProcess([{id:process.id,protocolo:'TCC - 00002'}],[],[],[serialDeletionLog]),true);
 assert.equal(restoresDeletedProcess([{id:'new-process',protocolo:'TCC - 00002'}],[],[],[serialDeletionLog]),false);
});

test('nova exclusão inclui envelopes assinados no expurgo, sem alcançar outros processos',()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);
 const jobs=[{id:'own',processId:p.id,provider:'ASTEN',providerEnvelopeId:'123',status:'ARCHIVED',providerRepositoryId:42,providerFolderId:11,providerEnvelopeHash:'hash'},{id:'foreign',processId:'foreign',provider:'ASTEN',providerEnvelopeId:'456',status:'SIGNED'}] as SignatureJob[];
 const task=processDeletionTask(p,jobs,[],{deleteFiles:true,clearHistory:true,rootFolderId:'root',protectedIds:[]});
 assert.deepEqual(task.envelopes,['123']);assert.equal(task.astenReconciliation?.[0].state,'PENDING');assert.equal(task.astenReconciliation?.[0].purgeRequired,true);
 const duplicate={...jobs[0],id:'duplicate',providerEnvelopeHash:'different'};
 const conflicted=processDeletionTask(p,[...jobs,duplicate],[],{deleteFiles:true,clearHistory:true,rootFolderId:'root',protectedIds:[]});
 assert.equal(conflicted.astenReconciliation?.[0].state,'REVIEW');assert.equal(conflicted.astenReconciliation?.[0].hash,undefined);
});
