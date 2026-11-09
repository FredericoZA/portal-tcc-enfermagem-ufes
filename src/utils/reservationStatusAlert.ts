import type { ProcessData } from '../types';
import {effectiveDefenseReservationStatus} from './defenseReservationState';
import { normalizeEmail } from './formatters';
import { isManagedDefenseLocation } from './reservationLocation';

export type ReservationStatusAlert = {
  kind: 'denied' | 'waiting' | 'delivery-failed';
  text: string;
  awaitsViewerResponse?: true;
};

const DENIAL_STATUSES = new Set(['DENIED', 'NEGADO', 'RECUSADO', 'REJEITADO', 'REJECTED']);
const WAITING_STATUSES = new Set(['PENDING', 'SENT']);

/**
 * Apresenta somente um aviso de reserva, dando prioridade à recusa registrada.
 * Avisos deste fluxo representam pendências/alertas, e não mensagens informativas.
 */
export function reservationStatusAlert(
  process: Pick<ProcessData, 'defesa' | 'registrationAnswers'>,
  access: 'visitor' | 'author' | 'other' = 'other',
  managedLocations?: string[],
  advisorViewerEmail?: string,
): ReservationStatusAlert | null {
  const response = process.defesa?.departmentResponse;
  const currentDecision = response && response.revision === (process.defesa.reservationRevision || 0);
  const request = currentDecision ? undefined : process.defesa?.reservationChangeRequest;
  const requestStatus = String(request?.status || '').toUpperCase();
  const localStatus = String(effectiveDefenseReservationStatus(process) || '').toUpperCase();

  // Recusa registrada tem precedência: nunca exibir, junto dela, a observação de espera.
  if (DENIAL_STATUSES.has(requestStatus) || DENIAL_STATUSES.has(localStatus)) {
    const message = 'A solicitação de reserva do local para a defesa não foi aprovada.';
    const instruction = access === 'visitor'
      ? ' Para enviar uma nova solicitação, o aluno deverá fazer login no Portal TCC e clicar em “Refazer reserva”.'
      : access === 'author' ? ' Para enviar uma nova solicitação, clique em “Refazer reserva”.' : '';
    return {
      kind: 'denied',
      text: message + instruction,
    };
  }

  if (WAITING_STATUSES.has(requestStatus) || (localStatus === 'PENDENTE' && !requestStatus)) {
    // O local vigente pode ter mudado desde a inscrição original.
    const location = request?.locationChoice || process.defesa?.local || String(process.registrationAnswers?.DEFESA_LOCAL ?? '');
    const approver = isManagedDefenseLocation(location, managedLocations) ? 'departamento' : 'orientador';
    const recipient = normalizeEmail(request?.recipient || process.defesa?.reservationRequestRecipient || '');
    if (approver === 'orientador' && advisorViewerEmail && (!recipient || recipient === advisorViewerEmail)) {
      return {
        kind: 'waiting',
        awaitsViewerResponse: true,
        text: 'A reserva aguarda sua resposta. Abra o pedido enviado para o seu e-mail e escolha aceitar ou recusar.',
      };
    }
    return {
      kind: 'waiting',
      text: `Aguardando o aceite ou a recusa do ${approver} pelo pedido enviado por e-mail.`,
    };
  }

  if (requestStatus === 'SEND_FAILED') {
    return {
      kind: 'delivery-failed',
      text: 'O envio do e-mail ainda não foi confirmado. Use “Alterar reserva” para repetir o mesmo pedido ou procure a secretaria.',
    };
  }

  return null;
}
