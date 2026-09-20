import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('planilhas usam um único menu por coluna para ordenar e filtrar', () => {
  const enhancer = read('src/components/PortalSpreadsheetRefinementEnhancer.tsx');
  assert.match(enhancer, /portal1041-column-menu-button/);
  assert.match(enhancer, /Ordenar A → Z \/ menor → maior/);
  assert.match(enhancer, /Ordenar Z → A \/ maior → menor/);
  assert.match(enhancer, /filterTitle\.textContent = 'Filtrar'/);
  assert.match(enhancer, /portal1041-filter-hidden/);
});

test('progresso é apresentado como etapa nas planilhas', () => {
  const enhancer = read('src/components/PortalSpreadsheetRefinementEnhancer.tsx');
  assert.match(enhancer, /replace\(\/\\bProgresso\\b\/gi, 'Etapa'\)/);
  assert.match(enhancer, /const stage = `Etapa \$\{match\[1\]/);
  assert.match(enhancer, /portal1041-stage-label/);
});

test('calendário reserva fins de semana estreitos e indisponíveis para defesas', () => {
  const enhancer = read('src/components/PortalSpreadsheetRefinementEnhancer.tsx');
  const css = read('src/portal-spreadsheet-refinement.css');
  assert.match(enhancer, /column === 0 \|\| column === 6/);
  assert.match(css, /grid-template-columns: \.20fr 1\.36fr 1\.36fr 1\.36fr 1\.36fr 1\.36fr \.20fr/);
  assert.match(css, /portal1041-calendar-weekend/);
  assert.match(css, /pointer-events: none !important/);
});

test('planilhas têm cabeçalho mais alto, separador branco forte, texto preto e hover neutro', () => {
  const css = read('src/portal-spreadsheet-refinement.css');
  assert.match(css, /border-bottom: 8px solid #fff !important/);
  assert.match(css, /padding-top: \.72rem !important/);
  assert.match(css, /color: #111827 !important/);
  assert.match(css, /portal1041-hover-lock/);
  assert.match(css, /portal1041-defense-filter-defended/);
  assert.match(css, /background: #dce5df !important/);
});

test('refinamento é carregado depois da camada visual 1.0.40', () => {
  const main = read('src/main.tsx');
  const css1040 = main.indexOf("import './portal-version-1040.css';");
  const cssRefinement = main.indexOf("import './portal-spreadsheet-refinement.css';");
  const enhancer1040 = main.indexOf('<PortalVersion1040Enhancer />');
  const enhancerRefinement = main.indexOf('<PortalSpreadsheetRefinementEnhancer />');
  assert.ok(css1040 >= 0 && cssRefinement > css1040);
  assert.ok(enhancer1040 >= 0 && enhancerRefinement > enhancer1040);
});
