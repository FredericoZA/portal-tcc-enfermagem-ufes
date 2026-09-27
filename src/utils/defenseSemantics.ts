import type { ProcessData, ProcessStatus } from '../types';

export type DefenseState = 'upcoming' | 'defended';
export type DefenseFilter = 'all' | DefenseState;

const POST_DEFENSE_STATUSES = new Set<ProcessStatus>([
  'EM_AVALIACAO',
  'AGUARDANDO_DADOS_FINAIS',
  'AGUARDANDO_ASSINATURA',
  'CONCLUIDO',
]);

const validTimestamp = (value?: string) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const normalizeInline = (value?: string) => String(value || '').replace(/\s+/g, ' ').trim();

export function getDefenseStateFromTimes(startAt?: string, endAt?: string, now = Date.now()): DefenseState {
  const end = validTimestamp(endAt);
  if (end !== null) return end < now ? 'defended' : 'upcoming';

  const start = validTimestamp(startAt);
  return start !== null && start < now ? 'defended' : 'upcoming';
}

export function getDefenseState(process: Pick<ProcessData, 'status' | 'defesa'>, now = Date.now()): DefenseState {
  if (POST_DEFENSE_STATUSES.has(process.status)) return 'defended';
  return getDefenseStateFromTimes(process.defesa?.startAt, process.defesa?.endAt, now);
}

export function matchesDefenseFilter(
  process: Pick<ProcessData, 'status' | 'defesa'>,
  filter: DefenseFilter,
  now = Date.now(),
): boolean {
  return filter === 'all' || getDefenseState(process, now) === filter;
}

export interface DefenseCalendarSummaryParts {
  time: string;
  title: string;
  students: string;
  location: string;
  headline: string;
  tooltip: string;
}

/**
 * Canonical calendar summary. The day itself already communicates the date, so
 * the event intentionally starts with time + title, and the second visual line
 * is reserved for the student names. Consumers should not rebuild this logic.
 */
export function getDefenseCalendarSummaryParts(
  process: Pick<ProcessData, 'titulo' | 'defesa'> & Partial<Pick<ProcessData, 'aluno1' | 'aluno2'>>,
): DefenseCalendarSummaryParts {
  const timestamp = validTimestamp(process.defesa?.startAt);
  const time = timestamp === null
    ? 'Horário a definir'
    : new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const title = normalizeInline(process.titulo) || 'Trabalho de Conclusão de Curso';
  const studentNames = [normalizeInline(process.aluno1?.nome), normalizeInline(process.aluno2?.nome)].filter(Boolean);
  const students = studentNames.join(' e ');
  const location = normalizeInline(process.defesa?.local);
  const headline = `${time} · ${title}`;
  const tooltip = [headline, students, location].filter(Boolean).join(' · ');

  return { time, title, students, location, headline, tooltip };
}

/**
 * Backward-compatible text helper for tooltips and non-visual contexts.
 * Visual calendar cells should prefer getDefenseCalendarSummaryParts().
 */
export function formatDefenseCalendarSummary(
  process: Pick<ProcessData, 'titulo' | 'defesa'> & Partial<Pick<ProcessData, 'aluno1' | 'aluno2'>>,
  maxTitleLength = 46,
): string {
  const parts = getDefenseCalendarSummaryParts(process);
  const title = parts.title.length > maxTitleLength
    ? `${parts.title.slice(0, Math.max(1, maxTitleLength - 1)).trimEnd()}…`
    : parts.title;
  return [`${parts.time} · ${title}`, parts.students, parts.location].filter(Boolean).join(' · ');
}
