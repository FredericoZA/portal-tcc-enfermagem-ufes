import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPortalCss } from './testUtils/portalCss';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

// Contratos de regressão dos ajustes visuais e funcionais consolidados.
test('Área do Presidente ordena fila e concluídos sem depender da aba ativa',()=>{
  const s=read('src/pages/CoordenadorPage.tsx');
  assert.match(s,/getSortedAndFilteredItems = \(items: any\[\], wrappedQueueItem: boolean\)/);
  assert.match(s,/getSortedAndFilteredItems\(pendingItems, true\)/);
  assert.match(s,/getSortedAndFilteredItems\(completedItems, false\)/);
  assert.match(s,/if \(!pA \|\| !pB\) return 0/);
});

test('cabeçalhos usam somente o runtime estrutural canônico',()=>{
  const main=read('src/main.tsx');
  const runtime=read('src/components/PortalStructuralRuntime.tsx');
  assert.doesNotMatch(main,/PortalSpreadsheetEnhancer/);
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

test('popup e logs usam o contrato canônico da release atual',()=>{
  const css=readPortalCss();
  const settings=read('src/components/HeaderSettingsPopover.tsx');
  const pkg=JSON.parse(read('package.json'));
  assert.match(settings,/aria-label="Configurar exibição da planilha"/);
  assert.match(css,/--portal-sheet-title-divider:\s*5px/);
  assert.match(css,/--portal-sheet-content-divider:\s*15px/);
  assert.equal(pkg.version,'1.0.70');
});