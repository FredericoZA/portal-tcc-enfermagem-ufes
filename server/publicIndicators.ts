import type { ProcessData } from '../src/types';

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
