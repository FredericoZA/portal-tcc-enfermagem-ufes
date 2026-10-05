import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPortalCss } from './testUtils/portalCss';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

// Contratos de regressão dos ajustes visuais e funcionais consolidados.
test('Área do Presidente ordena uma coleção única conforme a visão ativa',()=>{
  const s=read('src/pages/CoordenadorPage.tsx');
  assert.match(s,/type CoordinatorRow/);
  assert.match(s,/const pendingRows: CoordinatorRow\[\]/);
  assert.match(s,/const completedRows: CoordinatorRow\[\]/);
  assert.match(s,/getSortedAndFilteredItems = \(items: CoordinatorRow\[\]\)/);
  assert.match(s,/const visibleRows = activeTab === 'pendentes'/);
  assert.match(s,/const sortedRows = getSortedAndFilteredItems\(visibleRows\)/);
});

test('cabeçalhos usam somente o runtime estrutural canônico',()=>{
  const main=read('src/main.tsx');
  const runtime=read('src/utils/portalTableDom.ts');
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

test('popup e logs usam o contrato canônico da release 1.0.73',()=>{
  const css=readPortalCss();
  const settings=read('src/components/HeaderSettingsPopover.tsx');
  const pkg=JSON.parse(read('package.json'));
  assert.match(settings,/aria-label="Configurar exibição da planilha"/);
  assert.match(css,/--portal-sheet-title-divider:\s*5px/);
  assert.match(css,/--portal-sheet-content-divider:\s*15px/);
  assert.equal(pkg.version,'1.0.73');
});