import type {ProcessData} from '../src/types';

const TIME_ZONE = 'America/Sao_Paulo';
const civilDateTime = new Intl.DateTimeFormat('sv-SE', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, hourCycle: 'h23' });
const localClock = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, weekday: 'long', hour: '2-digit', hourCycle: 'h23' });
const civilWeekday = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long' });

export function recordedDefense(process: ProcessData, now: number) {
  const nowCivil = civilDateTime.format(now).replace(',', '.');
  if (process.status !== 'CONCLUIDO' && process.avaliacao?.status !== 'CONCLUIDO') return null;
  const input = process.defesa?.startAt || '';
  const parts = /^(\d{4}-\d{2}-\d{2})(?:T(([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?)(?:Z|[+-]\d{2}:\d{2}))?$/.exec(input);
  if (!parts) return null;
  const [, dateText, timeText, hourText] = parts;
  const date = new Date(`${dateText}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dateText) return null;
  // The legacy spreadsheet contains a civil day and hour, without a UTC offset.
  if (process.legacyRecord || !hourText) {
    const recordedCivil = timeText ? `${dateText} ${timeText}` : dateText;
    return recordedCivil <= nowCivil ? { day: dateText, weekday: civilWeekday.format(date), hour: hourText ? Number(hourText) : null } : null;
  }
  const instant = new Date(input);
  if (!Number.isFinite(instant.getTime()) || instant.getTime() > now) return null;
  const clock = localClock.formatToParts(instant);
  return {
    day: civilDateTime.format(instant).slice(0, 10),
    weekday: clock.find(part => part.type === 'weekday')?.value || '',
    hour: Number(clock.find(part => part.type === 'hour')?.value),
  };
}
/** A registration exists only after its draft has been submitted. */
export const registeredIndicatorProcesses=(processes:ProcessData[]):ProcessData[]=>Array.isArray(processes)?processes.filter(process=>process.status!=='EM_RASCUNHO'):[];

/** Completion needs its own timestamp; an edit/import timestamp is not a completion event. */
export function recordedCompletionDays(process:ProcessData,now:number):number|null{
 if(process.status!=='CONCLUIDO'||process.legacyRecord||!process.createdAt||!process.completedAt)return null;
 const start=Date.parse(process.createdAt),end=Date.parse(process.completedAt);
 return Number.isFinite(start)&&Number.isFinite(end)&&end>=start&&end<=now?(end-start)/86_400_000:null;
}
