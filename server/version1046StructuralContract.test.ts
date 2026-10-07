import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPortalCss } from './testUtils/portalCss';
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('release estrutural atual é 1.0.77', () => {
  assert.equal(JSON.parse(read('package.json')).version, '1.0.78');
});

test('estado de defesa é calculado na página pública sem pós-processamento global', () => {
  const runtime = read('src/utils/portalTableDom.ts');
  const home = read('src/pages/HomePage.tsx');
  assert.match(home, /getDefenseState\(proc\)/);
  assert.match(home, /portal-semantic-tone/);
  assert.doesNotMatch(runtime, /normalizeDefenseRows|formal-monthly-calendar-section|fetch\('\/api\/processes'/);
});

test('calendário filtra dias úteis no React e abre agenda sem busca paralela', () => {
  const home = read('src/pages/HomePage.tsx');
  const runtime = read('src/utils/portalTableDom.ts');
  assert.match(home, /const businessDays = Array\.from/);
  assert.match(home, /dayOfWeek >= 1 && dayOfWeek <= 5/);
  assert.match(home, /if \(hasEvents\)/);
  assert.doesNotMatch(home, /isWeekend|portal-core-calendar-weekend/);
  assert.doesNotMatch(runtime, /enhanceCalendar/);
});

test('indicadores têm contrato completo e frontend defensivo', () => {
  const api = read('server/publicIndicators.ts');
  const page = read('src/pages/IndicadoresPage.tsx');
  for (const key of ['coauthorRate', 'descriptive', 'formats', 'weekdays', 'dayparts']) assert.match(api, new RegExp(key));
  assert.match(page, /items = \[\]/);
  assert.match(page, /const normalized =/);
});

test('configurações usam workspace React sem runtime de pós-processamento', () => {
  const config = read('src/pages/ConfiguracoesPage.tsx');
  const modal = read('src/components/SettingsWorkspaceModal.tsx');
  const main = read('src/main.tsx');
  assert.match(config, /portal-settings-launcher/);
  assert.match(modal, /singlePane = sections\.length === 1/);
  assert.match(config, /Rodapé e Identidade/);
  assert.match(config, /Integrações e Plataforma/);
  assert.match(config, /activeSettingsPanel === 'identity'/);
  assert.match(config, /activeSettingsPanel === 'integrations'/);
  assert.doesNotMatch(main, /PortalSettingsRuntime/);
});

test('configurações separam artefatos e unem modelos com documentos', () => {
  const studio = read('src/components/IntegrationStudioPanel.tsx');
  const config = read('src/pages/ConfiguracoesPage.tsx');
  const models = read('src/components/MasterDocumentModelsPanel.tsx');
  assert.match(studio, /portal-studio-tabs/);
  assert.match(studio, /Editor de modelos e variáveis/);
  assert.match(studio, /var\(--portal-brand-action\)/);
  assert.match(config, /Documentos e Variáveis/);
  assert.match(config, /title: 'E-mails'/);
  assert.match(config, /title: 'Formulários'/);
  assert.match(config, /title: 'Fluxos'/);
  assert.doesNotMatch(config, /id: 'variables', title: 'Variáveis'/);
  assert.doesNotMatch(config, /initialTab="documents"/);
  assert.match(models, /Variáveis deste documento/);
  assert.match(models, /Visualizar modelo/);
});

test('runtime tabular canônico substitui as camadas 1.0.52 e 1.0.53', () => {
  const formatter = read('src/utils/tableFormatters.ts');
  const main = read('src/main.tsx');
  const css = readPortalCss();
  assert.match(formatter, /STATIC_PORTAL_TABLE_FORMAT/);
  assert.match(css, /color:\s*var\(--portal-text-dark\)/);
  assert.match(main, /PortalSpreadsheetRuntime/);
  assert.doesNotMatch(main, /PortalSettingsRuntime/);
  assert.match(main, /import '\.\/index\.css'/);
  assert.doesNotMatch(main, /PortalVersion1052Enhancer/);
  assert.doesNotMatch(main, /PortalVersion1053Enhancer/);
  assert.doesNotMatch(main, /PortalVersion1053PagerGuard/);
  assert.doesNotMatch(main, /portal-version-1052\.css/);
  assert.doesNotMatch(main, /portal-version-1053\.css/);
  assert.match(css, /data-portal-sheet="president"[\s\S]*data-portal-sticky-process/);
  assert.match(read('src/components/SettingsWorkspaceModal.tsx'), /data-portal-full-bleed/);
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
  const css = readPortalCss();
  for (const color of ['#fde68a', '#fdba74', '#bbf7d0', '#bfdbfe']) assert.match(css, new RegExp(color));
  for (const border of ['#d4a300', '#ea580c', '#16a34a', '#2563eb']) assert.match(css, new RegExp(border));
});
