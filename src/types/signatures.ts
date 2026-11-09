import type {SignatureRecipientRole} from './integrationStudio';
import type { DocumentType } from './index';

export interface SignaturePolicySnapshot {version:1;configured:boolean;documentType:'ATA'|'TERMO'|'DECLARACAO';templateId:string;studioRevision:number;roles:SignatureRecipientRole[];signers:Array<Pick<SignatureSignerSnapshot,'role'|'name'|'email'|'signingOrder'>>;digest:string;}

export type SignatureSignerRole = 'ADVISOR' | 'EXAMINER' | 'STUDENT' | 'CO_ADVISOR' | 'PRESIDENT';
export type SignatureSignerStatus = 'WAITING' | 'VIEWED' | 'SIGNED' | 'DECLINED';
export type SignatureJobStatus = 'WAITING_INTEGRATION' | 'QUEUED' | 'READY_FOR_REVIEW' | 'APPROVED' | 'SENDING' | 'SENT' | 'PARTIALLY_SIGNED' | 'SIGNED' | 'DECLINED' | 'EXPIRED' | 'CANCELED' | 'PROVIDER_ERROR' | 'DRIVE_SYNC_PENDING' | 'ARCHIVED';

export interface SignatureSignerSnapshot {
  id: string; role: SignatureSignerRole; name: string; email: string; signingOrder: number;
  status: SignatureSignerStatus; signedAt?: string;
}

export interface SignatureJob {
  /** Immutable contract for newly prepared minutes; absent on historical board-only jobs. */
  ataSignerPolicy?: 'BOARD_AUTHORS_V1';
  signerPolicySnapshot?:SignaturePolicySnapshot;
  /** Excluded from operational lists; archived evidence remains valid. */
  removedFromLogsAt?: string; removedFromLogsBy?: string;
  signedAt?: string;
  id: string; processId: string; protocol: string; documentType: Exclude<DocumentType, 'CONVITE'>;
  documentTitle: string; documentVersion: number; sourceDataRevision: number; fileName: string; mimeType: string;
  contentSha256: string; idempotencyKey: string; status: SignatureJobStatus; signers: SignatureSignerSnapshot[];
  createdAt: string; createdBy: string; updatedAt: string; approvedAt?: string; approvedBy?: string;
  approvalExpiresAt?: string; provider: 'ASTEN' | 'GOV_BR'; providerEnvelopeId?: string; providerEnvelopeHash?: string;
  providerCreationState?: 'PENDING' | 'CREATING' | 'CONFIRMED' | 'UNCERTAIN';
  /** Destino confirmado para esta versão; mudanças de configuração só afetam novas versões. */
  providerRepositoryId?: number;
  providerFolderId?: number;
  providerAuthenticationProfile?: 'CONFIDENTIAL_SMS' | 'EMAIL_LOGIN' | 'EMAIL_LINK';
  /** Falhas ambíguas de encaminhamento não autorizam novo envio automático. */
  providerDispatchState?: 'PENDING' | 'SENDING' | 'SENT' | 'UNCERTAIN';
  providerStatusCheckedAt?: string;
  sentAt?: string; completedAt?: string; lastError?: string; driveUnsignedFileId?: string; driveSignedFileId?: string;
  postArchivePending?: boolean;
  driveSignedWebViewLink?: string; signedSha256?: string; verificationCode?: string; artifactBase64?: string;
  /** Snapshot normalizado das variáveis usadas para renderizar esta versão. */
  renderVariables?: Record<string, string>;
  /** PDF privado pendente; envio não equivale à aprovação de assinatura. */
  govbrReview?: {
    fileId:string; fileName:string; sha256:string; uploadedAt:string; uploadedBy:string;
    approvedAt?:string; approvedBy?:string; method?:'MANUAL_VALIDAR_ITI';
    itiApproved?:boolean; signerMatches?:boolean; documentMatches?:boolean;
  };
}

export interface AstenIntegrationStatus {
  enabled: boolean; mode: 'ENCRYPTED_PERSISTENT_TOKEN' | 'EPHEMERAL_SESSION' | 'STATELESS_ENCRYPTED_SESSION' | 'SERVER_SECRET' | 'DISABLED'; configured: boolean;
  dispatchEnabled: boolean; sessionTtlMinutes: number; callbackConfigured: boolean; securityMessage: string;
}

export interface AstenDeclarationCheck {
  processId:string; protocol:string; ready:boolean; reason:string; recipientEmail?:string; recipientName?:string; jobId?:string; status?:SignatureJobStatus; sentAt?:string;
}

export type AstenDocumentFolderType='ATA'|'TERMO'|'DECLARACAO';
export interface AstenDocumentFoldersStatus {
  configured:boolean;
  repositoryId:number|null;
  folders:Array<{id:number;name:string}>;
  mapping:Partial<Record<AstenDocumentFolderType,number>>;
  missingTypes:AstenDocumentFolderType[];
  issues:string[];
  updatedAt?:string;
}

/** Public aggregate; never includes signatory identities or personal access links. */
export interface DocumentSignatureProgress {
 generated:boolean; signed:number; total:number; status?:SignatureJobStatus;
 provider:'ASTEN'|'GOV_BR'; emailSent:boolean;
}
