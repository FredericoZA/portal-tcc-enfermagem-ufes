import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('release atual é 1.0.54', () => {
  assert.equal(JSON.parse(read('package.json')).version, '1.0.54');
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

test('configurações usam barras e workspace modal canônico', () => {
  const config = read('src/pages/ConfiguracoesPage.tsx');
  const modal = read('src/components/SettingsWorkspaceModal.tsx');
  const v52 = read('src/components/PortalVersion1052Enhancer.tsx');
  assert.match(config, /portal-settings-title-bar/);
  assert.doesNotMatch(config, /portal-settings-hub-card/);
  assert.match(modal, /var\(--portal-green-header\)/);
  assert.match(modal, /singlePane = sections\.length === 1/);
  assert.match(v52, /Rodapé e Identidade/);
  assert.match(v52, /Integrações e Plataforma/);
  assert.match(v52, /data-portal-v52-settings-integrations/);
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

test('tipografia tabular preta e CSS v53 carregado por último', () => {
  const formatter = read('src/utils/tableFormatters.ts');
  const main = read('src/main.tsx');
  const css = read('src/portal-version-1053.css');
  assert.match(formatter, /cellTextColorClass = 'text-black'/);
  assert.ok(main.indexOf('portal-version-1053.css') > main.indexOf('portal-version-1052.css'));
  assert.ok(main.indexOf('PortalVersion1053Enhancer') > -1);
  assert.match(css, /data-portal-v53-sticky-process/);
  assert.match(css, /data-portal-v53-direct-sheet/);
  assert.match(css, /data-portal-v53-orphan/);
});

test('paginação preserva todas as linhas React e cria páginas reais', () => {
  const v52 = read('src/components/PortalVersion1052Enhancer.tsx');
  assert.match(v52, /config\.recordsLimit = 'all'/);
  assert.match(v52, /portal-pagination-hidden/);
  assert.match(v52, /Math\.ceil\(visibleRows\.length \/ pageSize\)/);
  assert.match(v52, /Anterior/);
  assert.match(v52, /Próxima/);
  assert.match(v52, /portal_table_page_size_/);
});

test('planilhas têm Todos, processo fixo e seleção do Presidente', () => {
  const v52 = read('src/components/PortalVersion1052Enhancer.tsx');
  const v53 = read('src/components/PortalVersion1053Enhancer.tsx');
  assert.match(v52, /enhanceMyTccFilters/);
  assert.match(v52, /enhancePresidentFilters/);
  assert.match(v53, /portalV53StickyProcess/);
  assert.match(v53, /portalV53StickySelection/);
  assert.match(v53, /portalV53AllActive/);
  assert.match(v53, /portalV53Orphan/);
});

test('rolagem 1.0.53 usa ponteiro e wheel no mesmo host', () => {
  const wrapper = read('src/components/TableScrollWrapper.tsx');
  const v53 = read('src/components/PortalVersion1053Enhancer.tsx');
  assert.match(wrapper, /data-portal-scroll-host/);
  assert.match(v53, /pointerdown/);
  assert.match(v53, /pointermove/);
  assert.match(v53, /wheel/);
  assert.match(v53, /scrollTop/);
  assert.match(v53, /scrollLeft/);
});

test('quatro papéis usam famílias cromáticas distintas', () => {
  const tokens = read('src/utils/portalSemanticTokens.ts');
  for (const color of ['#e9d46f', '#dea09b', '#9ecde2', '#c6afe3']) assert.match(tokens, new RegExp(color));
});
