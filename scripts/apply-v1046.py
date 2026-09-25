from pathlib import Path
import json
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    Path(path).write_text(content)


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise RuntimeError(f'Trecho não encontrado: {label}')
    return source.replace(old, new, 1)


def replace_regex(source: str, pattern: str, replacement: str, label: str, flags=re.S) -> str:
    result, count = re.subn(pattern, replacement, source, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'Padrão não encontrado ou ambíguo: {label} ({count})')
    return result

# -----------------------------------------------------------------------------
# 1. Versão e CSS final
# -----------------------------------------------------------------------------
pkg = json.loads(read('package.json'))
pkg['version'] = '1.0.46'
write('package.json', json.dumps(pkg, indent=2, ensure_ascii=False) + '\n')

main = read('src/main.tsx')
if "./portal-version-1046.css" not in main:
    main = replace_once(main, "import './portal-public-ux-1044.css';", "import './portal-public-ux-1044.css';\nimport './portal-version-1046.css';", 'import CSS v46')
write('src/main.tsx', main)

write('src/portal-version-1046.css', r'''/* Portal TCC 1.0.46 — consolidação estrutural de UX. */
:root {
  --portal-v46-green-dark: #005830;
  --portal-v46-green: #337959;
  --portal-v46-gray: #d5dce0;
}

/* Conteúdo comum das planilhas: preto, normal e sem envelhecimento visual. */
#portal-app-root main .portal-core-table tbody tr,
#portal-app-root main .portal-core-table tbody td {
  opacity: 1 !important;
  filter: none !important;
  color: #000 !important;
}
#portal-app-root main .portal-core-table tbody td [class*="text-slate-"],
#portal-app-root main .portal-core-table tbody td [class*="opacity-"] {
  color: #000 !important;
  opacity: 1 !important;
  filter: none !important;
}

/* Processo por vínculo: uma única fonte semântica de cor. */
.portal-role-process-button {
  background: var(--portal-role-bg) !important;
  border-color: var(--portal-role-border) !important;
  color: var(--portal-role-text) !important;
  box-shadow: none !important;
}
.portal-role-process-button * {
  color: var(--portal-role-text) !important;
  opacity: 1 !important;
}

/* Estados foscos e institucionais, sem verde/amarelo fluorescente. */
.portal-process-pill { box-shadow: none !important; }
.portal-tone-defended,
.portal-tone-signed { background: #c2d0c2 !important; border-color: #7e907e !important; color: #263728 !important; }
.portal-tone-upcoming,
.portal-tone-pending { background: #d4c69a !important; border-color: #9e8f63 !important; color: #453d25 !important; }
.portal-tone-student { background: #d8c98f !important; border-color: #9b884b !important; color: #3e361c !important; }
.portal-tone-board { background: #c9a39a !important; border-color: #8c5e55 !important; color: #402824 !important; }
.portal-tone-evaluator { background: #9db8c0 !important; border-color: #587884 !important; color: #20363e !important; }
.portal-tone-viewer { background: #b4a6be !important; border-color: #75647f !important; color: #342b39 !important; }

/* Fim de semana claro e indisponível desde o primeiro render. */
#formal-monthly-calendar-section .portal-calendar-day-cell.portal-core-calendar-weekend {
  background: #eef1f2 !important;
  color: #94a3b8 !important;
  cursor: default !important;
  box-shadow: none !important;
}
#formal-monthly-calendar-section .portal-calendar-day-cell.portal-core-calendar-weekend * {
  color: #94a3b8 !important;
}
#formal-monthly-calendar-section .portal-core-calendar-previews { display: none !important; }

/* Configurações: barras compactas em vez de cartões grandes. */
#portal-settings-hub.portal-settings-list {
  display: flex !important;
  flex-direction: column !important;
  gap: 8px !important;
}
#portal-settings-hub .portal-settings-title-bar {
  min-height: 58px !important;
  transition: background-color .12s ease, border-color .12s ease !important;
}
#portal-settings-hub .portal-settings-title-bar:hover {
  background: #cbd4d8 !important;
  border-color: #9ca9af !important;
}
.portal-settings-workspace-content .portal-workspace,
.portal-settings-workspace-content #audit-logs-page,
.portal-settings-workspace-content #asten-logs-page { margin-top: 0 !important; }
#portal-models-workspace .portal-studio { min-height: 68vh !important; }

/* O editor de Personalização adota o mesmo cabeçalho dos demais workspaces. */
.portal-modal-surface > div:first-child {
  background: var(--portal-v46-green-dark) !important;
  color: #fff !important;
  border-bottom: 16px solid #fff !important;
}
.portal-modal-surface > div:first-child #portal-customization-title { color: #fff !important; }
.portal-modal-surface > div:first-child button {
  background: #fff !important;
  color: #000 !important;
  border-color: #fff !important;
}
.portal-modal-surface > div:first-child button * { color: #000 !important; }
''')

# -----------------------------------------------------------------------------
# 2. Runtime: corrige a causa dos botões e remove o carregamento paralelo do calendário
# -----------------------------------------------------------------------------
path = 'src/components/PortalStructuralRuntime.tsx'
s = read(path)
s = s.replace("let calendarProcesses: any[] | null = null;\nlet calendarFetch: Promise<any[]> | null = null;\n", '')
s = replace_once(
    s,
    "function normalizeDefenseRows(table: HTMLTableElement) {\n  const headers = Array.from(table.tHead?.rows[0]?.cells || []) as HTMLTableCellElement[];",
    "function normalizeDefenseRows(table: HTMLTableElement) {\n  // Data da defesa só determina cor na planilha pública. Em telas restritas, a cor\n  // do processo representa vínculo ou assinatura e não pode ser sobrescrita aqui.\n  if (!table.closest('#formal-monthly-calendar-section')) return;\n  const headers = Array.from(table.tHead?.rows[0]?.cells || []) as HTMLTableCellElement[];",
    'escopo da classificação temporal'
)
s = replace_regex(
    s,
    r"function dateKey\(value: string\) \{.*?\nfunction enhanceAll\(\) \{",
    r'''function enhanceCalendar() {
  const period = calendarPeriod();
  const firstCell = document.querySelector<HTMLElement>('.portal-calendar-day-cell');
  const grid = firstCell?.parentElement;
  if (!period || !grid) return;
  grid.classList.add('portal-core-calendar-grid');
  const daysHeader = grid.parentElement?.previousElementSibling as HTMLElement | null;
  daysHeader?.classList.add('portal-core-calendar-week-header');
  if (!grid.isConnected) return;

  grid.querySelectorAll<HTMLElement>('.portal-calendar-day-cell').forEach((cell) => {
    const day = Number(cell.querySelector(':scope > div:first-child span')?.textContent?.trim() || cell.querySelector('span')?.textContent?.trim());
    if (!day) return;
    const weekday = new Date(period.year, period.month, day).getDay();
    const weekend = weekday === 0 || weekday === 6;
    cell.classList.toggle('portal-core-calendar-weekend', weekend);
    cell.setAttribute('aria-disabled', weekend ? 'true' : 'false');
    if (!cell.dataset.portalCoreWeekendGuard) {
      cell.dataset.portalCoreWeekendGuard = 'true';
      cell.addEventListener('click', (event) => {
        if (!cell.classList.contains('portal-core-calendar-weekend')) return;
        event.preventDefault();
        event.stopPropagation();
      }, true);
    }
    // Limpa somente artefatos de versões antigas do enhancer. Não toca nos filhos React.
    cell.querySelector('.portal-core-calendar-previews')?.remove();
  });
}

function enhanceAll() {''',
    'calendário assíncrono do enhancer'
)
s = s.replace('  void enhanceCalendar();', '  enhanceCalendar();')
write(path, s)

# -----------------------------------------------------------------------------
# 3. Calendário React e linhas antigas da planilha pública
# -----------------------------------------------------------------------------
path = 'src/pages/HomePage.tsx'
s = read(path)
s = replace_once(
    s,
    "                const colIndex = cellIndex % 7;\n                const isTopHalf = rowIndex <= 2;",
    "                const colIndex = cellIndex % 7;\n                const isWeekend = colIndex === 0 || colIndex === 6;\n                const isTopHalf = rowIndex <= 2;",
    'isWeekend nativo'
)
s = replace_once(
    s,
    "                    onClick={() => {\n                      if (hasEvents) {\n                        setSelectedDayDefenses(dayDefenses.length > 0 ? dayDefenses : null);\n                        setSelectedDayGcalEvents(dayGcal.length > 0 ? dayGcal : null);\n                      }\n                    }}",
    "                    onClick={() => {\n                      if (hasEvents && !isWeekend) {\n                        setSelectedDayDefenses(dayDefenses.length > 0 ? dayDefenses : null);\n                        setSelectedDayGcalEvents(dayGcal.length > 0 ? dayGcal : null);\n                      }\n                    }}\n                    aria-disabled={isWeekend ? true : undefined}",
    'clique imediato da agenda'
)
s = replace_once(
    s,
    "                      hasEvents\n                        ? isPastDay\n                          ? 'bg-slate-100/90 hover:bg-slate-200/80 border-slate-300 cursor-pointer h-16 sm:h-20 shadow-2xs text-slate-500 active:scale-[0.98]'\n                          : 'bg-slate-100/80 hover:bg-slate-200/90 border-slate-300 cursor-pointer h-16 sm:h-20 shadow-2xs active:scale-[0.98]'\n                        : 'bg-white hover:bg-slate-50 border-slate-200 cursor-default h-16 sm:h-20'",
    "                      isWeekend\n                        ? 'portal-core-calendar-weekend bg-slate-100/75 border-slate-200 cursor-default h-16 sm:h-20 text-slate-400'\n                        : hasEvents\n                          ? 'bg-slate-100/80 border-slate-300 cursor-pointer h-16 sm:h-20 shadow-2xs active:scale-[0.98]'\n                          : 'bg-white border-slate-200 cursor-default h-16 sm:h-20'",
    'cores do calendário'
)
s = replace_once(
    s,
    "                    title={hasEvents ? `Clique para abrir as ${totalEvents} defesas do dia ${dayNum}` : undefined}",
    "                    title={isWeekend ? 'Fim de semana — indisponível para defesas' : hasEvents ? `Clique para abrir as ${totalEvents} defesas do dia ${dayNum}` : undefined}",
    'tooltip de fim de semana'
)
s = replace_once(
    s,
    "                          className={`transition-all duration-200 ${\n                            isPast\n                              ? 'bg-slate-100/40 text-slate-400 opacity-60'\n                              : `${defStyles.rowZebraClass} hover:bg-slate-100/60 ${defStyles.cellTextColorClass}`\n                          }`}",
    "                          className={`transition-all duration-200 ${defStyles.rowZebraClass} ${defStyles.cellTextColorClass}`}",
    'remoção do fosqueamento de defesas passadas'
)
write(path, s)

# -----------------------------------------------------------------------------
# 4. Tipografia tabular global
# -----------------------------------------------------------------------------
path = 'src/utils/tableFormatters.ts'
s = read(path)
s = replace_regex(
    s,
    r"  // Cell Text Color\n  let cellTextColorClass = 'text-slate-900';.*?\n\n  // Column Borders & Zebra Striping",
    "  // Cell Text Color — contrato global: conteúdo comum das células é preto.\n  const cellTextColorClass = 'text-black';\n\n  // Column Borders & Zebra Striping",
    'cellTextColorClass'
)
write(path, s)

# -----------------------------------------------------------------------------
# 5. Meus TCCs: filtro e processo compartilham exatamente os mesmos tokens
# -----------------------------------------------------------------------------
path = 'src/pages/MeusProcessosPage.tsx'
s = read(path)
s = replace_once(s, "                  const chip = getFilterChipProps(catKey.toLowerCase(), isSelected, meusProcessosTextFormat, cfg.label);\n\n                  return (", "                  return (", 'chip paralelo de vínculo')
s = replace_once(s, "                      style={chip.buttonStyle}", "                      style={{ backgroundColor: cfg.bgColor, color: cfg.textHex, borderColor: cfg.borderColor, opacity: isSelected ? 1 : 0.62, boxShadow: isSelected ? `inset 0 0 0 1px ${cfg.borderColor}` : 'none' }}", 'estilo do filtro por vínculo')
s = s.replace("title={`Clique para ${isSelected ? 'isolar ou alternar' : 'exibir'} TCCs com papel de ${chip.label}`}", "title={`Clique para ${isSelected ? 'isolar ou alternar' : 'exibir'} TCCs com papel de ${cfg.label}`}")
s = s.replace("style={{ backgroundColor: chip.dotColor }}", "style={{ backgroundColor: cfg.borderColor }}")
s = s.replace('<span className="whitespace-nowrap font-extrabold">{chip.label}</span>', '<span className="whitespace-nowrap font-extrabold">{cfg.label}</span>')
s = s.replace('style={chip.badgeStyle}', "style={{ backgroundColor: cfg.borderColor, color: '#ffffff' }}", 1)
s = replace_once(
    s,
    "                  className={styles.firstColBtnClass}\n                  style={{ backgroundColor: roleConfig.bgColor, borderColor: roleConfig.borderColor, color: roleConfig.textHex }}",
    "                  className={`${styles.firstColBtnClass} portal-role-process-button`}\n                  style={{ '--portal-role-bg': roleConfig.bgColor, '--portal-role-border': roleConfig.borderColor, '--portal-role-text': roleConfig.textHex } as React.CSSProperties}",
    'processo por vínculo'
)
write(path, s)

# -----------------------------------------------------------------------------
# 6. Presidência: filtro e processo refletem assinatura real/conclusão
# -----------------------------------------------------------------------------
path = 'src/pages/CoordenadorPage.tsx'
s = read(path)
s = replace_once(
    s,
    "        const status = getDeclarationStatus(proc.id);\n        const signed = status.label === 'Assinada';\n        const tone = signed ? PORTAL_SEMANTIC_COLORS.signature.signed : PORTAL_SEMANTIC_COLORS.signature.pending;",
    "        const job = getDeclarationJob(proc.id);\n        const signed = proc.status === 'CONCLUIDO' || Boolean(job && ['SIGNED', 'DRIVE_SYNC_PENDING', 'ARCHIVED'].includes(job.status));\n        const tone = signed ? PORTAL_SEMANTIC_COLORS.signature.signed : PORTAL_SEMANTIC_COLORS.signature.pending;",
    'estado da pílula da Presidência'
)
old_filter = '''                    const isSelected = activeTab === filter.tab;
                    const chip = getFilterChipProps(filter.key, isSelected, coordTextFormat, filter.label);
                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => { setActiveTab(filter.tab); setSelectedIds([]); }}
                        data-selected={isSelected ? 'true' : 'false'}
                        aria-pressed={isSelected}
                        style={chip.buttonStyle}'''
new_filter = '''                    const isSelected = activeTab === filter.tab;
                    const chip = getFilterChipProps(filter.key, isSelected, coordTextFormat, filter.label);
                    const semanticTone = filter.key === 'assinadas' ? PORTAL_SEMANTIC_COLORS.signature.signed : PORTAL_SEMANTIC_COLORS.signature.pending;
                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => { setActiveTab(filter.tab); setSelectedIds([]); }}
                        data-selected={isSelected ? 'true' : 'false'}
                        aria-pressed={isSelected}
                        style={{ backgroundColor: semanticTone.bg, color: semanticTone.text, borderColor: semanticTone.border, opacity: isSelected ? 1 : 0.62, boxShadow: isSelected ? `inset 0 0 0 1px ${semanticTone.border}` : 'none' }}'''
s = replace_once(s, old_filter, new_filter, 'filtro de assinatura')
s = s.replace("style={{ backgroundColor: filter.key === 'assinadas' ? '#22a06b' : '#f4b400' }}", "style={{ backgroundColor: semanticTone.border }}")
# O primeiro badge posterior a esse filtro passa a usar a mesma paleta.
filter_pos = s.index("const semanticTone = filter.key === 'assinadas'")
badge_pos = s.index('style={chip.badgeStyle}', filter_pos)
if badge_pos < 0:
    raise RuntimeError('Badge do filtro da Presidência não encontrado')
s = s[:badge_pos] + "style={{ backgroundColor: semanticTone.border, color: '#ffffff' }}" + s[badge_pos + len('style={chip.badgeStyle}'):]
# Histórico concluído não deve ficar cinza.
s = s.replace("className={`hover:bg-slate-50 transition-colors text-slate-600 ${isSelected ? 'bg-emerald-50/40' : ''}`}", "className={`transition-colors text-black ${isSelected ? 'bg-emerald-50/40' : ''}`}")
write(path, s)

# -----------------------------------------------------------------------------
# 7. Indicadores: backend passa a cumprir o contrato que o frontend já renderiza
# -----------------------------------------------------------------------------
write('server/publicIndicators.ts', r'''import type { ProcessData } from '../src/types';

export type PublicIndicatorBucket = { label: string; count: number; key?: string };
export type PublicIndicatorsPayload = {
  generatedAt: string;
  privacy: { containsPersonalData: false; smallGroupSuppressed: boolean; minimumGroupSize: number; minimumBucketSize: number };
  totals: { registered: number; completed: number; published: number; defended: number; inProgress: number; completionRate: number; publicationRate: number; coauthorRate: number };
  descriptive: null | { monthlyMean: number; monthlyMedian: number; monthlyStdDev: number; peakMonth: string | null; peakMonthCount: number; completionDaysMean: number; completionDaysMedian: number; observedMonths: number };
  byStatus: Array<{ key: string; label: string; count: number }>;
  years: PublicIndicatorBucket[];
  months: PublicIndicatorBucket[];
  themes: PublicIndicatorBucket[];
  workTypes: PublicIndicatorBucket[];
  locations: PublicIndicatorBucket[];
  outcomes: PublicIndicatorBucket[];
  formats: PublicIndicatorBucket[];
  weekdays: PublicIndicatorBucket[];
  dayparts: PublicIndicatorBucket[];
};

const MIN_PUBLIC_GROUP_SIZE = 5;
const MIN_PUBLIC_BUCKET_SIZE = 3;
const TIME_ZONE = 'America/Sao_Paulo';
const STATUS_LABELS: Record<string, string> = {
  EM_RASCUNHO: 'Em rascunho',
  AGUARDANDO_CONFIRMACAO_LOCAL: 'Confirmando local',
  AGUARDANDO_DEFESA: 'Aguardando defesa',
  EM_AVALIACAO: 'Em avaliação',
  AGUARDANDO_DADOS_FINAIS: 'Dados finais',
  AGUARDANDO_ASSINATURA: 'Assinaturas',
  CONCLUIDO: 'Concluído',
};
const WORK_TYPE_LABELS: Record<string, string> = { MONOGRAFIA: 'Monografia', ARTIGO: 'Artigo', OUTRO: 'Outro' };

const round1 = (value: number) => Number(value.toFixed(1));
const clean = (value: string) => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const stddev = (values: number[]) => {
  if (!values.length) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
};
const countBuckets = (values: string[], limit?: number): PublicIndicatorBucket[] => {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    if (value) acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  return (limit ? sorted.slice(0, limit) : sorted).map(([label, count]) => ({ label, count }));
};
const publicBuckets = (items: PublicIndicatorBucket[]) => items.filter((item) => item.count >= MIN_PUBLIC_BUCKET_SIZE);
const formatPart = (iso: string, options: Intl.DateTimeFormatOptions) => {
  try { return new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, ...options }).format(new Date(iso)); }
  catch { return ''; }
};
const yearMonth = (iso: string) => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit' }).formatToParts(new Date(iso));
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    return year && month ? `${year}-${month}` : '';
  } catch { return ''; }
};

export function buildPublicIndicators(processes: ProcessData[], now = Date.now()): PublicIndicatorsPayload {
  const safe = Array.isArray(processes) ? processes : [];
  const total = safe.length;
  const smallGroupSuppressed = total > 0 && total < MIN_PUBLIC_GROUP_SIZE;
  const completedItems = safe.filter((process) => process.status === 'CONCLUIDO');
  const completed = completedItems.length;
  const published = safe.filter((process) => process.acervo?.publicationState === 'PUBLIC' || (process.acervo?.isPublic && Boolean(process.acervo?.publicFullWorkFileId || process.acervo?.publicExpandedAbstractFileId))).length;
  const defendedItems = safe.filter((process) => Boolean(process.defesa?.startAt) && new Date(process.defesa.startAt).getTime() <= now);
  const defended = defendedItems.length;
  const coauthors = safe.filter((process) => Boolean(process.aluno2)).length;

  const statusCounts = safe.reduce<Record<string, number>>((acc, process) => {
    acc[process.status] = (acc[process.status] || 0) + 1;
    return acc;
  }, {});
  const rawByStatus = Object.entries(statusCounts)
    .map(([key, count]) => ({ key, label: STATUS_LABELS[key] || key, count }))
    .sort((a, b) => b.count - a.count);

  const rawYears = countBuckets(defendedItems.map((process) => formatPart(process.defesa.startAt, { year: 'numeric' }))).sort((a, b) => a.label.localeCompare(b.label));
  const rawMonths = countBuckets(defendedItems.map((process) => yearMonth(process.defesa.startAt))).sort((a, b) => a.label.localeCompare(b.label));
  const completedOrPublic = safe.filter((process) => process.status === 'CONCLUIDO' || process.acervo?.publicationState === 'PUBLIC');
  const rawThemes = countBuckets(completedOrPublic.flatMap((process) => (process.acervo?.palavrasChave || []).map(clean).filter(Boolean)), 15);
  const rawWorkTypes = countBuckets(completedOrPublic.map((process) => WORK_TYPE_LABELS[process.acervo?.workType || ''] || 'Não informado'));
  const rawLocations = countBuckets(defendedItems.map((process) => clean(process.defesa?.local || '')).filter(Boolean), 8);
  const rawOutcomes = countBuckets(safe.map((process) => process.avaliacao?.resultadoLabel || process.avaliacao?.resultadoCode || '').filter(Boolean));
  const rawFormats = countBuckets(safe.flatMap((process) => {
    const formats: string[] = [];
    if (process.acervo?.publicFullWorkFileId) formats.push('Trabalho completo');
    if (process.acervo?.publicExpandedAbstractFileId) formats.push('Resumo expandido');
    return formats;
  }));
  const rawWeekdays = countBuckets(defendedItems.map((process) => {
    const value = formatPart(process.defesa.startAt, { weekday: 'long' });
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
  }).filter(Boolean));
  const rawDayparts = countBuckets(defendedItems.map((process) => {
    const hour = Number(formatPart(process.defesa.startAt, { hour: '2-digit', hour12: false }).replace(/\D/g, ''));
    return hour < 12 ? 'Manhã' : hour < 18 ? 'Tarde' : 'Noite';
  }));

  const monthlyValues = rawMonths.map((item) => item.count);
  const peak = [...rawMonths].sort((a, b) => b.count - a.count)[0];
  const completionDays = completedItems.map((process) => {
    if (!process.completedAt || !process.createdAt) return Number.NaN;
    return Math.max(0, (new Date(process.completedAt).getTime() - new Date(process.createdAt).getTime()) / 86_400_000);
  }).filter(Number.isFinite);
  const descriptive = !smallGroupSuppressed && monthlyValues.length ? {
    monthlyMean: round1(mean(monthlyValues)),
    monthlyMedian: round1(median(monthlyValues)),
    monthlyStdDev: round1(stddev(monthlyValues)),
    peakMonth: peak?.label || null,
    peakMonthCount: peak?.count || 0,
    completionDaysMean: round1(mean(completionDays)),
    completionDaysMedian: round1(median(completionDays)),
    observedMonths: monthlyValues.length,
  } : null;

  const detailedTotals = smallGroupSuppressed ? {
    completed: 0, published: 0, defended: 0, inProgress: 0, completionRate: 0, publicationRate: 0, coauthorRate: 0,
  } : {
    completed,
    published,
    defended,
    inProgress: Math.max(0, total - completed),
    completionRate: total ? round1((completed / total) * 100) : 0,
    publicationRate: total ? round1((published / total) * 100) : 0,
    coauthorRate: total ? round1((coauthors / total) * 100) : 0,
  };
  const visible = (items: PublicIndicatorBucket[]) => smallGroupSuppressed ? [] : publicBuckets(items);

  return {
    generatedAt: new Date(now).toISOString(),
    privacy: { containsPersonalData: false, smallGroupSuppressed, minimumGroupSize: MIN_PUBLIC_GROUP_SIZE, minimumBucketSize: MIN_PUBLIC_BUCKET_SIZE },
    totals: { registered: total, ...detailedTotals },
    descriptive,
    byStatus: smallGroupSuppressed ? [] : rawByStatus.filter((item) => item.count >= MIN_PUBLIC_BUCKET_SIZE),
    years: visible(rawYears),
    months: visible(rawMonths),
    themes: visible(rawThemes),
    workTypes: visible(rawWorkTypes),
    locations: visible(rawLocations),
    outcomes: visible(rawOutcomes),
    formats: visible(rawFormats),
    weekdays: visible(rawWeekdays),
    dayparts: visible(rawDayparts),
  };
}
''')

# Frontend defensivo contra payload parcial durante rollout/cache.
path = 'src/pages/IndicadoresPage.tsx'
s = read(path)
s = s.replace("const BarList: React.FC<{ items: Bucket[]; percentage?: boolean; empty?: string }> = ({ items, percentage = false, empty = 'Sem volume suficiente.' }) => {", "const BarList: React.FC<{ items?: Bucket[]; percentage?: boolean; empty?: string }> = ({ items = [], percentage = false, empty = 'Sem volume suficiente.' }) => {")
s = s.replace("const LineTrend: React.FC<{ items: Bucket[] }> = ({ items }) => {", "const LineTrend: React.FC<{ items?: Bucket[] }> = ({ items = [] }) => {")
s = replace_once(
    s,
    "      .then((payload) => { if (active) setData(payload); })",
    "      .then((payload) => {\n        if (!active) return;\n        const arrays = ['byStatus', 'years', 'months', 'themes', 'workTypes', 'locations', 'outcomes', 'formats', 'weekdays', 'dayparts'];\n        const normalized = { ...payload, totals: { registered: 0, completed: 0, published: 0, defended: 0, inProgress: 0, completionRate: 0, publicationRate: 0, coauthorRate: 0, ...(payload?.totals || {}) } } as any;\n        arrays.forEach((key) => { if (!Array.isArray(normalized[key])) normalized[key] = []; });\n        setData(normalized as PublicIndicators);\n      })",
    'normalização defensiva dos Indicadores'
)
write(path, s)

# -----------------------------------------------------------------------------
# 8. Shell canônico para os workspaces de Configurações
# -----------------------------------------------------------------------------
write('src/components/SettingsWorkspaceModal.tsx', r'''import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

export interface SettingsWorkspaceSection {
  id: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

interface SettingsWorkspaceModalProps {
  open: boolean;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  sections: SettingsWorkspaceSection[];
  onClose: () => void;
}

export const SettingsWorkspaceModal: React.FC<SettingsWorkspaceModalProps> = ({ open, title, icon: TitleIcon, sections, onClose }) => {
  const firstId = sections[0]?.id || '';
  const [activeId, setActiveId] = useState(firstId);
  useEffect(() => {
    if (open && (!activeId || !sections.some((section) => section.id === activeId))) setActiveId(firstId);
  }, [open, activeId, firstId, sections]);
  const current = useMemo(() => sections.find((section) => section.id === activeId) || sections[0], [sections, activeId]);
  if (!open || !current) return null;
  const CurrentIcon = current.icon;

  return <div className="fixed inset-0 z-[1000005] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="portal-settings-workspace flex max-h-[94vh] w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-[#e1e6e9] shadow-2xl">
      <header className="portal-settings-workspace-header flex items-center justify-between border-b-[16px] border-white bg-[#005830] px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-2">{TitleIcon && <TitleIcon className="h-5 w-5 shrink-0"/>}<h2 className="truncate text-sm font-black uppercase tracking-wide">{title}</h2></div>
        <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white bg-white text-black shadow-sm" aria-label="Fechar"><X className="h-4 w-4"/></button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <aside className="max-h-52 w-full shrink-0 overflow-y-auto border-b border-slate-300 bg-[#d5dce0] p-3 md:max-h-none md:w-64 md:border-b-0 md:border-r">
          <div className="rounded-xl border border-slate-300 bg-white p-2 shadow-sm">
            <div className="mb-2 border-b border-slate-200 px-2 pb-2 text-[10px] font-black uppercase tracking-wider text-slate-600">Navegação</div>
            <div className="space-y-1">{sections.map((section) => {
              const Icon = section.icon;
              const selected = section.id === current.id;
              return <button key={section.id} type="button" onClick={() => setActiveId(section.id)} className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${selected ? 'border-[#337959] bg-[#337959] text-white' : 'border-transparent bg-white text-slate-800 hover:border-slate-300'}`}>
                {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0"/>}
                <span className="min-w-0"><strong className="block text-[11px] font-black uppercase">{section.label}</strong>{section.description && <span className={`mt-0.5 block text-[9px] leading-4 ${selected ? 'text-white/80' : 'text-slate-500'}`}>{section.description}</span>}</span>
              </button>;
            })}</div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto bg-[#e1e6e9] p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#286a4d] bg-[#337959] px-4 py-2.5 text-white shadow-sm">{CurrentIcon && <CurrentIcon className="h-4 w-4"/>}<div><h3 className="text-xs font-black uppercase tracking-wide">{current.label}</h3>{current.description && <p className="mt-0.5 text-[10px] text-white/80">{current.description}</p>}</div></div>
          <div className="portal-settings-workspace-content min-w-0">{current.content}</div>
        </main>
      </div>
    </section>
  </div>;
};
''')

# Configurações: seis barras e workspaces padronizados.
path = 'src/pages/ConfiguracoesPage.tsx'
s = read(path)
s = replace_once(s, "import { AstenLogsPage } from './AstenLogsPage';", "import { AstenLogsPage } from './AstenLogsPage';\nimport { SettingsWorkspaceModal } from '../components/SettingsWorkspaceModal';", 'import SettingsWorkspaceModal')
s = replace_regex(
    s,
    r'''          <section id="portal-settings-hub" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">.*?          </section>''',
    r'''          <section id="portal-settings-hub" className="portal-settings-list space-y-2">
            {[
              { id: 'personalization', title: 'Personalização do Portal', text: 'Aparência, navegação, páginas, tabelas e pop-ups.', icon: Palette },
              { id: 'sync', title: 'Sincronização', text: 'Rodapé, Asten, Google, Supabase, Vercel e demais integrações.', icon: Sliders },
              { id: 'access', title: 'Acesso', text: 'Autorizações e pessoas com acesso ao Portal.', icon: Lock },
              { id: 'models', title: 'Modelos e Variáveis', text: 'Documentos, e-mails, formulários, fluxos e variáveis.', icon: Layers },
              { id: 'signatures', title: 'Registros de Assinatura', text: 'Fila, método, situação e histórico de assinatura.', icon: FileCheck2 },
              { id: 'logs', title: 'Registro de Logs', text: 'Auditoria, histórico técnico e rastreabilidade.', icon: ClipboardList },
            ].map(({ id, title, text, icon: Icon }) => (
              <button key={id} type="button" onClick={() => id === 'personalization' ? setPersonalizationHubOpen(true) : setActiveSettingsPanel(id as any)} className="portal-settings-title-bar flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-[#d5dce0] px-3.5 py-3 text-left shadow-sm">
                <Icon className="h-5 w-5 shrink-0 text-[#337959]" />
                <span className="min-w-0 flex-1"><strong className="block text-xs font-black uppercase tracking-wide text-black">{title}</strong><span className="mt-0.5 block text-[10px] text-slate-600">{text}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
              </button>
            ))}
          </section>''',
    'hub de configurações'
)
start = s.find('          {activeSettingsPanel && (')
end_marker = '          )}\n        </>'
end = s.find(end_marker, start)
if start < 0 or end < 0:
    raise RuntimeError('Modal legado de Configurações não encontrado')
new_modal = r'''          {activeSettingsPanel && (
            <SettingsWorkspaceModal
              open
              title={activeSettingsPanel === 'sync' ? 'Sincronização' : activeSettingsPanel === 'access' ? 'Acesso' : activeSettingsPanel === 'models' ? 'Modelos e Variáveis' : activeSettingsPanel === 'signatures' ? 'Registros de Assinatura' : 'Registro de Logs'}
              icon={activeSettingsPanel === 'sync' ? Sliders : activeSettingsPanel === 'access' ? Lock : activeSettingsPanel === 'models' ? Layers : activeSettingsPanel === 'signatures' ? FileCheck2 : ClipboardList}
              onClose={() => setActiveSettingsPanel(null)}
              sections={
                activeSettingsPanel === 'sync' ? [
                  { id: 'identity', label: 'Rodapé e identidade', description: 'Responsáveis, contatos e identidade operacional.', icon: Building2, content: settings ? <section className="rounded-xl border border-slate-300 bg-[#d5dce0] p-3"><MasterAndPresidentConfigForm settings={settings} onSettingsUpdated={() => { void refreshAuth(); showNotification('Configurações atualizadas.'); }} showNotification={showNotification} /><CommissionIdentityPanel isMaster /></section> : null },
                  { id: 'integrations', label: 'Integrações e plataformas', description: 'Asten, Google, Supabase, Vercel e serviços externos.', icon: Globe, content: <InfrastructureIntegrationsPanel isMaster /> },
                ] : activeSettingsPanel === 'access' ? [
                  { id: 'authorizations', label: 'Autorizações de acesso', description: 'Gerencie discentes e demais perfis autorizados.', icon: Lock, content: <AuthorizedStudentsPanel canManage /> },
                ] : activeSettingsPanel === 'models' ? [
                  { id: 'studio', label: 'Estúdio de modelos e variáveis', description: 'Documentos, e-mails, formulários, fluxos e variáveis em um único ambiente.', icon: Layers, content: <div id="portal-models-workspace" className="space-y-3"><MasterDocumentModelsPanel /><IntegrationStudioPanel actorEmail={userEmail || ''} initialStudio={settings?.integrationStudio} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification} /></div> },
                ] : activeSettingsPanel === 'signatures' ? [
                  { id: 'signature-ledger', label: 'Registros de assinatura', description: 'Documentos enviados, método e situação.', icon: FileCheck2, content: <AstenLogsPage /> },
                ] : [
                  { id: 'audit-ledger', label: 'Registro de logs', description: 'Auditoria e histórico técnico do Portal.', icon: ClipboardList, content: <AuditLogsPage /> },
                ]
              }
            />
          )}
'''
s = s[:start] + new_modal + s[end + len('          )}\n'):]
write(path, s)

# Estúdio: transforma as abas superiores em navegação lateral dentro do workspace.
path = 'src/components/IntegrationStudioPanel.tsx'
s = read(path)
old_header = r'''  return (
    <div className={`portal-workspace portal-studio ${panelClass} mb-5 overflow-hidden`}>
      <div className="border-b border-slate-200 bg-slate-50 p-2">
        <div className="flex items-center gap-2"><div className="grid flex-1 grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[9.5px] font-black uppercase transition cursor-pointer ${activeTab === tab.id ? 'border-slate-800 bg-slate-800 text-white shadow-2xs' : 'border-transparent bg-transparent text-slate-600 hover:border-slate-300 hover:bg-white'}`}><Icon className="h-3.5 w-3.5" />{tab.label}</button>;
          })}
          </div>
          <div className="hidden text-right text-[9px] font-semibold text-slate-500 md:block">{isDirty ? (draftSavedAt ? `Rascunho automático ${new Date(draftSavedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` : 'Salvando rascunho…') : (lastSavedAt ? `Publicado ${new Date(lastSavedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` : 'Ainda não publicado')}</div>
          <button type="button" onClick={() => void persistSnapshot(true)} disabled={isSaving} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-800 shadow-sm disabled:opacity-50"><Save className="h-3.5 w-3.5" />{isSaving ? 'Publicando…' : 'Publicar'}</button>
        </div>
      </div>

      <div className="bg-slate-50/40 p-3 sm:p-4">'''
new_header = r'''  return (
    <div className={`portal-workspace portal-studio ${panelClass} mb-5 overflow-hidden`}>
      <div className="portal-studio-heading flex flex-wrap items-center justify-between gap-2 border-b border-[#286a4d] bg-[#337959] px-3 py-2.5 text-white">
        <div><h3 className="text-xs font-black uppercase tracking-wide">Editor de modelos e variáveis</h3><p className="mt-0.5 text-[9px] text-white/80">Selecione uma área à esquerda e trabalhe com seleção, edição e visualização no mesmo contexto.</p></div>
        <div className="flex items-center gap-2"><div className="hidden text-right text-[9px] font-semibold text-white/80 md:block">{isDirty ? (draftSavedAt ? `Rascunho automático ${new Date(draftSavedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` : 'Salvando rascunho…') : (lastSavedAt ? `Publicado ${new Date(lastSavedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` : 'Ainda não publicado')}</div><button type="button" onClick={() => void persistSnapshot(true)} disabled={isSaving} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-white bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-black shadow-sm disabled:opacity-50"><Save className="h-3.5 w-3.5" />{isSaving ? 'Publicando…' : 'Publicar'}</button></div>
      </div>
      <div className="flex min-h-[68vh] flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b border-slate-300 bg-[#d5dce0] p-2 md:w-56 md:border-b-0 md:border-r">
          <div className="rounded-xl border border-slate-300 bg-white p-2 shadow-sm"><div className="mb-2 border-b border-slate-200 px-2 pb-2 text-[9px] font-black uppercase tracking-wider text-slate-500">Modelos e variáveis</div><div className="space-y-1">{tabs.map((tab) => { const Icon = tab.icon; const selected = activeTab === tab.id; return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[10px] font-black uppercase transition-colors ${selected ? 'border-[#337959] bg-[#337959] text-white' : 'border-transparent bg-white text-slate-700 hover:border-slate-300'}`}><Icon className="h-3.5 w-3.5 shrink-0"/>{tab.label}</button>; })}</div></div>
        </aside>
        <div className="min-w-0 flex-1 bg-slate-50/40 p-3 sm:p-4">'''
s = replace_once(s, old_header, new_header, 'navegação lateral do Estúdio')
old_tail = '''        )}
      </div>
    </div>
  );
};'''
new_tail = '''        )}
        </div>
      </div>
    </div>
  );
};'''
s = replace_once(s, old_tail, new_tail, 'fechamento do layout lateral do Estúdio')
write(path, s)

# -----------------------------------------------------------------------------
# 9. Testes de contrato da nova rodada
# -----------------------------------------------------------------------------
path = 'server/version1045StructuralContract.test.ts'
s = read(path)
s = s.replace("test('release atual é 1.0.45',()=>{const pkg=JSON.parse(read('package.json'));assert.equal(pkg.version,'1.0.45');});\n", '')
write(path, s)

write('server/version1046StructuralContract.test.ts', r'''import test from 'node:test';
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
''')

print('Migração estrutural 1.0.46 aplicada com sucesso.')
