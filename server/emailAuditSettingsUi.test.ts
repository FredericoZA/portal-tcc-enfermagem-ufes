import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import test from 'node:test';
import {EmailAuditSettingsControl} from '../src/components/EmailAuditSettings';

const render=(changes:Partial<React.ComponentProps<typeof EmailAuditSettingsControl>>={})=>renderToStaticMarkup(React.createElement(EmailAuditSettingsControl,{isMaster:true,enabled:true,saving:false,masterEmail:'current-master@example.invalid',onToggle:()=>{throw new Error('Rendering must not save settings.');},...changes}));

test('email audit switch is Master-only with a fixed current-Master destination and explicit complete-message guidance',()=>{
  assert.equal(render({isMaster:false}),'');
  const markup=render();
  assert.equal((markup.match(/role="switch"/g)||[]).length,1);
  assert.match(markup,/aria-checked="true"/);
  assert.match(markup,/aria-labelledby="email-audit-label"/);
  assert.match(markup,/Auditar envio de e-mails/);
  assert.match(markup,/<input[^>]*readOnly=""[^>]*value="current-master@example.invalid"/);
  assert.match(markup,/cópia completa dos e-mails enviados pelo Portal, inclusive códigos de acesso e links pessoais/);
  assert.match(markup,/O conteúdo sensível permanece fora do Registro de logs/);
  assert.doesNotMatch(markup,/type="submit"/);
});

test('email audit switch exposes its off, saving and failed states without another confirmation action',()=>{
  assert.match(render({enabled:false}),/aria-checked="false"/);
  const saving=render({saving:true});
  assert.match(saving,/disabled=""/);assert.match(saving,/role="status"[^>]*>Salvando configuração/);
  assert.match(render({message:'Auditoria de e-mails desativada.'}),/role="status"[^>]*>Auditoria de e-mails desativada/);
  assert.match(render({error:'Falha ao salvar.'}),/role="alert"[^>]*>Falha ao salvar/);
  assert.match(render({masterEmail:''}),/disabled=""/);
});
