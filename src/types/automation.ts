import type { DocumentType, ProcessData, ProcessRole } from './index';
import type { SignatureJob, SignatureJobStatus } from './signatures';

export type WorkflowEventCode =
  | 'TCC_CREATED'
  | 'LOCATION_CONFIRMED'
  | 'INVITATION_SENT'
  | 'EVALUATION_SUBMITTED'
  | 'REPOSITORY_SUBMITTED'
  | 'SIGNATURE_REQUESTED'
  | 'SIGNATURE_COMPLETED'
  | 'PROCESS_COMPLETED'
  | (string & {});

export type WorkflowActionKind = 'DOCUMENT' | 'EMAIL' | 'FORM' | 'SYSTEM_ACTION';

export interface ExecutableWorkflowAction {
  id: string;
  kind: WorkflowActionKind;
  referenceId?: string;
  title: string;
  detail?: string;
  condition?: import('./integrationStudio').StudioCondition;
}

export interface ExecutableWorkflowStage {
  id: string;
  order: number;
  title: string;
  eventCode: WorkflowEventCode;
  description?: string;
  actions: ExecutableWorkflowAction[];
}

export interface WorkflowValidationIssue {
  code:
    | 'DUPLICATE_STAGE'
    | 'DUPLICATE_ACTION'
    | 'MISSING_TRIGGER'
    | 'MISSING_REFERENCE'
    | 'UNKNOWN_REFERENCE'
    | 'INVALID_TEMPLATE'
    | 'INVALID_CONDITION'
    | 'INVALID_FORM_RULE'
    | 'MISSING_EXTERNAL_TEMPLATE'
    | 'INACCESSIBLE_APPEARANCE';
  path: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface WorkflowPlanAction extends ExecutableWorkflowAction {
  stageId: string;
  idempotencyKey: string;
}

export interface WorkflowPlan {
  eventCode: WorkflowEventCode;
  processId: string;
  protocol: string;
  variables: Record<string, string>;
  actions: WorkflowPlanAction[];
  issues: WorkflowValidationIssue[];
}

export type WorkflowActionStatus = 'COMPLETED' | 'SKIPPED' | 'FAILED';

export interface WorkflowActionExecution {
  startedAt?: string;
  completedAt?: string;
  actionId: string;
  stageId: string;
  kind: WorkflowActionKind;
  status: WorkflowActionStatus;
  externalId?: string;
  error?: string;
}

export interface WorkflowRun {
  studioRevision?: number;
  sourceDataRevision?: number;
  id: string;
  processId: string;
  protocol: string;
  eventCode: WorkflowEventCode;
  actorEmail: string;
  startedAt: string;
  completedAt: string;
  status: 'COMPLETED' | 'PARTIAL_FAILURE' | 'FAILED_VALIDATION';
  actions: WorkflowActionExecution[];
  issues: WorkflowValidationIssue[];
  /** Valores fornecidos pelo evento (por exemplo, respostas do formulário)
   * necessários para uma repetição idempotente da mesma execução. */
  eventVariables?: Record<string, string>;
}

export type EmailDeliveryStatus = 'ACCEPTED_BY_GMAIL' | 'FAILED' | 'RETRY';

export interface EmailDeliveryAttempt {
  number: number;
  startedAt: string;
  completedAt: string;
  status: EmailDeliveryStatus;
  gmailMessageId?: string;
  gmailThreadId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface EmailDeliveryRecord {
  id: string;
  processId?: string;
  protocol?: string;
  workflowRunId?: string;
  /** Evento e respostas mínimas necessários para reconstruir uma tentativa
   * sem depender de um WorkflowRun que pode ter falhado antes de registrar o
   * identificador externo da entrega. */
  workflowEventCode?: WorkflowEventCode;
  workflowEventVariables?: Record<string, string>;
  templateId?: string;
  idempotencyKey: string;
  recipient: string;
  subject: string;
  /** Conteúdo efetivamente renderizado no momento da primeira tentativa. */
  renderedText?: string;
  renderedHtml?: string;
  status: EmailDeliveryStatus;
  attempts: EmailDeliveryAttempt[];
  maxAttempts: number;
  nextRetryAt?: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type AstenEventStatus =
  | 'CREATED'
  | 'SENT'
  | 'PARTIALLY_SIGNED'
  | 'SIGNED'
  | 'DECLINED'
  | 'CANCELED'
  | 'EXPIRED'
  | 'ERROR'
  | 'UNMATCHED';

export interface AstenWebhookEvent {
  id: string;
  fingerprint: string;
  envelopeId?: string;
  status: AstenEventStatus;
  receivedAt: string;
  duplicate: boolean;
  matchedJobId?: string;
  safePayload: Record<string, unknown>;
}

export interface AstenEnvelopeTimeline {
  envelopeId: string;
  jobId?: string;
  status: AstenEventStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  eventIds: string[];
}

export interface AstenOperationalDashboard {
  generatedAt: string;
  totalJobs: number;
  jobsByStatus: Partial<Record<SignatureJobStatus, number>>;
  envelopes: AstenEnvelopeTimeline[];
  unmatchedEvents: AstenWebhookEvent[];
  duplicateEvents: number;
  needsAttention: Array<{
    jobId: string;
    processId: string;
    protocol: string;
    documentType: Exclude<DocumentType, 'CONVITE'>;
    status: SignatureJobStatus;
    reason: string;
  }>;
  recentEvents: AstenWebhookEvent[];
}

export interface CanonicalSignatureRecipient {
  role: 'STUDENT' | 'ADVISOR' | 'PRESIDENT';
  name: string;
  email: string;
  order: 1;
}

export interface CanonicalSignaturePlan {
  documentType: Exclude<DocumentType, 'CONVITE'>;
  required: boolean;
  reason?: string;
  signers: CanonicalSignatureRecipient[];
}

export interface WorkflowRuntimeContext {
  /** Completed effects preserved during a reviewed recovery of this event. */
  completedActions?: WorkflowActionExecution[];
  process: ProcessData;
  actorEmail: string;
  actorRoles: ProcessRole[];
  eventCode: WorkflowEventCode;
  occurredAt?: string;
  extraVariables?: Record<string, unknown>;
}

export type AstenDashboardJob = Pick<
  SignatureJob,
  'id' | 'processId' | 'protocol' | 'documentType' | 'status' | 'providerEnvelopeId' | 'updatedAt' | 'lastError'
>;
