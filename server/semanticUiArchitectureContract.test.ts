import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path: string) => readFile(path, 'utf8');

test('paleta semântica possui uma única fonte TypeScript e uma camada CSS permanente', async () => {
  const [main, app, tokens, semanticCss, versionCss] = await Promise.all([
    source('src/main.tsx'),
    source('src/App.tsx'),
    source('src/utils/portalSemanticTokens.ts'),
    source('src/portal-semantic-ui.css'),
    source('src/portal-version-1046.css'),
  ]);

  assert.ok(main.includes("import './portal-semantic-ui.css';"));
  assert.ok(app.includes('getPortalSemanticRootVars()'));
  assert.ok(tokens.includes("page: '#f1f5f9'"));
  assert.ok(tokens.includes('getPortalSemanticRootVars'));
  assert.ok(tokens.includes('resolvePortalFilterTone'));
  assert.ok(semanticCss.includes('background: var(--portal-tone-bg) !important;'));
  assert.ok(semanticCss.includes('background: var(--portal-surface-page) !important;'));
  assert.ok(!versionCss.includes('#c2d0c2'));
  assert.ok(!versionCss.includes('#d4c69a'));
});

test('lista de defesas usa uma única regra para filtrar e colorir o processo', async () => {
  const home = await source('src/pages/HomePage.tsx');

  assert.ok(home.includes("useState<DefenseFilter>('all')"));
  assert.ok(home.includes("(['all', 'upcoming', 'defended'] as const)"));
  assert.ok(home.includes('matchesDefenseFilter(proc, defenseStatusFilter)'));
  assert.ok(home.includes('const defenseState = getDefenseState(proc);'));
  assert.ok(home.includes('style={getPortalToneCssVars(defenseState)}'));
  assert.ok(home.includes('data-defense-state={defenseState}'));
  assert.ok(!home.includes("defenseStatusFilter === 'pending' && isPast"));
  assert.ok(!home.includes("defenseStatusFilter === 'concluded' && !isPast"));
});

test('calendário mantém superfície do portal e mostra resumo textual dos TCCs', async () => {
  const [home, semanticCss] = await Promise.all([
    source('src/pages/HomePage.tsx'),
    source('src/portal-semantic-ui.css'),
  ]);

  assert.ok(home.includes('portal-core-calendar-weekend'));
  assert.ok(home.includes('portal-calendar-defense-summary'));
  assert.ok(home.includes('formatDefenseCalendarSummary(proc)'));
  assert.ok(home.includes('getDefenseStateFromTimes(ev.start, ev.end)'));
  assert.ok(semanticCss.includes('.portal-calendar-day-cell.portal-core-calendar-weekend'));
  assert.ok(semanticCss.includes('.portal-calendar-empty-cell'));
  assert.ok(semanticCss.includes('background: var(--portal-surface-page) !important;'));
  assert.ok(!semanticCss.includes('.portal-core-calendar-weekend *'));
});

test('runtime legado não infere mais estado de defesa pelo DOM nem duplica a busca de processos', async () => {
  const enhancer = await source('src/components/PortalVersion1040Enhancer.tsx');
  assert.ok(!enhancer.includes('decorateDefenseList'));
  assert.ok(!enhancer.includes('enrichCalendarPreview'));
  assert.ok(!enhancer.includes("fetch('/api/processes'"));
});

test('filtros semânticos de todas as tabelas passam pelo resolvedor global', async () => {
  const formatter = await source('src/utils/tableFormatters.ts');
  assert.ok(formatter.includes('resolvePortalFilterTone(key)'));
  assert.ok(formatter.includes('getPortalToneStyle(semanticTone)'));
  assert.ok(formatter.includes("emoji: ''"));
});

test('agenda pública reutiliza o mesmo estado semântico da lista e do calendário', async () => {
  const agenda = await source('src/pages/AgendaPage.tsx');
  assert.ok(agenda.includes('const defenseState = getDefenseState(proc);'));
  assert.ok(agenda.includes('getPortalToneCssVars(defenseState)'));
  assert.ok(agenda.includes('<PortalProcessPill value={proc.protocolo || proc.id} tone={defenseState}'));
});
