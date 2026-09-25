import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('release atual é 1.0.46', () => {
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

test('configurações usam seis barras e workspace modal com navegação lateral', () => {
  const config = read('src/pages/ConfiguracoesPage.tsx');
  const modal = read('src/components/SettingsWorkspaceModal.tsx');
  assert.match(config, /portal-settings-title-bar/);
  assert.doesNotMatch(config, /portal-settings-hub-card/);
  assert.match(modal, /bg-\[#005830\]/);
  assert.match(modal, /Navegação/);
});

test('estúdio de modelos usa navegação lateral e cabeçalho interno verde', () => {
  const studio = read('src/components/IntegrationStudioPanel.tsx');
  assert.match(studio, /md:w-56/);
  assert.match(studio, /Editor de modelos e variáveis/);
  assert.match(studio, /bg-\[#337959\]/);
});

test('tipografia tabular preta e CSS v46 carregado por último', () => {
  const formatter = read('src/utils/tableFormatters.ts');
  const main = read('src/main.tsx');
  assert.match(formatter, /cellTextColorClass = 'text-black'/);
  assert.ok(main.indexOf('portal-version-1046.css') > main.indexOf('portal-public-ux-1044.css'));
});
