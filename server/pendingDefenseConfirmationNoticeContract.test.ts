import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {isDefenseOnCalendar, isDefenseReservationPending} from '../src/utils/defenseReservationState';
import {getDefenseCalendarSummaryParts} from '../src/utils/defenseSemantics';
import {publicCalendarView} from './publicViews';

function fixture(){
 const process=structuredClone(DEMO_PROCESSES[0]);
 process.defesa={startAt:'2026-11-05T17:00:00Z',endAt:'2026-11-05T18:30:00Z',local:'Auditório de Enfermagem',localStatus:'PENDENTE',reservationRevision:1};
 return process;
}

test('calendar places the pending note after time and keeps the location free of status suffixes',()=>{
 const process=fixture(),parts=getDefenseCalendarSummaryParts(process);
 assert.equal(parts.primary,`${parts.time} (aguardando confirmação) · ${process.titulo}`);
 assert.equal(parts.location,process.defesa.local);
 assert.equal((parts.primary.match(/aguardando confirmação/g)||[]).length,1);
});

test('old receipts do not hide the pending state of a new request, including the anonymous projection',()=>{
 const process=fixture();
 const response={revision:0,decision:'UNAVAILABLE' as const,respondedAt:'2026-11-04T12:00:00Z',respondedBy:'private@example.invalid',startAt:'2026-11-04T17:00:00Z',endAt:'2026-11-04T18:30:00Z'};
 process.defesa.departmentResponse=response;
 process.defesa.reservationHistory=[{startAt:response.startAt,endAt:response.endAt,local:'Sala anterior',departmentResponse:response,invalidatedAt:'2026-11-04T14:00:00Z',invalidatedBy:process.aluno1.email}];
 const projected=publicCalendarView(process);
 assert.equal(projected.defesa.hasReservationReceipt,true);
 for(const item of [process,projected]){
  assert.equal(isDefenseReservationPending(item),true);
  assert.equal(isDefenseOnCalendar(item),true);
  assert.match(getDefenseCalendarSummaryParts(item).primary,/\(aguardando confirmação\) · /);
 }
});

test('the current decision removes pending presentation and a refusal removes only the event',()=>{
 const process=fixture();
 process.defesa.departmentResponse={revision:1,decision:'CONFIRMED',respondedAt:'2026-11-04T15:00:00Z',respondedBy:'private@example.invalid',startAt:process.defesa.startAt,endAt:process.defesa.endAt};
 assert.equal(process.defesa.localStatus,'PENDENTE');
 assert.equal(isDefenseReservationPending(process),false);
 assert.doesNotMatch(getDefenseCalendarSummaryParts(process).primary,/aguardando confirmação/);
 assert.equal(isDefenseOnCalendar(process),true);
 process.defesa.departmentResponse.decision='UNAVAILABLE';
 assert.equal(isDefenseReservationPending(process),false);
 assert.equal(isDefenseOnCalendar(process),false);
 assert.equal(process.protocolo,DEMO_PROCESSES[0].protocolo);
 process.defesa.departmentResponse=undefined;process.defesa.localStatus=undefined;
 assert.equal(isDefenseReservationPending(process),false,'legacy records without a reservation state are not pending');
});
