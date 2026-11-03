import type { ProcessData } from '../types';
import { isOtherDefenseLocation } from './customDefenseLocation';

export type ReservationStatusAlert = {
  kind: 'denied' | 'waiting' | 'delivery-failed';
  text: string;
};

const DENIAL_STATUSES = new Set(['DENIED', 'NEGADO', 'RECUSADO', 'REJEITADO', 'REJECTED']);
const WAITING_STATUSES = new Set(['PENDING', 'SENT']);

/**
 * Apresenta somente um aviso de reserva, priorizando a solicitação mais recente.
 * Avisos deste fluxo representam pendências/alertas, e não mensagens informativas.
 */
export function reservationStatusAlert(
  process: Pick<ProcessData, 'defesa' | 'registrationAnswers'>,
): ReservationStatusAlert | null {
  const request = process.defesa?.reservationChangeRequest;
  const requestStatus = String(request?.status || '').toUpperCase();
  const localStatus = String(process.defesa?.localStatus || '').toUpperCase();

  if (DENIAL_STATUSES.has(requestStatus)) {
    return {
      kind: 'denied',
      text: 'O responsável recusou o agendamento. Use “Alterar reserva” para enviar outro pedido de reserva.',
    };
  }

  // Um novo pedido enviado substitui visualmente a recusa de um pedido anterior.
  if (WAITING_STATUSES.has(requestStatus)) {
    return {
      kind: 'waiting',
      text: isOtherDefenseLocation(request?.locationChoice)
        ? 'Aguardando o aceite ou a recusa do orientador pelo pedido enviado por e-mail.'
        : 'Aguardando o aceite ou a recusa do departamento pelo pedido enviado por e-mail.',
    };
  }

  if (requestStatus === 'SEND_FAILED') {
    return {
      kind: 'delivery-failed',
      text: 'O envio do e-mail ainda não foi confirmado. Use “Alterar reserva” para repetir o mesmo pedido ou procure a secretaria.',
    };
  }

  if (DENIAL_STATUSES.has(localStatus)) {
    return {
      kind: 'denied',
      text: 'O responsável recusou o agendamento. Use “Alterar reserva” para enviar outro pedido de reserva.',
    };
  }

  if (localStatus === 'PENDENTE' && !requestStatus) {
    return {
      kind: 'waiting',
      text: isOtherDefenseLocation(process.registrationAnswers?.DEFESA_LOCAL)
        ? 'Aguardando o aceite ou a recusa do orientador pelo pedido enviado por e-mail.'
        : 'Aguardando o aceite ou a recusa do departamento pelo pedido enviado por e-mail.',
    };
  }

  return null;
}
