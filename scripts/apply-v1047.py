from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    Path(path).write_text(content)


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise RuntimeError(f'Trecho não encontrado: {label}')
    return source.replace(old, new, 1)


# 1) Calendário público e Lista de Defesas: semântica passa a morar no React.
home = read('src/pages/HomePage.tsx')

home = replace_once(
    home,
    '<div className={`${defStyles.calendarDaysHeaderClass} py-2.5 px-4 sm:px-6 select-none`} style={defStyles.bannerHeaderStyle}>',
    '<div className={`${defStyles.calendarDaysHeaderClass} portal-core-calendar-week-header py-2.5 px-4 sm:px-6 select-none`} style={defStyles.bannerHeaderStyle}>',
    'classe canônica do cabeçalho semanal',
)

home = replace_once(
    home,
    '<div className="grid grid-cols-[0.5fr_1.1fr_1.1fr_1.1fr_1.1fr_1.1fr_0.5fr] border-l border-t border-slate-200 min-h-[300px]">',
    '<div className="portal-core-calendar-grid grid grid-cols-[0.5fr_1.1fr_1.1fr_1.1fr_1.1fr_1.1fr_0.5fr] border-l border-t border-slate-200 min-h-[300px]">',
    'classe canônica da grade do calendário',
)

home = replace_once(
    home,
    """                const isPastDay = dateObj.getTime() < todayMidnight.getTime();\n\n                return (""",
    """                const isPastDay = dateObj.getTime() < todayMidnight.getTime();\n\n                const calendarPreviewItems = [\n                  ...dayDefenses.map((proc) => {\n                    const startAt = proc.defesa?.startAt || '';\n                    const time = startAt ? formatTimeExtenso(startAt) : '';\n                    return {\n                      key: `defense-${proc.id}`,\n                      title: `${time ? `${time} · ` : ''}${formatTccTitle(proc.titulo || 'Trabalho de Conclusão de Curso')}`,\n                      isPast: startAt ? new Date(startAt).getTime() < Date.now() : isPastDay,\n                    };\n                  }),\n                  ...dayGcal.map((ev) => {\n                    const parsed = parseGcalEvent(ev);\n                    const time = ev.start\n                      ? new Date(ev.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })\n                      : '';\n                    return {\n                      key: `gcal-${ev.id}`,\n                      title: `${time ? `${time} · ` : ''}${formatTccTitle(parsed.trabalho || 'Trabalho de Conclusão de Curso')}`,\n                      isPast: ev.start ? new Date(ev.start).getTime() < Date.now() : isPastDay,\n                    };\n                  }),\n                ];\n\n                return (""",
    'previews React do calendário',
)

home = home.replace('cursor-default h-16 sm:h-20 text-slate-400', 'cursor-default h-20 text-slate-500')
home = home.replace("cursor-pointer h-16 sm:h-20 shadow-2xs active:scale-[0.98]", "cursor-pointer h-20 shadow-2xs active:scale-[0.98]")
home = home.replace("cursor-default h-16 sm:h-20'", "cursor-default h-20'")

old_count_block = """                    {/* Small Count Indicator centered in the cell */}\n                    {hasEvents && (\n                      <div className=\"flex-1 flex items-center justify-center w-full\">\n                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-xs text-center shadow-xs border ${\n                          isPastDay\n                            ? 'text-slate-500 bg-slate-200/80 border-slate-300'\n                            : 'text-slate-900 bg-slate-200 border-slate-300'\n                        }`}>\n                          {totalEvents} {totalEvents === 1 ? 'DEFESA' : 'DEFESAS'}\n                        </span>\n                      </div>\n                    )}"""
new_preview_block = """                    {/* Resumo dos trabalhos do dia: usa os dados já carregados pelo React, sem segunda busca. */}\n                    {hasEvents && !isWeekend && (\n                      <div className=\"portal-core-calendar-previews\" aria-label={`Resumo de ${totalEvents} defesa(s) no dia ${dayNum}`}>\n                        {calendarPreviewItems.slice(0, 3).map((item) => (\n                          <div\n                            key={item.key}\n                            className={`portal-core-calendar-card ${item.isPast ? 'is-defended' : 'is-upcoming'}`}\n                            title={item.title}\n                          >\n                            <strong>{item.title}</strong>\n                          </div>\n                        ))}\n                        {calendarPreviewItems.length > 3 && (\n                          <span className=\"portal-core-calendar-more\">+{calendarPreviewItems.length - 3} defesa(s)</span>\n                        )}\n                      </div>\n                    )}"""
home = replace_once(home, old_count_block, new_preview_block, 'substituição do contador por resumos')

filter_anchor = """                      const chip = getFilterChipProps(statusKey, isSelected, defensesTextFormat, fallbackLabel, fallbackEmoji);\n\n                      return ("""
filter_replacement = """                      const chip = getFilterChipProps(statusKey, isSelected, defensesTextFormat, fallbackLabel, fallbackEmoji);\n                      const canonicalStatusStyle = statusKey === 'pending'\n                        ? { backgroundColor: 'var(--portal-upcoming-bg)', color: 'var(--portal-upcoming-text)', borderColor: 'var(--portal-upcoming-border)', boxShadow: 'none' }\n                        : statusKey === 'concluded'\n                          ? { backgroundColor: 'var(--portal-defended-bg)', color: 'var(--portal-defended-text)', borderColor: 'var(--portal-defended-border)', boxShadow: 'none' }\n                          : chip.buttonStyle;\n\n                      return ("""
home = replace_once(home, filter_anchor, filter_replacement, 'paleta canônica dos filtros da lista')

home = replace_once(
    home,
    '                          style={chip.buttonStyle}\n                          className={`portal-table-filter-chip',
    '                          style={canonicalStatusStyle}\n                          className={`portal-table-filter-chip',
    'filtro da Lista de Defesas usa paleta canônica',
)

marker = '            const renderDefensesBodyCell = (colKey: string, proc: any, progress: any, isPast: boolean, ev1: any, ev2: any, cleanInst: (s?: string) => string) => {'
pos = home.find(marker)
if pos < 0:
    raise RuntimeError('renderDefensesBodyCell não encontrado')
head, tail = home[:pos], home[pos:]
tail = replace_once(
    tail,
    '<div className={defStyles.firstColBtnClass}>',
    '<div data-defense-status={isPast ? \'concluded\' : \'pending\'} className={`${defStyles.firstColBtnClass} portal-defense-process-button ${isPast ? \'is-defended\' : \'is-upcoming\'}`}>',
    'botão de processo da Lista de Defesas',
)
home = head + tail
write('src/pages/HomePage.tsx', home)


# 2) Runtime estrutural deixa de apagar conteúdo React e deixa de decidir cor de processo.
runtime = read('src/components/PortalStructuralRuntime.tsx')
runtime, removed = re.subn(
    r"\nfunction normalizeDefenseRows\(table: HTMLTableElement\) \{.*?\n\}\n\nfunction enhanceTable",
    "\nfunction enhanceTable",
    runtime,
    count=1,
    flags=re.S,
)
if removed != 1:
    raise RuntimeError(f'normalizeDefenseRows não removido: {removed}')
runtime = runtime.replace('  normalizeDefenseRows(table);\n', '')
runtime = replace_once(
    runtime,
    """    // Limpa somente artefatos de versões antigas do enhancer. Não toca nos filhos React.\n    cell.querySelector('.portal-core-calendar-previews')?.remove();""",
    """    // Os resumos pertencem ao React; o runtime não remove nem recria conteúdo do calendário.""",
    'runtime não remove previews React',
)
write('src/components/PortalStructuralRuntime.tsx', runtime)


# 3) CSS canônico: fim de semana = mesmo fundo da aplicação e processo = mesma paleta do calendário.
core = read('src/portal-core-1043.css')
core = replace_once(core, '  background: #f8fafc !important;\n  color: #64748b !important;', '  background: #f1f5f9 !important;\n  color: #64748b !important;', 'fundo de fim de semana')
core = replace_once(
    core,
    '#portal-app-root main td[data-portal-core-process-state="defended"] > div {',
    '#portal-app-root main td[data-portal-core-process-state="defended"] > div,\n#portal-app-root main .portal-core-table .portal-defense-process-button.is-defended {',
    'processo defendido compartilha paleta',
)
core = replace_once(
    core,
    '#portal-app-root main td[data-portal-core-process-state="upcoming"] > div {',
    '#portal-app-root main td[data-portal-core-process-state="upcoming"] > div,\n#portal-app-root main .portal-core-table .portal-defense-process-button.is-upcoming {',
    'processo futuro compartilha paleta',
)
core = replace_once(
    core,
    '#portal-app-root main td[data-portal-core-process-state] > div * {',
    '#portal-app-root main td[data-portal-core-process-state] > div *,\n#portal-app-root main .portal-core-table .portal-defense-process-button.is-defended *,\n#portal-app-root main .portal-core-table .portal-defense-process-button.is-upcoming * {',
    'filhos dos botões herdam cor semântica',
)
write('src/portal-core-1043.css', core)

v46 = read('src/portal-version-1046.css')
pattern = re.compile(r"/\* Fim de semana claro e indisponível desde o primeiro render\. \*/.*?#formal-monthly-calendar-section \.portal-core-calendar-previews \{ display: none !important; \}\n", re.S)
v46, count = pattern.subn('/* Calendário controlado pelo React; esta camada não sobrescreve fundo nem previews. */\n', v46, count=1)
if count != 1:
    raise RuntimeError(f'override de calendário v46 não removido: {count}')
write('src/portal-version-1046.css', v46)


# 4) Contratos: versões históricas não congelam bugs nem o número da release corrente.
v46test = read('server/version1046StructuralContract.test.ts')
v46test, count = re.subn(
    r"test\('release atual é 1\.0\.46'.*?\n\}\);\n\n",
    "test('release 1.0.46 mantém sua folha estrutural carregada', () => {\n  assert.match(read('src/main.tsx'), /portal-version-1046\\.css/);\n});\n\n",
    v46test,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError('teste de versão 1.0.46 não atualizado')
v46test, count = re.subn(
    r"test\('estado de defesa não sobrescreve cores de vínculo e assinatura'.*?\n\}\);",
    "test('estado de defesa não sobrescreve cores de vínculo e assinatura', () => {\n  const runtime = read('src/components/PortalStructuralRuntime.tsx');\n  const home = read('src/pages/HomePage.tsx');\n  assert.doesNotMatch(runtime, /normalizeDefenseRows/);\n  assert.doesNotMatch(runtime, /fetch\\('\\/api\\/processes'/);\n  assert.match(home, /portal-defense-process-button/);\n});",
    v46test,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError('teste semântico v46 não atualizado')
write('server/version1046StructuralContract.test.ts', v46test)

write('server/version1047CalendarStatusContract.test.ts', r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('release atual é 1.0.47', () => {
  assert.equal(JSON.parse(read('package.json')).version, '1.0.47');
});

test('calendário renderiza resumos no React sem busca ou mutação paralela', () => {
  const home = read('src/pages/HomePage.tsx');
  const runtime = read('src/components/PortalStructuralRuntime.tsx');
  const v46 = read('src/portal-version-1046.css');
  assert.match(home, /calendarPreviewItems/);
  assert.match(home, /portal-core-calendar-previews/);
  assert.match(home, /portal-core-calendar-card/);
  assert.match(home, /formatTccTitle/);
  assert.doesNotMatch(runtime, /querySelector\('\.portal-core-calendar-previews'\)\?\.remove/);
  assert.doesNotMatch(runtime, /fetch\('\/api\/processes'/);
  assert.doesNotMatch(v46, /portal-core-calendar-previews\s*\{\s*display:\s*none/);
});

test('fim de semana usa exatamente o fundo slate-100 da aplicação', () => {
  const home = read('src/pages/HomePage.tsx');
  const core = read('src/portal-core-1043.css');
  assert.match(home, /portal-core-calendar-weekend bg-slate-100/);
  assert.match(core, /\.portal-core-calendar-weekend,[\s\S]*background: #f1f5f9 !important/);
});

test('Lista de Defesas liga filtro, estado e botão do processo à mesma paleta', () => {
  const home = read('src/pages/HomePage.tsx');
  const core = read('src/portal-core-1043.css');
  assert.match(home, /canonicalStatusStyle/);
  assert.match(home, /var\(--portal-upcoming-bg\)/);
  assert.match(home, /var\(--portal-defended-bg\)/);
  assert.match(home, /portal-defense-process-button/);
  assert.match(home, /data-defense-status=\{isPast \? 'concluded' : 'pending'\}/);
  assert.match(core, /portal-defense-process-button\.is-defended/);
  assert.match(core, /portal-defense-process-button\.is-upcoming/);
});
''')

print('Migração 1.0.47 aplicada.')
