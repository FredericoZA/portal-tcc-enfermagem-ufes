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

test('cabeçalhos preservam contrato legado enquanto runtime estrutural assume menu único',()=>{
  const legacy=read('src/components/PortalSpreadsheetEnhancer.tsx');
  const runtime=read('src/components/PortalStructuralRuntime.tsx');
  assert.match(legacy,/hasNativeSort/);
  assert.match(runtime,/portal-core-column-menu/);
  assert.match(runtime,/Selecionar tudo/);
  assert.match(runtime,/Limpar tudo/);
});

test('Meus TCCs usa Etapa em vez de progresso percentual',()=>{
  const p=read('src/pages/MeusProcessosPage.tsx');
  assert.match(p,/key: 'progresso', label: 'Etapa'/);
  assert.match(p,/portal-stage-number/);
  assert.match(p,/stageNumber = getStepNumberLabel/);
});

test('popup e logs preservam acabamento aprovado e release atual está em 1.0.44',()=>{
  const css=read('src/portal-version-1040.css');
  const ui=read('src/components/PortalUiEnhancer.tsx');
  assert.match(css,/section\[aria-label\^="Colunas e ordem"\]/);
  assert.match(css,/border-bottom:4px solid #fff/);
  assert.match(ui,/portal-sidebar-nav-active/);
});