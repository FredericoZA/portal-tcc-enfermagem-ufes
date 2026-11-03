import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';
import type {SignatureJob} from '../../src/types';
import {latestSignature,ataArchived,declarationReady} from './gates';
test('segunda assinatura na mesma revisão preserva documento arquivado e elegibilidade da declaração',()=>{
 const process=structuredClone(DEMO_PROCESSES[0]);process.dataRevision=2;process.acervo={submittedAt:'2026-10-24',publishFullWork:false,publishExpandedAbstract:false};
 const first={processId:process.id,documentType:'ATA',documentVersion:1,sourceDataRevision:2,status:'ARCHIVED',driveSignedFileId:'signed',provider:'ASTEN'} as SignatureJob;
 const second={...first,documentVersion:2,status:'READY_FOR_REVIEW',driveSignedFileId:undefined,provider:'GOV_BR'} as SignatureJob;
 const jobs=[first,second];
 assert.equal(latestSignature(process,jobs,'ATA')?.id,first.id);
 assert.equal(latestSignature(process,jobs,'ATA')?.status,'ARCHIVED');
 assert.equal(ataArchived(process,jobs),true);assert.equal(declarationReady(process,jobs),true);
 const changed={...second,sourceDataRevision:3};
 assert.equal(ataArchived(process,[first,changed]),false,'dados novos exigem a assinatura da nova revisão');
});
