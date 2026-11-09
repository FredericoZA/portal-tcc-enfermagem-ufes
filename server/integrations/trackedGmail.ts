import { createHash } from 'crypto';
import type { EmailDeliveryAttempt, EmailDeliveryRecord, EmailDeliveryStatus, WorkflowEventCode } from '../../src/types/automation';
import { emailAuditCopy, type EmailAuditCopyMode } from './emailAuditCopy';
import { GmailDeliveryError } from './gmailDeliveryError';

export interface GmailAcceptedResponse {
  id?: string;
  threadId?: string;
  sender?: string;
}

export interface TrackedEmailInput {
  communicationCopy?: EmailDeliveryRecord['communicationCopy'];
  sourceDataRevision?: number;
  replyThreadId?:string;
  replyMessageId?:string;
  processId?: string;
  protocol?: string;
  workflowRunId?: string;
  studioRevision?: number;
  workflowEventCode?: WorkflowEventCode;
  workflowEventVariables?: Record<string, string>;
  templateId?: string;
  recipient: string;
  additionalRecipients?: string[];
  cc?: string[];
  workflowCc?: string[];
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
  send(input: { threadId?:string; messageId?:string; inReplyTo?:string; to: string; additionalRecipients?: string[]; cc?: string[]; subject: string; text: string; html?: string; attachments?: Array<{ fileName: string; mimeType: string; content: Buffer }> }): Promise<GmailAcceptedResponse | void>;
  journal: EmailDeliveryJournal;
  auditCopyEmail?: string;
  now?: () => Date;
}

const cleanEmail = (value: string): string => value.trim().toLowerCase();
const hash = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const normalizedCopies = (copies: readonly string[]): string[] => [...new Set(copies.map(cleanEmail))];

export function workflowEmailCopies(record: Pick<EmailDeliveryRecord,'cc'|'workflowCc'|'auditCopyEmail'>,knownWorkflowRecipients?:readonly string[]):string[] {
  if(record.workflowCc!==undefined)return normalizedCopies(record.workflowCc);
  const previousAudit=record.auditCopyEmail?cleanEmail(record.auditCopyEmail):undefined;
  const known=new Set(normalizedCopies(knownWorkflowRecipients||[]));
  return normalizedCopies(record.cc||[]).filter(email=>email!==previousAudit||known.has(email));
}

function originalWorkflowCopies(input:TrackedEmailInput,record:EmailDeliveryRecord):string[]{
  if(input.workflowCc!==undefined)return normalizedCopies(input.workflowCc);
  if(input.cc===undefined)return workflowEmailCopies(record);
  const copies=normalizedCopies(input.cc),snapshot=normalizedCopies(record.cc||[]);
  if(copies.length===snapshot.length&&copies.every(email=>snapshot.includes(email)))return workflowEmailCopies(record);
  return copies;
}

function currentAuditCopyEmail(input:TrackedEmailInput,ports:TrackedGmailPorts,record:EmailDeliveryRecord):string|undefined{
  if(Object.hasOwn(ports,'auditCopyEmail'))return ports.auditCopyEmail;
  if(Object.hasOwn(input,'auditCopyEmail'))return input.auditCopyEmail;
  return record.auditCopyEmail;
}

export function emailDeliveryIdempotencyKey(input: TrackedEmailInput): string {
  if (input.idempotencyKey) return input.idempotencyKey;
  const attachmentHashes=(input.attachments||[]).map(item=>`${item.fileName}:${hash(item.content)}`).join(';');
  return hash([input.processId || '', input.workflowRunId || '', input.templateId || '', cleanEmail(input.recipient), input.subject, input.text, input.html || '',attachmentHashes,(input.cc||[]).map(cleanEmail).sort().join(','),...(input.additionalRecipients?.length?[normalizedCopies(input.additionalRecipients).sort().join(',')]:[])].join('|'));
}

export function retryDelayMilliseconds(attemptNumber: number): number {
  const exponent = Math.max(0, Math.min(8, attemptNumber - 1));
  return Math.min(24 * 60 * 60_000, 60_000 * (2 ** exponent));
}

function classifyFailure(error: unknown): { code: string; message: string; retryable: boolean; uncertain: boolean } {
  const message = error instanceof Error ? error.message : 'Falha desconhecida no Gmail.';
  if (!(error instanceof GmailDeliveryError) || error.deliveryOutcome === 'UNCERTAIN') {
    return {code:'GMAIL_DELIVERY_UNCERTAIN',message:message.slice(0,500),retryable:false,uncertain:true};
  }
  const normalized = message.toLowerCase();
  const rejectedPermanently = error.deliveryOutcome === 'REJECTED' && error.providerStatus !== undefined && error.providerStatus < 500 && ![408,409,425,429].includes(error.providerStatus);
  const permanent = rejectedPermanently || normalized.includes('invalid recipient') || normalized.includes('destinatário inválido') || normalized.includes('forbidden') || normalized.includes('permission');
  return { code: permanent ? 'PERMANENT_GMAIL_ERROR' : 'TRANSIENT_GMAIL_ERROR', message: message.slice(0, 500), retryable: !permanent,uncertain:false };
}

export function initialEmailDelivery(input: TrackedEmailInput, now = new Date()): EmailDeliveryRecord {
  const key = emailDeliveryIdempotencyKey(input);
  const timestamp = now.toISOString();
  return {
    communicationCopy: input.communicationCopy ? {...input.communicationCopy} : undefined,
    attachmentManifest:(input.attachments||[]).map(item=>({fileName:item.fileName,mimeType:item.mimeType,sha256:hash(item.content),byteLength:item.content.length})),
    sourceDataRevision: input.sourceDataRevision,
    id: `mail_${hash(key).slice(0, 24)}`,
    rfcMessageId:`mail_${hash(key).slice(0,24)}@portal-tcc.local`,
    processId: input.processId,
    protocol: input.protocol,
    workflowRunId: input.workflowRunId,
    studioRevision: input.studioRevision,
    workflowEventCode: input.workflowEventCode,
    workflowEventVariables: input.workflowEventVariables ? { ...input.workflowEventVariables } : undefined,
    templateId: input.templateId,
    idempotencyKey: key,
    recipient: cleanEmail(input.recipient),
    additionalRecipients: input.additionalRecipients && normalizedCopies(input.additionalRecipients),
    cc: input.cc?.map(cleanEmail),
    workflowCc: normalizedCopies(input.workflowCc??input.cc??[]),
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

const inFlightDeliveries = new WeakMap<EmailDeliveryJournal, Map<string, Promise<EmailDeliveryRecord>>>();

export async function dispatchTrackedEmail(input: TrackedEmailInput, ports: TrackedGmailPorts): Promise<EmailDeliveryRecord> {
  const key = emailDeliveryIdempotencyKey(input);
  let active = inFlightDeliveries.get(ports.journal);
  if (!active) { active = new Map(); inFlightDeliveries.set(ports.journal, active); }
  const previous = active.get(key);
  if (previous) return previous;
  const pending = dispatchClaimedEmail(input, ports, key);
  active.set(key, pending);
  try { return await pending; } finally { active.delete(key); }
}

async function dispatchClaimedEmail(input: TrackedEmailInput, ports: TrackedGmailPorts, key: string): Promise<EmailDeliveryRecord> {
  const existing = await ports.journal.findByIdempotencyKey(key);
  if (existing?.status === 'ACCEPTED_BY_GMAIL') return existing;
  const now = (ports.now || (() => new Date()))();
  const record = existing ? structuredClone(existing) : initialEmailDelivery(input, now);
  if (record.dispatchState === 'SENDING' || record.dispatchState === 'UNCERTAIN') {
    const leased = record.dispatchState === 'SENDING' && record.dispatchLeaseUntil && Date.parse(record.dispatchLeaseUntil) > now.getTime();
    if (leased) return record;
    if (record.dispatchState === 'SENDING') {
      record.dispatchState = 'UNCERTAIN';
      record.status = 'FAILED';
      record.nextRetryAt = undefined;
      record.dispatchLeaseUntil = undefined;
      record.updatedAt = now.toISOString();
      record.attempts.push({number:record.attempts.length+1,startedAt:record.dispatchStartedAt || record.updatedAt,completedAt:record.updatedAt,status:'FAILED',errorCode:'GMAIL_DELIVERY_UNCERTAIN',errorMessage:'A tentativa foi iniciada, mas o retorno do Gmail não foi confirmado. Confira os envios antes de autorizar nova tentativa.'});
      await ports.journal.save(record);
    }
    return record;
  }
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
  const workflowCc=originalWorkflowCopies(input,record);
  Object.assign(record, {workflowCc}, emailAuditCopy({
    recipient: record.recipient, cc: workflowCc, text: input.text, html: input.html,
    auditCopyMode: input.auditCopyMode || record.auditCopyMode,
    auditCopyEmail: currentAuditCopyEmail(input,ports,record),
  }));
  if (input.additionalRecipients) record.additionalRecipients = normalizedCopies(input.additionalRecipients)
    .filter(email => email !== record.recipient);
  const additionalRecipients = record.additionalRecipients;
  if (additionalRecipients?.length) record.cc = record.cc?.filter(email => !additionalRecipients.includes(email));
  // A pending legacy reply can be threaded before its next safe dispatch.
  if (input.replyThreadId && input.replyMessageId) {
    record.replyThreadId = input.replyThreadId;
    record.replyMessageId = input.replyMessageId;
    record.subject = input.subject.trim().slice(0, 998);
  }
  const attemptNumber = record.attempts.length + 1;
  const startedAt = now.toISOString();
  record.attachmentManifest=(input.attachments||[]).map(item=>({fileName:item.fileName,mimeType:item.mimeType,sha256:hash(item.content),byteLength:item.content.length}));
  record.renderedText = input.text;
  record.renderedHtml = input.html;
  record.studioRevision = input.studioRevision ?? record.studioRevision;
  record.status = 'RETRY';
  record.dispatchState = 'SENDING';
  record.dispatchStartedAt = startedAt;
  record.dispatchLeaseUntil = new Date(now.getTime()+120_000).toISOString();
  record.nextRetryAt = undefined;
  await ports.journal.save(record);
  try {
    const response = (await ports.send({ threadId:record.replyThreadId,messageId:record.rfcMessageId,inReplyTo:record.replyMessageId,to: record.recipient, ...(record.additionalRecipients?.length?{additionalRecipients:record.additionalRecipients}:{}), cc: record.cc, subject: record.subject, text: input.text, html: input.html, attachments: input.attachments })) || {};
    const completedAt = (ports.now || (() => new Date()))().toISOString();
    const sender = response.sender ? cleanEmail(response.sender) : undefined;
    const attempt: EmailDeliveryAttempt = { number: attemptNumber, startedAt, completedAt, status: 'ACCEPTED_BY_GMAIL', gmailMessageId: response?.id, gmailThreadId: response?.threadId, sender };
    record.attempts.push(attempt);
    record.status = 'ACCEPTED_BY_GMAIL';
    record.acceptedAt = completedAt;
    if (sender) record.sender = sender;
    record.nextRetryAt = undefined;
    record.updatedAt = completedAt;
    record.dispatchState = undefined;
    record.dispatchStartedAt = undefined;
    record.dispatchLeaseUntil = undefined;
  } catch (error) {
    const completed = (ports.now || (() => new Date()))();
    const failure = classifyFailure(error);
    const canRetry = failure.retryable && attemptNumber < record.maxAttempts;
    const status: EmailDeliveryStatus = canRetry ? 'RETRY' : 'FAILED';
    record.attempts.push({ number: attemptNumber, startedAt, completedAt: completed.toISOString(), status, errorCode: failure.code, errorMessage: failure.message });
    record.status = status;
    record.dispatchState = failure.uncertain ? 'UNCERTAIN' : undefined;
    record.dispatchLeaseUntil = undefined;
    if (!failure.uncertain) record.dispatchStartedAt = undefined;
    record.nextRetryAt = canRetry ? new Date(completed.getTime() + retryDelayMilliseconds(attemptNumber)).toISOString() : undefined;
    record.updatedAt = completed.toISOString();
  }
  await ports.journal.save(record);
  return record;
}

export function dueEmailRetries(records: EmailDeliveryRecord[], now = new Date()): EmailDeliveryRecord[] {
  const timestamp = now.getTime();
  return records
    .filter((record) => record.status === 'RETRY' && !record.dispatchState && record.attempts.length < record.maxAttempts && (!record.nextRetryAt || new Date(record.nextRetryAt).getTime() <= timestamp))
    .sort((a, b) => String(a.nextRetryAt || a.createdAt).localeCompare(String(b.nextRetryAt || b.createdAt)));
}

export class MemoryEmailDeliveryJournal implements EmailDeliveryJournal {
  private readonly records = new Map<string, EmailDeliveryRecord>();
  async findByIdempotencyKey(key: string): Promise<EmailDeliveryRecord | null> { return this.records.get(key) || null; }
  async save(record: EmailDeliveryRecord): Promise<void> { this.records.set(record.idempotencyKey, record); }
  values(): EmailDeliveryRecord[] { return Array.from(this.records.values()); }
}
