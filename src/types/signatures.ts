import type { DocumentType } from './index';

export type SignatureSignerRole = 'ADVISOR' | 'STUDENT' | 'PRESIDENT';
export type SignatureSignerStatus = 'WAITING' | 'VIEWED' | 'SIGNED' | 'DECLINED';
export type SignatureJobStatus = 'WAITING_INTEGRATION' | 'QUEUED' | 'READY_FOR_REVIEW' | 'APPROVED' | 'SENDING' | 'SENT' | 'PARTIALLY_SIGNED' | 'SIGNED' | 'DECLINED' | 'EXPIRED' | 'CANCELED' | 'PROVIDER_ERROR' | 'DRIVE_SYNC_PENDING' | 'ARCHIVED';

export interface SignatureSignerSnapshot {
  id: string; role: SignatureSignerRole; name: string; email: string; signingOrder: number;
  status: SignatureSignerStatus; signedAt?: string;
}

export interface SignatureJob {
  signedAt?: string;
  id: string; processId: string; protocol: string; documentType: Exclude<DocumentType, 'CONVITE'>;
  documentTitle: string; documentVersion: number; sourceDataRevision: number; fileName: string; mimeType: string;
  contentSha256: string; idempotencyKey: string; status: SignatureJobStatus; signers: SignatureSignerSnapshot[];
  createdAt: string; createdBy: string; updatedAt: string; approvedAt?: string; approvedBy?: string;
  approvalExpiresAt?: string; provider: 'ASTEN'; providerEnvelopeId?: string; providerEnvelopeHash?: string;
  providerCreationState?: 'PENDING' | 'CREATING' | 'CONFIRMED' | 'UNCERTAIN';
  sentAt?: string; completedAt?: string; lastError?: string; driveUnsignedFileId?: string; driveSignedFileId?: string;
  driveSignedWebViewLink?: string; signedSha256?: string; verificationCode?: string; artifactBase64?: string;
  /** Snapshot normalizado das variáveis usadas para renderizar esta versão. */
  renderVariables?: Record<string, string>;
}

export interface AstenIntegrationStatus {
  enabled: boolean; mode: 'ENCRYPTED_PERSISTENT_TOKEN' | 'EPHEMERAL_SESSION' | 'STATELESS_ENCRYPTED_SESSION' | 'SERVER_SECRET' | 'DISABLED'; configured: boolean;
  dispatchEnabled: boolean; sessionTtlMinutes: number; callbackConfigured: boolean; securityMessage: string;
}
