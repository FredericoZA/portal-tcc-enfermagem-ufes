import type { ProcessData } from '../types';

export type DefenseState = 'upcoming' | 'defended';
export type DefenseFilter = 'all' | DefenseState;

type DefenseSummaryProcess = Pick<ProcessData, 'titulo' | 'defesa'> & Partial<Pick<ProcessData, 'aluno1' | 'aluno2'>>;

const validTimestamp = (value?: string) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

/**
 * Fonte canônica do estado temporal de uma defesa.
 *
 * Regra institucional de interface:
 * - início anterior ao instante atual => já defendido;
 * - início no instante atual ou futuro => a defender.
 *
 * O horário de término é mantido apenas por compatibilidade de assinatura da
 * função. Ele não participa da classificação, para que calendário, filtro e
 * botão do processo nunca discordem entre si durante ou após o horário marcado.
 */
export function getDefenseStateFromTimes(startAt?: string, _endAt?: string, now = Date.now()): DefenseState {
  const start = validTimestamp(startAt);
  return start !== null && start < now ? 'defended' : 'upcoming';
}

/**
 * O status administrativo do processo não altera a cor da defesa. A cor é
 * exclusivamente temporal e deriva de defesa.startAt.
 */
export function getDefenseState(process: Pick<ProcessData, 'status' | 'defesa'>, now = Date.now()): DefenseState {
  return getDefenseStateFromTimes(process.defesa?.startAt, process.defesa?.endAt, now);
}

export function matchesDefenseFilter(
  process: Pick<ProcessData, 'status' | 'defesa'>,
  filter: DefenseFilter,
  now = Date.now(),
): boolean {
  return filter === 'all' || getDefenseState(process, now) === filter;
}

export function getDefenseCalendarSummaryParts(process: DefenseSummaryProcess): { primary: string; secondary: string } {
  const timestamp = validTimestamp(process.defesa?.startAt);
  const time = timestamp === null
    ? 'Horário a definir'
    : new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const title = String(process.titulo || 'Trabalho de Conclusão de Curso').replace(/\s+/g, ' ').trim();
  const students = [process.aluno1?.nome, process.aluno2?.nome]
    .map((name) => String(name || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' · ');
  return { primary: [time, title].filter(Boolean).join(' · '), secondary: students };
}

export function formatDefenseCalendarSummary(process: DefenseSummaryProcess, maxTitleLength = 46): string {
  const timestamp = validTimestamp(process.defesa?.startAt);
  const time = timestamp === null
    ? 'Horário a definir'
    : new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const normalizedTitle = String(process.titulo || 'Trabalho de Conclusão de Curso').replace(/\s+/g, ' ').trim();
  const title = normalizedTitle.length > maxTitleLength
    ? `${normalizedTitle.slice(0, Math.max(1, maxTitleLength - 1)).trimEnd()}…`
    : normalizedTitle;
  const students = [process.aluno1?.nome, process.aluno2?.nome]
    .map((name) => String(name || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' · ');
  return [time, title, students].filter(Boolean).join(' · ');
}
