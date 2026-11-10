import {processWorkflowSection} from '../src/utils/processLink';
import test from 'node:test';
import assert from 'node:assert/strict';
import {currentAtaArchived,documentSignatureArchived,processWithPendingAtaStage} from '../src/utils/documentSignatureState';
import {ataArchived} from './workflow/gates';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import type {SignatureJob} from '../src/types/signatures';
import {deriveSignatureSigners} from './workflow/signaturePolicy';

test('ata do conceito atual exige três assinaturas distintas e PDF arquivado',()=>{
 const process=structuredClone(DEMO_PROCESSES[0]);
 process.avaliacao={status:'CONCLUIDO',documentRevision:4};
 const signers=deriveSignatureSigners(process,'ATA',{},'BOARD_ONLY_LEGACY').map(signer=>({...signer,status:'SIGNED' as const}));
 const archived={processId:process.id,documentType:'ATA',documentVersion:2,sourceDataRevision:4,status:'ARCHIVED',driveSignedFileId:'current-pdf',signers} as SignatureJob;
 assert.equal(currentAtaArchived(process,[{...archived,sourceDataRevision:3}]),false);
 assert.equal(currentAtaArchived(process,[{...archived,signers:signers.slice(0,2)}]),false);
 assert.equal(currentAtaArchived(process,[{...archived,signers:[signers[0],signers[1],{...signers[2],email:signers[1].email}]}]),false);
 assert.equal(currentAtaArchived(process,[{...archived,driveSignedFileId:undefined}]),false);
 assert.equal(currentAtaArchived(process,[archived]),true);
});
test('entrega permanece liberada quando uma ata está arquivada e outro provedor da mesma revisão ainda aguarda assinatura',()=>{
 const process=DEMO_PROCESSES[0];const archived={processId:process.id,documentType:'ATA',documentVersion:1,sourceDataRevision:1,status:'ARCHIVED',driveSignedFileId:'signed-private'} as SignatureJob;
 const pending={...archived,documentVersion:2,status:'SENT',driveSignedFileId:undefined} as SignatureJob;
 assert.equal(documentSignatureArchived([archived,pending],process.id,'ATA'),true);assert.equal(ataArchived(process,[archived,pending]),true);
 assert.equal(documentSignatureArchived([archived,{...pending,sourceDataRevision:2}],process.id,'ATA'),false);
 assert.equal(documentSignatureArchived([{...archived,driveSignedFileId:undefined}],process.id,'ATA'),false);
 assert.equal(documentSignatureArchived([{...archived,status:'SIGNED'}],process.id,'ATA'),false);
});

test('Gov.br preparation and pending upload never complete the signature stage',()=>{
 const process={...structuredClone(DEMO_PROCESSES[0]),etapaAtual:'REPOSITORIO',status:'AGUARDANDO_DADOS_FINAIS',avaliacao:{status:'CONCLUIDO'},acervo:undefined} as any;
 for(const status of ['READY_FOR_REVIEW','SENT','PARTIALLY_SIGNED','SIGNED','DRIVE_SYNC_PENDING','DECLINED','PROVIDER_ERROR']){
  const jobs=[{processId:process.id,documentType:'ATA',provider:'GOV_BR',documentVersion:1,sourceDataRevision:process.dataRevision,status}] as SignatureJob[];
  const pending=processWithPendingAtaStage(process,jobs);
  assert.equal(pending.etapaAtual,'ASSINATURA',status);assert.equal(pending.status,'AGUARDANDO_ASSINATURA',status);
  assert.equal(processWorkflowSection(pending),'docs',status);
  assert.equal(documentSignatureArchived(jobs,process.id,'ATA'),false,status);
 }
 const archived=[{processId:process.id,documentType:'ATA',provider:'GOV_BR',documentVersion:1,sourceDataRevision:process.dataRevision,status:'ARCHIVED',driveSignedFileId:'signed-validated-pdf'}] as SignatureJob[];
 assert.equal(processWithPendingAtaStage(process,archived),process);
 assert.equal(processWorkflowSection(processWithPendingAtaStage(process,archived)),'acervo');
 assert.equal(documentSignatureArchived(archived,process.id,'ATA'),true);
 assert.equal(process.etapaAtual,'REPOSITORIO','projection does not mutate stored history');
});
