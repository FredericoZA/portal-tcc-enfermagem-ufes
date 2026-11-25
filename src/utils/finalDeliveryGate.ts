import type { ProcessData } from '../types';

/** An elapsed calendar event alone cannot release uploads. The recorded
 * assessment and the archived minutes attest the defense. */
export function finalDeliveryBlocker(
  process: Pick<ProcessData, 'defesa' | 'avaliacao' | 'legacyRecord'>,
  archiveConfirmed: boolean,
  now = Date.now(),
) {
  if (process.legacyRecord) return undefined;
  const start = Date.parse(process.defesa.startAt);
  if (!Number.isFinite(start) || start > now || process.avaliacao.status !== 'CONCLUIDO') {
    return {
      code: 'DEFENSE_AND_CONCEPT_REQUIRED',
      error: 'A entrega final aguarda a realização da defesa e o registro do conceito e da ata pelo orientador.',
    };
  }
  if (!archiveConfirmed) return {
    code: 'ATA_SIGNATURE_REQUIRED',
    error: 'A entrega final aguarda a validação e o arquivamento da ata assinada.',
  };
}
