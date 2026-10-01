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

test('runtime reconhece todas as sete planilhas e padroniza Processo de forma autorreparável', () => {
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  for (const key of ['defenses', 'acervo', 'meus_processos', 'coordinator', 'authorized_access', 'signature_logs', 'audit_logs']) assert.match(runtime, new RegExp(key));
  assert.match(runtime, /#public-calendar-cards-section/);
  assert.match(runtime, /#biblioteca-tccs-section/);
  assert.match(runtime, /#meus-processos-page-container/);
  assert.match(runtime, /#coordenador-page-root/);
  assert.match(runtime, /function renameProcessHeader/);
  assert.match(runtime, /node\.data = 'Processo'/);
  assert.match(runtime, /portalStickyProcess/);
  assert.match(runtime, /portalStickySelection/);
  assert.match(runtime, /portalStickyThead/);
  assert.match(runtime, /characterData: true/);
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
  assert.match(runtime, /host\.scrollTop \+= event\.deltaY/);
  assert.match(runtime, /host\.scrollLeft \+=/);
  assert.match(css, /cursor: grab !important/);
  assert.match(css, /overflow: auto !important/);
  assert.match(css, /isolation: isolate !important/);
});

test('paginação canônica é recriada após renderizações React e permanece no rodapé direito', () => {
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  const css = read('src/portal-spreadsheet-runtime.css');
  assert.match(runtime, /ensureSinglePager/);
  assert.match(runtime, /host\.insertAdjacentElement\('afterend', pager\)/);
  assert.match(runtime, /pager\.dataset\.portalGenerated = 'true'/);
  assert.match(runtime, /readPageSize\(key\)/);
  assert.match(runtime, /pageSizeKey\(key\)/);
  assert.match(runtime, /makeButton\('Anterior'/);
  assert.match(runtime, /makeButton\('Próxima'/);
  assert.match(runtime, /pageList\(totalPages, current\)/);
  assert.match(runtime, /portal-table-layouts-updated/);
  assert.match(css, /\.portal-spreadsheet-pager[\s\S]*justify-content: flex-end/);
  assert.match(css, /visibility: visible !important/);
  assert.doesNotMatch(runtime, /portal-spreadsheet-page-size/);
});

test('Meus TCCs mantém filtros React com paleta amarelo, laranja, verde e azul', () => {
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  const page = read('src/pages/MeusProcessosPage.tsx');
  const tokens = read('src/utils/portalSemanticTokens.ts');
  const css = read('src/portal-spreadsheet-runtime.css');
  assert.match(page, /selectedRoleCategories/);
  assert.match(page, /toggleRoleCategory/);
  assert.match(page, /selectedRoleCategories\.includes\(roleCat\)/);
  assert.match(page, /ROLE_CONFIGS/);
  assert.doesNotMatch(runtime, /enhanceMyTccFilters|selectedMyTccRoles|portal-runtime-all-filter/);
  for (const border of ['#d4a300', '#ea580c', '#16a34a', '#2563eb']) assert.match(tokens, new RegExp(border));
  assert.match(css, /portal-native-all-filter\[data-selected="true"\][\s\S]*color: #111827 !important/);
  assert.match(css, /portal-meus-processos-filter-row[\s\S]*border-bottom: 2px solid/);
});

test('Presidente mantém seleção React com duas colunas fixas opacas e controle maior', () => {
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  const page = read('src/pages/CoordenadorPage.tsx');
  const css = read('src/portal-spreadsheet-runtime.css');
  assert.match(page, /selectedIds/);
  assert.match(page, /toggleSelectAllPending/);
  assert.match(page, /data-portal-selection-column="true"/);
  assert.match(runtime, /portal-sheet-checkbox/);
  assert.match(runtime, /portalStickySelection/);
  assert.match(runtime, /opaqueColor/);
  assert.match(css, /width: 54px !important/);
  assert.match(css, /left: 54px !important/);
  assert.match(css, /width: 28px !important/);
  assert.match(css, /portal-coordinator-filter-row[\s\S]*border-bottom: 2px solid/);
  assert.doesNotMatch(runtime, /portal-president-all-view|renderPresidentAllView|apiClient/);
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
