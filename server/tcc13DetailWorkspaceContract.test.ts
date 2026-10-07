import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('detalhes do TCC usam um único workspace abaixo do fluxo',()=>{
  const page=read('src/pages/ProcessoDetailPage.tsx');
  assert.match(page,/id="tcc-detail-workspace"/);
  assert.match(page,/portal-tcc-workspace-summary/);
  assert.match(page,/portal-tcc-workspace-tabs/);
  assert.match(page,/portal-tcc-workspace-content/);
});

test('cabeçalho do detalhe mantém somente ações operacionais solicitadas',()=>{
  const page=read('src/pages/ProcessoDetailPage.tsx');
  const header=page.slice(page.indexOf('<header className="portal-modal-header'),page.indexOf('</header>',page.indexOf('<header className="portal-modal-header')));
  assert.doesNotMatch(header,/showHeaderRoleBadge|Admin Master|Reabrir avaliação|RotateCcw/);
  assert.match(header,/Abrir histórico de auditoria/);
  assert.match(header,/Excluir trabalho/);
});

test('subcaixas do detalhe não herdam cabeçalho verde estrutural',()=>{
  const css=read('src/styles/portal-components.css');
  assert.match(css,/\.portal-tcc-workspace-content \.portal-section-header\s*\{/);
  assert.match(css,/background:\s*var\(--portal-surface-card\)/);
  assert.match(css,/color:\s*var\(--portal-text-dark\)/);
});
