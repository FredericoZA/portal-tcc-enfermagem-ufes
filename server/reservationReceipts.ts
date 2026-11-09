import type {ProcessData} from '../src/types';
import type {ReservationReceiptSummary} from '../src/types/workflowOperations';
import {effectiveDefenseReservationStatus} from '../src/utils/defenseReservationState';

type Defense = ProcessData['defesa'];
type ReceiptContext = NonNullable<Defense['reservationHistory']>[number]['receiptContext'];
export type ReservationReceiptSelection = {summary: ReservationReceiptSummary; process: ProcessData};

const validDate = (value: unknown): value is string =>
  typeof value === 'string' && Boolean(value) && Number.isFinite(Date.parse(value));

/** One receipt per answered request; private snapshots never leave this module. */
export function reservationReceipts(process: ProcessData): ReservationReceiptSelection[] {
  const items = new Map<string, ReservationReceiptSelection>();

  const add = (defense: Defense, fallbackId: string, current: boolean, context?: ReceiptContext) => {
    const response = defense.departmentResponse;
    const manual = !response && defense.localStatus === 'CONFIRMADO' && validDate(defense.localConfirmedAt);
    if (!response && !manual) return;
    const decision = response?.decision || (manual ? 'CONFIRMED' : undefined);
    if (decision !== 'CONFIRMED' && decision !== 'UNAVAILABLE') return;

    const startAt = response?.startAt || defense.startAt;
    const respondedAt = response?.respondedAt || defense.localConfirmedAt;
    if (!validDate(startAt) || !validDate(respondedAt)) return;

    const rawRevision = response?.revision ?? defense.reservationRevision ?? defense.locationProof?.reservationRevision;
    const revision = typeof rawRevision === 'number' && Number.isSafeInteger(rawRevision) && rawRevision >= 0
      ? rawRevision : undefined;
    // Older manual confirmations have no factual revision. Keep a selector without inventing one.
    const id = revision === undefined ? fallbackId : `revision-${revision}`;
    if (items.has(id) && !current) return;

    const savedLocation = (response?.receiptBody || '').split('\n')
      .find(row => /^Local(?: solicitado| autorizado)?:/.test(row))?.replace(/^[^:]+:\s*/, '');
    const local = response?.local || savedLocation || defense.local;
    const selected: ProcessData = {
      ...process, ...context,
      // Do not attribute today's board to a past request whose board was not recorded.
      ...(!current ? {
        orientador: context?.orientador || {nome: '', email: ''},
        coorientador: context?.coorientador || null,
        banca: context?.banca || [],
        registrationAnswers: undefined,
      } : {}),
      defesa: {...defense, local, startAt, endAt: response?.endAt || defense.endAt, reservationHistory: undefined},
    };
    items.set(id, {
      process: selected,
      summary: {
        id, revision, decision, startAt, endAt: selected.defesa.endAt, local, respondedAt, current,
        url: `/api/public/processes/${encodeURIComponent(process.protocolo)}/reservation-receipt?receipt=${encodeURIComponent(id)}`,
      },
    });
  };

  for (const [index, entry] of (process.defesa.reservationHistory || []).entries()) {
    add({...entry}, `history-${index}`, false, entry.receiptContext);
  }
  const response = process.defesa.departmentResponse;
  const current = !response || response.revision === (process.defesa.reservationRevision || 0);
  // A stale response is still a recorded receipt, but cannot borrow a new location.
  const defense = current ? process.defesa : {
    ...process.defesa, local: response?.local || 'Local não informado no registro original',
  };
  add(defense, 'current', current);

  return [...items.values()].sort((a, b) =>
    Date.parse(b.summary.respondedAt!) - Date.parse(a.summary.respondedAt!) || a.summary.id.localeCompare(b.summary.id));
}

export function reservationReceiptStatus(process: ProcessData): 'PENDENTE' | 'CONFIRMADO' | 'RECUSADO' | undefined {
  const status = effectiveDefenseReservationStatus(process);
  if (status === 'NEGADO' || status === 'REJEITADO' || status === 'RECUSADO') return 'RECUSADO';
  return status;
}
