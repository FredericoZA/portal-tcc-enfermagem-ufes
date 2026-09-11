import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGmailRawMessage } from './googleWorkspace';

test('gera mensagem MIME com corpo alternativo e PDF anexado', () => {
  const raw = buildGmailRawMessage({
    to: 'destino@ufes.br',
    subject: 'Convite\r\nBcc: invasor@exemplo.com',
    text: 'Texto simples',
    html: '<p>Texto HTML</p>',
    attachments: [{ fileName: 'convite.pdf', mimeType: 'application/pdf', content: Buffer.from('%PDF-teste') }]
  }, 'teste');
  assert.match(raw, /multipart\/mixed; boundary="portal-tcc-mixed-teste"/);
  assert.match(raw, /multipart\/alternative; boundary="portal-tcc-alt-teste"/);
  assert.match(raw, /Content-Disposition: attachment; filename="convite\.pdf"/);
  assert.match(raw, /JVBERi10ZXN0ZQ==/);
  assert.doesNotMatch(raw, /\r\nBcc:/);
});

test('bloqueia anexos acima do limite seguro', () => {
  assert.throws(() => buildGmailRawMessage({
    to: 'destino@ufes.br', subject: 'Teste', text: 'Teste',
    attachments: [{ fileName: 'grande.pdf', mimeType: 'application/pdf', content: Buffer.alloc(20 * 1024 * 1024 + 1) }]
  }, 'limite'), /20 MB/);
});
