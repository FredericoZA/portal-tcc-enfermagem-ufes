import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import type {ProcessData} from '../src/types';
import {initialEmailDelivery} from './integrations/trackedGmail';
import {selectReservationNoticeRecoveries} from './reservationNoticeRecovery';

const now = new Date('2026-11-04T17:00:00Z');
function answered(id='reservation', revision=0): ProcessData {
  const process = structuredClone(DEMO_PROCESSES[0]);
  process.id=id;process.protocolo=`TEST-${id}`;process.defesa.reservationRevision=revision;
  process.defesa.departmentResponse={revision,decision:'UNAVAILABLE',respondedBy:'department@example.invalid',respondedAt:'2026-11-04T15:41:00Z',startAt:process.defesa.startAt,endAt:process.defesa.endAt};
  return process;
}
function notice(process: ProcessData) {
  return initialEmailDelivery({processId:process.id,recipient:process.defesa.departmentResponse!.respondedBy,subject:'Reserva recusada',text:'Conteúdo fictício',idempotencyKey:`reservation-receipt:${process.id}:${process.defesa.reservationRevision ?? 0}:${process.defesa.departmentResponse!.respondedBy}`},now);
}

test('seleciona resposta vigente sem ledger sem alterar processo, protocolo ou histórico',()=>{
  const process=answered();process.defesa.localStatus='PENDENTE';
  const before=structuredClone(process),selected=selectReservationNoticeRecoveries([process],[],{now});
  assert.equal(selected.length,1);assert.equal(selected[0].process,process);assert.equal(selected[0].processId,process.id);assert.equal(selected[0].revision,0);
  assert.equal(selected[0].idempotencyKey,`reservation-receipt:${process.id}:0:department@example.invalid`);assert.equal(selected[0].delivery,undefined);
  assert.deepEqual(process,before);
});

test('aceita RETRY vencido e exclui aceito, falha encerrada, envio ativo e resultado incerto',()=>{
  const cases=[
    {state:'due',expected:1}, {state:'future',expected:0}, {state:'accepted',expected:0},
    {state:'failed',expected:0}, {state:'sending',expected:0}, {state:'uncertain',expected:0},
    {state:'stale-sending',expected:0}, {state:'exhausted',expected:0}, {state:'invalid-date',expected:0},
  ];
  for (const {state,expected} of cases) {
    const process=answered(state),delivery=notice(process);delivery.nextRetryAt='2026-11-04T16:59:00Z';
    if(state==='future')delivery.nextRetryAt='2026-11-04T17:01:00Z';
    if(state==='accepted')delivery.status='ACCEPTED_BY_GMAIL';
    if(state==='failed')delivery.status='FAILED';
    if(state==='sending'||state==='stale-sending'){delivery.dispatchState='SENDING';delivery.dispatchLeaseUntil=state==='sending'?'2026-11-04T17:01:00Z':'2026-11-04T16:59:00Z';}
    if(state==='uncertain')delivery.dispatchState='UNCERTAIN';
    if(state==='exhausted')delivery.maxAttempts=0;
    if(state==='invalid-date')delivery.nextRetryAt='invalid';
    const before=structuredClone(delivery),selected=selectReservationNoticeRecoveries([process],[delivery],{now});
    assert.equal(selected.length,expected,state);assert.deepEqual(delivery,before);
    if(expected)assert.equal(selected[0].delivery,delivery);
  }
});

test('não usa respostas nem comprovantes de revisões anteriores para a reserva vigente',()=>{
  const stale=answered('stale',2);stale.defesa.departmentResponse!.revision=1;
  const unanswered=answered('unanswered',2);delete unanswered.defesa.departmentResponse;
  unanswered.defesa.reservationHistory=[{reservationRevision:1,departmentResponse:answered().defesa.departmentResponse} as NonNullable<ProcessData['defesa']['reservationHistory']>[number]];
  const current=answered('current',2),previous=notice(current);previous.idempotencyKey=`reservation-receipt:${current.id}:1:department@example.invalid`;previous.status='ACCEPTED_BY_GMAIL';
  const selected=selectReservationNoticeRecoveries([stale,unanswered,current],[previous],{now});
  assert.deepEqual(selected.map(item=>item.processId),['current']);assert.match(selected[0].idempotencyKey,/:2:/);
});

test('revisão ausente do processo equivale a zero, mas a resposta exige revisão válida e destinatário exato',()=>{
  const process=answered();delete process.defesa.reservationRevision;
  delete (process.defesa.departmentResponse as Partial<NonNullable<ProcessData['defesa']['departmentResponse']>>).revision;
  assert.equal(selectReservationNoticeRecoveries([process],[],{now}).length,0,'resposta sem revisão não corresponde ao pedido vigente');
  process.defesa.departmentResponse!.revision=Number.NaN;
  assert.equal(selectReservationNoticeRecoveries([process],[],{now}).length,0,'revisão inválida não corresponde ao pedido vigente');
  process.defesa.departmentResponse!.revision=0;
  const otherRecipient=notice(process);otherRecipient.idempotencyKey=`reservation-receipt:${process.id}:0:another@example.invalid`;otherRecipient.status='ACCEPTED_BY_GMAIL';
  assert.equal(selectReservationNoticeRecoveries([process],[otherRecipient],{now}).length,1);
  const current=notice(process);current.status='ACCEPTED_BY_GMAIL';
  assert.equal(selectReservationNoticeRecoveries([process],[current],{now}).length,0);
});

test('limite mantém a ordem dos processos elegíveis e registros duplicados não contornam aceite ou incerteza',()=>{
  const processes=[answered('one'),answered('two'),answered('three')];
  assert.deepEqual(selectReservationNoticeRecoveries(processes,[],{now,limit:2}).map(item=>item.processId),['one','two']);
  assert.deepEqual(selectReservationNoticeRecoveries(processes,[],{now,limit:0}),[]);
  const pending=notice(processes[0]),accepted=structuredClone(pending);accepted.status='ACCEPTED_BY_GMAIL';
  assert.deepEqual(selectReservationNoticeRecoveries(processes,[pending,accepted],{now,limit:2}).map(item=>item.processId),['two','three']);
  const uncertain=structuredClone(pending);uncertain.dispatchState='UNCERTAIN';
  assert.deepEqual(selectReservationNoticeRecoveries(processes,[pending,uncertain],{now,limit:1}).map(item=>item.processId),['two']);
});

test('recupera aceite e recusa, mantém compatibilidade sem nextRetryAt e limita o lote',()=>{
  const processes=Array.from({length:105},(_,index)=>answered(String(index)));
  processes[0].defesa.departmentResponse!.decision='CONFIRMED';
  const legacy=notice(processes[0]);legacy.nextRetryAt=undefined;
  assert.equal(selectReservationNoticeRecoveries(processes,[legacy],{now}).length,25);
  assert.equal(selectReservationNoticeRecoveries(processes,[legacy],{now,limit:1000}).length,100);
  assert.equal(selectReservationNoticeRecoveries(processes,[legacy],{now,limit:2})[0].process.defesa.departmentResponse!.decision,'CONFIRMED');
  assert.deepEqual(selectReservationNoticeRecoveries(processes,[],{now:new Date('invalid')}),[]);
});
