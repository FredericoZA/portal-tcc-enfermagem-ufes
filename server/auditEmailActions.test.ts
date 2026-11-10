import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {EmailDeliveryRetryAction,EmailCommunicationCopyAction} from '../src/components/AuditLogDetails';
import type {ReadableAuditLog} from '../src/utils/auditLogPresentation';

const entry=(after:Record<string,unknown>,extra:Partial<ReadableAuditLog>={}):ReadableAuditLog=>({
 id:'email-delivery:fixture',emailDeliveryId:'fixture',source:'email',processId:'proc-fixture',
 actorEmail:'master@example.invalid',actorRoles:[],action:'EMAIL_ENVIO_FALHOU',entityType:'email_delivery',
 entityId:'fixture',timestamp:'2026-11-04T12:00:00Z',after,...extra,
});
const render=(log:ReadableAuditLog,working=false)=>renderToStaticMarkup(React.createElement(EmailDeliveryRetryAction,{log,working,onRetry:()=>{throw new Error('Nenhum envio é executado ao renderizar.');}}));

test('detalhes da auditoria oferecem retomada individual para uma entrega pendente ou com falha',()=>{
 for(const status of ['RETRY','FAILED']){
  const html=render(entry({status,attempts:[{status:'RETRY'}]}));
  assert.match(html,/<button/);assert.match(html,/Tentar envio novamente/);assert.doesNotMatch(html,/disabled=""/);
 }
 assert.match(render(entry({status:'FAILED'}),true),/disabled=""/);
 assert.match(render(entry({status:'FAILED'}),true),/Conferindo nova tentativa/);
});

test('detalhes não oferecem reenvio de mensagens aceitas, em processamento ou com resultado incerto',()=>{
 for(const after of [
  {status:'ACCEPTED_BY_GMAIL'},
  {status:'RETRY',dispatchState:'SENDING',dispatchLeaseUntil:'2099-01-01T00:00:00Z'},
  {status:'RETRY',dispatchState:'SENDING',dispatchLeaseUntil:'2000-01-01T00:00:00Z'},
  {status:'FAILED',dispatchState:'UNCERTAIN'},
  {status:'FAILED',retryBlockedReason:'O convite pertence a outro agendamento.'},
 ])assert.equal(render(entry(after)),'');
});

test('códigos de acesso e eventos sem entrega ou processo não oferecem reconstrução de envio',()=>{
 assert.equal(render(entry({status:'FAILED'},{processId:undefined})), '');
 assert.equal(render(entry({status:'FAILED'},{emailDeliveryId:undefined})), '');
 assert.equal(render(entry({status:'FAILED'},{source:'activity',emailDeliveryId:undefined,entityType:'security',action:'EMAIL_CODIGO_ACESSO_FALHOU'})), '');
});


test('nova cópia exige flag segura do backend e Master; renderizar nunca envia',()=>{
 const draw=(after:Record<string,unknown>,isMaster=true)=>renderToStaticMarkup(React.createElement(EmailCommunicationCopyAction,{log:entry(after),isMaster,working:false,onCopy:()=>{throw Error('Render must not send');}}));
 assert.match(draw({status:'ACCEPTED_BY_GMAIL',canRequestCommunicationCopy:true}),/Autorizar nova cópia da comunicação/);
 assert.equal(draw({status:'ACCEPTED_BY_GMAIL',canRequestCommunicationCopy:true},false),'');
 assert.equal(draw({status:'ACCEPTED_BY_GMAIL'}),'');
 assert.equal(draw({status:'FAILED',dispatchState:'UNCERTAIN',communicationCopyBlockedReason:'Conteúdo pessoal'}),'');
});
