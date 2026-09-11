import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchTrackedEmail, dueEmailRetries, emailDeliveryIdempotencyKey, MemoryEmailDeliveryJournal } from './trackedGmail';

test('não duplica envio já aceito pelo Gmail', async () => {
  const journal = new MemoryEmailDeliveryJournal();
  let sends = 0;
  const input = { processId: 'p1', recipient: 'Aluno@UFES.br', subject: 'Convite', text: 'Olá', idempotencyKey: 'fixed-key' };
  const ports = { journal, now: () => new Date('2026-08-01T10:00:00.000Z'), send: async () => { sends += 1; return { id: 'gmail-message-1', threadId: 'thread-1' }; } };
  const first = await dispatchTrackedEmail(input, ports);
  const second = await dispatchTrackedEmail(input, ports);
  assert.equal(first.status, 'ACCEPTED_BY_GMAIL');
  assert.equal(second.attempts.length, 1);
  assert.equal(sends, 1);
});

test('agenda retentativa exponencial e encerra no limite', async () => {
  const journal = new MemoryEmailDeliveryJournal();
  let now = new Date('2026-08-01T10:00:00.000Z');
  const ports = { journal, now: () => now, send: async () => { throw new Error('Gmail respondeu 503.'); } };
  const input = { recipient: 'aluno@ufes.br', subject: 'Aviso', text: 'Teste', idempotencyKey: 'retry-key', maxAttempts: 2 };
  const first = await dispatchTrackedEmail(input, ports);
  assert.equal(first.status, 'RETRY');
  assert.equal(dueEmailRetries([first], now).length, 0);
  now = new Date(first.nextRetryAt!);
  const final = await dispatchTrackedEmail(input, ports);
  assert.equal(final.status, 'FAILED');
  assert.equal(final.attempts.length, 2);
});

test('conteúdo diferente do anexo produz uma nova chave idempotente', () => {
  const base = { recipient: 'aluno@ufes.br', subject: 'Documento', text: 'Segue o PDF.' };
  const first = emailDeliveryIdempotencyKey({ ...base, attachments: [{ fileName: 'ata.pdf', mimeType: 'application/pdf', content: Buffer.from('pdf-versao-1') }] });
  const second = emailDeliveryIdempotencyKey({ ...base, attachments: [{ fileName: 'ata.pdf', mimeType: 'application/pdf', content: Buffer.from('pdf-versao-2') }] });
  assert.notEqual(first, second);
});

test('registra evento e variáveis necessárias para reconstruir uma falha', async () => {
  const journal = new MemoryEmailDeliveryJournal();
  const record = await dispatchTrackedEmail({
    processId: 'p1',
    recipient: 'aluno@ufes.br',
    subject: 'Parecer',
    text: 'Falha transitória',
    idempotencyKey: 'workflow-retry-key',
    workflowEventCode: 'FORM_PARECER_SUBMITTED',
    workflowEventVariables: { PARECER_PERSONALIZADO: 'Texto do formulário' }
  }, {
    journal,
    now: () => new Date('2026-08-01T10:00:00.000Z'),
    send: async () => { throw new Error('Gmail respondeu 503.'); }
  });

  assert.equal(record.status, 'RETRY');
  assert.equal(record.workflowEventCode, 'FORM_PARECER_SUBMITTED');
  assert.deepEqual(record.workflowEventVariables, { PARECER_PERSONALIZADO: 'Texto do formulário' });
});
