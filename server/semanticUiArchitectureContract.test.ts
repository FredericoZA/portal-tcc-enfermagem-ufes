import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { readPortalCss } from './testUtils/portalCss';
const source = (path: string) => readFile(path, 'utf8');

test('paleta semântica possui uma única fonte de valores no CSS canônico', async () => {
  const [main, tokens, css] = await Promise.all([
    source('src/main.tsx'),
    source('src/utils/portalSemanticTokens.ts'),
    readPortalCss(),
  ]);

  assert.ok(main.includes("import './index.css';"));
  assert.ok(tokens.includes("PORTAL_THEME.semantic.defense"));
  assert.ok(tokens.includes('resolvePortalFilterTone'));
  assert.ok(css.includes('--portal-surface-page: #f1f5f9'));
  assert.ok(css.includes('--portal-defense-defended-bg: #bed8c3'));
  assert.ok(css.includes('--portal-defense-upcoming-bg: #e8dda7'));
  assert.ok(css.includes('background: var(--portal-tone-bg)'));
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

test('calendário mantém superfície do portal e mostra horário, título e alunos dos TCCs do dia', async () => {
  const [home, semantics, semanticCss] = await Promise.all([
    source('src/pages/HomePage.tsx'),
    source('src/utils/defenseSemantics.ts'),
    readPortalCss(),
  ]);

  assert.ok(home.includes('portal-core-calendar-weekend'));
  assert.ok(home.includes('portal-calendar-defense-summary'));
  assert.ok(home.includes('getDefenseCalendarSummaryParts(proc)'));
  assert.ok(home.includes('portal-calendar-defense-primary'));
  assert.ok(home.includes('portal-calendar-defense-secondary'));
  assert.ok(home.includes('getDefenseStateFromTimes(ev.start, ev.end)'));
  assert.ok(home.includes('{dayDefenses.map((proc) => {'));
  assert.ok(home.includes('{dayGcal.map((ev) => {'));
  assert.ok(!home.includes('dayDefenses.slice(0, 2)'));
  assert.ok(!home.includes('dayGcal.slice(0, 2 - dayDefenses.length)'));
  assert.ok(semantics.includes('process.aluno1?.nome'));
  assert.ok(semantics.includes('process.aluno2?.nome'));
  assert.ok(semanticCss.includes('.portal-calendar-day-cell'));
  assert.ok(semanticCss.includes('.portal-calendar-empty-cell'));
  assert.ok(semanticCss.includes('background: var(--portal-surface-panel)'));
  assert.ok(!semanticCss.includes('.portal-core-calendar-weekend *'));
});

test('runtime visual legado não participa mais do bootstrap', async () => {
  const main = await source('src/main.tsx');
  assert.ok(!main.includes('PortalVersion1040Enhancer'));
  assert.ok(!main.includes('PortalSettingsRuntime'));
});

test('filtros semânticos de todas as tabelas passam pelo resolvedor global por chave ou rótulo', async () => {
  const formatter = await source('src/utils/tableFormatters.ts');
  assert.ok(formatter.includes('resolvePortalFilterTone(key)'));
  assert.ok(formatter.includes("resolvePortalFilterTone(itemConfig.key || '')"));
  assert.ok(formatter.includes('resolvePortalFilterTone(label)'));
  assert.ok(formatter.includes("resolvePortalFilterTone(fallbackLabel || '')"));
  assert.ok(formatter.includes('getPortalToneStyle(semanticTone)'));
  assert.ok(formatter.includes("emoji: ''"));
});

test('agenda pública reutiliza o mesmo estado semântico da lista e do calendário', async () => {
  const agenda = await source('src/pages/AgendaPage.tsx');
  assert.ok(agenda.includes('const defenseState = getDefenseState(proc);'));
  assert.ok(agenda.includes('getPortalToneCssVars(defenseState)'));
  assert.ok(agenda.includes('<PortalProcessPill value={proc.protocolo || proc.id} tone={defenseState}'));
});
