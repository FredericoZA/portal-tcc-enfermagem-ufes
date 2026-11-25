import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { buildConfirmedReservationsPdf } from '../src/utils/confirmedReservationsPdf';
import { confirmedReservations, formatReservationPeriod, reservationPeriodError } from '../src/utils/confirmedReservations';
import { DEMO_PROCESSES } from '../src/services/demoSeed';

test('PDF reservations use their current decision and Brasília time for an inclusive period across months', async()=>{
  const base=structuredClone(DEMO_PROCESSES[0]);
  base.defesa={...base.defesa,localStatus:'CONFIRMADO',local:'Auditório',startAt:'2026-12-01T00:00:00Z',endAt:'2026-12-01T01:30:00Z'};
  const p=(protocolo: string, defesa: Partial<typeof base.defesa> = {})=>({...base,protocolo,defesa:{...base.defesa,...defesa}});
  const before=p('Confirmada');
  const unconfirmed=p('Ainda pendente',{localStatus:'PENDENTE'});
  const refused=p('Recusada',{reservationRevision:2,departmentResponse:{
    revision:2,decision:'UNAVAILABLE',startAt:base.defesa.startAt,endAt:base.defesa.endAt,respondedAt:base.defesa.startAt,respondedBy:'teste@example.invalid',
  }});
  const nextMonth=p('Dezembro',{startAt:'2026-12-01T16:30:00Z',endAt:''});
  const fixture=[unconfirmed,nextMonth,refused,before];
  const period={startDate:'2026-11-30',endDate:'2026-12-01'};
  const rows=confirmedReservations(fixture,period);
  assert.equal(rows.length,2);
  assert.equal(rows[1][1],'13:30 – 15:00');
  assert.match(rows[0][0],/30\/11\/2026/);
  assert.equal(rows[0][1],'21:00 – 22:30');
  assert.equal(rows[0][3],'Confirmada');
  const oneDay={startDate:'2026-12-01',endDate:'2026-12-01'};
  assert.deepEqual(confirmedReservations(fixture,oneDay).map(row=>row[3]),['Dezembro']);
  assert.equal(formatReservationPeriod(oneDay),'01/12/2026');
  assert.equal(reservationPeriodError(period),'');
  assert.ok(reservationPeriodError({startDate:'2026-12-01',endDate:'2026-11-30'}));
  assert.ok(reservationPeriodError({startDate:'2026-02-29',endDate:'2026-03-02'}));
  assert.ok(reservationPeriodError({startDate:'',endDate:'2026-03-02'}));
  assert.equal(reservationPeriodError({startDate:'2028-02-29',endDate:'2028-02-29'}),'');
  const pdf=await buildConfirmedReservationsPdf({rows:Array.from({length:44},()=>rows[0]),period:formatReservationPeriod(period),courseName:'Curso de Enfermagem'});
  const document=await PDFDocument.load(pdf);
  assert.ok(document.getPages().length>1);
  assert.equal(document.getTitle(),'Reservas confirmadas · 30/11/2026 a 01/12/2026');
});
