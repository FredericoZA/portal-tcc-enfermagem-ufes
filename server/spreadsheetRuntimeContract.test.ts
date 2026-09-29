import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('uma única camada canônica controla as planilhas', () => {
  const main = read('src/main.tsx');
  assert.match(main, /PortalSpreadsheetRuntime/);
  assert.match(main, /PortalSettingsRuntime/);
  assert.match(main, /portal-spreadsheet-runtime\.css/);
  for (const legacy of ['PortalVersion1052Enhancer', 'PortalVersion1053Enhancer', 'PortalVersion1053PagerGuard']) assert.doesNotMatch(main, new RegExp(legacy));
  assert.doesNotMatch(main, /portal-version-105[23]\.css/);
});

test('runtime reconhece as sete planilhas e padroniza Processo', () => {
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  for (const key of ['defenses', 'acervo', 'meus_processos', 'coordinator', 'authorized_access', 'signature_logs', 'audit_logs']) assert.match(runtime, new RegExp(key));
  assert.match(runtime, /replace\(\/n\[º°o\]/);
  assert.match(runtime, /'Processo'/);
  assert.match(runtime, /portalStickyProcess/);
  assert.match(runtime, /portalStickySelection/);
});

test('mão move a tabela e empurra a página quando não existe overflow vertical interno', () => {
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  const wrapper = read('src/components/TableScrollWrapper.tsx');
  const css = read('src/portal-spreadsheet-runtime.css');
  assert.match(wrapper, /portal-spreadsheet-scroll-host/);
  assert.match(runtime, /addEventListener\('mousedown'/);
  assert.match(runtime, /window\.addEventListener\('mousemove'/);
  assert.match(runtime, /window\.addEventListener\('mouseup'/);
  assert.match(runtime, /host\.scrollLeft = startLeft - dx/);
  assert.match(runtime, /host\.scrollTop = startTop - dy/);
  assert.match(runtime, /startWindowY/);
  assert.match(runtime, /window\.scrollTo\(\{ top: Math\.max\(0, startWindowY - dy\)/);
  assert.match(css, /cursor: grab !important/);
  assert.match(css, /overflow: auto !important/);
});

test('wheel vertical nunca é convertido em deslocamento horizontal', () => {
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  const css = read('src/portal-spreadsheet-runtime.css');
  assert.match(runtime, /const horizontalIntent = event\.shiftKey \|\| Math\.abs\(event\.deltaX\) > Math\.abs\(event\.deltaY\)/);
  assert.match(runtime, /if \(!canY\) return;/);
  assert.match(runtime, /host\.scrollTop \+= event\.deltaY/);
  assert.doesNotMatch(runtime, /if \(canX\) \{\s*const before = host\.scrollLeft;\s*host\.scrollLeft \+= event\.deltaY/);
  assert.match(css, /overscroll-behavior-y: auto !important/);
});

test('paginação fica depois da planilha com seletor e páginas reais', () => {
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  assert.match(runtime, /host\.insertAdjacentElement\('afterend', pager\)/);
  assert.match(runtime, /Linhas por página/);
  assert.match(runtime, /\[25, 50, 100, 'all'\]/);
  assert.match(runtime, /makeButton\('Anterior'/);
  assert.match(runtime, /makeButton\('Próxima'/);
  assert.match(runtime, /pageList\(totalPages, current\)/);
});

test('cabeçalho é compacto e faixas de filtro mantêm respiro à direita', () => {
  const css = read('src/portal-spreadsheet-runtime.css');
  assert.match(css, /th\[data-portal-sticky-header="true"\][\s\S]*padding-top: 5px !important;[\s\S]*padding-bottom: 5px !important;/);
  assert.match(css, /portal-meus-processos-filter-row[\s\S]*padding-right: 28px !important;/);
  assert.match(css, /portal-coordinator-filter-row/);
});

test('Meus TCCs usa Todos sem bolinha e quatro tons distintos', () => {
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  const css = read('src/portal-spreadsheet-runtime.css');
  const tokens = read('src/utils/portalSemanticTokens.ts');
  assert.match(runtime, /makeAllFilterButton\('portal-runtime-all-filter', 'Todos'\)/);
  assert.doesNotMatch(runtime, /portal-runtime-all-filter[^\n]*portal-filter-dot/);
  assert.match(css, /data-portal-all-active="true"/);
  assert.match(css, /Quando Todos está ativo/);
  for (const border of ['#9a7600', '#a04444', '#2e718d', '#6e4a94']) {
    assert.match(css, new RegExp(border));
    assert.match(tokens, new RegExp(border));
  }
});

test('Presidente mantém seleção, cores iniciais e Envio textual', () => {
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  const css = read('src/portal-spreadsheet-runtime.css');
  assert.match(runtime, /portal-sheet-checkbox/);
  assert.match(runtime, /Selecionar\/Deselecionar todos/);
  assert.match(runtime, /flattenInformationalCell/);
  assert.match(runtime, /envio\.dataset\.portalPlainText = 'true'/);
  assert.match(css, /tbody td:nth-child\(-n\+3\)/);
  assert.match(css, /--portal-sticky-row-bg/);
});

test('Acesso, Assinaturas e Logs são planilhas diretas no workspace', () => {
  const settings = read('src/components/PortalSettingsRuntime.tsx');
  const css = read('src/portal-spreadsheet-runtime.css');
  for (const kind of ['access', 'signatures', 'logs']) assert.match(settings, new RegExp(`portalSheetMode = '${kind}'`));
  assert.match(css, /portal-settings-workspace\[data-portal-sheet-mode\]/);
  assert.match(css, /#authorized-access-panel,#asten-logs-page,#audit-logs-page/);
  assert.match(css, /background: var\(--portal-green-action, #337959\) !important/);
  assert.match(css, /#audit-logs-page td\[data-portal-plain-text="true"\]/);
});
