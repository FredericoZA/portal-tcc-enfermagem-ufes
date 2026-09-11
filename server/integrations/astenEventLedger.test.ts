import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProcessData } from '../../src/types';
import { buildAstenOperationalDashboard, buildCanonicalSignaturePlan, mapAstenEventToJobStatus, normalizeAstenWebhookEvent, publicationAuthorizationRequired, reduceAstenTimeline } from './astenEventLedger';

const processFixture = {
  id: 'p1', protocolo: 'TCC-1', titulo: 'Teste', etapaAtual: 'ASSINATURA', status: 'AGUARDANDO_ASSINATURA', createdByEmail: 'a@ufes.br',
  aluno1: { nome: 'Ana', matricula: '1', email: 'a@ufes.br' }, aluno2: { nome: 'Bia', matricula: '2', email: 'b@ufes.br' },
  orientador: { nome: 'Prof.', email: 'prof@ufes.br' }, coorientador: null, banca: [],
  defesa: { startAt: '', endAt: '', local: '' }, avaliacao: { status: 'CONCLUIDO' },
  acervo: { publishFullWork: true, trabalhoCompletoFileId: 'drive-work' }, dataRevision: 1, createdAt: '', updatedAt: ''
} satisfies ProcessData;

test('termo usa aluno(s) e orientador na mesma ordem 1', () => {
  const plan = buildCanonicalSignaturePlan(processFixture, 'TERMO', { name: 'Presidente', email: 'pres@ufes.br' });
  assert.equal(plan.required, true);
  assert.deepEqual(plan.signers.map((item) => item.order), [1, 1, 1]);
  assert.deepEqual(plan.signers.map((item) => item.role), ['STUDENT', 'STUDENT', 'ADVISOR']);
});

test('termo não é requerido quando não existe escolha de publicação', () => {
  const privateProcess = { ...processFixture, acervo: { ...processFixture.acervo, publishFullWork: false, publishExpandedAbstract: false } };
  assert.equal(publicationAuthorizationRequired(privateProcess), false);
  assert.equal(buildCanonicalSignaturePlan(privateProcess, 'TERMO', { name: 'P', email: 'p@ufes.br' }).required, false);
});

test('webhook remove segredos, detecta duplicata e consolida painel', () => {
  const payload = { idEnvelope: 77, evento: 'envelope assinado', tokenAPI: 'nao-pode-vazar', nested: { conteudoBase64: 'segredo' } };
  const first = normalizeAstenWebhookEvent({ payload, receivedAt: '2026-08-01T10:00:00.000Z', jobs: [{ id: 'j1', processId: 'p1', protocol: 'TCC-1', documentType: 'ATA', status: 'SENT', providerEnvelopeId: '77', updatedAt: '' }] });
  const duplicate = normalizeAstenWebhookEvent({ payload, receivedAt: '2026-08-01T10:01:00.000Z', knownFingerprints: new Set([first.fingerprint]) });
  assert.equal(first.status, 'SIGNED');
  assert.equal('tokenAPI' in first.safePayload, false);
  assert.equal('nested' in first.safePayload, false);
  assert.deepEqual(Object.keys(first.safePayload).sort(), ['envelopeId', 'event']);
  assert.equal(duplicate.duplicate, true);
  assert.equal(reduceAstenTimeline([first, duplicate]).length, 1);
  const dashboard = buildAstenOperationalDashboard({ jobs: [{ id: 'j1', processId: 'p1', protocol: 'TCC-1', documentType: 'ATA', status: 'DRIVE_SYNC_PENDING', providerEnvelopeId: '77', updatedAt: '' }], events: [first, duplicate], now: '2026-08-01T11:00:00.000Z' });
  assert.equal(dashboard.duplicateEvents, 1);
  assert.equal(dashboard.needsAttention.length, 1);
});

test('assinatura concluída permite retomar arquivamento pendente no Drive',()=>{
  assert.equal(mapAstenEventToJobStatus('SIGNED','DRIVE_SYNC_PENDING'),'SIGNED');
  assert.equal(mapAstenEventToJobStatus('SENT','DRIVE_SYNC_PENDING'),'DRIVE_SYNC_PENDING');
});
