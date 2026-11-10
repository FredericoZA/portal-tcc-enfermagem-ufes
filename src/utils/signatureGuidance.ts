import type { SignatureJob, SignatureJobStatus, SignatureSignerStatus } from '../types/signatures';

const SIGNATURE_STATUS_LABELS: Record<SignatureJobStatus | SignatureSignerStatus, string> = {
  WAITING_INTEGRATION: 'Aguardando integração',
  QUEUED: 'Preparando solicitação',
  READY_FOR_REVIEW: 'Aguardando conferência',
  APPROVED: 'Conferência aprovada',
  SENDING: 'Encaminhamento em andamento',
  SENT: 'Aguardando assinaturas',
  PARTIALLY_SIGNED: 'Assinaturas ainda pendentes',
  SIGNED: 'Assinado',
  DECLINED: 'Assinatura recusada',
  EXPIRED: 'Prazo de assinatura encerrado',
  CANCELED: 'Solicitação cancelada',
  PROVIDER_ERROR: 'Falha na integração de assinatura',
  DRIVE_SYNC_PENDING: 'Aguardando arquivamento no Drive',
  ARCHIVED: 'Documento assinado e arquivado',
  WAITING: 'Aguardando assinatura',
  VIEWED: 'Documento visualizado',
};

export function signatureStatusLabel(status: SignatureJobStatus | SignatureSignerStatus): string {
  return SIGNATURE_STATUS_LABELS[status] || 'Situação não informada';
}

/** Shared short recommendation wherever the signer chooses a provider. */
export const ASTEN_SIGNATURE_GUIDANCE = 'Prefira o Asten para assinar: basta seguir o link recebido por e-mail.';

export const ASTEN_AUTOMATIC_GUIDANCE = 'As solicitações de assinatura são enviadas automaticamente pelo Asten. Assine pelo link recebido por e-mail. Se necessário, utilize o Gov.br.';

export function automaticAstenDocumentStatus(job: SignatureJob | undefined, queued: boolean, usingGovbr: boolean, attempted = false, pendingError?: string): string {
  if (usingGovbr) return 'ASTEN - Via Gov.br selecionada.';
  if (job) {
    switch (job.status) {
      case 'SENT':
        return job.sentAt || job.providerDispatchState === 'SENT'
          ? 'ASTEN - E-mail enviado. Solicitação enviada para o e-mail dos signatários.'
          : 'ASTEN - Aguardando assinaturas.';
      case 'PARTIALLY_SIGNED': return 'ASTEN - E-mail enviado. Aguardando as assinaturas restantes.';
      case 'SIGNED':
      case 'DRIVE_SYNC_PENDING': return 'ASTEN - Assinaturas concluídas, arquivamento pendente.';
      case 'ARCHIVED': return 'ASTEN - Documento assinado e arquivado.';
      case 'WAITING_INTEGRATION':
      case 'PROVIDER_ERROR':
      case 'DECLINED':
      case 'EXPIRED':
      case 'CANCELED': return 'ASTEN - Envio ou assinatura não concluídos.';
    }
  }
  if (queued && attempted) return pendingError
    ? `ASTEN - Envio pendente. ${pendingError}`
    : 'ASTEN - Envio pendente, aguardando nova tentativa automática.';
  return queued ? 'ASTEN - Preparando envio.' : 'ASTEN - Envio automático pendente para esta versão.';
}
