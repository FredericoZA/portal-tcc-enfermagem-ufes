import {recordedDefense,recordedCompletionDays,registeredIndicatorProcesses} from './indicatorFacts';
import { operationalConfig, resolveCatalogValue } from '../src/utils/operationalConfig';
import type { IntegrationStudioSettings } from '../src/types/integrationStudio';
import type { ProcessData, StudioFormSubmission } from '../src/types';
import type { StatisticalDistribution, TccStatisticalSnapshot } from '../src/types/statistics';

const MINIMUM_CATEGORY_SIZE=3;
const DAY_MS=86_400_000;
export interface StatisticalSnapshotInput {
  studio?: Partial<IntegrationStudioSettings>;
  processes: ProcessData[];
  formSubmissions: StudioFormSubmission[];
  generatedAt?: string;
}

const normalizeLabel = (value: unknown): string => String(value ?? '')
  .normalize('NFKC')
  .replace(/[\u0000-\u001f\u007f]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 120);

const percentage = (part: number, total: number): number => total ? Number((part / total * 100).toFixed(1)) : 0;

function median(values: number[]): number | null {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!ordered.length) return null;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function distribution(values: unknown[], denominator: number, suppressSmall = true): StatisticalDistribution {
  const counts = new Map<string, { label: string; count: number }>();
  let unknown = 0;
  for (const raw of values) {
    const label = normalizeLabel(raw);
    if (!label) { unknown++; continue; }
    const key = label.toLocaleLowerCase('pt-BR');
    const current = counts.get(key) || { label, count: 0 };
    current.count++;
    counts.set(key, current);
  }
  let suppressed = 0;
  const entries = Array.from(counts.values())
    .filter((entry) => {
      if (!suppressSmall || entry.count >= MINIMUM_CATEGORY_SIZE) return true;
      suppressed += entry.count;
      return false;
    })
    .map((entry) => ({ ...entry, share: percentage(entry.count, denominator) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
  return { entries, unknown, suppressed };
}

function latestAnswersByProcess(submissions: StudioFormSubmission[]): Map<string, Record<string, string | number | boolean>> {
  const byProcess = new Map<string, Record<string, string | number | boolean>>();
  for (const submission of submissions.filter(s=>s.archiveStatus==='ARCHIVED').sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))) {
    byProcess.set(submission.processId, { ...(byProcess.get(submission.processId) || {}), ...submission.answers });
  }
  return byProcess;
}

function firstAnswer(answers: Record<string, string | number | boolean>, keys: string[]): string {
  for (const key of keys) {
    const value = normalizeLabel(answers[key]);
    if (value) return value;
  }
  return '';
}

const STATUS_LABELS: Record<string, string> = {
  EM_RASCUNHO: 'Em rascunho',
  AGUARDANDO_CONFIRMACAO_LOCAL: 'Aguardando confirmação de local',
  AGUARDANDO_DEFESA: 'Aguardando defesa',
  EM_AVALIACAO: 'Aguardando registro de conceito e ata',
  AGUARDANDO_DADOS_FINAIS: 'Aguardando dados finais',
  AGUARDANDO_ASSINATURA: 'Aguardando assinatura',
  CONCLUIDO: 'Concluído'
};

const WORK_TYPE_LABELS: Record<string, string> = { MONOGRAFIA: 'Monografia', ARTIGO: 'Artigo', OUTRO: 'Outro' };

export function buildTccStatisticalSnapshot(input: Pick<StatisticalSnapshotInput, 'processes' | 'formSubmissions' | 'generatedAt' | 'studio'>): TccStatisticalSnapshot {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const processes = registeredIndicatorProcesses(input.processes);
  const total = processes.length;
  const answersByProcess = latestAnswersByProcess(input.formSubmissions);
  const areas: string[] = [];
  const themes: string[] = [];
  const studyTypes: string[] = [];
  const purposes: string[] = [];
  let keywordCovered = 0;

  for (const process of processes) {
    const answers = { ...(process.registrationAnswers || {}), ...(answersByProcess.get(process.id) || {}) };
    const catalog = operationalConfig(input.studio).catalogs;
    const classify = (kind: string, keys: string[]) => resolveCatalogValue(catalog.map(e=>({...e,active:true})), kind, firstAnswer(answers, keys), process.createdAt);
    areas.push(classify('AREA_TEMATICA', ['AREA_TEMATICA', 'AREA_DE_CONCENTRACAO', 'LINHA_DE_PESQUISA', 'AREA']));
    themes.push(classify('TEMA_PRINCIPAL', ['TEMA_PRINCIPAL', 'TEMA', 'EIXO_TEMATICO']));
    studyTypes.push(classify('TIPO_DE_ESTUDO', ['TIPO_DE_ESTUDO', 'DESENHO_DO_ESTUDO', 'METODOLOGIA']));
    purposes.push(classify('FINALIDADE_DO_TRABALHO', ['FINALIDADE_DO_TRABALHO', 'FINALIDADE', 'DESTINACAO']));
    const keywords = Array.from(new Set((process.acervo?.palavrasChave || []).map(value=>normalizeLabel(value).toLocaleLowerCase('pt-BR')).filter(value=>value&&!/@|https?:|\d{6,}/i.test(value))));
    if (keywords.length) keywordCovered++;
  }

  const generatedAtMs = Date.parse(generatedAt);
  const completionDurations = processes.map(process=>recordedCompletionDays(process,generatedAtMs)).filter((value):value is number=>value!==null);
  const openAges = processes
    .filter((process) => process.status !== 'CONCLUIDO')
    .map((process) => (generatedAtMs - Date.parse(process.createdAt)) / DAY_MS)
    .filter((value) => value >= 0);
  const completed = processes.filter((process) => process.status === 'CONCLUIDO').length;
  const published = processes.filter((process) => Boolean(process.acervo?.publishFullWork || process.acervo?.publishExpandedAbstract)).length;
  const coauthored = processes.filter((process) => Boolean(process.aluno2)).length;
  const from = processes.map((process) => process.createdAt).filter(Boolean).sort()[0] || null;
  const to = processes.map((process) => process.updatedAt).filter(Boolean).sort().at(-1) || null;

  return {
    generatedAt,
    window: { from, to, academicCycleId: null },
    privacy: {
      containsPersonalData: false,
      minimumCategorySize: MINIMUM_CATEGORY_SIZE,
      note: 'Nomes, e-mails, matrículas, títulos e resumos não são incluídos. Categorias temáticas com menos de três ocorrências são agregadas.'
    },
    totals: {
      processes: total,
      authors: processes.reduce((sum, process) => sum + (process.aluno2 ? 2 : 1), 0),
      coauthoredProcesses: coauthored,
      defended: processes.filter(process=>recordedDefense(process,generatedAtMs)!==null).length,
      completed,
      publicationRequested: published
    },
    rates: {
      completion: percentage(completed, total),
      publication: percentage(published, total),
      coauthorship: percentage(coauthored, total)
    },
    timing: {
      medianCompletionDays: completionDurations.length ? Number(median(completionDurations)!.toFixed(1)) : null,
      medianAgeOpenDays: openAges.length ? Number(median(openAges)!.toFixed(1)) : null
    },
    distributions: {
      status: distribution(processes.map((process) => STATUS_LABELS[process.status] || process.status), total, false),
      outcome: distribution(processes.map((process) => process.avaliacao?.resultadoLabel || process.avaliacao?.resultadoCode || ''), total),
      workType: distribution(processes.map((process) => WORK_TYPE_LABELS[process.acervo?.workType || ''] || process.acervo?.workType || ''), total),
      defenseFormat: distribution(processes.map((process) => process.defesa?.formato || ''), total),
      themes: distribution(themes, total),
      areas: distribution(areas, total),
      studyTypes: distribution(studyTypes, total),
      purposes: distribution(purposes, total),
      // Palavras-chave são campos livres e não devem sair em agregações exportáveis.
      keywords: { entries: [], unknown: total, suppressed: 0 }
    },
    dataQuality: {
      areaCoverage: percentage(areas.filter(Boolean).length, total),
      themeCoverage: percentage(themes.filter(Boolean).length, total),
      studyTypeCoverage: percentage(studyTypes.filter(Boolean).length, total),
      purposeCoverage: percentage(purposes.filter(Boolean).length, total),
      keywordCoverage: percentage(keywordCovered, total)
    }
  };
}

