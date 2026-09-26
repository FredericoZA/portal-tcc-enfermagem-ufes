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

const normalizeSummaryText = (value?: string): string => String(value || '').replace(/\s+/g, ' ').trim();

/**
 * Conteúdo canônico de um evento na grade mensal.
 *
 * A UI recebe duas linhas semanticamente separadas para impedir que título e
 * discentes sejam novamente reduzidos a “(defesa)” ou a uma única string
 * truncada. A data não é repetida porque já pertence à célula do calendário.
 */
export function getDefenseCalendarSummaryParts(
  process: Pick<ProcessData, 'titulo' | 'defesa' | 'aluno1' | 'aluno2'>,
): { primary: string; secondary: string; fullText: string } {
  const timestamp = validTimestamp(process.defesa?.startAt);
  const time = timestamp === null
    ? 'Horário a definir'
    : new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const title = normalizeSummaryText(process.titulo) || 'Trabalho de Conclusão de Curso';
  const students = [normalizeSummaryText(process.aluno1?.nome), normalizeSummaryText(process.aluno2?.nome)]
    .filter(Boolean)
    .join(' · ') || 'Discente não identificado';
  const primary = `${time} · ${title}`;
  return { primary, secondary: students, fullText: `${primary}\n${students}` };
}

/** Compatibilidade com tooltips e consumidores textuais. */
export function formatDefenseCalendarSummary(
  process: Pick<ProcessData, 'titulo' | 'defesa' | 'aluno1' | 'aluno2'>,
  _maxTitleLength = 46,
): string {
  return getDefenseCalendarSummaryParts(process).fullText;
}
