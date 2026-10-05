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
