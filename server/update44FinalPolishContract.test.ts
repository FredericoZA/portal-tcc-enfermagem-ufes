import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

// Contratos de regressão dos ajustes visuais e funcionais consolidados.
test('Área do Presidente ordena fila e concluídos sem depender da aba ativa',()=>{
  const s=read('src/pages/CoordenadorPage.tsx');
  assert.match(s,/getSortedAndFilteredItems = \(items: any\[\], wrappedQueueItem: boolean\)/);
  assert.match(s,/getSortedAndFilteredItems\(pendingItems, true\)/);
  assert.match(s,/getSortedAndFilteredItems\(completedItems, false\)/);
  assert.match(s,/if \(!pA \|\| !pB\) return 0/);
});

test('cabeçalhos preservam ordenação nativa e acrescentam filtro por coluna',()=>{
  const s=read('src/components/PortalSpreadsheetEnhancer.tsx');
  assert.match(s,/hasNativeSort/);
  assert.match(s,/portal-column-header-content/);
  assert.match(s,/Filtrar valores desta coluna/);
});

test('Meus TCCs usa Etapa em vez de progresso percentual',()=>{
  const p=read('src/pages/MeusProcessosPage.tsx');
  assert.match(p,/key: 'progresso', label: 'Etapa'/);
  assert.match(p,/portal-stage-number/);
  assert.match(p,/stageNumber = getStepNumberLabel/);
});

test('popup e logs seguem acabamento aprovado e release está em 1.0.40',()=>{
  const css=read('src/portal-version-1040.css');
  const ui=read('src/components/PortalUiEnhancer.tsx');
  const pkg=JSON.parse(read('package.json'));
  assert.match(css,/section\[aria-label\^="Colunas e ordem"\]/);
  assert.match(css,/border-bottom:4px solid #fff/);
  assert.match(ui,/portal-sidebar-nav-active/);
  assert.equal(pkg.version,'1.0.40');
});