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
const fixedLocations = ['Auditório do Departamento', 'Sala de Reuniões'];

test('novo pedido retorna dados propostos sem modificar a reserva vigente', () => {
  const before = JSON.stringify(process.defesa);
  const next = validateReservationChange(
    { date: '2026-11-06', time: '14:00', locationChoice: 'Sala de Reuniões' },
    process, fixedLocations, 90,
  );
  assert.equal(next.startAt, '2026-11-06T17:00:00.000Z');
  assert.equal(next.endAt, '2026-11-06T18:30:00.000Z');
  assert.equal(next.local, 'Sala de Reuniões');
  assert.equal(JSON.stringify(process.defesa), before);
});

test('outro local é normalizado, com sigla marcada preservada', () => {
  const next = validateReservationChange(
    { date: '2026-11-06', time: '14:00', locationChoice: OTHER_DEFENSE_LOCATION, customLocation: 'AUDITÓRIO CENTRAL DA *UFES*' },
    process, fixedLocations, 90,
  );
  assert.equal(next.custom, true);
  assert.equal(next.local, 'Auditório Central da UFES');
});

test('finais de semana e locais não cadastrados continuam bloqueados', () => {
  for(const date of ['2026-11-07','2026-11-08']){
    assert.throws(()=>validateReservationChange({date,time:'14:00',locationChoice:fixedLocations[0]},process,fixedLocations,90),/segunda a sexta-feira/);
  }
  assert.throws(
    () => validateReservationChange({ date: '2026-11-06', time: '14:00', locationChoice: 'Local inventado' }, process, fixedLocations, 90),
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

test('datas retrospectivas e horários noturnos conservam a precisão de minuto e 90 minutos de duração', () => {
  const next=validateReservationChange({date:'2020-11-06',time:'23:47',locationChoice:fixedLocations[0]},process,fixedLocations,90);
  assert.equal(next.startAt,'2020-11-07T02:47:00.000Z');
  assert.equal(next.endAt,'2020-11-07T04:17:00.000Z');
  assert.throws(()=>validateReservationChange({date:'2026-02-30',time:'23:47',locationChoice:fixedLocations[0]},process,fixedLocations,90),/horário|data|fuso/);
  assert.throws(()=>validateReservationChange({date:'2026-11-06',time:'24:00',locationChoice:fixedLocations[0]},process,fixedLocations,90),/válidos/);
});
