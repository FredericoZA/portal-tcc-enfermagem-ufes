import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('release atual é 1.0.57', () => {
  assert.equal(JSON.parse(read('package.json')).version, '1.0.57');
});

test('estado de defesa não sobrescreve cores de vínculo e assinatura', () => {
  const runtime = read('src/components/PortalStructuralRuntime.tsx');
  assert.match(runtime, /if \(!table\.closest\('#formal-monthly-calendar-section'\)\) return/);
  assert.doesNotMatch(runtime, /fetch\('\/api\/processes'/);
});

test('calendário classifica fim de semana no React e abre agenda sem busca paralela', () => {
  const home = read('src/pages/HomePage.tsx');
  const runtime = read('src/components/PortalStructuralRuntime.tsx');
  assert.match(home, /isWeekend = colIndex === 0 \|\| colIndex === 6/);
  assert.match(home, /hasEvents && !isWeekend/);
  assert.match(runtime, /function enhanceCalendar\(\)/);
  assert.doesNotMatch(runtime, /async function enhanceCalendar/);
});

test('indicadores têm contrato completo e frontend defensivo', () => {
  const api = read('server/publicIndicators.ts');
  const page = read('src/pages/IndicadoresPage.tsx');
  for (const key of ['coauthorRate', 'descriptive', 'formats', 'weekdays', 'dayparts']) assert.match(api, new RegExp(key));
  assert.match(page, /items = \[\]/);
  assert.match(page, /const normalized =/);
});

test('configurações usam barras e runtime canônico de workspace', () => {
  const config = read('src/pages/ConfiguracoesPage.tsx');
  const modal = read('src/components/SettingsWorkspaceModal.tsx');
  const runtime = read('src/components/PortalSettingsRuntime.tsx');
  assert.match(config, /portal-settings-title-bar/);
  assert.doesNotMatch(config, /portal-settings-hub-card/);
  assert.match(modal, /var\(--portal-green-header\)/);
  assert.match(modal, /singlePane = sections\.length === 1/);
  assert.match(runtime, /Rodapé e Identidade/);
  assert.match(runtime, /Integrações e Plataforma/);
  assert.match(runtime, /data-portal-settings-integrations/);
});

test('estúdio de modelos delega navegação ao workspace externo e preserva cabeçalho', () => {
  const studio = read('src/components/IntegrationStudioPanel.tsx');
  const config = read('src/pages/ConfiguracoesPage.tsx');
  assert.match(studio, /portal-studio-tabs/);
  assert.match(studio, /Editor de modelos e variáveis/);
  assert.match(studio, /var\(--portal-green-action\)/);
  assert.match(config, /label: 'Modelos'/);
  assert.match(config, /label: 'Documentos'/);
  assert.match(config, /label: 'E-mails'/);
  assert.match(config, /label: 'Formulários'/);
  assert.match(config, /label: 'Fluxo'/);
  assert.match(config, /label: 'Variáveis'/);
});

test('runtime tabular canônico substitui as camadas 1.0.52 e 1.0.53', () => {
  const formatter = read('src/utils/tableFormatters.ts');
  const main = read('src/main.tsx');
  const css = read('src/portal-spreadsheet-runtime.css');
  assert.match(formatter, /cellTextColorClass = 'text-black'/);
  assert.match(main, /PortalSpreadsheetRuntime/);
  assert.match(main, /PortalSettingsRuntime/);
  assert.match(main, /portal-spreadsheet-runtime\.css/);
  assert.doesNotMatch(main, /PortalVersion1052Enhancer/);
  assert.doesNotMatch(main, /PortalVersion1053Enhancer/);
  assert.doesNotMatch(main, /PortalVersion1053PagerGuard/);
  assert.doesNotMatch(main, /portal-version-1052\.css/);
  assert.doesNotMatch(main, /portal-version-1053\.css/);
  assert.match(css, /data-portal-sticky-process/);
  assert.match(css, /data-portal-full-bleed/);
});

test('paginação preserva todas as linhas React e cria páginas reais pela camada canônica', () => {
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  assert.match(runtime, /config\.recordsLimit = 'all'/);
  assert.match(runtime, /portal-runtime-page-hidden/);
  assert.match(runtime, /Math\.ceil\(visibleRows\.length \/ pageSize\)/);
  assert.match(runtime, /Anterior/);
  assert.match(runtime, /Próxima/);
  assert.match(runtime, /readPageSize\(key\)/);
  assert.match(runtime, /localStorage\.setItem\(pageSizeKey\(key\), String\(preferred \|\| DEFAULT_PAGE_SIZE\[key\]\)\)/);
  assert.match(runtime, /portal_table_page_size_/);
  assert.match(runtime, /host\.insertAdjacentElement\('afterend', pager\)/);
  assert.match(runtime, /characterData: true/);
});

test('planilhas mantêm Processo fixo e filtros/seleção sob responsabilidade das páginas', () => {
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  const meusTccs = read('src/pages/MeusProcessosPage.tsx');
  const coordinator = read('src/pages/CoordenadorPage.tsx');
  assert.match(runtime, /portalStickyProcess/);
  assert.match(runtime, /portalStickySelection/);
  assert.match(runtime, /portal-sheet-checkbox/);
  assert.doesNotMatch(runtime, /enhanceMyTccFilters|enhancePresidentFilters|portal-president-all-view/);
  assert.match(meusTccs, /selectedRoleCategories/);
  assert.match(meusTccs, /toggleRoleCategory/);
  assert.match(coordinator, /selectedIds/);
  assert.match(coordinator, /data-portal-selection-column="true"/);
});

test('rolagem canônica usa mouse no documento e wheel no mesmo host', () => {
  const wrapper = read('src/components/TableScrollWrapper.tsx');
  const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
  assert.match(wrapper, /data-portal-scroll-host/);
  assert.match(wrapper, /portal-spreadsheet-scroll-host/);
  assert.match(runtime, /mousedown/);
  assert.match(runtime, /window\.addEventListener\('mousemove'/);
  assert.match(runtime, /wheel/);
  assert.match(runtime, /scrollTop/);
  assert.match(runtime, /scrollLeft/);
});

test('quatro papéis usam famílias cromáticas amarelo, laranja, verde e azul', () => {
  const tokens = read('src/utils/portalSemanticTokens.ts');
  for (const color of ['#fde68a', '#fdba74', '#bbf7d0', '#bfdbfe']) assert.match(tokens, new RegExp(color));
  for (const border of ['#d4a300', '#ea580c', '#16a34a', '#2563eb']) assert.match(tokens, new RegExp(border));
});
