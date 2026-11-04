import { createHash } from 'crypto';
import type { EmailDeliveryAttempt, EmailDeliveryRecord, EmailDeliveryStatus, WorkflowEventCode } from '../../src/types/automation';
import { emailAuditCopy, type EmailAuditCopyMode } from './emailAuditCopy';

export interface GmailAcceptedResponse {
  id?: string;
  threadId?: string;
  sender?: string;
}

export interface TrackedEmailInput {
  replyThreadId?:string;
  replyMessageId?:string;
  processId?: string;
  protocol?: string;
  workflowRunId?: string;
  workflowEventCode?: WorkflowEventCode;
  workflowEventVariables?: Record<string, string>;
  templateId?: string;
  recipient: string;
  cc?: string[];
  auditCopyMode?: EmailAuditCopyMode;
  auditCopyEmail?: string;
  requestedBy?: string;
  sender?: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{ fileName: string; mimeType: string; content: Buffer }>;
  idempotencyKey?: string;
  maxAttempts?: number;
}

export interface EmailDeliveryJournal {
  findByIdempotencyKey(key: string): Promise<EmailDeliveryRecord | null>;
  save(record: EmailDeliveryRecord): Promise<void>;
}

export interface TrackedGmailPorts {
  send(input: { threadId?:string; messageId?:string; inReplyTo?:string; to: string; cc?: string[]; subject: string; text: string; html?: string; attachments?: Array<{ fileName: string; mimeType: string; content: Buffer }> }): Promise<GmailAcceptedResponse | void>;
  journal: EmailDeliveryJournal;
  auditCopyEmail?: string;
  now?: () => Date;
}

const cleanEmail = (value: string): string => value.trim().toLowerCase();
const hash = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');

export function emailDeliveryIdempotencyKey(input: TrackedEmailInput): string {
  if (input.idempotencyKey) return input.idempotencyKey;
  const attachmentHashes=(input.attachments||[]).map(item=>`${item.fileName}:${hash(item.content)}`).join(';');
  return hash([input.processId || '', input.workflowRunId || '', input.templateId || '', cleanEmail(input.recipient), input.subject, input.text, input.html || '',attachmentHashes,(input.cc||[]).map(cleanEmail).sort().join(',')].join('|'));
}

export function retryDelayMilliseconds(attemptNumber: number): number {
  const exponent = Math.max(0, Math.min(8, attemptNumber - 1));
  return Math.min(24 * 60 * 60_000, 60_000 * (2 ** exponent));
}

function classifyFailure(error: unknown): { code: string; message: string; retryable: boolean } {
  const message = error instanceof Error ? error.message : 'Falha desconhecida no Gmail.';
  const normalized = message.toLowerCase();
  const permanent = normalized.includes('invalid recipient') || normalized.includes('destinatário inválido') || normalized.includes('forbidden') || normalized.includes('permission');
  return { code: permanent ? 'PERMANENT_GMAIL_ERROR' : 'TRANSIENT_GMAIL_ERROR', message: message.slice(0, 500), retryable: !permanent };
}

export function initialEmailDelivery(input: TrackedEmailInput, now = new Date()): EmailDeliveryRecord {
  const key = emailDeliveryIdempotencyKey(input);
  const timestamp = now.toISOString();
  return {
    id: `mail_${hash(key).slice(0, 24)}`,
    rfcMessageId:`mail_${hash(key).slice(0,24)}@portal-tcc.local`,
    processId: input.processId,
    protocol: input.protocol,
    workflowRunId: input.workflowRunId,
    workflowEventCode: input.workflowEventCode,
    workflowEventVariables: input.workflowEventVariables ? { ...input.workflowEventVariables } : undefined,
    templateId: input.templateId,
    idempotencyKey: key,
    recipient: cleanEmail(input.recipient),
    cc: input.cc?.map(cleanEmail),
    auditCopyMode: input.auditCopyMode,
    auditCopyEmail: input.auditCopyEmail,
    requestedBy: input.requestedBy ? cleanEmail(input.requestedBy) : undefined,
    sender: input.sender ? cleanEmail(input.sender) : undefined,
    replyThreadId:input.replyThreadId,
    replyMessageId:input.replyMessageId,
    subject: input.subject.trim().slice(0, 998),
    renderedText: input.text,
    renderedHtml: input.html,
    status: 'RETRY',
    attempts: [],
    maxAttempts: Math.max(1, Math.min(10, input.maxAttempts || 4)),
    nextRetryAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export async function dispatchTrackedEmail(input: TrackedEmailInput, ports: TrackedGmailPorts): Promise<EmailDeliveryRecord> {
  const key = emailDeliveryIdempotencyKey(input);
  const existing = await ports.journal.findByIdempotencyKey(key);
  if (existing?.status === 'ACCEPTED_BY_GMAIL') return existing;
  const now = (ports.now || (() => new Date()))();
  const record = existing || initialEmailDelivery(input, now);
  record.requestedBy ||= input.requestedBy ? cleanEmail(input.requestedBy) : undefined;
  record.sender ||= input.sender ? cleanEmail(input.sender) : undefined;
  if (record.attempts.length >= record.maxAttempts) {
    record.status = 'FAILED';
    record.nextRetryAt = undefined;
    record.updatedAt = now.toISOString();
    await ports.journal.save(record);
    return record;
  }
  if (record.nextRetryAt && new Date(record.nextRetryAt).getTime() > now.getTime()) return record;

  // Preserve the original key: enabling audit copies must never resend accepted mail.
  // Only a real new attempt can change the recipient/body snapshot in the ledger.
  Object.assign(record, emailAuditCopy({
    recipient: record.recipient, cc: input.cc ?? record.cc, text: input.text, html: input.html,
    auditCopyMode: input.auditCopyMode || record.auditCopyMode,
    auditCopyEmail: input.auditCopyEmail || ports.auditCopyEmail || record.auditCopyEmail,
  }));
  const attemptNumber = record.attempts.length + 1;
  const startedAt = now.toISOString();
  record.renderedText = input.text;
  record.renderedHtml = input.html;
  try {
    const response = (await ports.send({ threadId:record.replyThreadId,messageId:record.rfcMessageId,inReplyTo:record.replyMessageId,to: record.recipient, cc: record.cc, subject: record.subject, text: input.text, html: input.html, attachments: input.attachments })) || {};
    const completedAt = (ports.now || (() => new Date()))().toISOString();
    const sender = response.sender ? cleanEmail(response.sender) : undefined;
    const attempt: EmailDeliveryAttempt = { number: attemptNumber, startedAt, completedAt, status: 'ACCEPTED_BY_GMAIL', gmailMessageId: response?.id, gmailThreadId: response?.threadId, sender };
    record.attempts.push(attempt);
    record.status = 'ACCEPTED_BY_GMAIL';
    record.acceptedAt = completedAt;
    if (sender) record.sender = sender;
    record.nextRetryAt = undefined;
    record.updatedAt = completedAt;
  } catch (error) {
    const completed = (ports.now || (() => new Date()))();
    const failure = classifyFailure(error);
    const canRetry = failure.retryable && attemptNumber < record.maxAttempts;
    const status: EmailDeliveryStatus = canRetry ? 'RETRY' : 'FAILED';
    record.attempts.push({ number: attemptNumber, startedAt, completedAt: completed.toISOString(), status, errorCode: failure.code, errorMessage: failure.message });
    record.status = status;
    record.nextRetryAt = canRetry ? new Date(completed.getTime() + retryDelayMilliseconds(attemptNumber)).toISOString() : undefined;
    record.updatedAt = completed.toISOString();
  }
  await ports.journal.save(record);
  return record;
}

export function dueEmailRetries(records: EmailDeliveryRecord[], now = new Date()): EmailDeliveryRecord[] {
  const timestamp = now.getTime();
  return records
    .filter((record) => record.status === 'RETRY' && record.attempts.length < record.maxAttempts && (!record.nextRetryAt || new Date(record.nextRetryAt).getTime() <= timestamp))
    .sort((a, b) => String(a.nextRetryAt || a.createdAt).localeCompare(String(b.nextRetryAt || b.createdAt)));
}

export class MemoryEmailDeliveryJournal implements EmailDeliveryJournal {
  private readonly records = new Map<string, EmailDeliveryRecord>();
  async findByIdempotencyKey(key: string): Promise<EmailDeliveryRecord | null> { return this.records.get(key) || null; }
  async save(record: EmailDeliveryRecord): Promise<void> { this.records.set(record.idempotencyKey, record); }
  values(): EmailDeliveryRecord[] { return Array.from(this.records.values()); }
}
