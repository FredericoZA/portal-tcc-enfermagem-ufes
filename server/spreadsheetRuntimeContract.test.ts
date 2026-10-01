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

test('runtime reconhece todas as sete planilhas e padroniza Processo', () => {
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  for (const key of ['defenses', 'acervo', 'meus_processos', 'coordinator', 'authorized_access', 'signature_logs', 'audit_logs']) assert.match(runtime, new RegExp(key));
  assert.match(runtime, /replace\(\/n\[º°o\]/);
  assert.match(runtime, /'Processo'/);
  assert.match(runtime, /portalStickyProcess/);
  assert.match(runtime, /portalStickySelection/);
});

test('mão e roda movimentam o host nos dois eixos sem pointer capture', () => {
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  const wrapper = read('src/components/TableScrollWrapper.tsx');
  const css = read('src/portal-spreadsheet-runtime.css');
  assert.match(wrapper, /portal-spreadsheet-scroll-host/);
  assert.match(runtime, /addEventListener\('mousedown'/);
  assert.match(runtime, /window\.addEventListener\('mousemove'/);
  assert.match(runtime, /window\.addEventListener\('mouseup'/);
  assert.match(runtime, /addEventListener\('wheel'/);
  assert.doesNotMatch(runtime, /setPointerCapture|releasePointerCapture/);
  assert.match(runtime, /host\.scrollLeft = startLeft - dx/);
  assert.match(runtime, /host\.scrollTop = startTop - dy/);
  assert.match(css, /cursor: grab !important/);
  assert.match(css, /overflow: auto !important/);
});

test('paginação fica depois da planilha e quantidade de linhas é controlada pela engrenagem', () => {
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  assert.match(runtime, /host\.insertAdjacentElement\('afterend', pager\)/);
  assert.match(runtime, /linhas por pagina/);
  assert.match(runtime, /savePageSize\(key, size\)/);
  assert.match(runtime, /syncPageSizePopover\(activeSettingsTable\)/);
  assert.match(runtime, /makeButton\('Anterior'/);
  assert.match(runtime, /makeButton\('Próxima'/);
  assert.match(runtime, /pageList\(totalPages, current\)/);
  assert.doesNotMatch(runtime, /portal-spreadsheet-page-size/);
});

test('Meus TCCs usa Todos sem bolinha e quatro tons combináveis', () => {
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  const css = read('src/portal-spreadsheet-runtime.css');
  const tokens = read('src/utils/portalSemanticTokens.ts');
  assert.match(runtime, /portal-runtime-all-filter/);
  assert.match(runtime, /selectedMyTccRoles\.has\(tone\)/);
  assert.match(runtime, /selectedMyTccRoles\.clear\(\)/);
  assert.doesNotMatch(runtime, /portal-runtime-all-filter[^\n]*portal-filter-dot/);
  for (const tone of ['student', 'board', 'evaluator', 'viewer']) assert.match(css, new RegExp(`data-portal-role-tone="${tone}"`));
  for (const border of ['#9a7600', '#a04444', '#2e718d', '#6e4a94']) {
    assert.match(css, new RegExp(border));
    assert.match(tokens, new RegExp(border));
  }
});

test('Presidente tem seleção fixa e Envio textual sem pílula', () => {
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  const css = read('src/portal-spreadsheet-runtime.css');
  assert.match(runtime, /portal-sheet-checkbox/);
  assert.match(runtime, /portalStickySelection/);
  assert.match(runtime, /cell\.dataset\.portalPlainText = 'true'/);
  assert.match(css, /data-portal-plain-text="true"/);
  assert.match(css, /--portal-sticky-row-bg/);
});

test('Acesso, Assinaturas e Logs permanecem planilhas do workspace sem camada visual paralela', () => {
  const settings = read('src/components/PortalSettingsRuntime.tsx');
  const workspace = read('src/components/SettingsWorkspaceModal.tsx');
  const css = read('src/portal-spreadsheet-runtime.css');
  for (const kind of ['access', 'signatures', 'logs']) assert.match(settings, new RegExp(`portalSheetMode = '${kind}'`));
  assert.match(workspace, /data-portal-full-bleed/);
  assert.match(css, /data-portal-full-bleed/);
  assert.match(css, /background: var\(--portal-green-action, #337959\) !important/);
});
