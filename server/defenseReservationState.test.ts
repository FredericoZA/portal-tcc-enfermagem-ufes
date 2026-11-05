import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {currentDefenseSelection,isDefenseOnCalendar,isDefenseReservationDeclined,publicDefenseReservationStatus,effectiveDefenseReservationStatus,calendarEventMatchesProcess} from '../src/utils/defenseReservationState';
import {publicCalendarView,publicRepositoryView} from './publicViews';
import {restartReservation} from './workflow/reservationReschedule';
import {getDefenseState} from '../src/utils/defenseSemantics';
import {inspectDefenseConflicts} from './defenseConflicts';

const pending=()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);
 p.defesa={...p.defesa,startAt:'2026-12-07T17:00:00Z',endAt:'2026-12-07T18:30:00Z',localStatus:'PENDENTE',departmentResponse:undefined};
 return p;
};

test('pedido pendente ocupa o calendário; aceite mantém a defesa e não muda sua cor temporal',()=>{
 const p=pending();
 assert.equal(isDefenseOnCalendar(p),true);
 assert.equal(publicDefenseReservationStatus(p),'PENDENTE');
 const color=getDefenseState(p);
 p.defesa.localStatus='CONFIRMADO';
 assert.equal(isDefenseOnCalendar(p),true);
 assert.equal(publicDefenseReservationStatus(p),'CONFIRMADO');
 assert.equal(getDefenseState(p),color);
});

test('recusa antiga sai da agenda pública, preserva o TCC e a nova solicitação volta à agenda',()=>{
 const p=pending();const {id,protocolo}=p;
 p.defesa.departmentResponse={revision:0,decision:'UNAVAILABLE',respondedAt:'2026-11-04T14:00:00Z',respondedBy:'secretaria@example.invalid',startAt:p.defesa.startAt,endAt:p.defesa.endAt,receiptBody:'comprovante privado'};
 assert.equal(p.defesa.localStatus,'PENDENTE','compatível com registros antigos, sem migração');
 assert.equal(isDefenseOnCalendar(p),false);
 const query={startAt:p.defesa.startAt,local:p.defesa.local,emails:[p.orientador.email]};
 assert.equal(inspectDefenseConflicts([p],query).length,0,'a recusa libera sala e pessoas');
 for(const project of [publicCalendarView,publicRepositoryView]){
  const view=project(p);
  assert.equal(view.protocolo,protocolo);
  assert.equal(view.defesa.localStatus,'RECUSADO');
  assert.equal(isDefenseOnCalendar(view),false);
  assert.doesNotMatch(JSON.stringify(view),/secretaria@example\.invalid|comprovante privado|respondedBy|receiptBody/);
 }
 const next=restartReservation(p,{...p,defesa:{...p.defesa,startAt:'2026-12-08T17:00:00Z',endAt:'2026-12-08T18:30:00Z'}},p.aluno1.email,'2026-11-04T15:00:00Z');
 assert.equal(next.id,id);assert.equal(next.protocolo,protocolo);
 assert.equal(isDefenseOnCalendar(next),true);assert.equal(next.defesa.localStatus,'PENDENTE');
 assert.equal(next.defesa.reservationHistory?.at(-1)?.departmentResponse?.decision,'UNAVAILABLE');
 assert.equal(inspectDefenseConflicts([next],{...query,startAt:next.defesa.startAt}).length,1);
});

test('todas as grafias de recusa existentes liberam o intervalo, sem excluir o registro do repositório',()=>{
 for(const status of ['NEGADO','RECUSADO','REJEITADO'] as const){
  const p=pending();p.defesa.localStatus=status;
  assert.equal(isDefenseReservationDeclined(p),true);
  assert.equal(isDefenseOnCalendar(p),false);
  assert.equal(inspectDefenseConflicts([p],{startAt:p.defesa.startAt,local:p.defesa.local,emails:[p.aluno1.email]}).length,0);
  assert.equal(publicRepositoryView(p).protocolo,p.protocolo);
 }
});

test('decisão da revisão atual corrige o status antigo; revisão anterior não altera a nova solicitação',()=>{
 const p=pending();
 p.defesa.departmentResponse={revision:0,decision:'CONFIRMED',respondedAt:'2026-11-04T15:41:34.985Z',respondedBy:'secretaria@example.invalid',startAt:p.defesa.startAt,endAt:p.defesa.endAt};
 assert.equal(effectiveDefenseReservationStatus(p),'CONFIRMADO');
 p.defesa.departmentResponse.decision='UNAVAILABLE';assert.equal(effectiveDefenseReservationStatus(p),'RECUSADO');
 p.defesa.reservationRevision=1;assert.equal(effectiveDefenseReservationStatus(p),'PENDENTE');
 assert.equal(isDefenseOnCalendar(p),true);
});

test('legados sem estado de reserva continuam visíveis; datas vazias ou inválidas não ocupam agenda',()=>{
 const p=pending();p.defesa.localStatus=undefined;assert.equal(isDefenseOnCalendar(p),true);
 for(const date of ['', 'sem data']){p.defesa.startAt=date;assert.equal(isDefenseOnCalendar(p),false);}
});

test('evento antigo do Google é vinculado por protocolo, mesmo com ID público diferente',()=>{
 const p=pending();const event={id:'external-123',description:`Trabalho: Exemplo\nProtocolo: ${p.protocolo}`};
 assert.equal(calendarEventMatchesProcess(event,p),true);
 assert.equal(calendarEventMatchesProcess(event,publicCalendarView(p)),true);
 assert.equal(calendarEventMatchesProcess({id:`gcal-${p.id}`},p),true);
 assert.equal(calendarEventMatchesProcess({id:'another',portalTccProtocol:p.protocolo},publicCalendarView(p)),true);
 assert.equal(calendarEventMatchesProcess({id:'another',description:`Trabalho: ${p.titulo}`},p),false);
 assert.equal(calendarEventMatchesProcess({id:'another',description:`Protocolo: ${p.protocolo}9`},p),false);
});

test('pop-up aberto recebe o aceite e fecha quando a reserva é recusada ou muda de dia',()=>{
 const before=pending();const selected=[before];const accepted=structuredClone(before);accepted.defesa.localStatus='CONFIRMADO';
 assert.equal(currentDefenseSelection(selected,[accepted])?.[0],accepted);
 const declined=structuredClone(accepted);declined.defesa.localStatus='RECUSADO';assert.equal(currentDefenseSelection(selected,[declined]),null);
 const moved=structuredClone(before);moved.defesa.startAt='2026-12-08T17:00:00Z';assert.equal(currentDefenseSelection(selected,[moved]),null);
 assert.equal(currentDefenseSelection(selected,[]),null);assert.equal(currentDefenseSelection(null,[before]),null);
});
