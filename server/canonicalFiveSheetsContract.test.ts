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
  const css = read('src/index.css');

  assert.match(css, /PORTAL TCC — SISTEMA VISUAL CANÔNICO/);
  assert.match(css, /--portal-sheet-title-height:\s*45px/);
  assert.match(css, /--portal-sheet-title-divider:\s*5px/);
  assert.match(css, /--portal-sheet-filter-height:\s*45px/);
  assert.match(css, /--portal-sheet-content-divider:\s*15px/);
  assert.match(css, /--portal-sheet-column-header-height:\s*35px/);
  assert.match(css, /--portal-sheet-row-min-height:\s*30px/);
  assert.match(css, /--portal-sheet-pagination-height:\s*24px/);
  assert.match(css, /--portal-sheet-column-control-size:\s*15px/);

  assert.match(css, /\[data-portal-sheet\]\[data-portal-has-filter="true"\] \[data-portal-sheet-filter="true"\]/);
  assert.match(css, /\[data-portal-sheet\]\[data-portal-has-filter="false"\] \[data-portal-sheet-title="true"\]/);
  assert.doesNotMatch(css, /Separador único: exatamente 16px/);
});

test('sticky é canônico e preserva exceção estrutural do Presidente', () => {
  const css = read('src/index.css');
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');

  assert.match(css, /Cabeçalho sticky/);
  assert.match(css, /data-portal-sheet="repository"[\s\S]*:is\(th, td\):first-child/);
  assert.match(css, /data-portal-sheet="my-tccs"[\s\S]*:is\(th, td\):first-child/);
  assert.match(css, /data-portal-sheet="president"[\s\S]*data-portal-sticky-selection/);
  assert.match(css, /left:\s*54px/);
  assert.match(runtime, /data-portal-sticky-process/);
  assert.match(runtime, /data-portal-sticky-thead/);
});

test('Repositório e Meus TCCs congelam apenas a primeira coluna', () => {
  const css = read('src/index.css');
  assert.match(css, /data-portal-sheet="repository"[\s\S]*:is\(th, td\):first-child/);
  assert.match(css, /data-portal-sheet="my-tccs"[\s\S]*:is\(th, td\):first-child/);
  assert.doesNotMatch(css, /data-portal-sheet="repository"[\s\S]*td:nth-child\(2\)[\s\S]*position:\s*sticky/);
});

test('controle de coluna é 15x15 sem afetar o checkbox do Presidente', () => {
  const css = read('src/index.css');
  assert.match(css, /--portal-sheet-column-control-size:\s*15px/);
  assert.match(css, /\.portal-core-column-menu,[\s\S]*\.portal-column-filter/);
  assert.doesNotMatch(css, /portal-sheet-checkbox[\s\S]*portal-sheet-column-control-size/);
});

test('Configurações não cria painel externo ao redor do hub', () => {
  const css = read('src/index.css');
  assert.match(css, /#configuracoes-page-container,[\s\S]*#portal-settings-hub,[\s\S]*\.portal-settings-list[\s\S]*background:\s*transparent/);
});

test('aplicação carrega um único stylesheet autoritativo', () => {
  const main = read('src/main.tsx');
  const imports = [...main.matchAll(/import ['"]\.\/([^'"]+\.css)['"];/g)].map((match) => match[1]);
  assert.deepEqual(imports, ['index.css']);
});
