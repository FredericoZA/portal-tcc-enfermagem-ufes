import type { EmailDeliveryRecord } from '../../src/types/automation';
import type { ProcessData, SignatureJob } from '../../src/types';
import { effectiveDefenseReservationStatus } from '../../src/utils/defenseReservationState';
import { isReservationDecisionEmail, operationalEmailRouting } from '../../src/utils/studioOperationalCatalog';
import { repositoryDeliveryReady } from '../../src/utils/repositoryDeliveryEmail';
import { documentSignatureCompleted } from '../../src/utils/documentSignatureState';
import { declarationReady, ataArchived } from './gates';

export type EmailRetryBlocker = { code: string; error: string };

/** A communication retry must still describe the currently completed academic event. */
export function operationalEmailRetryBlocker(
  record: EmailDeliveryRecord,
  process: ProcessData,
  jobs: SignatureJob[],
): EmailRetryBlocker | undefined {
  const template = record.templateId || '';
  if (!operationalEmailRouting(template) && template !== 'email-resposta-departamento') return;
  if (record.sourceDataRevision !== undefined && record.sourceDataRevision !== process.dataRevision) {
    return { code: 'STALE_EMAIL_PROCESS_REVISION', error: 'Os dados do TCC mudaram desde este e-mail. Consulte a comunicação atual do processo.' };
  }
  const reservationNotice = ['email-reserva', 'email-reserva-autores', 'email-convite', 'email-resposta-departamento'].includes(template) || isReservationDecisionEmail(template);
  if (reservationNotice && Number(record.workflowEventVariables?.RESERVATION_REVISION || 0) !== (process.defesa.reservationRevision || 0)) {
    return { code: 'STALE_RESERVATION_REQUEST', error: 'Este e-mail pertence a outro agendamento. Consulte a solicitação atual.' };
  }
  if (['email-reserva', 'email-reserva-autores'].includes(template)) {
    if (effectiveDefenseReservationStatus(process) !== 'PENDENTE' || process.defesa.departmentResponse || process.defesa.invitationSentAt || process.defesa.invitationDriveFileId) {
      return { code: 'RESERVATION_REQUEST_CLOSED', error: 'A solicitação de reserva já foi encerrada. Consulte a decisão registrada no processo.' };
    }
  }
  if (isReservationDecisionEmail(template)) {
    const response = process.defesa.departmentResponse;
    const expected = template === 'email-local-indisponivel' ? 'UNAVAILABLE' : 'CONFIRMED';
    if (!response || response.revision !== (process.defesa.reservationRevision || 0) || response.decision !== expected) {
      return { code: 'RESERVATION_DECISION_CHANGED', error: 'Este comprovante não corresponde à decisão atual do agendamento.' };
    }
  }
  if (template === 'email-resposta-departamento' && process.defesa.departmentResponse?.revision !== (process.defesa.reservationRevision || 0)) {
    return { code: 'RESERVATION_DECISION_CHANGED', error: 'A resposta do agendamento ainda não foi confirmada para esta solicitação.' };
  }
  if (template === 'email-convite' && (
    effectiveDefenseReservationStatus(process) !== 'CONFIRMADO' || !process.defesa.invitationDriveFileId || process.defesa.invitationSentAt
  )) {
    return { code: 'INVITATION_EVENT_NOT_CURRENT', error: 'O convite exige o local confirmado e a carta vigente, sem outro envio já concluído. Consulte a ficha do TCC.' };
  }
  if (template === 'email-entrega-repositorio' && !repositoryDeliveryReady(process, jobs)) {
    return { code: 'REPOSITORY_NOTICE_NOT_CURRENT', error: 'Este aviso exige a ata assinada e arquivada e uma entrega final ainda pendente.' };
  }
  if (template === 'email-assinatura-termo' && (
    !process.acervo?.submittedAt || !process.acervo.authorizationConfirmedAt ||
    !(process.acervo.publishFullWork || process.acervo.publishExpandedAbstract) || !ataArchived(process, jobs) ||
    process.status === 'CONCLUIDO' || documentSignatureCompleted(jobs,process.id,'TERMO',process.dataRevision)
  )) {
    return { code: 'TERM_NOTICE_NOT_CURRENT', error: 'O aviso do Termo exige entrega registrada, publicação autorizada e ata arquivada.' };
  }
  const declarationArchived = template === 'email-conclusao' && jobs.some(job =>
    job.processId===process.id && job.documentType==='DECLARACAO' && job.sourceDataRevision===process.dataRevision &&
    job.status==='ARCHIVED' && Boolean(job.driveSignedFileId));
  if (template === 'email-conclusao' && (process.status !== 'CONCLUIDO' || !declarationReady(process, jobs) || !declarationArchived)) {
    return { code: 'COMPLETION_NOTICE_NOT_CURRENT', error: 'O aviso final aguarda a conclusão do processo com os documentos exigidos.' };
  }
}
