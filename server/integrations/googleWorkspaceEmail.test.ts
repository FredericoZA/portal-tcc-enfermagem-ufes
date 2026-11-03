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


test('HTML institucional mantém cores, alinhamento e acentos no MIME enviado ao Gmail',()=>{
 const html='<table><tr><td bgcolor="#005830" style="background-color:#005830;text-align:center">Curso de Graduação em Enfermagem e Obstetrícia</td></tr></table>'+('Texto com acentuação. '.repeat(120));
 const raw=buildGmailRawMessage({to:'department@example.invalid',subject:'Reserva',text:'Confirmação da reserva.',html},'institucional');
 const part=raw.split('--portal-tcc-alt-institucional')[2];
 assert.match(part,/Content-Type: text\/html; charset="UTF-8"/);assert.match(part,/Content-Transfer-Encoding: base64/);
 const encoded=part.split('\r\n\r\n')[1].trim();assert.equal(Buffer.from(encoded.replaceAll('\r\n',''),'base64').toString('utf8'),html);assert.ok(encoded.split('\r\n').every(line=>line.length<=76));
});

test('reply MIME keeps message identifiers for the original Gmail conversation',()=>{
 const raw=buildGmailRawMessage({to:'department@example.invalid',cc:['author@example.invalid'],subject:'Solicitação de reserva',text:'Reserva confirmada.',messageId:'reply@portal-tcc.local',inReplyTo:'request@portal-tcc.local',threadId:'gmail-thread'},'reply');
 assert.match(raw,/Message-ID: <reply@portal-tcc.local>/);
 assert.match(raw,/In-Reply-To: <request@portal-tcc.local>/);
 assert.match(raw,/References: <request@portal-tcc.local>/);
 assert.match(raw,/Cc: author@example.invalid/);
});
