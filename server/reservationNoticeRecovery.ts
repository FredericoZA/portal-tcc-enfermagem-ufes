import type {ProcessData} from '../src/types';
import type {EmailDeliveryRecord} from '../src/types/automation';

export interface ReservationNoticeRecoveryCandidate {
  process: ProcessData;
  processId: string;
  revision: number;
  idempotencyKey: string;
  delivery?: EmailDeliveryRecord;
}

export function selectReservationNoticeRecoveries(
  processes: readonly ProcessData[],
  deliveries: readonly EmailDeliveryRecord[],
  options: {now?: Date; limit?: number} = {}
): ReservationNoticeRecoveryCandidate[] {
  const now = (options.now || new Date()).getTime();
  const limit = Number.isFinite(options.limit) ? Math.min(100, Math.max(0, Math.floor(options.limit!))) : 25;
  if (!Number.isFinite(now) || limit === 0) return [];
  const deliveriesByKey = new Map<string, EmailDeliveryRecord[]>();
  for (const delivery of deliveries) {
    const records = deliveriesByKey.get(delivery.idempotencyKey) || [];
    records.push(delivery);
    deliveriesByKey.set(delivery.idempotencyKey, records);
  }
  const selected: ReservationNoticeRecoveryCandidate[] = [];
  for (const process of processes) {
    const response = process.defesa?.departmentResponse;
    const revision = process.defesa?.reservationRevision ?? 0;
    if (!response || response.revision !== revision || !Number.isSafeInteger(revision) || revision < 0 || !response.respondedBy) continue;
    const idempotencyKey = `reservation-receipt:${process.id}:${revision}:${response.respondedBy}`;
    const records = deliveriesByKey.get(idempotencyKey) || [];
    if (records.some(delivery => {
      if (delivery.status !== 'RETRY' || delivery.dispatchState || delivery.attempts.length >= delivery.maxAttempts) return true;
      return Boolean(delivery.nextRetryAt && (!Number.isFinite(Date.parse(delivery.nextRetryAt)) || Date.parse(delivery.nextRetryAt) > now));
    })) continue;
    selected.push({process, processId:process.id, revision, idempotencyKey, delivery:records[0]});
    if (selected.length >= limit) break;
  }
  return selected;
}
