export interface PublicBlankPdfArtifact {
  driveFileId:string; sha256:string; byteLength:number;
  sourceContentSha256:string; sourceVersion:number; publishedAt:string;
}
// Tipos compartilhados do Portal Institucional de TCC

import type { IntegrationStudioSettings } from './integrationStudio';
export * from './integrationStudio';
export * from './tccDetailFormat';
export * from './signatures';
export * from './courseOperations';
export * from './statistics';

export type GlobalRole = 'MASTER_ADMIN' | 'COMMISSION_PRESIDENT';

export type ProcessRole = 'STUDENT' | 'ADVISOR' | 'CO_ADVISOR' | 'EXAMINER';

export type UserRole = GlobalRole | ProcessRole;

export interface InstallationProfile {
  installationId: string;
  portalName: string;
  institutionName: string;
  institutionAcronym: string;
  courseName: string;
  courseAcronym: string;
  departmentName?: string;
  campusName?: string;
  city: string;
  countryCode: string;
  locale: string;
  studentEmailDomains: string[];
  internalEmailDomains: string[];
  protocolPrefix: string;
  driveRootFolderName: string;
  defaultInstitutionName: string;
  defaultDefenseLocation?: string;
}

export type AcademicCycleStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED';

export interface AcademicCycle {
  id: string;
  label: string;
  year: number;
  term: string;
  submissionOpenAt: string;
  submissionCloseAt: string;
  defenseStartAt: string;
  defenseEndAt: string;
  status: AcademicCycleStatus;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PortalFeatureKey =
  | 'ACADEMIC_CYCLES'
  | 'STUDENT_BULK_IMPORT'
  | 'PAIR_ACCEPTANCE'
  | 'DEFENSE_CONFLICTS'
  | 'INSTITUTIONAL_DOSSIER'
  | 'PUBLIC_AUTHENTICITY'
  | 'ADMIN_TRANSFER'
  | 'OPERATIONS_KPIS';

export interface PortalFeatureFlag {
  key: PortalFeatureKey;
  enabled: boolean;
  audience: 'ALL' | 'ADMIN_ONLY' | 'PILOT';
  description: string;
  updatedAt: string;
  updatedBy: string;
}

export type ProcessEtapa = 
  | 'CADASTRO'
  | 'AGENDAMENTO'
  | 'CONFIRMACAO_LOCAL'
  | 'CONVITE'
  | 'DEFESA'
  | 'AVALIACAO'
  | 'REPOSITORIO'
  | 'ASSINATURA'
  | 'DOCUMENTOS'
  | 'CONCLUIDO';

export type ProcessStatus = 
  | 'EM_RASCUNHO'
  | 'AGUARDANDO_CONFIRMACAO_LOCAL'
  | 'AGUARDANDO_DEFESA'
  | 'EM_AVALIACAO'
  | 'AGUARDANDO_DADOS_FINAIS'
  | 'AGUARDANDO_ASSINATURA'
  | 'CONCLUIDO';

export interface StudentInfo {
  tratamento?: 'Aluno'|'Aluna';
  nome: string;
  matricula: string;
  email: string;
}

export interface AdvisorInfo {
  tratamento?: 'Professor'|'Professora';
  titulacao?: string;
  siape?: string;
  nome: string;
  email: string;
  instituicao?: string;
}

export interface ExaminerInfo {
  tratamento?: 'Professor'|'Professora';
  siape?: string;
  id: string;
  nome: string;
  email: string;
  funcao: 'ORIENTADOR' | 'EXAMINER_2' | 'EXAMINER_3';
  membroTipo?: 'INTERNO' | 'EXTERNO';
  instituicao?: string;
  profissao?: string;
  titulacao?: string;
}

export interface DefesaInfo {
  departmentResponse?: {departmentEmail?:string;attribution?:'EMAIL_LINK'|'MASTER_ADMIN';receiptBody?:string;receiptPresentation?:{institution:string;course:string;color:string;timezone:string;participants:Array<{role:string;name:string}>};receiptDesign?:NonNullable<import('./integrationStudio').IntegrationStudioSettings['receiptDesign']>;revision:number;decision:'CONFIRMED'|'UNAVAILABLE';respondedAt:string;respondedBy:string;local?:string;startAt:string;endAt:string};
  /** Address fixed when the current reservation request is sent. */
  reservationRequestRecipient?: string;
  reservationRevision?: number;
  reservationHistory?: Array<{reservationRevision?:number;receiptContext?:Pick<ProcessData,'titulo'|'aluno1'|'aluno2'|'orientador'|'coorientador'|'banca'>;invitationDriveFileId?:string;invitationSentAt?:string;invitationRecipients?:string[];startAt:string;endAt:string;local:string;alternateLocation?:string;locationProof?:import('./workflowOperations').LocationProof;departmentResponse?:DefesaInfo['departmentResponse'];localStatus?:DefesaInfo['localStatus'];localConfirmedAt?:string;localConfirmedBy?:string;localEvidenceUrl?:string;invalidatedAt:string;invalidatedBy:string}>;
  locationProof?: import('./workflowOperations').LocationProof;
  alternateLocation?: string;
  startAt: string;
  endAt: string;
  local: string;
  formato?: string;
  banca?: Array<{ nome: string; filiacao?: string; papel?: string }>;
  calendarEventId?: string;
  localStatus?: 'PENDENTE' | 'CONFIRMADO' | 'NEGADO' | 'RECUSADO' | 'REJEITADO';
  /** Pedido de alteração independente da reserva vigente. Não substitui a data/local antes de aprovação. */
  reservationChangeRequest?: {
    requestId: string;
    requestedAt: string;
    requestedBy: string;
    startAt: string;
    endAt: string;
    local: string;
    locationChoice: string;
    recipient: string;
    status: 'PENDING' | 'SENT' | 'SEND_FAILED' | 'DENIED' | 'APPROVED';
    sentAt?: string;
    resolvedAt?: string;
    resolvedBy?: string;
    failureMessage?: string;
  };
  localEvidenceUrl?: string;
  localConfirmedAt?: string;
  localConfirmedBy?: string;
  invitationDriveFileId?: string;
  invitationSentAt?: string;
  invitationRecipients?: string[];
}

export interface EvaluationOutcomeOption {
  code: string;
  label: string;
}

export interface EvaluationInfo {
  /** Explicitly confirmed by the advisor; registration alone never implies attendance. */
  coadvisorPresent?: boolean;
  submissionSha256?: string;
  reviewedAta?: {fileId:string;version:number;verificationCode:string;signaturePolicySnapshot?:import('./signatures').SignaturePolicySnapshot};
  documentText?: string;
  documentRevision?: number;
  answers?: Record<string, string | number | boolean>;
  dataReview?: {
    sourceDataRevision: number;
    formRevision: number;
    confirmedAt: string;
    confirmedBy: string;
    fields: Array<[string, string]>;
  };
  status: 'PENDENTE' | 'CONCLUIDO';
  resultadoCode?: string;
  resultadoLabel?: string;
  nota?: number;
  notaFinal?: number;
  parecer?: string;
  submittedBy?: string;
  submittedAt?: string;
  updatedAt?: string;
}

export interface ProcessAcervoInfo {
  palavrasChave?: string[];
  resumoSintese?: string;
  resumoExpandidoFileUrl?: string;
  resumoExpandidoFileId?: string;
  resumoExpandidoFileName?: string;
  resumoExpandidoSha256?: string;
  resumoExpandidoVersion?: number;
  trabalhoCompletoFileUrl?: string;
  trabalhoCompletoFileId?: string;
  trabalhoCompletoFileName?: string;
  trabalhoCompletoSha256?: string;
  trabalhoCompletoVersion?: number;
  isPublic?: boolean;
  publishFullWork?: boolean;
  publishExpandedAbstract?: boolean;
  publicationRequestedAt?: string;
  publicationWithdrawnAt?: string;
  publicationWithdrawnBy?: string;
  publicationWithdrawalReason?: string;
  publicFullWorkFileId?: string;
  publicFullWorkFileUrl?: string;
  publicExpandedAbstractFileId?: string;
  publicExpandedAbstractFileUrl?: string;
  publicationSyncedAt?: string;
  publicationState?: 'NOT_REQUESTED' | 'PENDING_SYNC' | 'PUBLIC' | 'WITHDRAWN';
  workType?: 'MONOGRAFIA' | 'ARTIGO' | 'OUTRO';
  authorizationConfirmedAt?: string;
  firstSubmittedAt?: string;
  submittedAt?: string;
  submittedBy?: string;
}

export interface AuthorizedStudent {
  id: string;
  nome: string;
  email: string;
  active: boolean;
  processIds: string[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  accessType?: 'STUDENT' | 'ADVISOR' | 'CO_ADVISOR' | 'EXAMINER';
  origin?: 'MASTER_LIST' | 'TCC_FORM';
  roles?: ProcessRole[];
  memberType?: 'INTERNAL' | 'EXTERNAL';
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
  manualRevocation?: boolean;
}

export interface ProcessData {
  /** Historical repository projection; never a live defense workflow. */
  legacyRecord?: boolean;
  authorOrder?: 'ALUNO_1_FIRST' | 'ALUNO_2_FIRST';
  previousProtocols?: string[];
  registrationAnswers?: Record<string, string | number | boolean>;
  registrationRevision?: number;
  completedAt?: string;
  id: string;
  protocolo: string;
  titulo: string;
  etapaAtual: ProcessEtapa;
  status: ProcessStatus;
  createdByEmail: string;
  academicCycleId?: string;
  coauthorAcceptance?: {
    status: 'NOT_REQUIRED' | 'PENDING' | 'ACCEPTED' | 'REJECTED';
    invitedEmail?: string;
    requestedAt?: string;
    respondedAt?: string;
    respondedBy?: string;
  };
  aluno1: StudentInfo;
  aluno2: StudentInfo | null;
  orientador: AdvisorInfo;
  coorientador: AdvisorInfo | null;
  banca: ExaminerInfo[];
  defesa: DefesaInfo;
  avaliacao: EvaluationInfo;
  acervo?: ProcessAcervoInfo;
  driveFolderId?: string;
  driveFolderUrl?: string;
  driveSyncedAt?: string;
  signatureProviderPreferences?: Partial<Record<'ATA'|'TERMO'|'DECLARACAO', 'ASTEN'|'GOV_BR'>>;
  astenSignatureIntent?: { documentType: 'ATA'|'TERMO'|'DECLARACAO'; revision: number; queuedAt: string; attemptedAt?: string; lastError?: string; lastErrorCode?: string; studioRevision?: number };
  dataRevision: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessMembership {
  id: string;
  processId: string;
  email: string;
  roles: ProcessRole[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DocumentType = 'CONVITE' | 'ATA' | 'TERMO' | 'DECLARACAO';

export type DocumentStatus = 
  | 'NAO_DISPONIVEL'
  | 'GERANDO'
  | 'DISPONIVEL'
  | 'AGUARDANDO_ASSINATURA'
  | 'ASSINADO'
  | 'SUBSTITUIDO'
  | 'COM_ERRO';

export interface DocumentVersion {
  id: string;
  version: number;
  sourceDataRevision: number;
  driveDocId?: string;
  drivePdfId?: string;
  signedDriveFileId?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveDownloadUrl?: string;
  fileName?: string;
  generatedAt: string;
  generatedBy: string;
  isCurrent: boolean;
  replacesVersion?: number;
  contentPreviewText?: string;
}

export interface ProcessDocument {
  signatureProgress?: import('./signatures').DocumentSignatureProgress;
  id: string;
  type: DocumentType;
  title: string;
  status: DocumentStatus;
  visibleToRoles: ProcessRole[];
  requiresSignature: boolean;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  versions?: DocumentVersion[];
  driveFileId?: string;
  driveWebViewLink?: string;
  driveDownloadUrl?: string;
  signatureProvider?: 'ASTEN' | 'GOV_BR';
}

export type CorrectionRequestStatus = 'ABERTO' | 'EM_ANALISE' | 'CORRIGIDO' | 'RECUSADO';

export interface DocumentCorrectionRequest {
  id: string;
  processId: string;
  documentId: string;
  documentVersion: number;
  requestedByEmail: string;
  requestedByRoles: UserRole[];
  description: string;
  status: CorrectionRequestStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface AuditLog {
  currentProcessStage?: ProcessEtapa;
  id: string;
  processId?: string;
  processProtocol?: string;
  processTitle?: string;
  actorName?: string;
  source?: 'activity' | 'email';
  emailDeliveryId?: string;
  actorEmail: string;
  actorRoles: UserRole[];
  action: string;
  entityType: string;
  entityId: string;
  before?: any;
  after?: any;
  timestamp: string;
}

export interface CommissionMemberInfo {
  id: string;
  name: string;
  email?: string;
  startDate?: string;
  endDate?: string;
  active: boolean;
}

export interface GlobalSettings {
  installationProfile?: InstallationProfile;
  academicCycles?: AcademicCycle[];
  featureFlags?: PortalFeatureFlag[];
  tableAppearance?: Record<string, any>;
  tableLayouts?: Record<string, any>;
  portalAppearance?: {
    schemaVersion: number;
    globalPopupStyle?: import('../utils/portalAppearanceLinks').GlobalPopupStyle;
    linkedItems?: Record<string, boolean>;
    siteConfig?: Record<string, any>;
    calendarPopup?: Record<string, any>;
    tccDetailPopup?: Record<string, any>;
    loginPopup?: Record<string, any>;
    generalPopups?: Record<string, any>;
    designSystem?: {
      primaryColor: string;
      textColor: string;
      fontFamily: string;
      radius: string;
      targetSize: number;
      contrastStandard: 'AA' | 'AAA';
      validationScore: number;
    };
    publishedAt?: string;
    publishedBy?: string;
  };
  ownerName?: string;
  ownerEmail?: string;
  commissionPresidentName?: string;
  commissionPresidentEmail?: string;
  commissionPresidentContactEmail?: string;
  commissionMembers?: CommissionMemberInfo[];
  isSystemBlocked?: boolean;
  blockedAt?: string;
  blockedBy?: string;
  masterEmail: string;
  masterRecoveryEmails?: string[];
  sessionValidAfter?: number;
  substituteCoordinatorName?: string;
  commissionMember2Name?: string;
  commissionMember3Name?: string;
  commissionMember4Name?: string;
  commissionMember5Name?: string;
  portalMaintainerName?: string;
  contactEmail?: string;
  whatsappUrl?: string;
  appEnvironment: 'development' | 'test' | 'production';
  timezone: string;
  slotDurationMinutes: number;
  defaultEditLockMode: 'UNTIL_EVALUATION_SUBMITTED' | 'ALWAYS_UNLOCKED';
  optionalTimeLockEnabled: boolean;
  optionalEditLockHoursBeforeDefense: number;
  evaluationOutcomeOptions: EvaluationOutcomeOption[];
  calendarId?: string;
  driveRootFolderId?: string;
  templateIds?: Record<string, string>;
  emailConfig?: { auditEmailsEnabled?: boolean; auditCopyEmail?: string; roomReservationDepartmentEmail?: string; roomReservationDepartmentEnabled?: boolean; roomReservationEmailCentralized?: boolean; [key: string]: any };
  integrationStudio?: IntegrationStudioSettings;
  integrationStudioDraft?: IntegrationStudioSettings;
  documentModels?: Record<string, {
    id: string;
    type: string;
    label: string;
    fileName: string;
    templateContentText: string;
    driveFileId: string;
    driveFileUrl: string;
    variables: string[];
    uploadedAt: string;
    uploadedBy: string;
    contentSha256?: string;
    driveRevisionId?: string;
    driveModifiedTime?: string;
    publicPdf?: PublicBlankPdfArtifact;
    activeVersion?: number;
    versions?: Array<{
      version: number;
      fileName: string;
      driveFileId: string;
      driveFileUrl: string;
      variables: string[];
      uploadedAt: string;
      uploadedBy: string;
      contentSha256?: string;
      driveRevisionId?: string;
      driveModifiedTime?: string;
      publicPdf?: PublicBlankPdfArtifact;
    }>;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  userEmail: string | null;
  globalRoles: GlobalRole[];
  memberships: ProcessMembership[];
  settings: GlobalSettings | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface GoogleCalendarSyncedEvent {
  id: string;
  portalTccProtocol?: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  syncedAt: string;
}
