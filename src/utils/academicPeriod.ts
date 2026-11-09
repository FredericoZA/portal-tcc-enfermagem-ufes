import {saoPauloCalendarDate} from './formatters';

export const ACADEMIC_PERIOD_FIELD = 'PERIODO_ACADEMICO_ESTATISTICO';
export const UNKNOWN_ACADEMIC_PERIOD = 'Não informado';
export const ACADEMIC_PERIOD_LABEL = 'A qual período acadêmico esta apresentação se refere?';
export function academicPeriodHelpText(now = new Date()):string{
  const year=saoPauloCalendarDate(now).slice(0,4);
  return `Informe o período ao qual o trabalho se refere, por exemplo, ${year}.1. Se não souber, escolha Não informado. O campo é opcional e não altera a data da defesa ou as etapas do processo.`;
}

/** This is a student-supplied statistical label, independent of the defense date. */
export function academicPeriod(value: unknown): string | undefined {
  return typeof value === 'string' && /^[1-9]\d{3}-[12]$/.test(value.trim()) ? value.trim() : undefined;
}

export function academicPeriodOptions(savedValue?: unknown, now = new Date()): string[] {
  const year = Number(saoPauloCalendarDate(now).slice(0, 4));
  const periods = [year - 1, year, year + 1].flatMap(value => [`${value}-1`, `${value}-2`]);
  const saved = academicPeriod(savedValue);
  if (saved && !periods.includes(saved)) periods.push(saved);
  return [UNKNOWN_ACADEMIC_PERIOD, ...periods.sort()];
}
