import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path:string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('1.0.54 fica restrita ao Repositório e Meus TCCs', () => {
  const runtime = read('src/components/PortalVersion1054Enhancer.tsx');
  assert.match(runtime, /#biblioteca-tccs-section/);
  assert.match(runtime, /#meus-processos-page-container/);
  assert.doesNotMatch(runtime, /#coordenador-page-root/);
  assert.doesNotMatch(runtime, /portal-settings-workspace/);
});

test('runtime e css da 1.0.54 estão ativados por último', () => {
  const main = read('src/main.tsx');
  assert.match(main, /PortalVersion1054Enhancer/);
  assert.match(main, /portal-version-1054\.css/);
  assert.ok(main.indexOf('<PortalVersion1054Enhancer') > main.indexOf('<PortalVersion1053Enhancer'));
  assert.ok(main.indexOf("portal-version-1054.css") > main.indexOf("portal-version-1053.css"));
});

test('as duas planilhas exibem Processo e possuem arraste real horizontal e vertical', () => {
  const runtime = read('src/components/PortalVersion1054Enhancer.tsx');
  const css = read('src/portal-version-1054.css');
  assert.match(runtime, /matching\.data = 'Processo'/);
  assert.match(runtime, /addEventListener\('mousedown'/);
  assert.match(runtime, /addEventListener\('mousemove'/);
  assert.match(runtime, /host\.scrollLeft = startLeft - dx/);
  assert.match(runtime, /host\.scrollTop = startTop - dy/);
  assert.match(css, /#biblioteca-tccs-section \.table-sticky-container/);
  assert.match(css, /#meus-processos-page-container \.table-sticky-container/);
  assert.match(css, /max-height: min\(68vh, 720px\) !important/);
  assert.match(css, /overflow: auto !important/);
  assert.match(css, /cursor: grab !important/);
});

test('Repositório e Meus TCCs têm paginação única depois da planilha', () => {
  const runtime = read('src/components/PortalVersion1054Enhancer.tsx');
  const css = read('src/portal-version-1054.css');
  assert.match(runtime, /PAGE_SIZE_PREFIX = 'portal_table_page_size_'/);
  assert.match(runtime, /CURRENT_PAGE_PREFIX = 'portal_table_current_page_'/);
  assert.match(runtime, /className = 'portal-v54-pager'/);
  assert.match(runtime, /host\.insertAdjacentElement\('afterend', pager\)/);
  assert.match(runtime, /makeButton\('Anterior'/);
  assert.match(runtime, /makeButton\('Próxima'/);
  assert.match(runtime, /portal-v54-page-hidden/);
  assert.match(css, /\.portal-v54-pager/);
  assert.match(css, /\.portal-v52-pager[\s\S]*display: none !important/);
});

test('filtros de Meus TCCs ficam brancos e somente o selecionado escurece', () => {
  const runtime = read('src/components/PortalVersion1054Enhancer.tsx');
  const css = read('src/portal-version-1054.css');
  assert.match(runtime, /portalV54AllActive/);
  assert.match(css, /button\.portal-standard-filter-chip[\s\S]*background: #fff !important/);
  assert.match(css, /aria-pressed="true"[\s\S]*background: #aeb0b3 !important/);
  assert.match(css, /\.portal-v52-all-filter \.portal-filter-dot[\s\S]*display: none !important/);
  assert.match(css, /filter: none !important/);
});

test('quatro vínculos têm cores distintas e Processo usa a mesma família cromática', () => {
  const css = read('src/portal-version-1054.css');
  const colors = ['#9a7600', '#a04444', '#2e718d', '#6e4a94'];
  colors.forEach((color) => {
    const occurrences = css.split(color).length - 1;
    assert.ok(occurrences >= 2, `${color} deve aparecer no filtro e na pílula Processo`);
  });
  assert.equal(new Set(colors).size, 4);
});

test('release focada usa versão 1.0.54', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '1.0.54');
});
