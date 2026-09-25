import fs from 'node:fs';

const changed = new Set();

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content);
  changed.add(path);
}

function replaceOnce(path, oldText, newText, label) {
  let content = read(path);
  if (content.includes(newText)) return;
  if (!content.includes(oldText)) throw new Error(`${label}: trecho original não encontrado em ${path}`);
  content = content.replace(oldText, newText);
  write(path, content);
}

function mutate(path, label, mutateContent) {
  const content = read(path);
  const next = mutateContent(content);
  if (next === content) return;
  if (!next) throw new Error(`${label}: transformação vazia em ${path}`);
  write(path, next);
}

// App: os tokens semânticos passam a existir no elemento raiz e abastecem todo o CSS.
replaceOnce(
  'src/App.tsx',
  "import { PortalFeedbackController } from './components/PortalFeedbackController';",
  "import { PortalFeedbackController } from './components/PortalFeedbackController';\nimport { getPortalSemanticRootVars } from './utils/portalSemanticTokens';",
  'import dos tokens raiz',
);
replaceOnce(
  'src/App.tsx',
  '<div id="portal-app-root" className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-900">',
  '<div id="portal-app-root" className="min-h-screen flex flex-col font-sans antialiased text-slate-900" style={{ ...getPortalSemanticRootVars(), backgroundColor: \'var(--portal-surface-page)\' }}>',
  'superfície raiz',
);

// tableFormatters: qualquer filtro semântico usa a mesma paleta, independentemente da página.
replaceOnce(
  'src/utils/tableFormatters.ts',
  "import { tableInheritsGlobalAppearance } from './portalAppearanceLinks';",
  "import { tableInheritsGlobalAppearance } from './portalAppearanceLinks';\nimport { getPortalToneStyle, resolvePortalFilterTone } from './portalSemanticTokens';",
  'import semântico do formatador global',
);
replaceOnce(
  'src/utils/tableFormatters.ts',
  "  const dotColor = itemConfig.dotColor || '#eab308';\n\n  let buttonStyle: CSSProperties = {};",
  "  const dotColor = itemConfig.dotColor || '#eab308';\n  const semanticTone = resolvePortalFilterTone(key);\n\n  if (semanticTone) {\n    const semanticStyle = getPortalToneStyle(semanticTone);\n    return {\n      label,\n      emoji: '',\n      dotColor: String(semanticStyle.borderColor || dotColor),\n      buttonStyle: {\n        ...semanticStyle,\n        opacity: isSelected ? 1 : 0.7,\n        boxShadow: 'none',\n      } as CSSProperties,\n      badgeStyle: {\n        backgroundColor: semanticStyle.borderColor,\n        color: semanticStyle.color,\n      } as CSSProperties,\n      mode: 'full',\n      itemConfig,\n    };\n  }\n\n  let buttonStyle: CSSProperties = {};",
  'paleta global dos filtros',
);

// HomePage: o estado que filtra é exatamente o mesmo que colore calendário e processo.
replaceOnce(
  'src/pages/HomePage.tsx',
  "import { resolveInstallationProfile } from '../utils/installationProfile';",
  "import { resolveInstallationProfile } from '../utils/installationProfile';\nimport { DefenseFilter, DefenseState, formatDefenseCalendarSummary, getDefenseState, getDefenseStateFromTimes, matchesDefenseFilter } from '../utils/defenseSemantics';\nimport { getPortalToneCssVars } from '../utils/portalSemanticTokens';",
  'imports semânticos da Home',
);
replaceOnce(
  'src/pages/HomePage.tsx',
  "  const [defenseStatusFilter, setDefenseStatusFilter] = useState<'all' | 'pending' | 'concluded'>('all');",
  "  const [defenseStatusFilter, setDefenseStatusFilter] = useState<DefenseFilter>('all');",
  'tipo canônico do filtro de defesas',
);
replaceOnce(
  'src/pages/HomePage.tsx',
  "                    {(['all', 'pending', 'concluded'] as const).map((statusKey) => {\n                      const isSelected = defenseStatusFilter === statusKey;\n                      const fallbackLabel = statusKey === 'all' ? 'TODAS' : statusKey === 'pending' ? 'A DEFENDER' : 'JÁ DEFENDIDAS';\n                      const fallbackEmoji = statusKey === 'all' ? '📋' : statusKey === 'pending' ? '⏳' : '✅';\n                      const chip = getFilterChipProps(statusKey, isSelected, defensesTextFormat, fallbackLabel, fallbackEmoji);",
  "                    {(['all', 'upcoming', 'defended'] as const).map((statusKey) => {\n                      const isSelected = defenseStatusFilter === statusKey;\n                      const fallbackLabel = statusKey === 'all' ? 'TODAS' : statusKey === 'upcoming' ? 'A DEFENDER' : 'JÁ DEFENDIDAS';\n                      const chip = getFilterChipProps(statusKey, isSelected, defensesTextFormat, fallbackLabel, '');",
  'filtros canônicos da lista',
);
replaceOnce(
  'src/pages/HomePage.tsx',
  "              // Defense Status Filter\n              const isPast = new Date(proc.defesa.startAt).getTime() < Date.now();\n              if (defenseStatusFilter === 'pending' && isPast) return false;\n              if (defenseStatusFilter === 'concluded' && !isPast) return false;",
  "              // O mesmo estado semântico controla filtro e apresentação.\n              if (!matchesDefenseFilter(proc, defenseStatusFilter)) return false;",
  'predicado único da lista',
);
replaceOnce(
  'src/pages/HomePage.tsx',
  "            const renderDefensesBodyCell = (colKey: string, proc: any, progress: any, isPast: boolean, ev1: any, ev2: any, cleanInst: (s?: string) => string) => {",
  "            const renderDefensesBodyCell = (colKey: string, proc: any, progress: any, defenseState: DefenseState, ev1: any, ev2: any, cleanInst: (s?: string) => string) => {",
  'estado semântico no renderer da tabela',
);
mutate('src/pages/HomePage.tsx', 'botão de processo semântico', (content) => {
  if (content.includes('data-defense-state={defenseState}')) return content;
  const start = content.indexOf('            const renderDefensesBodyCell =');
  const end = content.indexOf("                case 'defesaDataHora':", start);
  if (start < 0 || end < 0) throw new Error('renderer da tabela de defesas não localizado');
  const section = content.slice(start, end);
  const old = '<div className={defStyles.firstColBtnClass}>';
  if (!section.includes(old)) throw new Error('botão da primeira coluna não localizado');
  const replacement = '<div className={`${defStyles.firstColBtnClass} portal-semantic-tone`} style={getPortalToneCssVars(defenseState)} data-defense-state={defenseState}>';
  return content.slice(0, start) + section.replace(old, replacement) + content.slice(end);
});
replaceOnce(
  'src/pages/HomePage.tsx',
  "                      const isPast = proc.defesa?.startAt ? new Date(proc.defesa.startAt).getTime() < Date.now() : false;",
  "                      const defenseState = getDefenseState(proc);",
  'estado da linha de defesa',
);
replaceOnce(
  'src/pages/HomePage.tsx',
  'renderDefensesBodyCell(colKey, proc, progress, isPast, ev1, ev2, cleanInst)',
  'renderDefensesBodyCell(colKey, proc, progress, defenseState, ev1, ev2, cleanInst)',
  'estado passado ao renderer',
);

replaceOnce(
  'src/pages/HomePage.tsx',
  "                        ? 'portal-core-calendar-weekend bg-slate-100/75 border-slate-200 cursor-default h-16 sm:h-20 text-slate-400'\n                        : hasEvents\n                          ? 'bg-slate-100/80 border-slate-300 cursor-pointer h-16 sm:h-20 shadow-2xs active:scale-[0.98]'\n                          : 'bg-white border-slate-200 cursor-default h-16 sm:h-20'",
  "                        ? 'portal-core-calendar-weekend border-slate-200 cursor-default min-h-[118px] text-slate-400'\n                        : hasEvents\n                          ? 'bg-white border-slate-300 cursor-pointer min-h-[118px] shadow-2xs active:scale-[0.98]'\n                          : 'bg-white border-slate-200 cursor-default min-h-[118px]'",
  'altura e superfície do calendário',
);
replaceOnce(
  'src/pages/HomePage.tsx',
  '<div key={`empty-lead-${idx}`} className="portal-calendar-empty-cell border-r border-b border-slate-200 bg-slate-50/20 h-16 sm:h-20" />',
  '<div key={`empty-lead-${idx}`} className="portal-calendar-empty-cell border-r border-b border-slate-200 min-h-[118px]" />',
  'células vazias iniciais',
);
replaceOnce(
  'src/pages/HomePage.tsx',
  '<div key={`empty-trail-${idx}`} className="portal-calendar-empty-cell border-r border-b border-slate-200 bg-slate-50/20 h-16 sm:h-20" />',
  '<div key={`empty-trail-${idx}`} className="portal-calendar-empty-cell border-r border-b border-slate-200 min-h-[118px]" />',
  'células vazias finais',
);
mutate('src/pages/HomePage.tsx', 'resumos dentro dos dias', (content) => {
  if (content.includes('portal-calendar-defense-summary') && content.includes('formatDefenseCalendarSummary(proc)')) return content;
  const startMarker = '                    {/* Small Count Indicator centered in the cell */}';
  const start = content.indexOf(startMarker);
  if (start < 0) throw new Error('indicador antigo do calendário não localizado');
  const end = content.indexOf('                  </div>\n                );', start);
  if (end < 0) throw new Error('fim da célula do calendário não localizado');
  const replacement = `                    {/* Resumos das defesas: estado, filtro e cor vêm da mesma fonte semântica. */}\n                    {hasEvents && (\n                      <div className="mt-1 flex-1 min-h-0 space-y-1 overflow-hidden w-full">\n                        {dayDefenses.slice(0, 2).map((proc) => {\n                          const defenseState = getDefenseState(proc);\n                          return (\n                            <span\n                              key={proc.id}\n                              className="portal-calendar-defense-summary portal-semantic-tone"\n                              style={getPortalToneCssVars(defenseState)}\n                              data-defense-state={defenseState}\n                              title={formatDefenseCalendarSummary(proc, 160)}\n                            >\n                              {formatDefenseCalendarSummary(proc)}\n                            </span>\n                          );\n                        })}\n                        {dayDefenses.length < 2 && dayGcal.slice(0, 2 - dayDefenses.length).map((ev) => {\n                          const defenseState = getDefenseStateFromTimes(ev.start, ev.end);\n                          const parsed = parseGcalEvent(ev);\n                          const startLabel = ev.start\n                            ? new Date(ev.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })\n                            : 'Horário a definir';\n                          const summary = startLabel + ' · ' + parsed.trabalho;\n                          return (\n                            <span\n                              key={ev.id}\n                              className="portal-calendar-defense-summary portal-semantic-tone"\n                              style={getPortalToneCssVars(defenseState)}\n                              data-defense-state={defenseState}\n                              title={summary}\n                            >\n                              {summary}\n                            </span>\n                          );\n                        })}\n                        {totalEvents > 2 && (\n                          <span className="block text-[9px] font-bold text-slate-600 px-1">\n                            +{totalEvents - 2} {totalEvents - 2 === 1 ? 'defesa' : 'defesas'}\n                          </span>\n                        )}\n                      </div>\n                    )}\n`;
  return content.slice(0, start) + replacement + content.slice(end);
});

// O runtime 1.0.40 não pode mais inferir estado pelo DOM nem buscar processos novamente.
mutate('src/components/PortalVersion1040Enhancer.tsx', 'remoção da inferência DOM de defesas', (content) => {
  if (!content.includes('function decorateDefenseList()') && !content.includes('enrichCalendarPreview')) return content;
  const start = content.indexOf('function decorateDefenseList()');
  const end = content.indexOf('function enhanceAll()', start);
  if (start < 0 || end < 0) throw new Error('bloco legado de defesas não localizado');
  let next = content.slice(0, start) + content.slice(end);
  next = next.replace('  decorateDefenseList();\n', '').replace('  void enrichCalendarPreview();\n', '');
  return next;
});

console.log(changed.size ? `Arquivos alterados: ${Array.from(changed).join(', ')}` : 'Refatoração já aplicada; nenhuma alteração necessária.');
