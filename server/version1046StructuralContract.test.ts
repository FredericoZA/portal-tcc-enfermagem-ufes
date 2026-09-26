import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('release atual permanece 1.0.46 até a publicação da próxima versão', () => {
  assert.equal(JSON.parse(read('package.json')).version, '1.0.46');
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

test('configurações usam seis barras e workspace modal responsivo ao número de seções', () => {
  const config = read('src/pages/ConfiguracoesPage.tsx');
  const modal = read('src/components/SettingsWorkspaceModal.tsx');
  assert.match(config, /portal-settings-title-bar/);
  assert.doesNotMatch(config, /portal-settings-hub-card/);
  assert.match(modal, /var\(--portal-green-header\)/);
  assert.match(modal, /const hasNavigation = sections\.length > 1/);
  assert.match(modal, /\{hasNavigation && <aside/);
  assert.match(modal, /Navegação/);
});

test('estúdio de modelos usa uma única navegação principal e superfícies semânticas', () => {
  const studio = read('src/components/IntegrationStudioPanel.tsx');
  assert.match(studio, /portal-studio-tabs/);
  assert.match(studio, /md:grid-cols-\[220px_minmax\(0,1fr\)\]/);
  assert.match(studio, /var\(--portal-surface-layer-2\)/);
  assert.match(studio, /var\(--portal-green-action\)/);
});

test('tipografia tabular preta e CSS v46 carregado por último', () => {
  const formatter = read('src/utils/tableFormatters.ts');
  const main = read('src/main.tsx');
  assert.match(formatter, /cellTextColorClass = 'text-black'/);
  assert.ok(main.indexOf('portal-version-1046.css') > main.indexOf('portal-public-ux-1044.css'));
});
