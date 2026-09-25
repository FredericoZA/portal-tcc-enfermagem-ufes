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

export function formatDefenseCalendarSummary(process: Pick<ProcessData, 'titulo' | 'defesa'>, maxTitleLength = 46): string {
  const timestamp = validTimestamp(process.defesa?.startAt);
  const time = timestamp === null
    ? 'Horário a definir'
    : new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const normalizedTitle = String(process.titulo || 'Trabalho de Conclusão de Curso').replace(/\s+/g, ' ').trim();
  const title = normalizedTitle.length > maxTitleLength
    ? `${normalizedTitle.slice(0, Math.max(1, maxTitleLength - 1)).trimEnd()}…`
    : normalizedTitle;

  return `${time} · ${title}`;
}
