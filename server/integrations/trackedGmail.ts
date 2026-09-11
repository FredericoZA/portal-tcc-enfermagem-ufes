import { createHash } from 'crypto';
import type { EmailDeliveryAttempt, EmailDeliveryRecord, EmailDeliveryStatus, WorkflowEventCode } from '../../src/types/automation';

export interface GmailAcceptedResponse {
  id?: string;
  threadId?: string;
}

export interface TrackedEmailInput {
  processId?: string;
  protocol?: string;
  workflowRunId?: string;
  workflowEventCode?: WorkflowEventCode;
  workflowEventVariables?: Record<string, string>;
  templateId?: string;
  recipient: string;
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
  send(input: { to: string; subject: string; text: string; html?: string; attachments?: Array<{ fileName: string; mimeType: string; content: Buffer }> }): Promise<GmailAcceptedResponse | void>;
  journal: EmailDeliveryJournal;
  now?: () => Date;
}

const cleanEmail = (value: string): string => value.trim().toLowerCase();
const hash = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');

export function emailDeliveryIdempotencyKey(input: TrackedEmailInput): string {
  if (input.idempotencyKey) return input.idempotencyKey;
  const attachmentHashes=(input.attachments||[]).map(item=>`${item.fileName}:${hash(item.content)}`).join(';');
  return hash([input.processId || '', input.workflowRunId || '', input.templateId || '', cleanEmail(input.recipient), input.subject, input.text, input.html || '',attachmentHashes].join('|'));
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
    processId: input.processId,
    protocol: input.protocol,
    workflowRunId: input.workflowRunId,
    workflowEventCode: input.workflowEventCode,
    workflowEventVariables: input.workflowEventVariables ? { ...input.workflowEventVariables } : undefined,
    templateId: input.templateId,
    idempotencyKey: key,
    recipient: cleanEmail(input.recipient),
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
  if (record.attempts.length >= record.maxAttempts) {
    record.status = 'FAILED';
    record.nextRetryAt = undefined;
    record.updatedAt = now.toISOString();
    await ports.journal.save(record);
    return record;
  }
  if (record.nextRetryAt && new Date(record.nextRetryAt).getTime() > now.getTime()) return record;

  const attemptNumber = record.attempts.length + 1;
  const startedAt = now.toISOString();
  try {
    const response = (await ports.send({ to: record.recipient, subject: record.subject, text: input.text, html: input.html, attachments: input.attachments })) || {};
    const completedAt = (ports.now || (() => new Date()))().toISOString();
    const attempt: EmailDeliveryAttempt = { number: attemptNumber, startedAt, completedAt, status: 'ACCEPTED_BY_GMAIL', gmailMessageId: response?.id, gmailThreadId: response?.threadId };
    record.attempts.push(attempt);
    record.status = 'ACCEPTED_BY_GMAIL';
    record.acceptedAt = completedAt;
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
