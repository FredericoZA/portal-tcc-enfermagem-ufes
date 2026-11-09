import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProcessFlowPanel } from '../src/components/ProcessFlowPanel';
import { ProcessSummaryCard } from '../src/components/ProcessSummaryCard';
import type { ProcessData } from '../src/types';
import { OTHER_DEFENSE_LOCATION } from '../src/utils/customDefenseLocation';
import { reservationStatusAlert } from '../src/utils/reservationStatusAlert';

const process = (localStatus: string, requestStatus = '', locationChoice = '') => ({
  defesa: {
    startAt: '2026-11-06T17:00:00Z',
    endAt: '2026-11-06T18:30:00Z',
    local: 'Auditório do Departamento de Enfermagem',
    localStatus,
    ...(requestStatus ? {
      reservationChangeRequest: {
        status: requestStatus,
        locationChoice,
      },
    } : {}),
  },
  registrationAnswers: { DEFESA_LOCAL: 'Auditório do Departamento de Enfermagem' },
}) as unknown as ProcessData;

test('negativa apresenta instruções distintas para autor, visitante e demais usuários', () => {
  const denied = process('NEGADO');
  assert.deepEqual(reservationStatusAlert(denied, 'other'), {
    kind: 'denied', text: 'A solicitação de reserva do local para a defesa não foi aprovada.',
  });
  assert.match(reservationStatusAlert(denied, 'visitor')?.text || '', /o aluno deverá fazer login.*“Refazer reserva”/);
  assert.match(reservationStatusAlert(denied, 'author')?.text || '', /clique em “Refazer reserva”/);
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

test('a espera acompanha o local vigente após troca entre local próprio e espaço do Departamento', () => {
  const custom = process('PENDENTE');
  custom.defesa.local = 'Sala Fictícia de Teste';
  assert.match(reservationStatusAlert(custom)?.text || '', /do orientador/);
  const managed = process('PENDENTE');
  managed.defesa.local = 'Sala de reuniões';
  managed.registrationAnswers = { DEFESA_LOCAL: OTHER_DEFENSE_LOCATION };
  assert.match(reservationStatusAlert(managed)?.text || '', /do departamento/);
  const namedChoice = process('PENDENTE', 'SENT', 'Laboratório externo');
  assert.match(reservationStatusAlert(namedChoice)?.text || '', /do orientador/);
});

test('falha no envio possui mensagem própria e confirmação não gera alerta', () => {
  assert.equal(reservationStatusAlert(process('CONFIRMADO', 'SEND_FAILED'))?.kind, 'delivery-failed');
  assert.equal(reservationStatusAlert(process('CONFIRMADO')), null);
});

test('recusa elimina a caixa operacional e mantém um aviso vermelho com Refazer reserva habilitado', () => {
  const storedDenial = process('RECUSADO', 'SENT');
  const savedResponse = process('PENDENTE', 'SENT');
  savedResponse.defesa.departmentResponse = {revision: 0, decision: 'UNAVAILABLE', respondedBy: 'secretaria@example.invalid', respondedAt: '2026-11-04T15:41:34.985Z', startAt: savedResponse.defesa.startAt, endAt: savedResponse.defesa.endAt};
  const requestDenial = process('PENDENTE', 'DENIED');
  for (const p of [storedDenial, savedResponse, requestDenial]) {
    const panel = renderToStaticMarkup(createElement(ProcessFlowPanel, {process: p, canConfirm: true, jobs: [], onUpdated: async () => {}}));
    assert.equal(panel, '', 'a recusa não possui caixa amarela ou ações duplicadas');
    const summary = renderToStaticMarkup(createElement(ProcessSummaryCard, {process: p, canEdit: false, canEditReservation: true, onUpdated: async () => {}}));
    assert.equal((summary.match(/role="alert"/g) || []).length, 1);
    assert.match(summary, /role="alert"[^>]*bg-red-50/);
    assert.match(summary, /não foi aprovada/);
    assert.match(summary, /text-center font-bold/);
    const button = summary.match(/<button[^>]*aria-label="Refazer reserva"[^>]*>[\s\S]*?<\/button>/)?.[0] || '';
    assert.match(button, /border-red-700 bg-red-700/);
    assert.match(button, />Refazer reserva<\/button>/);
    assert.doesNotMatch(button, /disabled=/);
    assert.doesNotMatch(summary, /Aguardando o aceite|Solicitar nova data/);
  }
});

test('visitante e orientador não recebem botão para refazer uma reserva recusada', () => {
  const p = process('RECUSADO');
  const render = (isAuthenticated: boolean) => renderToStaticMarkup(createElement(ProcessSummaryCard, {
    process: p, canEdit: isAuthenticated, isAuthenticated, onUpdated: async () => {},
  }));
  const visitor = render(false);
  const other = render(true);
  assert.match(visitor, /o aluno deverá fazer login/);
  assert.doesNotMatch(visitor, /<button[^>]+aria-label="Refazer reserva"/);
  assert.match(other, /não foi aprovada/);
  assert.doesNotMatch(other, /Refazer reserva/);
});

test('uma nova revisão pendente não herda a recusa nem o botão vermelho do pedido anterior', () => {
  const p = process('PENDENTE', 'SENT');
  p.defesa.reservationRevision = 1;
  p.defesa.departmentResponse = {revision: 0, decision: 'UNAVAILABLE', respondedBy: 'secretaria@example.invalid', respondedAt: '2026-11-04T15:41:34.985Z', startAt: p.defesa.startAt, endAt: p.defesa.endAt};
  const panel = renderToStaticMarkup(createElement(ProcessFlowPanel, {process: p, canConfirm: true, jobs: [], onUpdated: async () => {}}));
  assert.match(panel, /Aguardando o aceite ou a recusa/);
  assert.doesNotMatch(panel, /Abrir comprovante/);
  assert.doesNotMatch(panel, /recusou|indisponibilidade|Solicitar nova data/);
  const summary = renderToStaticMarkup(createElement(ProcessSummaryCard, {process: p, canEdit: false, canEditReservation: true, onUpdated: async () => {}}));
  assert.match(summary, /Aguardando o aceite ou a recusa/);
  assert.match(summary, /Alterar reserva da defesa/);
  assert.doesNotMatch(summary, /Refazer reserva|Reserva negada/);
});

test('componente usa um único bloco vermelho para avisos e botão de reserva vermelho', () => {
  const src = readFileSync(new URL('../src/components/ProcessSummaryCard.tsx', import.meta.url), 'utf8');
  assert.match(src, /const alert = reservationStatusAlert\(process, /);
  assert.match(src, /const denial = alert\?\.kind === 'denied'/);
  assert.match(src, /\{alert && \([\s\S]*?role="alert"[\s\S]*?border-red-300 bg-red-50/);
  assert.match(src, /onClick=\{openReservation\}[^>]*className="[^"]*border-red-700 bg-red-700/);
  assert.doesNotMatch(src, /A reserva foi recusada\. É necessário enviar uma nova solicitação/);
  assert.doesNotMatch(src, /Nova solicitação de reserva aguardando confirmação do responsável\./);
});

test('dados do processo confirmam a reserva vigente e orientam apenas quem pode alterá-la', () => {
  const render = (p: ProcessData, canEditReservation: boolean) => renderToStaticMarkup(createElement(ProcessSummaryCard, {
    process: p, canEdit: false, canEditReservation, onUpdated: async () => {},
  }));
  const confirmed = process('CONFIRMADO');
  confirmed.defesa.invitationSentAt = '2026-11-04T15:41:34.985Z';
  assert.match(render(confirmed, true), /role="status"[^>]*>.*Reserva confirmada\..*A mudança inicia uma nova solicitação/);
  assert.match(render(confirmed, false), /Reserva confirmada\./);
  assert.doesNotMatch(render(confirmed, false), /Alterar reserva/);
  assert.doesNotMatch(render(process('CONFIRMADO', 'SENT'), true), /Reserva confirmada\./);
  assert.doesNotMatch(render(process('RECUSADO'), true), /Reserva confirmada\./);
});

test('aviso orienta a consultar o próprio e-mail apenas na visão do orientador destinatário', () => {
  const pending = process('PENDENTE', 'SENT', OTHER_DEFENSE_LOCATION);
  pending.defesa.reservationChangeRequest!.recipient = 'Orientador@Example.Invalid';
  const advisor = 'orientador@example.invalid';

  assert.match(reservationStatusAlert(pending, 'other', undefined, advisor)?.text || '', /pedido enviado para o seu e-mail/);
  assert.match(reservationStatusAlert(pending)?.text || '', /do orientador/);
  assert.match(reservationStatusAlert(pending, 'other', undefined, 'outro@example.invalid')?.text || '', /do orientador/);

  pending.defesa.reservationChangeRequest!.locationChoice = 'Auditório do Departamento de Enfermagem';
  assert.match(reservationStatusAlert(pending, 'other', undefined, advisor)?.text || '', /do departamento/);
});

test('atalho para a caixa de entrada aparece somente para o orientador destinatário enquanto aguarda resposta', () => {
  const pending = process('PENDENTE', 'SENT', OTHER_DEFENSE_LOCATION);
  pending.defesa.reservationChangeRequest!.recipient = 'orientador@ufes.br';
  const render = (advisorViewerEmail?: string) => renderToStaticMarkup(createElement(ProcessSummaryCard, {
    process: pending, canEdit: false, isAuthenticated: true, advisorViewerEmail,
    canEditReservation: true, onUpdated: async () => {},
  }));

  assert.match(render('orientador@ufes.br'), /href="https:\/\/mail\.google\.com\/"[^>]*>.*Acessar e-mail para responder/);
  assert.match(render('orientador@ufes.br'), /<button(?![^>]* disabled=)[^>]*aria-label="Alterar reserva da defesa"/);
  assert.doesNotMatch(render('outro@ufes.br'), /Acessar e-mail para responder/);
  assert.match(render(), /Alterar reserva/);
  pending.defesa.reservationChangeRequest!.status = 'DENIED';
  assert.doesNotMatch(render('orientador@ufes.br'), /Acessar e-mail para responder/);
});
