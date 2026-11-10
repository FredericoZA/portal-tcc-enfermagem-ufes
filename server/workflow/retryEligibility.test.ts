import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_PROCESSES } from '../../src/services/demoSeed';
import type { SignatureJob } from '../../src/types';
import { nativeFormRetryEvent, workflowRetryBlocker } from './retryEligibility';

function fixture(){
  const process=structuredClone(DEMO_PROCESSES[0]);
  process.status='AGUARDANDO_ASSINATURA';
  process.defesa={startAt:'2000-01-03T13:00:00Z',endAt:'2000-01-03T14:30:00Z',local:'Espaço de teste',
    localStatus:'CONFIRMADO',invitationSentAt:'2000-01-01T13:00:00Z',invitationDriveFileId:'fixture-invitation'};
  process.avaliacao={status:'CONCLUIDO',submittedAt:'2000-01-03T14:30:00Z'};
  process.acervo=undefined;
  return process;
}

test('retomada da ata exige o evento atual mesmo sem revisão na execução legada',()=>{
  const process=fixture();
  assert.equal(workflowRetryBlocker(process,'EVALUATION_SUBMITTED',[]),undefined);
  assert.equal(workflowRetryBlocker(process,'EVALUATION_SUBMITTED',[],process.dataRevision),undefined);
  assert.match(workflowRetryBlocker(process,'EVALUATION_SUBMITTED',[],process.dataRevision+1)||'',/mudaram/);
  process.avaliacao={status:'PENDENTE'};
  assert.match(workflowRetryBlocker(process,'EVALUATION_SUBMITTED',[])||'',/ata/);
  assert.match(workflowRetryBlocker(process,'evaluationSubmitted',[])||'',/ata/);
});

test('retomada da entrega e declaração usa a ata arquivada e os dados finais atuais',()=>{
  const process=fixture();
  const job={id:'fixture-ata',processId:process.id,documentType:'ATA',documentVersion:1,status:'ARCHIVED',
    sourceDataRevision:process.dataRevision,driveSignedFileId:'fixture-signed-ata'} as SignatureJob;
  assert.match(workflowRetryBlocker(process,'REPOSITORY_SUBMITTED',[])||'',/entrega/);
  assert.match(workflowRetryBlocker(process,'PUBLICATION_CLEARED',[])||'',/declaração/);
  process.acervo={submittedAt:new Date().toISOString(),palavrasChave:['A','B','C','D','E'],
    resumoSintese:'Resumo registrado no processo',trabalhoCompletoFileUrl:'https://drive.example.invalid/fixture',
    publishFullWork:false,publishExpandedAbstract:false};
  assert.equal(workflowRetryBlocker(process,'REPOSITORY_SUBMITTED',[job]),undefined);
  assert.equal(workflowRetryBlocker(process,'PUBLICATION_CLEARED',[job]),undefined);
  assert.match(workflowRetryBlocker(process,'REPOSITORY_SUBMITTED',[])||'',/ata/);
});

test('local pendente não libera continuação e formulário desconhecido não vira entrega final',()=>{
  const process=fixture();
  process.defesa.localStatus='PENDENTE';
  process.defesa.invitationSentAt=undefined;
  assert.match(workflowRetryBlocker(process,'LOCATION_CONFIRMED',[])||'',/local/);
  assert.equal(nativeFormRetryEvent('AVALIACAO'),'EVALUATION_SUBMITTED');
  assert.equal(nativeFormRetryEvent('DADOS_FINAIS'),'REPOSITORY_SUBMITTED');
  for(const name of ['unknown','__proto__','constructor'])assert.equal(nativeFormRetryEvent(name),undefined);
});
