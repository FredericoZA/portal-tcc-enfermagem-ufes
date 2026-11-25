import type { ProcessData } from '../types';
import { defenseEndAt } from './defenseSchedule';
import { effectiveDefenseReservationStatus, isDefenseOnCalendar } from './defenseReservationState';

type Reservation = Pick<ProcessData, 'protocolo' | 'titulo' | 'defesa' | 'status'>;

export interface ReservationPeriod {
  startDate: string;
  endDate: string;
}

const isCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export function reservationPeriodError({startDate, endDate}: ReservationPeriod): string {
  if (!isCalendarDate(startDate) || !isCalendarDate(endDate)) return 'Informe uma data inicial e uma data final válidas.';
  return startDate > endDate ? 'A data final deve ser igual ou posterior à data inicial.' : '';
}

export function formatReservationPeriod({startDate, endDate}: ReservationPeriod) {
  const format = (value: string) => value.split('-').reverse().join('/');
  return startDate === endDate ? format(startDate) : `${format(startDate)} a ${format(endDate)}`;
}

export function confirmedReservations(processes: readonly Reservation[], period: ReservationPeriod, timeZone = 'America/Sao_Paulo') {
  if (reservationPeriodError(period)) return [];
  const localDate = new Intl.DateTimeFormat('sv-SE', {timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
  const day = new Intl.DateTimeFormat('pt-BR', {timeZone,weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});
  const time = new Intl.DateTimeFormat('pt-BR', {timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  return processes
    .filter(p=>p.status!=='EM_RASCUNHO' && isDefenseOnCalendar(p) && effectiveDefenseReservationStatus(p)==='CONFIRMADO')
    .map(p=>({p,start:Date.parse(p.defesa.startAt)}))
    .filter(({start})=>{
      const date = localDate.format(start);
      return date >= period.startDate && date <= period.endDate;
    })
    .sort((a,b)=>a.start-b.start || a.p.protocolo.localeCompare(b.p.protocolo,'pt-BR'))
    .map(({p,start})=>{
      const recordedEnd = Date.parse(p.defesa.endAt);
      const end = recordedEnd>start ? recordedEnd : Date.parse(defenseEndAt(p.defesa.startAt));
      return [day.format(start), `${time.format(start)} – ${time.format(end)}`, p.defesa.local || '—', p.protocolo, p.titulo];
    });
}

