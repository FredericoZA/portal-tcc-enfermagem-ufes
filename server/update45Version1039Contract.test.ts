import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

// Contratos finais da 1.0.39: tabelas, Presidência e rastreabilidade Asten.
test('1.0.39 mantém cabeçalhos estáveis e separador branco robusto',()=>{
  const enhancer=read('src/components/PortalSpreadsheetEnhancer.tsx');
  const css=read('src/portal-update-43.css');
  assert.match(enhancer,/canonicalizeHeader/);
  assert.match(enhancer,/wrapper\.className='portal-column-header-content'/);
  assert.doesNotMatch(enhancer,/labelHost=header\.querySelector<HTMLElement>\(':scope > div'\)\|\|header/);
  assert.match(css,/box-shadow:inset 0 4px 0 #fff/);
});

test('1.0.39 permite filtro na seleção sem ordenar e navegação vertical por arraste',()=>{
  const enhancer=read('src/components/PortalSpreadsheetEnhancer.tsx');
  const coordinator=read('src/pages/CoordenadorPage.tsx');
  const scroll=read('src/components/TableScrollWrapper.tsx');
  assert.match(enhancer,/isSelectionColumn/);
  assert.match(enhancer,/dataset\.portalFilterValue/);
  assert.match(coordinator,/data-portal-selection-column="true"/);
  assert.match(scroll,/findVerticalScrollParent/);
  assert.match(scroll,/scrollParentRef\.current\.scrollTop/);
});

test('1.0.39 expõe envio Gov.br e registros Master da Asten',()=>{
  const coordinator=read('src/pages/CoordenadorPage.tsx');
  const app=read('src/App.tsx');
  const asten=read('src/pages/AstenLogsPage.tsx');
  const ui=read('src/components/PortalUiEnhancer.tsx');
  assert.match(coordinator,/uploadGovBrSignedPdf/);
  assert.match(coordinator,/Enviar assinado/);
  assert.match(app,/case 'asten-logs'/);
  assert.match(asten,/Registros da Asten/);
  assert.match(ui,/nav-item-asten-logs/);
});

test('release está marcado como 1.0.39',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'1.0.39');
});
