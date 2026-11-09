import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_PROCESSES } from '../../src/services/demoSeed';
import type { EmailDeliveryRecord } from '../../src/types/automation';
import type { SignatureJob } from '../../src/types';
import { initialEmailDelivery } from '../integrations/trackedGmail';
import { operationalEmailRetryBlocker } from './emailRetryEligibility';

const message = (templateId:string, revision=0):EmailDeliveryRecord => initialEmailDelivery({
  templateId,recipient:'fixture@example.invalid',subject:'Mensagem fictícia',text:'Texto de teste',
  idempotencyKey:templateId,workflowEventVariables:{RESERVATION_REVISION:String(revision)},
});
function processFixture(){
  const process=structuredClone(DEMO_PROCESSES[0]);
  process.defesa={...process.defesa,localStatus:'CONFIRMADO',reservationRevision:0,
    departmentResponse:undefined,invitationDriveFileId:'fixture-invitation',invitationSentAt:undefined};
  return process;
}

test('convite de banca exige aceite e carta da reserva vigente sem envio já concluído',()=>{
  const process=processFixture(),mail=message('email-convite');
  assert.equal(operationalEmailRetryBlocker(mail,process,[]),undefined);
  for(const changes of [{localStatus:'PENDENTE' as const},{invitationDriveFileId:undefined},{invitationSentAt:new Date().toISOString()}]){
    const changed={...process,defesa:{...process.defesa,...changes}};
    assert.equal(operationalEmailRetryBlocker(mail,changed,[])?.code,'INVITATION_EVENT_NOT_CURRENT');
  }
  process.defesa.reservationRevision=1;
  assert.equal(operationalEmailRetryBlocker(mail,process,[])?.code,'STALE_RESERVATION_REQUEST');
  assert.equal(operationalEmailRetryBlocker(message('email-convite',1),process,[]),undefined);
});

test('solicitação, cópia de cadastro e comprovantes não voltam a uma fase já encerrada',()=>{
  const process=processFixture();
  for(const template of ['email-reserva','email-reserva-autores']){
    assert.equal(operationalEmailRetryBlocker(message(template),process,[])?.code,'RESERVATION_REQUEST_CLOSED');
    const pending={...process,defesa:{...process.defesa,localStatus:'PENDENTE' as const,invitationDriveFileId:undefined}};
    assert.equal(operationalEmailRetryBlocker(message(template),pending,[]),undefined);
  }
  process.defesa.departmentResponse={revision:0,decision:'UNAVAILABLE',respondedBy:'approver@example.invalid',respondedAt:new Date().toISOString(),departmentEmail:'approver@example.invalid',startAt:process.defesa.startAt,endAt:process.defesa.endAt,local:process.defesa.local};
  assert.equal(operationalEmailRetryBlocker(message('email-comprovante-reserva'),process,[])?.code,'RESERVATION_DECISION_CHANGED');
  assert.equal(operationalEmailRetryBlocker(message('email-local-indisponivel'),process,[]),undefined);
  process.defesa.departmentResponse.revision=1;
  assert.equal(operationalEmailRetryBlocker(message('email-local-indisponivel'),process,[])?.code,'RESERVATION_DECISION_CHANGED');
});

test('avisos de entrega, termo e conclusão respeitam os documentos e a etapa atuais',()=>{
  const process=processFixture();
  process.avaliacao={status:'CONCLUIDO'};
  process.etapaAtual='REPOSITORIO';
  process.acervo={publishFullWork:false,publishExpandedAbstract:false};
  const jobs=[{id:'fixture-ata',processId:process.id,documentType:'ATA',status:'ARCHIVED',documentVersion:1,sourceDataRevision:process.dataRevision,driveSignedFileId:'fixture-signed-ata'}] as SignatureJob[];
  assert.equal(operationalEmailRetryBlocker(message('email-entrega-repositorio'),process,[])?.code,'REPOSITORY_NOTICE_NOT_CURRENT');
  assert.equal(operationalEmailRetryBlocker(message('email-entrega-repositorio'),process,jobs),undefined);
  process.acervo.submittedAt=new Date().toISOString();
  assert.equal(operationalEmailRetryBlocker(message('email-entrega-repositorio'),process,jobs)?.code,'REPOSITORY_NOTICE_NOT_CURRENT');
  assert.equal(operationalEmailRetryBlocker(message('email-assinatura-termo'),process,jobs)?.code,'TERM_NOTICE_NOT_CURRENT');
  assert.equal(operationalEmailRetryBlocker(message('email-conclusao'),process,jobs)?.code,'COMPLETION_NOTICE_NOT_CURRENT');
  process.status='CONCLUIDO';
  assert.equal(operationalEmailRetryBlocker(message('email-conclusao'),process,jobs)?.code,'COMPLETION_NOTICE_NOT_CURRENT');
  const declaration={...jobs[0],id:'fixture-declaration',documentType:'DECLARACAO' as const};
  assert.equal(operationalEmailRetryBlocker(message('email-conclusao'),process,[...jobs,declaration]),undefined);
  assert.equal(operationalEmailRetryBlocker(message('email-conclusao'),process,[])?.code,'COMPLETION_NOTICE_NOT_CURRENT');
});

test('revisão registrada impede reconstruir uma mensagem operacional com dados de outra versão',()=>{
  const process=processFixture();
  const mail={...message('email-convite'),sourceDataRevision:process.dataRevision-1};
  assert.equal(operationalEmailRetryBlocker(mail,process,[])?.code,'STALE_EMAIL_PROCESS_REVISION');
  mail.sourceDataRevision=process.dataRevision;
  assert.equal(operationalEmailRetryBlocker(mail,process,[]),undefined);
  assert.equal(operationalEmailRetryBlocker(message('custom-audit-notice'),process,[]),undefined);
});
