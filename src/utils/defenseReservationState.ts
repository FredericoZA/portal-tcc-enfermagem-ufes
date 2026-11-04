import type {GoogleCalendarSyncedEvent, ProcessData} from '../types';

type ReservationProcess = Pick<ProcessData, 'defesa'>;
type CalendarProcess = Pick<ProcessData, 'id' | 'protocolo' | 'defesa'>;
const REFUSED = new Set(['NEGADO', 'RECUSADO', 'REJEITADO']);

/** A saved decision for the current request is authoritative over an old status field. */
export function effectiveDefenseReservationStatus(process: ReservationProcess): ProcessData['defesa']['localStatus'] {
  const response = process.defesa?.departmentResponse;
  if (response && response.revision === (process.defesa.reservationRevision || 0)) {
    if (response.decision === 'UNAVAILABLE') return 'RECUSADO';
    if (response.decision === 'CONFIRMED') return 'CONFIRMADO';
  }
  return process.defesa?.localStatus;
}

/** Historical receipts never suppress the pending state of a new request. */
export function isDefenseReservationPending(process: ReservationProcess): boolean {
  return effectiveDefenseReservationStatus(process) === 'PENDENTE';
}

/** Old refusals retained PENDENTE together with an UNAVAILABLE receipt. */
export function isDefenseReservationDeclined(process: ReservationProcess): boolean {
  return REFUSED.has(String(effectiveDefenseReservationStatus(process) || '').toUpperCase());
}

/** Scheduling eligibility is independent of the defense's existing time-based colors. */
export function isDefenseOnCalendar(process: ReservationProcess): boolean {
  return Boolean(process.defesa?.startAt)
    && Number.isFinite(Date.parse(process.defesa.startAt))
    && !isDefenseReservationDeclined(process);
}

/** Expose the outcome without exposing the private reservation receipt or its author. */
export function publicDefenseReservationStatus(process: ReservationProcess): ProcessData['defesa']['localStatus'] {
  return isDefenseReservationDeclined(process) ? 'RECUSADO' : effectiveDefenseReservationStatus(process);
}

/** Match only stable portal identifiers, not similar titles or people's names. */
export function calendarEventMatchesProcess(
  event: Pick<GoogleCalendarSyncedEvent, 'id' | 'description' | 'portalTccProtocol'>,
  process: CalendarProcess,
): boolean {
  if (event.id === `gcal-${process.id}`) return true;
  if (!process.protocolo) return false;
  if (event.portalTccProtocol === process.protocolo) return true;
  return String(event.description || '').split(/\r?\n/)
    .some(line => /^Protocolo:\s*/i.test(line.trim())
      && line.trim().replace(/^Protocolo:\s*/i, '').trim() === process.protocolo);
}

/** An open day popup follows the current schedule instead of retaining a stale copy. */
export function currentDefenseSelection<T extends CalendarProcess>(selection: T[] | null, processes: T[]): T[] | null {
  if (!selection) return null;
  const current = selection.flatMap(previous => {
    const next = processes.find(process => process.id === previous.id || process.protocolo === previous.protocolo);
    return next && isDefenseOnCalendar(next)
      && new Date(next.defesa.startAt).toDateString() === new Date(previous.defesa.startAt).toDateString()
      ? [next] : [];
  });
  return current.length ? current : null;
}
