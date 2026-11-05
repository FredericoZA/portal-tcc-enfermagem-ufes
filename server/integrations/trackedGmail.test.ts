import test from 'node:test';
import assert from 'node:assert/strict';
import { GmailDeliveryError } from './gmailDeliveryError';
import { dispatchTrackedEmail, dueEmailRetries, emailDeliveryIdempotencyKey, MemoryEmailDeliveryJournal, type EmailDeliveryJournal } from './trackedGmail';
import type {EmailDeliveryRecord} from '../../src/types/automation';

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
  const ports = { journal, now: () => now, send: async () => { throw new GmailDeliveryError('Gmail respondeu 503.','REJECTED',503); } };
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
    send: async () => { throw new GmailDeliveryError('Gmail respondeu 503.','REJECTED',503); }
  });

  assert.equal(record.status, 'RETRY');
  assert.equal(record.workflowEventCode, 'FORM_PARECER_SUBMITTED');
  assert.deepEqual(record.workflowEventVariables, { PARECER_PERSONALIZADO: 'Texto do formulário' });
});

test('persiste a reivindicação antes do Gmail e não chama o provedor se o commit falha', async () => {
  let sends=0;
  const journal:EmailDeliveryJournal={async findByIdempotencyKey(){return null;},async save(record){assert.equal(record.dispatchState,'SENDING');assert.ok(record.dispatchLeaseUntil);throw Error('Conflito de concorrência');}};
  await assert.rejects(dispatchTrackedEmail({recipient:'author@example.invalid',subject:'Aviso',text:'Teste',idempotencyKey:'claim-conflict'},{journal,send:async()=>{sends++;}}),/Conflito/);
  assert.equal(sends,0);
});

test('duas chamadas simultâneas na mesma instância compartilham o envio', async () => {
  const journal=new MemoryEmailDeliveryJournal();let sends=0;
  const input={recipient:'author@example.invalid',subject:'Aviso',text:'Teste',idempotencyKey:'concurrent-local'};
  const ports={journal,send:async()=>{sends++;await Promise.resolve();return{id:'single'};}};
  const [first,second]=await Promise.all([dispatchTrackedEmail(input,ports),dispatchTrackedEmail(input,ports)]);
  assert.equal(sends,1);assert.equal(first.status,'ACCEPTED_BY_GMAIL');assert.equal(first.id,second.id);assert.equal(first.attempts.length,1);
});

test('duas instâncias com revisão CAS enviam somente após vencer o claim durável', async () => {
  let revision=0,stored:EmailDeliveryRecord|null=null,sends=0;
  const instance=():EmailDeliveryJournal=>{let readRevision=0;return{async findByIdempotencyKey(){readRevision=revision;return stored?structuredClone(stored):null;},async save(record){if(readRevision!==revision)throw Error('Conflito de concorrência');stored=structuredClone(record);readRevision=++revision;}};};
  const input={recipient:'author@example.invalid',subject:'Aviso',text:'Teste',idempotencyKey:'concurrent-cas'};
  const send=async()=>{sends++;await Promise.resolve();return{id:'claimed'};};
  const results=await Promise.allSettled([dispatchTrackedEmail(input,{journal:instance(),send}),dispatchTrackedEmail(input,{journal:instance(),send})]);
  assert.equal(sends,1);assert.equal(results.filter(item=>item.status==='fulfilled').length,1);assert.equal(results.filter(item=>item.status==='rejected').length,1);
  assert.equal((stored as EmailDeliveryRecord|null)?.status,'ACCEPTED_BY_GMAIL');
});

test('timeout após chamar o provedor permanece incerto e não é reenviado automaticamente', async () => {
  const journal=new MemoryEmailDeliveryJournal();let sends=0;
  const input={recipient:'author@example.invalid',subject:'Aviso',text:'Teste',idempotencyKey:'uncertain'};
  const first=await dispatchTrackedEmail(input,{journal,send:async()=>{sends++;throw new GmailDeliveryError('O POST excedeu o tempo limite.','UNCERTAIN');}});
  assert.equal(first.status,'FAILED');assert.equal(first.dispatchState,'UNCERTAIN');assert.equal(first.attempts[0].errorCode,'GMAIL_DELIVERY_UNCERTAIN');assert.equal(first.nextRetryAt,undefined);
  assert.deepEqual(dueEmailRetries([first],new Date(Date.now()+86400000)),[]);
  const repeated=await dispatchTrackedEmail(input,{journal,send:async()=>{sends++;return{id:'unexpected'};}});
  assert.equal(sends,1);assert.equal(repeated.attempts.length,1);assert.equal(repeated.dispatchState,'UNCERTAIN');
  repeated.maxAttempts=10;repeated.nextRetryAt=new Date().toISOString();await journal.save(repeated);
  const forcedLegacyRetry=await dispatchTrackedEmail(input,{journal,send:async()=>{sends++;return{id:'unexpected-retry'};}});
  assert.equal(sends,1);assert.equal(forcedLegacyRetry.dispatchState,'UNCERTAIN');assert.equal(forcedLegacyRetry.attempts.length,1);
});

test('claim abandonado torna-se incerto; falha no commit do resultado não causa outro envio', async () => {
  let stored:EmailDeliveryRecord|null=null,saves=0,sends=0;let now=new Date('2026-11-04T12:00:00Z');
  const journal:EmailDeliveryJournal={async findByIdempotencyKey(){return stored?structuredClone(stored):null;},async save(record){saves++;if(saves===2)throw Error('Falha no commit final');stored=structuredClone(record);}};
  const input={recipient:'author@example.invalid',subject:'Aviso',text:'Teste',idempotencyKey:'accepted-uncommitted'};
  const ports={journal,now:()=>now,send:async()=>{sends++;return{id:'provider-accepted'};}};
  await assert.rejects(dispatchTrackedEmail(input,ports),/commit final/);
  assert.equal((stored as EmailDeliveryRecord|null)?.dispatchState,'SENDING');
  const active=await dispatchTrackedEmail(input,ports);assert.equal(active.dispatchState,'SENDING');assert.equal(sends,1);
  now=new Date('2026-11-04T12:03:00Z');const stale=await dispatchTrackedEmail(input,ports);
  assert.equal(stale.dispatchState,'UNCERTAIN');assert.equal(stale.status,'FAILED');assert.equal(sends,1);assert.equal(stale.attempts.length,1);assert.equal(stale.attempts[0].startedAt,'2026-11-04T12:00:00.000Z');
});

test('falha comprovada antes do envio e rejeição temporária são elegíveis para nova tentativa', async () => {
  for(const failure of [new GmailDeliveryError('Conta Google ainda não autorizada.','NOT_SENT'),new GmailDeliveryError('Quota temporariamente esgotada.','REJECTED',429)]){
    const journal=new MemoryEmailDeliveryJournal(),now=new Date('2026-11-04T12:00:00Z');
    const record=await dispatchTrackedEmail({recipient:'author@example.invalid',subject:'Aviso',text:'Teste',idempotencyKey:failure.deliveryOutcome},{journal,now:()=>now,send:async()=>{throw failure;}});
    assert.equal(record.status,'RETRY');assert.equal(record.dispatchState,undefined);assert.ok(record.nextRetryAt);
    assert.equal(dueEmailRetries([record],new Date(record.nextRetryAt!)).length,1);
  }
});

test('mensagem de exceção sem resultado estruturado não comprova rejeição do Gmail',async()=>{
  const journal=new MemoryEmailDeliveryJournal();
  const record=await dispatchTrackedEmail({recipient:'author@example.invalid',subject:'Aviso',text:'Teste',idempotencyKey:'unknown-error'},{journal,send:async()=>{throw Error('Gmail respondeu 503.');}});
  assert.equal(record.status,'FAILED');assert.equal(record.dispatchState,'UNCERTAIN');assert.equal(record.attempts[0].errorCode,'GMAIL_DELIVERY_UNCERTAIN');assert.equal(record.nextRetryAt,undefined);
});
