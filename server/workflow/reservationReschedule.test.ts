import {waitingMilestone} from './deadlines';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';
import {rescheduledReservationStudio,RESERVATION_RESCHEDULED,restartReservation,reservationScheduleChanged} from './reservationReschedule';
import {executeWorkflowEvent} from './runtime';
import {MemoryEmailDeliveryJournal,dispatchTrackedEmail} from '../integrations/trackedGmail';
import {isDefenseOnCalendar} from '../../src/utils/defenseReservationState';
import {reservationStatusAlert} from '../../src/utils/reservationStatusAlert';

test('reenvio usa somente o pedido de reserva e não duplica e-mail aceito para a mesma revisão',async()=>{
 const studio=rescheduledReservationStudio({revision:1,docTemplates:[],formTemplates:[],matrixColumns:[],matrixRows:[],emailTemplates:[{id:'email-reserva',recipient:'department@example.invalid',subject:'Reserva',body:'Novo agendamento'}],workflowStages:[{id:'initial',eventCode:'TCC_CREATED',actions:[{id:'reserve',type:'email',refId:'email-reserva'},{id:'welcome',type:'email',refId:'email-boas-vindas'}]}]} as any);
 const process=structuredClone(DEMO_PROCESSES[0]);const journal=new MemoryEmailDeliveryJournal();let accepted=0;
 const ports={createDocument:async()=>{throw Error('Não gerar documento no reenvio');},createFormTask:async()=>{throw Error('Não recriar formulário');},sendEmail:async(input:any)=>{const record=await dispatchTrackedEmail({recipient:input.to[0],subject:input.subject,text:input.text,idempotencyKey:input.idempotencyKey},{journal,send:async()=>{accepted++;return{id:'fake-gmail-id'};}});return{externalId:record.id};}};
 const context={process,eventCode:RESERVATION_RESCHEDULED,actorEmail:'master@portal.local',actorRoles:[]};
 assert.equal((await executeWorkflowEvent(studio,context,ports)).status,'COMPLETED');assert.equal(accepted,1);
 await executeWorkflowEvent(studio,context,ports);assert.equal(accepted,1);
 await executeWorkflowEvent(studio,{...context,process:{...process,dataRevision:process.dataRevision+1}},ports);assert.equal(accepted,2);
});

test('reinício preserva histórico, retira prova anterior e reinicia o prazo da confirmação',()=>{
 const before=structuredClone(DEMO_PROCESSES[0]);const now='2026-10-25T15:00:00Z';before.defesa.locationProof={driveFileId:'old-file',fileName:'proof.pdf',version:3,sha256:'hash',uploadedBy:before.aluno1.email,uploadedAt:before.createdAt};
 const after={...before,defesa:{...before.defesa,startAt:'2026-11-20T14:00:00Z'}};
 assert.equal(reservationScheduleChanged(before,after),true);assert.equal(reservationScheduleChanged(before,structuredClone(before)),false);
 const restarted=restartReservation(before,after,before.aluno1.email,now);
 assert.equal(restarted.defesa.locationProof,undefined);assert.equal(restarted.defesa.reservationHistory?.[0].locationProof?.driveFileId,'old-file');assert.equal(before.defesa.locationProof.driveFileId,'old-file');assert.equal(waitingMilestone(restarted,[])?.startedAt,now);
});

test('refazer reserva recusada preserva a solicitação antiga no histórico sem herdar avisos ou bloqueios',()=>{
 for(const status of ['DENIED','PENDING','SENT','SEND_FAILED','APPROVED'] as const){
  const before=structuredClone(DEMO_PROCESSES[0]),now='2026-11-05T15:00:00Z';
  before.defesa.localStatus='PENDENTE';delete before.defesa.reservationRevision;
  before.defesa.departmentResponse={revision:0,decision:'UNAVAILABLE',respondedBy:'department@example.invalid',respondedAt:'2026-11-04T15:41:00Z',startAt:before.defesa.startAt,endAt:before.defesa.endAt};
  before.defesa.reservationChangeRequest={requestId:'old-change',requestedAt:'2026-11-03T15:00:00Z',requestedBy:before.aluno1.email,startAt:before.defesa.startAt,endAt:before.defesa.endAt,local:before.defesa.local,locationChoice:before.defesa.local,recipient:'department@example.invalid',status};
  const original=structuredClone(before);
  assert.equal(reservationStatusAlert(before)?.kind,'denied');assert.equal(isDefenseOnCalendar(before),false);
  const restarted=restartReservation(before,{...before,defesa:{...before.defesa,startAt:'2026-12-07T17:00:00Z',endAt:'2026-12-07T18:30:00Z'}},before.aluno1.email,now);
  assert.equal(restarted.id,before.id);assert.equal(restarted.protocolo,before.protocolo);
  assert.equal(restarted.defesa.reservationRevision,1);assert.equal(restarted.defesa.localStatus,'PENDENTE');
  assert.equal(restarted.defesa.departmentResponse,undefined);assert.equal(restarted.defesa.reservationChangeRequest,undefined);
  assert.equal(reservationStatusAlert(restarted)?.kind,'waiting','a nova revisão mostra apenas a espera pela nova decisão');
  assert.equal(isDefenseOnCalendar(restarted),true,'a nova data volta à agenda com o mesmo TCC');
  const historical=restarted.defesa.reservationHistory!.at(-1)!;
  assert.deepEqual(historical.departmentResponse,original.defesa.departmentResponse);
  assert.deepEqual(Reflect.get(historical,'reservationChangeRequest'),original.defesa.reservationChangeRequest);
  assert.notEqual(Reflect.get(historical,'reservationChangeRequest'),before.defesa.reservationChangeRequest,'o histórico preserva uma cópia independente da solicitação antiga');
  assert.deepEqual(before,original,'reiniciar não altera o objeto original');
 }
});
