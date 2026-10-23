import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('detalhes do TCC removem o subtítulo institucional redundante',()=>{
  const detail=read('src/pages/ProcessoDetailPage.tsx');
  assert.doesNotMatch(detail,/Enfermagem e Obstetrícia UFES, Maruípe UFES/);
  assert.doesNotMatch(detail,/Enfermagem e Obstetrícia · Maruípe\/UFES/);
  assert.doesNotMatch(detail,/Etapa:/);
  assert.doesNotMatch(detail,/TCC Teste/);
});

test('filtro selecionado usa o cinza exato solicitado',()=>{
  const tokens=read('src/styles/portal-tokens.css');
  const css=read('src/styles/portal-components.css');
  assert.match(tokens,/--portal-filter-selected-bg:\s*#aeb0b3/i);
  assert.match(css,/background:\s*var\(--portal-filter-selected-bg\)/);
  assert.match(css,/filter:\s*none/);
});

test('presidência mantém atualização automática e remove o botão manual',()=>{
  const page=read('src/pages/CoordenadorPage.tsx');
  assert.doesNotMatch(page,/title="Atualizar declarações"/);
  assert.match(page,/useSignatureUpdates\(/);
  const toolbar=page.slice(page.indexOf('portal-sheet-toolbar-terminal'),page.indexOf('portal-sheet-toolbar-terminal')+2600);
  assert.ok(!toolbar.includes('RefreshCw'));
  assert.ok(toolbar.indexOf('SearchPopover') < toolbar.indexOf('HeaderSettingsPopover'));
});
