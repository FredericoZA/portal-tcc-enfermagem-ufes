import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {TccAbstractPopover} from '../src/components/TccAbstractPopover';

test('resumo ausente mostra somente o ícone, com descrição acessível e sem botão ou traço',()=>{
  for(const summary of [undefined,'','   ']){
    const html=renderToStaticMarkup(React.createElement(TccAbstractPopover,{summary,processLabel:'001 - Legado',unavailableLabel:'Resumo não localizado no acervo importado'}));
    assert.match(html,/role="img"/);
    assert.match(html,/aria-label="Resumo não localizado no acervo importado"/);
    assert.equal((html.match(/<svg\b/g)||[]).length,1);
    assert.doesNotMatch(html,/<button\b|—|<span aria-hidden/);
  }
});

test('resumo presente mantém acionador acessível sem expandir o texto na célula da tabela',()=>{
  const html=renderToStaticMarkup(React.createElement(TccAbstractPopover,{summary:'Texto sintético do resumo para conferência.',processLabel:'TCC-2026-0042'}));
  assert.match(html,/aria-label="Ler resumo do TCC TCC-2026-0042"/);
  assert.match(html,/aria-haspopup="dialog"/);
  assert.match(html,/aria-expanded="false"/);
  assert.doesNotMatch(html,/Texto sintético do resumo para conferência/);
  assert.doesNotMatch(html,/portal-abstract-unavailable/);
});
