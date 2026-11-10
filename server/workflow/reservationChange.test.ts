import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ProcessData } from '../../src/types';
import { OTHER_DEFENSE_LOCATION } from '../../src/utils/customDefenseLocation';
import { buildReservationChangeEmail, validateReservationChange } from './reservationChange';

const process = {
  protocolo: 'TCC-2026-0010',
  titulo: 'Segurança do paciente no SUS',
  aluno1: { nome: 'Ana Silva' },
  aluno2: null,
  orientador: { nome: 'João Alves', email: 'orientador@ufes.br' },
  defesa: {
    startAt: '2026-11-02T17:00:00.000Z',
    endAt: '2026-11-02T18:30:00.000Z',
    local: 'Auditório do Departamento',
    localStatus: 'CONFIRMADO',
  },
} as unknown as ProcessData;
const now = new Date('2026-11-03T09:00:00.000Z');
const fixedLocations = ['Auditório do Departamento', 'Sala de Reuniões'];

test('novo pedido retorna dados propostos sem modificar a reserva vigente', () => {
  const before = JSON.stringify(process.defesa);
  const next = validateReservationChange(
    { date: '2026-11-06', time: '14:00', locationChoice: 'Sala de Reuniões' },
    process, fixedLocations, 90, now,
  );
  assert.equal(next.startAt, '2026-11-06T17:00:00.000Z');
  assert.equal(next.endAt, '2026-11-06T18:30:00.000Z');
  assert.equal(next.local, 'Sala de Reuniões');
  assert.equal(JSON.stringify(process.defesa), before);
});

test('outro local é normalizado, com sigla marcada preservada', () => {
  const next = validateReservationChange(
    { date: '2026-11-06', time: '14:00', locationChoice: OTHER_DEFENSE_LOCATION, customLocation: 'AUDITÓRIO CENTRAL DA *UFES*' },
    process, fixedLocations, 90, now,
  );
  assert.equal(next.custom, true);
  assert.equal(next.local, 'Auditório Central da UFES');
});

test('finais de semana, datas passadas e locais não cadastrados são bloqueados', () => {
  for(const date of ['2026-11-07','2026-11-08']){
    assert.throws(()=>validateReservationChange({date,time:'14:00',locationChoice:fixedLocations[0]},process,fixedLocations,90,now),/segunda a sexta-feira/);
  }
  assert.throws(()=>validateReservationChange({date:'2026-10-30',time:'14:00',locationChoice:fixedLocations[0]},process,fixedLocations,90,now),/futuros/);
  assert.throws(
    () => validateReservationChange({ date: '2026-11-02', time: '14:00', locationChoice: fixedLocations[0] }, process, fixedLocations, 90, now),
    /futuros/,
  );
  assert.throws(
    () => validateReservationChange({ date: '2026-11-06', time: '14:00', locationChoice: 'Local inventado' }, process, fixedLocations, 90, now),
    /local publicado/,
  );
});

test('mensagem indica nova solicitação e conserva dados anteriores', () => {
  const message = buildReservationChangeEmail(process, {
    startAt: '2026-11-06T17:00:00.000Z', local: 'Sala de Reuniões',
  }, false);
  assert.match(message.subject, /Nova solicitação de reserva/);
  assert.match(message.text, /Reserva informada anteriormente/);
  assert.match(message.text, /Nova solicitação/);
  assert.match(message.text, /Auditório do Departamento/);
  assert.match(message.text, /Sala de Reuniões/);
  assert.match(message.text, /permanecerá no Portal/);
});
