import type {AuditLog, ProcessData} from '../src/types';
import type {EmailDeliveryRecord} from '../src/types/automation';
import {hasPersonalEmailAccess} from './integrations/emailAuditCopy';

const PRIVATE_KEY = /base64|token|secret|password|credential|api[_-]?key|artifact|contentText|htmlBody|renderedHtml|renderedText/i;
const PERSONAL_MESSAGE = 'Conteúdo de acesso pessoal omitido da auditoria.';

/** A log is a description, never a route for obtaining login or decision credentials. */
export function safeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 14) return '[Detalhamento extenso omitido]';
  if (typeof value === 'string') {
    if (/^data:|^Bearer\s/i.test(value) || hasPersonalEmailAccess(value)) return PERSONAL_MESSAGE;
    return value.slice(0, 12_000);
  }
  if (Array.isArray(value)) return value.slice(0, 500).map(item => safeAuditValue(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !PRIVATE_KEY.test(key)).map(([key, item]) => [key, safeAuditValue(item, depth + 1)]));
}

function snapshot(log: AuditLog): Partial<ProcessData> {
  for (const value of [log.after, log.before]) {
    if (value && typeof value === 'object' && (value.protocolo || value.titulo)) return value;
  }
  return {};
}

export function emailDeliveryAuditMetadata(record: EmailDeliveryRecord): Record<string, unknown> {
  return safeAuditValue({recipient:record.recipient,cc:record.cc || [],subject:record.subject,status:record.status,
    createdAt:record.createdAt,updatedAt:record.updatedAt,acceptedAt:record.acceptedAt,nextRetryAt:record.nextRetryAt,
    attempts:record.attempts,maxAttempts:record.maxAttempts,requestedBy:record.requestedBy,sender:record.sender,
    provider:'Gmail',auditCopyMode:record.auditCopyMode,auditCopyEmail:record.auditCopyEmail}) as Record<string, unknown>;
}

export function emailDeliveryAuditSummary(record: EmailDeliveryRecord): Record<string, unknown> {
  return {id:record.id,processId:record.processId,protocol:record.protocol,templateId:record.templateId,
    ...emailDeliveryAuditMetadata(record),recipient:record.recipient.replace(/^(.{2}).*(@.*)$/,'$1***$2')};
}

export function buildAuditFeed(input: {logs: AuditLog[]; deliveries: EmailDeliveryRecord[]; processes: ProcessData[]}): AuditLog[] {
  const processes = new Map(input.processes.map(p => [p.id, p]));
  const nameOf = (email: string, process?: Partial<ProcessData>): string | undefined => {
    const people = [process?.aluno1, process?.aluno2, process?.orientador, process?.coorientador, ...(process?.banca || [])];
    return people.find(person => person?.email?.trim().toLowerCase() === email.trim().toLowerCase())?.nome;
  };
  const activities = input.logs.map(log => {
    const process = processes.get(log.processId || '') || snapshot(log);
    return {...safeAuditValue(log) as AuditLog, source: 'activity' as const,
      processProtocol: log.processProtocol || process.protocolo,
      processTitle: log.processTitle || process.titulo,
      actorName: log.actorName || nameOf(log.actorEmail || '', process)};
  });
  const emails: AuditLog[] = input.deliveries.map(record => {
    const process = processes.get(record.processId || '');
    const requestedBy = record.requestedBy || '';
    const statusAction = record.status === 'ACCEPTED_BY_GMAIL' ? 'EMAIL_ENVIO_ACEITO_GMAIL'
      : record.status === 'FAILED' ? 'EMAIL_ENVIO_FALHOU'
        : record.attempts.length ? 'EMAIL_ENVIO_NOVA_TENTATIVA' : 'EMAIL_ENVIO_PENDENTE';
    return {
      id: `email-delivery:${record.id}`, source: 'email', emailDeliveryId: record.id,
      processId: record.processId, processProtocol: record.protocol || process?.protocolo,
      processTitle: process?.titulo, actorEmail: requestedBy || 'Sistema', actorName: nameOf(requestedBy, process), actorRoles: [],
      action: statusAction, entityType: 'email_delivery', entityId: record.id,
      timestamp: record.updatedAt || record.createdAt,
      after: emailDeliveryAuditMetadata(record),
    };
  });
  return [...activities, ...emails].sort((a,b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0) || a.id.localeCompare(b.id));
}

/** Plain text of the last attempted message; protected messages disclose metadata only. */
export function emailDeliveryPreview(record: EmailDeliveryRecord): {subject:string;text:string;sensitive:boolean} {
  const sensitive = record.auditCopyMode === 'sensitive' || hasPersonalEmailAccess(record.renderedText || '', record.renderedHtml || '');
  const subject = String(safeAuditValue(record.subject));
  if (sensitive) return {subject,text:'Esta mensagem contém um código ou link pessoal. A auditoria mostra os destinatários, horários e resultados, sem divulgar esse acesso.',sensitive:true};
  const text = record.renderedText || (record.renderedHtml || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<br\s*\/?\s*>|<\/(?:p|div|li|tr)>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
  return {subject,text:text || 'O conteúdo desta mensagem antiga não foi registrado.',sensitive:false};
}
