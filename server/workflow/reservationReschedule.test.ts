import {waitingMilestone} from './deadlines';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';
import {rescheduledReservationStudio,RESERVATION_RESCHEDULED,restartReservation,reservationScheduleChanged} from './reservationReschedule';
import {executeWorkflowEvent} from './runtime';
import {MemoryEmailDeliveryJournal,dispatchTrackedEmail} from '../integrations/trackedGmail';

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
