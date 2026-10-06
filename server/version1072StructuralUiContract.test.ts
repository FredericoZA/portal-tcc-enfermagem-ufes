import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('menu de coluna fecha ao clicar fora e com Escape', () => {
  const runtime = read('src/utils/portalTableDom.ts');
  assert.match(runtime, /handleOutsidePointerDown/);
  assert.match(runtime, /document\.addEventListener\('pointerdown', handleOutsidePointerDown, true\)/);
  assert.match(runtime, /event\.key === 'Escape'/);
});

test('checkbox mestre não é bloqueado pelo guard do cabeçalho', () => {
  const runtime = read('src/utils/portalTableDom.ts');
  assert.match(runtime, /header\.dataset\.portalSelectionColumn !== 'true'/);
  assert.match(runtime, /portal-sheet-checkbox/);
});

test('ícones das barras são brancos e canônicos', () => {
  const icon = read('src/components/ColorfulHeaderIcon.tsx');
  assert.doesNotMatch(icon, /headerShowEmojis|headerIconStyle|effectiveEmoji/);
  assert.match(icon, /text-white/);
});

test('filtro selecionado usa reforço global e rótulo FILTRAR', () => {
  const css = read('src/styles/portal-components.css');
  assert.match(css, /filter: brightness\(\.81\)/);
  assert.match(css, /outline: 1px solid var\(--portal-text-dark\)/);
  for (const file of ['src/pages/HomePage.tsx','src/pages/MeusProcessosPage.tsx','src/pages/CoordenadorPage.tsx','src/pages/PortalTutorialPage.tsx']) {
    assert.match(read(file), /FILTRAR:/);
  }
  assert.doesNotMatch(read('src/pages/PortalTutorialPage.tsx'), /Filtrar visão:/i);
});

test('calendário usa controles autossuficientes com período em formato pílula', () => {
  const home = read('src/pages/HomePage.tsx');
  const css = read('src/styles/portal-components.css');
  assert.match(home, /portal-calendar-toolbar/);
  assert.match(home, /portal-calendar-period-control/);
  assert.match(home, /portal-calendar-period-button/);
  assert.match(home, /portal-calendar-today-button/);
  assert.equal((home.match(/portal-calendar-step-button/g) || []).length, 2);
  assert.match(css, /\.portal-calendar-toolbar \{[\s\S]*display: flex/);
  assert.match(css, /\.portal-calendar-period-control \{[\s\S]*width: max-content/);
  assert.match(css, /\.portal-calendar-period-button \{[\s\S]*min-width: 168px/);
});

test('planilhas não inserem emojis no texto de células/cabeçalhos', () => {
  const formatters = read('src/utils/tableFormatters.ts');
  const mine = read('src/pages/MeusProcessosPage.tsx');
  const coord = read('src/pages/CoordenadorPage.tsx');
  assert.match(formatters, /return stripEmojis\(text\)/);
  assert.doesNotMatch(mine, /⏰|🪪|📍/);
  assert.doesNotMatch(coord, /📤|📖|🎓|👨‍🏫|👥|📝|🔑|📍|🟢/);
});

test('Presidência tem Todos e seleção em grupo baseada na visão exibida', () => {
  const coord = read('src/pages/CoordenadorPage.tsx');
  assert.match(coord, /'todos' \| 'pendentes' \| 'concluidos'/);
  assert.match(coord, /key: 'todos', label: 'Todos'/);
  assert.match(coord, /toggleSelectionGroup/);
  assert.match(coord, /visibleRowIds/);
  assert.match(coord, /allVisibleSelected/);
  assert.match(coord, /toggleSelectAllVisible/);
});

test('sidebar não duplica logs e assinaturas de Configurações', () => {
  const sidebar = read('src/components/Sidebar.tsx');
  assert.doesNotMatch(sidebar, /label: getNavLabel\('logs'/);
  assert.doesNotMatch(sidebar, /label: getNavLabel\('asten-logs'/);
});

test('release atual é 1.0.77', () => {
  assert.equal(JSON.parse(read('package.json')).version, '1.0.77');
});
