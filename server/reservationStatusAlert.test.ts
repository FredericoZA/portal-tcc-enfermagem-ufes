import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { ProcessData } from '../src/types';
import { OTHER_DEFENSE_LOCATION } from '../src/utils/customDefenseLocation';
import { reservationStatusAlert } from '../src/utils/reservationStatusAlert';

const process = (localStatus: string, requestStatus = '', locationChoice = '') => ({
  defesa: {
    startAt: '2026-11-06T17:00:00Z',
    endAt: '2026-11-06T18:30:00Z',
    local: 'Auditório do Departamento',
    localStatus,
    ...(requestStatus ? {
      reservationChangeRequest: {
        status: requestStatus,
        locationChoice,
      },
    } : {}),
  },
  registrationAnswers: { DEFESA_LOCAL: 'Auditório do Departamento' },
}) as unknown as ProcessData;

test('negativa do departamento mostra somente a mensagem exata da recusa', () => {
  const alert = reservationStatusAlert(process('NEGADO'));
  assert.deepEqual(alert, {
    kind: 'denied',
    text: 'O responsável recusou o agendamento. Use “Solicitar nova data” para enviar outro pedido de reserva.',
  });
});

test('resposta salva prevalece sobre PENDENTE e sobre aviso antigo de envio, sem confundir revisões', () => {
  const p = process('PENDENTE', 'SENT');
  p.defesa.departmentResponse = {revision: 0, decision: 'UNAVAILABLE', respondedBy: 'secretaria@example.invalid', respondedAt: '2026-11-04T15:41:34.985Z', startAt: p.defesa.startAt, endAt: p.defesa.endAt};
  assert.equal(reservationStatusAlert(p)?.kind, 'denied');
  p.defesa.departmentResponse.decision = 'CONFIRMED';
  assert.equal(reservationStatusAlert(p), null);
  p.defesa.reservationRevision = 1;
  assert.equal(reservationStatusAlert(p)?.kind, 'waiting', 'resposta de uma reserva anterior não resolve o pedido novo');
});

test('recusa prevalece sobre pedido pendente: não mostra simultaneamente a mensagem de espera', () => {
  const alert = reservationStatusAlert(process('RECUSADO', 'SENT'));
  assert.equal(alert?.kind, 'denied');
  assert.equal(alert?.text.includes('Aguardando'), false);
});

test('recusa de novo pedido exibe a mesma mensagem sem observação extra', () => {
  const alert = reservationStatusAlert(process('PENDENTE', 'DENIED'));
  assert.equal(alert?.kind, 'denied');
});

test('aviso de aguardando resposta é um alerta e identifica o departamento', () => {
  const alert = reservationStatusAlert(process('PENDENTE'));
  assert.equal(alert?.kind, 'waiting');
  assert.equal(alert?.text, 'Aguardando o aceite ou a recusa do departamento pelo pedido enviado por e-mail.');
});

test('pedido de outro local identifica o orientador sem misturar mensagens', () => {
  const alert = reservationStatusAlert(process('CONFIRMADO', 'SENT', OTHER_DEFENSE_LOCATION));
  assert.equal(alert?.kind, 'waiting');
  assert.match(alert?.text || '', /orientador/);
});

test('falha no envio possui mensagem própria e confirmação não gera alerta', () => {
  assert.equal(reservationStatusAlert(process('CONFIRMADO', 'SEND_FAILED'))?.kind, 'delivery-failed');
  assert.equal(reservationStatusAlert(process('CONFIRMADO')), null);
});

test('componente usa um único bloco vermelho para avisos e botão vermelho na recusa', () => {
  const src = readFileSync(new URL('../src/components/ProcessSummaryCard.tsx', import.meta.url), 'utf8');
  assert.match(src, /const alert = reservationStatusAlert\(process\)/);
  assert.match(src, /const denial = alert\?\.kind === 'denied'/);
  assert.match(src, /\{alert && \([\s\S]*?role="alert"[\s\S]*?border-red-300 bg-red-50/);
  assert.match(src, /denial[\s\S]*?'border-red-700 bg-red-700/);
  assert.doesNotMatch(src, /A reserva foi recusada\. É necessário enviar uma nova solicitação/);
  assert.doesNotMatch(src, /Nova solicitação de reserva aguardando confirmação do responsável\./);
});
