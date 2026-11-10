import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {publicCalendarView, publicRepositoryView} from './publicViews';
import {reservationReceipts, reservationReceiptStatus} from './reservationReceipts';
import {restartReservation} from './workflow/reservationReschedule';
import type {ProcessData} from '../src/types';

type Defense = ProcessData['defesa'];
function answered(revision: number, decision: 'CONFIRMED' | 'UNAVAILABLE' = 'UNAVAILABLE'): Defense {
  const day = String(revision + 10).padStart(2, '0');
  return {
    reservationRevision: revision,
    startAt: `2026-11-${day}T17:00:00Z`, endAt: `2026-11-${day}T18:30:00Z`,
    local: `Sala ${revision}`, localStatus: decision === 'CONFIRMED' ? 'CONFIRMADO' : 'RECUSADO',
    departmentResponse: {
      revision, decision, startAt: `2026-11-${day}T17:00:00Z`, endAt: `2026-11-${day}T18:30:00Z`,
      local: decision === 'CONFIRMED' ? `Sala ${revision}` : undefined,
      respondedAt: `2026-11-04T${String(revision + 10).padStart(2, '0')}:00:00Z`,
      respondedBy: 'private-responder@example.invalid',
      receiptBody: `Título: Trabalho original ${revision}\nAutor: Autora da Solicitação\nLocal: Sala ${revision}`,
    },
  };
}
function fixture(): ProcessData {
  const process = structuredClone(DEMO_PROCESSES[0]);
  process.defesa = answered(2);
  process.defesa.reservationHistory = [0, 1].map(revision => ({
    ...answered(revision, revision === 1 ? 'CONFIRMED' : 'UNAVAILABLE'),
    invalidatedAt: '2026-11-04T15:00:00Z', invalidatedBy: 'private-actor@example.invalid',
  }));
  return process;
}

test('one receipt per answered revision, newest first, with independent outcome and original location', () => {
  const process = fixture();
  const before = structuredClone(process);
  const receipts = reservationReceipts(process);
  assert.deepEqual(receipts.map(item => item.summary.id), ['revision-2', 'revision-1', 'revision-0']);
  assert.deepEqual(receipts.map(item => item.summary.current), [true, false, false]);
  assert.deepEqual(receipts.map(item => item.summary.decision), ['UNAVAILABLE', 'CONFIRMED', 'UNAVAILABLE']);
  assert.equal(receipts[2].process.defesa.local, 'Sala 0');
  assert.equal(receipts[2].process.defesa.startAt, '2026-11-10T17:00:00Z');
  assert.equal(receipts[2].process.defesa.reservationHistory, undefined);
  assert.equal(receipts[2].process.orientador.nome, '', 'do not attribute current board to an unrecorded historical board');
  assert.deepEqual(process, before, 'selection must not mutate source or history');
});

test('response and proof of the same revision count once and the current response wins', () => {
  const process = fixture();
  process.defesa.locationProof = {driveFileId: 'private-drive-id', reservationRevision: 2, fileName: 'original.pdf', version: 1, sha256: 'private-hash', uploadedAt: '2026-11-04T12:00:00Z', uploadedBy: 'private-uploader@example.invalid'};
  process.defesa.reservationHistory!.push({...answered(2, 'CONFIRMED'), invalidatedAt: '', invalidatedBy: ''});
  const receipts = reservationReceipts(process);
  assert.equal(receipts.length, 3);
  assert.equal(receipts[0].summary.decision, 'UNAVAILABLE');
  assert.equal(receipts[0].summary.current, true);
});

test('pending request retains answered history without counting an unanswered request or upload as a receipt', () => {
  const process = fixture();
  process.defesa.departmentResponse = undefined;
  process.defesa.localStatus = 'PENDENTE';
  process.defesa.locationProof = {driveFileId: 'private-file', fileName: 'uploaded.pdf', version: 1, sha256: 'private-hash', uploadedAt: '2026-11-04T12:00:00Z', uploadedBy: 'private-uploader@example.invalid'};
  assert.equal(reservationReceiptStatus(process), 'PENDENTE');
  assert.equal(reservationReceipts(process).length, 2);
  assert.ok(reservationReceipts(process).every(item => !item.summary.current));
  for (const view of [publicCalendarView(process), publicRepositoryView(process)]) {
    assert.equal(view.defesa.hasReservationReceipt, true);
    assert.equal(view.defesa.reservationReceiptCount, 2);
    assert.equal(view.defesa.localStatus, 'PENDENTE');
  }
  process.defesa.reservationHistory = [];
  assert.equal(reservationReceipts(process).length, 0);
});

test('recorded rejection overrides an inconsistent pending raw field', () => {
  const process = fixture();
  process.defesa.localStatus = 'PENDENTE';
  assert.equal(reservationReceiptStatus(process), 'RECUSADO');
  for (const status of ['NEGADO', 'REJEITADO', 'RECUSADO'] as const) {
    process.defesa.departmentResponse = undefined;
    process.defesa.localStatus = status;
    assert.equal(reservationReceiptStatus(process), 'RECUSADO');
  }
});

test('stale response cannot overwrite a preserved receipt of the same revision or borrow new location', () => {
  const process = fixture();
  process.defesa.departmentResponse = answered(0).departmentResponse;
  process.defesa.departmentResponse!.receiptBody = '';
  process.defesa.local = 'Sala da nova solicitação';
  process.defesa.localStatus = 'PENDENTE';
  const receipts = reservationReceipts(process);
  assert.equal(receipts.length, 2);
  assert.equal(receipts.find(item => item.summary.id === 'revision-0')!.summary.local, 'Sala 0');
  assert.equal(reservationReceiptStatus(process), 'PENDENTE');
  process.defesa.reservationHistory = [];
  const stale = reservationReceipts(process)[0];
  assert.equal(stale.summary.current, false);
  assert.equal(stale.summary.local, 'Local não informado no registro original');
});

test('old manual confirmations use opaque selectors without inventing a revision or treating missing evidence as confirmation', () => {
  const process = fixture();
  process.defesa = {startAt: '2026-11-12T17:00:00Z', endAt: '2026-11-12T18:30:00Z', local: 'Auditório', localStatus: 'PENDENTE', reservationHistory: [{
    startAt: '2026-11-10T17:00:00Z', endAt: '2026-11-10T18:30:00Z', local: 'Sala antiga', localStatus: 'CONFIRMADO',
    localConfirmedAt: '2026-11-04T10:00:00Z', localConfirmedBy: 'private-manual@example.invalid', invalidatedAt: '', invalidatedBy: '',
  }]};
  assert.equal(reservationReceipts(process)[0].summary.id, 'history-0');
  assert.equal(reservationReceipts(process)[0].summary.revision, undefined);
  process.defesa.reservationHistory![0].localConfirmedAt = undefined;
  assert.equal(reservationReceipts(process).length, 0);
  process.defesa.localStatus = 'CONFIRMADO';
  process.defesa.localConfirmedAt = '2026-11-04T11:00:00Z';
  assert.equal(reservationReceipts(process)[0].summary.id, 'current');
  process.defesa.localConfirmedAt = 'invalid-date';
  assert.equal(reservationReceipts(process).length, 0);
});

test('new reschedule stores factual context and revision while retaining stable process identity', () => {
  const before = fixture();
  const original = structuredClone(before);
  const next = restartReservation(before, {...before, titulo: 'Novo Título', defesa: {...before.defesa, startAt: '2026-12-10T17:00:00Z', local: 'Novo local'}}, 'author@example.invalid', '2026-11-04T15:00:00Z');
  assert.equal(next.id, before.id); assert.equal(next.protocolo, before.protocolo);
  assert.equal(next.defesa.reservationRevision, 3);
  const historical = next.defesa.reservationHistory!.at(-1)!;
  assert.equal(historical.reservationRevision, 2);
  assert.equal(historical.receiptContext!.titulo, original.titulo);
  assert.deepEqual(historical.receiptContext!.orientador, original.orientador);
  assert.deepEqual(historical.receiptContext!.banca, original.banca);
  before.aluno1.nome = 'Mutated later'; before.banca[0].nome = 'Mutated later';
  assert.deepEqual(historical.receiptContext!.aluno1, original.aluno1);
  assert.deepEqual(historical.receiptContext!.banca, original.banca);
  const selected = reservationReceipts(next)[0];
  assert.equal(selected.summary.id, 'revision-2');
  assert.equal(selected.process.titulo, original.titulo);
  assert.equal(selected.process.defesa.local, 'Sala 2');
  assert.equal(reservationReceiptStatus(next), 'PENDENTE');
});

test('public receipt summaries and projections omit private snapshots and original file identifiers', () => {
  const process = fixture();
  process.defesa.reservationHistory![0].receiptContext = {
    titulo: process.titulo, aluno1: {...process.aluno1, matricula: 'PRIVATE-REGISTRATION', email: 'private-student@example.invalid'},
    aluno2: null, orientador: process.orientador, coorientador: null, banca: process.banca,
  };
  const json = JSON.stringify({items: reservationReceipts(process).map(item => item.summary), calendar: publicCalendarView(process), repository: publicRepositoryView(process)});
  assert.doesNotMatch(json, /private-responder|private-actor|private-student|PRIVATE-REGISTRATION|receiptBody|receiptContext|respondedBy|reservationHistory|driveFileId/);
  assert.ok(reservationReceipts(process).every(item => item.summary.url.includes(`?receipt=${item.summary.id}`)));
});

test('new response emails link to the answered receipt rather than whichever reservation becomes latest', async () => {
  const {processEmailMessage} = await import('../src/utils/processEmailMessage');
  const process = fixture();
  for (const decision of ['CONFIRMED', 'UNAVAILABLE'] as const) {
    process.defesa.departmentResponse!.decision = decision;
    const message = processEmailMessage({process, recipient: process.aluno1.email, subject: 'Resposta', text: '', templateId: 'email-comprovante-reserva', baseUrl: 'https://portal.example', courseName: 'Enfermagem'});
    assert.match(message.html, /href="https:\/\/portal\.example\/api\/public\/processes\/[^\"]+\/reservation-receipt\?receipt=revision-2"/);
    assert.doesNotMatch(message.html, /href="[^\"]+\/reservation-receipt"/);
  }
});
