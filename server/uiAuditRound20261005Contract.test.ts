import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Presidência usa uma única planilha para Todos, Pendentes e Assinadas', () => {
  const source = read('src/pages/CoordenadorPage.tsx');
  assert.equal((source.match(/<table/g) || []).length, 1);
  assert.match(source, /const visibleRows = activeTab === 'pendentes'/);
  assert.match(source, /const sortedRows = getSortedAndFilteredItems\(visibleRows\)/);
  assert.match(source, /Selecionar\/Deselecionar todos os itens visíveis/);
  assert.match(source, /<span>Ações<\/span>/);
});

test('Presidência não confunde conclusão ou arquivamento com publicação pública', () => {
  const source = read('src/pages/CoordenadorPage.tsx');
  assert.doesNotMatch(source, /Publicada/);
  assert.match(source, /getLatestDeclarationJob/);
  assert.match(source, /Assinada · arquivada/);
  assert.match(source, /Sem registro/);
});

test('larguras estruturais da Presidência mantêm Processo compacto e Título amplo', () => {
  const source = read('src/pages/CoordenadorPage.tsx');
  assert.match(source, /protocolo: 'w-\[118px\] min-w-\[118px\] max-w-\[118px\]'/);
  assert.match(source, /titulo: 'w-\[320px\] min-w-\[320px\]'/);
  assert.match(source, /COORDINATOR_DEFAULT_COLUMN_WIDTHS/);
});

test('seletor de mês tem botão próprio e não herda largura de botão de ícone', () => {
  const formatter = read('src/utils/tableFormatters.ts');
  const home = read('src/pages/HomePage.tsx');
  const css = read('src/styles/portal-components.css');
  assert.match(formatter, /calendarNavBtnClass: 'portal-calendar-nav-button'/);
  assert.match(home, /portal-calendar-period-control/);
  assert.match(home, /portal-calendar-period-button/);
  assert.match(css, /\.portal-calendar-period-button \{[\s\S]*width: max-content/);
  assert.match(css, /\.portal-calendar-period-control \{[\s\S]*width: max-content/);
  assert.doesNotMatch(formatter, /calendarNavBtnClass: 'portal-toolbar-icon-button'/);
});


test('escala tipográfica reduz ruído e aumenta a hierarquia dos títulos', () => {
  const tokens = read('src/styles/portal-tokens.css');
  const sheet = read('src/styles/portal-sheet.css');
  const components = read('src/styles/portal-components.css');
  const formatters = read('src/utils/tableFormatters.ts');

  assert.match(tokens, /--portal-sheet-title-font-size: 18px/);
  assert.match(tokens, /--portal-sheet-filter-label-font-size: 9px/);
  assert.match(tokens, /--portal-sheet-filter-chip-font-size: 10px/);
  assert.match(tokens, /--portal-sheet-body-font-size: 11px/);
  assert.match(sheet, /font-size: var\(--portal-sheet-title-font-size\)/);
  assert.match(sheet, /font-size: var\(--portal-sheet-body-font-size\)/);
  assert.match(components, /font-size: var\(--portal-sheet-filter-chip-font-size\)/);
  assert.match(formatters, /return 'text-\[11px\]'/);
});

test('sidebar usa texto corrido menor e ações de sessão mais compactas', () => {
  const components = read('src/styles/portal-components.css');
  assert.match(components, /\.portal-sidebar-nav-item \{[\s\S]*font-size: var\(--portal-sidebar-nav-font-size\)/);
  assert.match(components, /\.portal-sidebar-nav-item \{[\s\S]*text-transform: none/);
  assert.match(components, /#bottom-access-portal-btn,[\s\S]*height: 32px/);
  assert.match(components, /font-size: var\(--portal-sidebar-session-action-font-size\)/);
});

test('eventos do calendário usam tipografia 30 por cento mais densa', () => {
  const tokens = read('src/styles/portal-tokens.css');
  const components = read('src/styles/portal-components.css');
  assert.match(tokens, /--portal-calendar-event-font-size: 8\.5px/);
  assert.match(tokens, /--portal-calendar-event-secondary-font-size: 7\.5px/);
  assert.match(components, /\.portal-calendar-defense-summary \{[\s\S]*font-size: var\(--portal-calendar-event-font-size\)/);
});

test('navegação mensal mantém botão de período largo e acabamento canônico', () => {
  const components = read('src/styles/portal-components.css');
  assert.match(components, /\.portal-calendar-period-button \{[\s\S]*min-width: 194px/);
  assert.match(components, /\.portal-calendar-nav-button \{[\s\S]*border-radius: var\(--portal-control-radius\)/);
  assert.match(components, /\.portal-calendar-nav-button:hover/);
});
