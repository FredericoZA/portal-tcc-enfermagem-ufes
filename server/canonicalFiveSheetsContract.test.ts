import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('cinco superfícies usam o mesmo contrato canônico', () => {
  const home = read('src/pages/HomePage.tsx');
  const meus = read('src/pages/MeusProcessosPage.tsx');
  const presidente = read('src/pages/CoordenadorPage.tsx');

  for (const id of ['calendar', 'defenses', 'repository']) {
    assert.match(home, new RegExp(`data-portal-sheet="${id}"`));
  }
  assert.match(meus, /data-portal-sheet="my-tccs"/);
  assert.match(presidente, /data-portal-sheet="president"/);

  for (const source of [home, meus, presidente]) {
    assert.match(source, /data-portal-sheet-title="true"/);
  }
  assert.match(home, /data-portal-sheet-column-header="true"/);
  assert.match(home, /data-portal-sheet-filter="true"/);
  assert.match(meus, /data-portal-sheet-filter="true"/);
  assert.match(presidente, /data-portal-sheet-filter="true"/);
});

test('geometria é única e não depende de seletores nth-child por tela', () => {
  const css = read('src/portal-surface-contract.css');

  assert.match(css, /TCC8 — CONTRATO CANÔNICO DAS CINCO PLANILHAS/);
  assert.match(css, /--portal-sheet-title-height:45px/);
  assert.match(css, /--portal-sheet-title-divider:5px/);
  assert.match(css, /--portal-sheet-filter-height:45px/);
  assert.match(css, /--portal-sheet-content-divider:15px/);
  assert.match(css, /--portal-sheet-column-header-height:35px/);
  assert.match(css, /--portal-sheet-row-min-height:30px/);
  assert.match(css, /--portal-sheet-pagination-height:24px/);
  assert.match(css, /--portal-sheet-column-control-size:15px/);

  assert.match(css, /\[data-portal-sheet\]\[data-portal-has-filter="true"\] \[data-portal-sheet-filter="true"\]/);
  assert.match(css, /\[data-portal-sheet\]\[data-portal-has-filter="false"\] \[data-portal-sheet-title="true"\]/);
  assert.doesNotMatch(css, /Separador único: exatamente 16px/);
});

test('sticky é canônico e preserva exceção estrutural do Presidente', () => {
  const css = read('src/portal-surface-contract.css');
  const runtime = read('src/portal-spreadsheet-runtime.css');

  assert.match(css, /Primeira linha congelada/);
  assert.match(css, /data-portal-sheet="repository"[\s\S]*table th:first-child/);
  assert.match(css, /data-portal-sheet="my-tccs"[\s\S]*table td:first-child/);
  assert.match(css, /data-portal-sheet="president"[\s\S]*data-portal-sticky-selection/);
  assert.match(css, /left:54px!important/);
  assert.match(runtime, /data-portal-sticky-process/);
  assert.match(runtime, /data-portal-sticky-thead/);
});

test('Repositório e Meus TCCs não pintam a segunda coluna como sticky', () => {
  const css = read('src/portal-surface-contract.css');
  assert.doesNotMatch(css, /#biblioteca-tccs-section tbody td:nth-child\(2\),\s*#meus-processos-table tbody td:first-child/);
  assert.match(css, /data-portal-sheet="repository"[\s\S]*tbody td:nth-child\(2\)[\s\S]*background-color:transparent!important/);
});

test('checkbox do Presidente não herda tamanho do botão circular de coluna', () => {
  const css = read('src/portal-surface-contract.css');
  assert.match(css, /thead th button:not\(\.portal-sheet-checkbox\)/);
});

test('Configurações não cria painel externo ao redor do hub', () => {
  const css = read('src/portal-surface-contract.css');
  assert.match(css, /#configuracoes-page-container,[\s\S]*#portal-settings-hub,[\s\S]*\.portal-settings-list[\s\S]*background:transparent!important/);
});

test('folha autoritativa continua carregada por último', () => {
  const main = read('src/main.tsx');
  assert.ok(main.lastIndexOf('portal-surface-contract.css') > main.lastIndexOf('portal-spreadsheet-runtime.css'));
});
