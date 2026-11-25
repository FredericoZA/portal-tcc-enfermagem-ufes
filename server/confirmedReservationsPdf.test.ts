import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { confirmedReservations, buildConfirmedReservationsPdf } from '../src/utils/confirmedReservationsPdf';
import { DEMO_PROCESSES } from '../src/services/demoSeed';

test('PDF reservations use their current decision and Brasília time for the selected month', async()=>{
  const base=structuredClone(DEMO_PROCESSES[0]);
  base.defesa={...base.defesa,localStatus:'CONFIRMADO',local:'Auditório',startAt:'2026-12-01T00:00:00Z',endAt:'2026-12-01T01:30:00Z'};
  const p=(protocolo: string, defesa: Partial<typeof base.defesa> = {})=>({...base,protocolo,defesa:{...base.defesa,...defesa}});
  const before=p('Confirmada');
  const unconfirmed=p('Ainda pendente',{localStatus:'PENDENTE'});
  const refused=p('Recusada',{reservationRevision:2,departmentResponse:{
    revision:2,decision:'UNAVAILABLE',startAt:base.defesa.startAt,endAt:base.defesa.endAt,respondedAt:base.defesa.startAt,respondedBy:'teste@example.invalid',
  }});
  const nextMonth=p('Dezembro',{startAt:'2026-12-01T16:30:00Z',endAt:''});
  const rows=confirmedReservations([unconfirmed,nextMonth,refused,before],2026,10);
  assert.equal(rows.length,1);
  assert.match(rows[0][0],/30\/11\/2026/);
  assert.equal(rows[0][1],'21:00 – 22:30');
  assert.equal(rows[0][3],'Confirmada');
  assert.equal(confirmedReservations([nextMonth],2026,11)[0][1],'13:30 – 15:00');
  const pdf=await buildConfirmedReservationsPdf({rows:Array.from({length:44},()=>rows[0]),period:'Novembro de 2026',courseName:'Curso de Enfermagem'});
  const document=await PDFDocument.load(pdf);
  assert.ok(document.getPages().length>1);
  assert.equal(document.getTitle(),'Reservas confirmadas · Novembro de 2026');
});
