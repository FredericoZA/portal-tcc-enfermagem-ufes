import test from 'node:test';
import assert from 'node:assert/strict';
import {emailAuditCopy, hasPersonalEmailAccess} from './emailAuditCopy';
import {dispatchTrackedEmail, MemoryEmailDeliveryJournal} from './trackedGmail';

const audit = 'tccenfermagemufes@gmail.com';

test('cópia de auditoria mantém o grupo e não duplica destinatários', () => {
  const result = emailAuditCopy({recipient:' Autor@example.invalid ', cc:['Orientador@example.invalid', 'orientador@example.invalid', 'AUTOR@example.invalid', audit.toUpperCase()], auditCopyEmail:audit, text:'Reserva recusada. Consulte o comprovante público.'});
  assert.deepEqual(result, {cc:['orientador@example.invalid',audit], auditCopyEmail:audit, auditCopyMode:'operational'});
  assert.deepEqual(emailAuditCopy({recipient:audit.toUpperCase(),text:'Aviso',auditCopyEmail:audit}).cc,[]);
});

test('comprovante público admite cópia, mas decisão pessoal, código e assinatura não admitem', () => {
  const publicReceipt = 'https://portal.example.invalid/api/public/processes/TCC-2026-0006/reservation-receipt';
  assert.deepEqual(emailAuditCopy({recipient:'author@example.invalid',text:publicReceipt,auditCopyEmail:audit}).cc,[audit]);
  for (const content of [
    'https://portal.example.invalid/api/reservation-confirmation/token-pessoal-123?decision=decline',
    '<a href="https://provider.example.invalid/signature/token-pessoal-123">Assinar</a>',
    'Seu código de acesso: 123456',
    'Código de confirmação: <strong>123456</strong>',
    'https://provider.example.invalid/link?token=personal',
    '<a href="https://provider.example.invalid/link?a=1&amp;access_token=personal">Entrar</a>',
  ]) {
    const result=emailAuditCopy({recipient:'responsavel@example.invalid',cc:['author@example.invalid'],text:content,auditCopyEmail:audit});
    assert.equal(result.auditCopyMode,'sensitive');assert.deepEqual(result.cc,[]);
  }
  assert.deepEqual(emailAuditCopy({recipient:'responsavel@example.invalid',text:'Mensagem protegida sem padrão conhecido.',auditCopyEmail:audit,auditCopyMode:'sensitive',cc:[audit]}).cc,[]);
});

test('configuração inválida ou cabeçalho injetado não vira destinatário de cópia', () => {
  assert.throws(()=>emailAuditCopy({recipient:'author@example.invalid',text:'Aviso',auditCopyEmail:'audit@example.invalid\r\nBcc: foreign@example.invalid'}),/auditoria inválido/);
  assert.throws(()=>emailAuditCopy({recipient:'author@example.invalid',text:'Aviso',auditCopyEmail:audit,cc:['foreign@example.invalid, another@example.invalid']}),/cópia inválido/);
});

test('conteúdo real do portalOtp e variações HTML não expõem o código para auditoria', () => {
  const code='012345';
  const portalText=`Seu código de acesso é ${code}. Ele expira em 10 minutos e só pode ser usado uma vez. Se você não solicitou este acesso, ignore esta mensagem.`;
  const portalHtml=`<div style="font-family:Arial,sans-serif"><h2>Portal de TCC</h2><p>Use o código abaixo para concluir seu acesso:</p><div style="font-size:30px;letter-spacing:8px">${code}</div><p>O código expira em 10 minutos e só pode ser usado uma vez.</p></div>`;
  for (const [text,html] of [
    [portalText,''],['',portalHtml],[portalText,portalHtml],
    ['Seu codigo de acesso eh 123456.',''],
    ['', '<p>Seu c&oacute;digo de acesso &eacute;&nbsp;<strong>123456</strong>.</p>'],
    ['', '<p>C&#243;digo de confirma&#231;&#227;o &#233; <strong>&#49;&#50;&#51;&#52;&#53;&#54;</strong></p>'],
    ['', '<p>Código de acesso é <b>123</b><span>456</span>.</p>'],
  ]) {
    assert.equal(hasPersonalEmailAccess(text,html),true);
    const result=emailAuditCopy({recipient:'student@example.invalid',cc:['foreign@example.invalid'],text,html,auditCopyEmail:audit});
    assert.equal(result.auditCopyMode,'sensitive');assert.deepEqual(result.cc,[]);
  }
  assert.equal(hasPersonalEmailAccess('O código de acesso expira em 10 minutos. Nenhum código foi solicitado.'),false);
});

test('envio registra as cópias efetivas e não repete o e-mail aceito ao habilitar auditoria', async () => {
  const journal=new MemoryEmailDeliveryJournal(),sent:Array<{to:string;cc?:string[]}>=[];
  const input={recipient:'author@example.invalid',subject:'Reserva',text:'Resposta ao agendamento.',cc:['advisor@example.invalid'],idempotencyKey:'accepted-original'};
  const send=async(message:{to:string;cc?:string[]})=>{sent.push(message);return{id:'gmail-accepted',threadId:'gmail-thread'};};
  const first=await dispatchTrackedEmail(input,{journal,send});
  const again=await dispatchTrackedEmail(input,{journal,send,auditCopyEmail:audit});
  assert.equal(again.id,first.id);assert.equal(sent.length,1);assert.deepEqual(again.cc,['advisor@example.invalid']);
  const next=await dispatchTrackedEmail({...input,idempotencyKey:'new-with-audit'},{journal,send,auditCopyEmail:audit});
  assert.equal(next.status,'ACCEPTED_BY_GMAIL');assert.deepEqual(next.cc,['advisor@example.invalid',audit]);
  assert.deepEqual(sent.at(-1)?.cc,next.cc);assert.equal(next.auditCopyMode,'operational');assert.equal(next.auditCopyEmail,audit);
});

test('retentativa antiga recebe cópia segura e mantém identidade e histórico do envio', async () => {
  const journal=new MemoryEmailDeliveryJournal();let now=new Date('2026-11-04T12:00:00Z');
  const input={recipient:'author@example.invalid',subject:'Comprovante',text:'Reserva negada.',idempotencyKey:'pending-old',requestedBy:'student@example.invalid',sender:'portal@example.invalid'};
  const failed=await dispatchTrackedEmail(input,{journal,now:()=>now,send:async()=>{throw Error('Gmail respondeu 503');}});
  assert.equal(failed.status,'RETRY');now=new Date(failed.nextRetryAt!);let captured:string[]|undefined;
  const done=await dispatchTrackedEmail({...input,requestedBy:'admin@example.invalid'},{journal,now:()=>now,auditCopyEmail:audit,send:async message=>{captured=message.cc;return{id:'accepted-retry'};}});
  assert.equal(done.id,failed.id);assert.equal(done.attempts.length,2);assert.equal(done.status,'ACCEPTED_BY_GMAIL');
  assert.deepEqual(captured,[audit]);assert.deepEqual(done.cc,[audit]);
  assert.equal(done.requestedBy,'student@example.invalid','a nova tentativa não atribui a ação original ao administrador');
  assert.equal(done.sender,'portal@example.invalid');
});

test('retentativa de decisão pessoal remove cópias antigas antes do envio', async () => {
  const journal=new MemoryEmailDeliveryJournal();let now=new Date('2026-11-04T12:00:00Z');
  const input={recipient:'department@example.invalid',subject:'Solicitação',text:'Pedido pendente.',idempotencyKey:'personal-old'};
  const failed=await dispatchTrackedEmail(input,{journal,now:()=>now,send:async()=>{throw Error('Gmail respondeu 503');}});
  failed.cc=['author@example.invalid',audit];now=new Date(failed.nextRetryAt!);let captured:string[]|undefined;
  const done=await dispatchTrackedEmail({...input,text:'https://portal.example.invalid/api/reservation-confirmation/personal-123'},{journal,now:()=>now,auditCopyEmail:audit,send:async message=>{captured=message.cc;return{id:'personal-retry'};}});
  assert.deepEqual(captured,[]);assert.deepEqual(done.cc,[]);assert.equal(done.auditCopyMode,'sensitive');
});

test('a prévia acompanha o conteúdo efetivo da última tentativa, sem mudar quando não há novo envio', async () => {
  const journal=new MemoryEmailDeliveryJournal();let now=new Date('2026-11-04T12:00:00Z');
  const input={recipient:'author@example.invalid',subject:'Aviso',text:'Corpo original',html:'<p>Corpo original</p>',idempotencyKey:'content-retry'};
  const failure=await dispatchTrackedEmail(input,{journal,now:()=>now,send:async()=>{throw Error('Gmail respondeu 503');}});
  const updated={...input,text:'Corpo reconstruído da tentativa',html:undefined};
  let sends=0;
  await dispatchTrackedEmail(updated,{journal,now:()=>now,auditCopyEmail:audit,send:async()=>{sends++;return{id:'not-due'};}});
  assert.equal(sends,0);assert.equal(failure.renderedText,'Corpo original');
  assert.deepEqual(failure.cc,[],'um envio ainda não realizado não deve constar como copiado para a auditoria');
  now=new Date(failure.nextRetryAt!);
  const accepted=await dispatchTrackedEmail(updated,{journal,now:()=>now,send:async actual=>{sends++;assert.equal(actual.text,updated.text);assert.equal(actual.html,undefined);return{id:'last-body'};}});
  assert.equal(sends,1);assert.equal(accepted.renderedText,updated.text);assert.equal(accepted.renderedHtml,undefined);
  await dispatchTrackedEmail({...updated,text:'Não foi enviado'}, {journal,now:()=>now,send:async()=>{sends++;}});
  assert.equal(sends,1);assert.equal(accepted.renderedText,updated.text);
});

test('tentativa aceita registra a conta remetente real, sem atribuí-la a uma falha anterior', async () => {
  const journal=new MemoryEmailDeliveryJournal();let now=new Date('2026-11-04T12:00:00Z');
  const input={recipient:'author@example.invalid',subject:'Aviso',text:'Resposta.',requestedBy:'student@example.invalid',idempotencyKey:'sender-truth'};
  const failed=await dispatchTrackedEmail(input,{journal,now:()=>now,send:async()=>{throw Error('Gmail respondeu 503');}});
  assert.equal(failed.sender,undefined);assert.equal(failed.attempts[0].sender,undefined);
  now=new Date(failed.nextRetryAt!);
  const accepted=await dispatchTrackedEmail(input,{journal,now:()=>now,send:async()=>({id:'message',sender:' Portal@Example.Invalid '})});
  assert.equal(accepted.sender,'portal@example.invalid');assert.equal(accepted.attempts[1].sender,'portal@example.invalid');
  assert.equal(accepted.attempts[0].sender,undefined);assert.equal(accepted.requestedBy,'student@example.invalid');
});
