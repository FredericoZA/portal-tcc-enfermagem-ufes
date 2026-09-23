import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('1.0.42 é carregada depois da 1.0.41', () => {
  const main = read('src/main.tsx');
  assert.ok(main.indexOf("import './portal-version-1042.css';") > main.indexOf("import './portal-version-1041.css';"));
  assert.ok(main.indexOf('<PortalVersion1042Enhancer />') > main.indexOf('<PortalVersion1041Enhancer />'));
});

test('planilhas removem controles legados e deixam um único menu combinado', () => {
  const enhancer = read('src/components/PortalVersion1042Enhancer.tsx');
  const css = read('src/portal-version-1042.css');
  assert.match(enhancer, /removeObsoleteHeaderControls/);
  assert.match(enhancer, /portal-column-controls/);
  assert.match(enhancer, /portal-column-sort/);
  assert.match(enhancer, /portal-column-filter/);
  assert.match(css, /portal1043-column-menu-button/);
  assert.match(css, /thead th svg/);
});

test('defesas passadas não ficam foscas e o botão de processo usa paleta sóbria', () => {
  const enhancer = read('src/components/PortalVersion1042Enhancer.tsx');
  const css = read('src/portal-version-1042.css');
  assert.match(enhancer, /FADED_ROW_CLASSES/);
  assert.match(enhancer, /row\.classList\.remove\(\.\.\.FADED_ROW_CLASSES\)/);
  assert.match(css, /#b8d2c0/);
  assert.match(css, /#72927c/);
  assert.match(css, /#e4d6a8/);
  assert.match(css, /#b6a164/);
});

test('faixa branca aprovada é aplicada a todas as planilhas', () => {
  const enhancer = read('src/components/PortalVersion1042Enhancer.tsx');
  const css = read('src/portal-version-1042.css');
  assert.match(enhancer, /table\.classList\.add\('portal1042-sheet'\)/);
  assert.match(css, /border-bottom: 16px solid #fff !important/);
  assert.match(css, /border-bottom: 12px solid #fff !important/);
});

test('package publica a versão 1.0.42', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '1.0.42');
});
