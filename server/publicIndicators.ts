import type { ProcessData } from '../src/types';
import type {LegacyAcademicRecord} from '../src/types/legacyArchive';
import {legacyRepositoryProcess} from '../src/utils/legacyRepository';
import {publicLegacyAcademicView} from './legacyArchive';

export type PublicIndicatorBucket = { label: string; count: number; key?: string };
export type PublicIndicatorsPayload = {
  generatedAt: string;
  privacy: { containsPersonalData: false; smallGroupSuppressed: boolean; minimumGroupSize: number; minimumBucketSize: number; note: string };
  totals: { registered: number; completed: number; published: number; defended: number; inProgress: number; completionRate: number; publicationRate: number; coauthorRate: number };
  descriptive: null | { monthlyMean: number; monthlyMedian: number; monthlyStdDev: number; peakMonth: string | null; peakMonthCount: number; completionDaysMean: number | null; completionDaysMedian: number | null; observedMonths: number };
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
const catalogLabel = (labels:Record<string,string>,key:string) => Object.prototype.hasOwnProperty.call(labels,key)?labels[key]:'';
const dateOnly = (value:string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const dateValue = (value:string) => {
  const date=new Date(dateOnly(value)?`${value}T12:00:00-03:00`:value);
  if(!Number.isFinite(date.getTime())||dateOnly(value)&&date.toISOString().slice(0,10)!==value)return null;
  return date;
};
const publicFileKinds = (process:ProcessData):string[] => {
  const acervo=process.acervo;
  if(process.status!=='CONCLUIDO'||!acervo||acervo.publicationWithdrawnAt)return [];
  if(process.legacyRecord) return acervo.isPublic?[
    ...(acervo.publishFullWork&&acervo.trabalhoCompletoFileUrl?['Trabalho completo']:[]),
    ...(acervo.publishExpandedAbstract&&acervo.resumoExpandidoFileUrl?['Resumo expandido']:[]),
  ]:[];
  if(acervo.publicationState!=='PUBLIC')return [];
  return [
    ...(acervo.publishFullWork&&(acervo.publicFullWorkFileId||acervo.publicFullWorkFileUrl)?['Trabalho completo']:[]),
    ...(acervo.publishExpandedAbstract&&(acervo.publicExpandedAbstractFileId||acervo.publicExpandedAbstractFileUrl)?['Resumo expandido']:[]),
  ];
};

const round1 = (value: number) => Number(value.toFixed(1));
const RESULT_LABELS:Record<string,string> = { APROVADO:'Aprovado', APROVADO_COM_RESSALVA:'Aprovado com ressalva', REPROVADO:'Reprovado' };
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
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  return (limit ? sorted.slice(0, limit) : sorted).map(([label, count]) => ({ label, count }));
};
const publicBuckets = (items: PublicIndicatorBucket[]) => items.filter((item) => item.count >= MIN_PUBLIC_BUCKET_SIZE);
const formatPart = (iso: string, options: Intl.DateTimeFormatOptions) => {
  try { const date=dateValue(iso);return date?new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, ...options }).format(date):''; }
  catch { return ''; }
};
const yearMonth = (iso: string) => {
  try {
    const date=dateValue(iso);if(!date)return '';
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit' }).formatToParts(date);
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
  const published = safe.filter((process) => publicFileKinds(process).length>0).length;
  const defendedItems = safe.filter((process) => {
    const date=dateValue(process.defesa?.startAt||'');
    return date&&date.getTime()<=now&&(process.status==='CONCLUIDO'||process.avaliacao?.status==='CONCLUIDO');
  });
  const defended = defendedItems.length;
  const coauthors = safe.filter((process) => Boolean(process.aluno2)).length;

  const statusCounts = new Map<string, number>();
  for (const process of safe) {
    const status = String(process.status || '');
    // Rótulos desconhecidos não devem ser reproduzidos como texto livre em API pública.
    if (!Object.prototype.hasOwnProperty.call(STATUS_LABELS,status)) continue;
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  }
  const rawByStatus = Array.from(statusCounts.entries())
    .map(([key, count]) => ({ key, label: STATUS_LABELS[key] || key, count }))
    .sort((a, b) => b.count - a.count);

  const rawYears = countBuckets(defendedItems.map((process) => formatPart(process.defesa.startAt, { year: 'numeric' }))).sort((a, b) => a.label.localeCompare(b.label));
  const rawMonths = countBuckets(defendedItems.map((process) => yearMonth(process.defesa.startAt))).sort((a, b) => a.label.localeCompare(b.label));
  const completedOrPublic = safe.filter((process) => process.status === 'CONCLUIDO' || publicFileKinds(process).length>0);
  // Campos livres (palavras-chave e locais) podem conter dados pessoais,
  // mesmo que repetidos. Nunca são divulgados pela API pública de indicadores.
  const rawWorkTypes = countBuckets(completedOrPublic.map((process) => catalogLabel(WORK_TYPE_LABELS,process.acervo?.workType || '') || 'Não informado'));
  const rawOutcomes = countBuckets(safe.map((process) => catalogLabel(RESULT_LABELS,process.avaliacao?.resultadoCode || '')).filter(Boolean));
  const rawFormats = countBuckets(safe.flatMap(publicFileKinds));
  const rawWeekdays = countBuckets(defendedItems.map((process) => {
    const value = formatPart(process.defesa.startAt, { weekday: 'long' });
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
  }).filter(Boolean));
  const rawDayparts = countBuckets(defendedItems.filter(process=>!dateOnly(process.defesa.startAt)).map((process) => {
    const hour = Number(formatPart(process.defesa.startAt, { hour: '2-digit', hourCycle:'h23' }).replace(/\D/g, ''));
    return hour < 12 ? 'Manhã' : hour < 18 ? 'Tarde' : 'Noite';
  }));

  const visibleMonths=publicBuckets(rawMonths);
  const monthlyValues = visibleMonths.map((item) => item.count);
  const peak = [...visibleMonths].sort((a, b) => b.count - a.count)[0];
  const completionDays = completedItems.map((process) => {
    if (process.legacyRecord||!process.completedAt || !process.createdAt) return Number.NaN;
    const start=Date.parse(process.createdAt),end=Date.parse(process.completedAt);
    return Number.isFinite(start)&&Number.isFinite(end)&&end>=start&&end<=now?(end-start)/86_400_000:Number.NaN;
  }).filter(Number.isFinite);
  const descriptive = !smallGroupSuppressed && monthlyValues.length ? {
    monthlyMean: round1(mean(monthlyValues)),
    monthlyMedian: round1(median(monthlyValues)),
    monthlyStdDev: round1(stddev(monthlyValues)),
    peakMonth: peak && peak.count >= MIN_PUBLIC_BUCKET_SIZE ? peak.label : null,
    peakMonthCount: peak && peak.count >= MIN_PUBLIC_BUCKET_SIZE ? peak.count : 0,
    // Durações com uma ou duas observações poderiam permitir inferência individual.
    completionDaysMean: completionDays.length >= MIN_PUBLIC_BUCKET_SIZE ? round1(mean(completionDays)) : null,
    completionDaysMedian: completionDays.length >= MIN_PUBLIC_BUCKET_SIZE ? round1(median(completionDays)) : null,
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
    privacy: { containsPersonalData: false, smallGroupSuppressed, minimumGroupSize: MIN_PUBLIC_GROUP_SIZE, minimumBucketSize: MIN_PUBLIC_BUCKET_SIZE, note:'A resposta contém somente contagens e medidas agregadas, sem campos individuais. As distribuições e medidas mensais consideram grupos com pelo menos três registros. A supressão reduz a exposição de grupos pequenos e não garante anonimização absoluta.' },
    totals: { registered: total, ...detailedTotals },
    descriptive,
    byStatus: smallGroupSuppressed ? [] : rawByStatus.filter((item) => item.count >= MIN_PUBLIC_BUCKET_SIZE),
    years: visible(rawYears),
    months: visible(rawMonths),
    themes: [],
    workTypes: visible(rawWorkTypes),
    locations: [],
    outcomes: visible(rawOutcomes),
    formats: visible(rawFormats),
    weekdays: visible(rawWeekdays),
    dayparts: visible(rawDayparts),
  };
}

export function buildPublicIndicatorsFromState(state:{processes?:ProcessData[];legacyAcademicRecords?:LegacyAcademicRecord[]},now=Date.now()):PublicIndicatorsPayload {
  const current=Array.isArray(state.processes)?state.processes:[];
  const legacy=Array.isArray(state.legacyAcademicRecords)?state.legacyAcademicRecords:[];
  return buildPublicIndicators([...current,...legacy.map(record=>legacyRepositoryProcess(publicLegacyAcademicView(record)))],now);
}
