import type {AuditLog, ProcessData} from '../src/types';
import type {EmailDeliveryRecord} from '../src/types/automation';
import {communicationCopyBlocker} from './workflow/emailCommunicationCopy';
import {hasPersonalEmailAccess} from './integrations/emailAuditCopy';
import {isReservationDecisionEmail} from '../src/utils/studioOperationalCatalog';

import {isRegistrationIdentifierField} from '../src/utils/operationalConfig';
import {auditSearchText, isEmailNotificationAudit} from '../src/utils/auditLogPresentation';
import {timestampInSaoPauloDateRange} from '../src/utils/formatters';
import {processDeletionSummary,type ProcessDeletionTask} from './workflow/processDeletion';

const PRIVATE_KEY = /base64|token|secret|password|credential|api[_-]?key|artifact|contentText|htmlBody|renderedHtml|renderedText|^otp(?:Code|Value)?$|^(?:login|access|authentication)Code$|^astenEnvelopeIds$|^manualAstenEnvelopes$/i;
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
  return Object.fromEntries(Object.entries(value).filter(([key]) => !PRIVATE_KEY.test(key) && !isRegistrationIdentifierField(key)).map(([key, item]) => [key, safeAuditValue(item, depth + 1)]));
}

function snapshot(log: AuditLog): Partial<ProcessData> {
  for (const value of [log.after, log.before]) {
    if (value && typeof value === 'object' && (value.protocolo || value.titulo)) return value;
  }
  return {};
}

export function emailDeliveryAuditMetadata(record: EmailDeliveryRecord): Record<string, unknown> {
  const dispatchState = record.dispatchState === 'SENDING' && !(record.dispatchLeaseUntil && Date.parse(record.dispatchLeaseUntil) > Date.now()) ? 'UNCERTAIN' : record.dispatchState;
  const decision = isReservationDecisionEmail(record.templateId) ? record.workflowEventVariables?.RESERVATION_DECISION : undefined;
  const decisionEvent = decision === 'CONFIRMED' ? 'LOCATION_CONFIRMED' : decision === 'UNAVAILABLE' ? 'LOCATION_UNAVAILABLE' : undefined;
  return safeAuditValue({templateId:record.templateId,studioRevision:record.studioRevision,workflowEventCode:record.workflowEventCode ?? decisionEvent,
    recipient:[record.recipient,...(record.additionalRecipients||[])].join(', '),cc:record.cc || [],subject:record.subject,status:record.status,
    createdAt:record.createdAt,updatedAt:record.updatedAt,acceptedAt:record.acceptedAt,nextRetryAt:record.nextRetryAt,
    dispatchState,dispatchStartedAt:record.dispatchStartedAt,dispatchLeaseUntil:record.dispatchLeaseUntil,
    attempts:record.attempts,maxAttempts:record.maxAttempts,requestedBy:record.requestedBy,sender:record.sender,
    provider:'Gmail',auditCopyMode:record.auditCopyMode,auditCopyEmail:record.auditCopyEmail}) as Record<string, unknown>;
}

export function emailDeliveryAuditSummary(record: EmailDeliveryRecord): Record<string, unknown> {
  return {id:record.id,processId:record.processId,protocol:record.protocol,templateId:record.templateId,
    ...emailDeliveryAuditMetadata(record),recipient:[record.recipient,...(record.additionalRecipients||[])].map(email=>email.replace(/^(.{2}).*(@.*)$/,'$1***$2')).join(', ')};
}

type AuditFeedInput = {logs: AuditLog[]; deliveries: EmailDeliveryRecord[]; processes: ProcessData[]; deletionTasks?: ProcessDeletionTask[]; copyBlocker?: (record:EmailDeliveryRecord,process?:ProcessData)=>{code:string;error:string}|undefined; retryBlocker?: (record:EmailDeliveryRecord,process?:ProcessData)=>{code:string;error:string}|undefined};

function auditFeedProjector(input:AuditFeedInput) {
  const processes = new Map(input.processes.map(p => [p.id, p]));
  const nameOf = (email: string, process?: Partial<ProcessData>): string | undefined => {
    const people = [process?.aluno1, process?.aluno2, process?.orientador, process?.coorientador, ...(process?.banca || [])];
    return people.find(person => person?.email?.trim().toLowerCase() === email.trim().toLowerCase())?.nome;
  };
  const deletions = new Map((input.deletionTasks || []).map(task => [task.id, task]));
  const activity = (log:AuditLog):AuditLog => {
    const deletion = log.action === 'EXCLUSAO_PROCESSO_TCC' ? deletions.get(log.entityId) : undefined;
    const deletionDetails = deletion ? processDeletionSummary(deletion) : undefined;
    const process = processes.get(log.processId || '') || snapshot(log);
    return safeAuditValue({...log, source: 'activity', currentProcessStage: processes.get(log.processId || '')?.etapaAtual,
      ...(deletionDetails ? {after:{...log.after,cleanupTaskId:deletionDetails.id,cleanupPending:deletionDetails.status==='PENDING',cleanupStatus:deletionDetails.status==='COMPLETED'?'Limpeza concluída':deletionDetails.externalPending>0?'Limpeza pendente nas plataformas externas':'Limpeza pendente',
        attempts:deletionDetails.attemptCount || 0,lastAttemptAt:deletionDetails.lastAttemptAt,nextRetryAt:deletionDetails.nextRetryAt,
        processingUntil:deletionDetails.processingUntil,errors:deletionDetails.errors,externalPending:deletionDetails.externalPending}} : {}),
      processProtocol: log.processProtocol || process.protocolo,
      processTitle: log.processTitle || process.titulo,
      actorName: log.actorName || nameOf(log.actorEmail || '', process)}) as AuditLog;
  };
  const email = (record:EmailDeliveryRecord):AuditLog => {
    const process = processes.get(record.processId || '');
    const requestedBy = record.requestedBy || '';
    const metadata = emailDeliveryAuditMetadata(record);
    const copyBlocker=input.copyBlocker?.(record,process)||communicationCopyBlocker(record);
    metadata.canRequestCommunicationCopy=!copyBlocker;
    metadata.communicationCopyBlockedReason=copyBlocker?.error;
    metadata.communicationCopy=record.communicationCopy;
    if(record.status!=='ACCEPTED_BY_GMAIL'){
      const blocker=input.retryBlocker?.(record,process);
      if(blocker){metadata.retryBlockedReason=blocker.error;metadata.retryBlockedCode=blocker.code;}
    }
    const statusAction = metadata.dispatchState === 'SENDING' ? 'EMAIL_ENVIO_EM_PROCESSAMENTO'
      : metadata.dispatchState === 'UNCERTAIN' ? 'EMAIL_ENVIO_NAO_CONFIRMADO'
      : record.status === 'ACCEPTED_BY_GMAIL' ? 'EMAIL_ENVIO_ACEITO_GMAIL'
      : record.status === 'FAILED' ? 'EMAIL_ENVIO_FALHOU'
        : record.attempts.length ? 'EMAIL_ENVIO_NOVA_TENTATIVA' : 'EMAIL_ENVIO_PENDENTE';
    return safeAuditValue({
      id: `email-delivery:${record.id}`, source: 'email', emailDeliveryId: record.id,
      processId: record.processId, processProtocol: record.protocol || process?.protocolo,
      processTitle: process?.titulo, currentProcessStage: process?.etapaAtual, actorEmail: requestedBy || 'Sistema', actorName: nameOf(requestedBy, process), actorRoles: [],
      action: statusAction, entityType: 'email_delivery', entityId: record.id,
      timestamp: record.updatedAt || record.createdAt,
      after: metadata,
    }) as AuditLog;
  };
  return {activity,email};
}

const compareAuditRows=(a:AuditLog,b:AuditLog)=>(Date.parse(b.timestamp)||0)-(Date.parse(a.timestamp)||0)||a.id.localeCompare(b.id);
export function buildAuditFeed(input:AuditFeedInput):AuditLog[] {
  const project=auditFeedProjector(input);
  return [...input.logs.map(project.activity),...input.deliveries.map(project.email)].sort(compareAuditRows);
}

const auditPageSize = 100;
type AuditCursor = {at: number; id: string};
const auditPosition = (log: AuditLog): AuditCursor => ({at: Date.parse(log.timestamp) || 0, id: log.id});

export function decodeAuditCursor(value: string): AuditCursor | null {
  if (!value || value.length > 600 || !/^[\w-]+$/.test(value)) return null;
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!Number.isSafeInteger(cursor?.at) || typeof cursor.id !== 'string' || !cursor.id || cursor.id.length > 260) return null;
    return {at: cursor.at, id: cursor.id};
  } catch {
    return null;
  }
}

type AuditPageQuery={before?: AuditCursor; search:string; kind:string; start:string; end:string; focusId:string};
export function pageAuditFeed(rows: AuditLog[], query:AuditPageQuery) {
  const matches = rows.filter(log => {
    const email = isEmailNotificationAudit(log);
    return (query.kind !== 'email' || email) && (query.kind !== 'activity' || !email) &&
      timestampInSaoPauloDateRange(log.timestamp, query.start, query.end) &&
      (!query.search || auditSearchText(log).includes(query.search));
  });
  const before = query.before;
  const start = before ? matches.findIndex(log => {
    const current = auditPosition(log);
    return current.at < before.at || (current.at === before.at && current.id.localeCompare(before.id) > 0);
  }) : 0;
  const items = start < 0 ? [] : matches.slice(start, start + auditPageSize);
  const last = items.at(-1);
  const nextCursor = last && start + items.length < matches.length
    ? Buffer.from(JSON.stringify(auditPosition(last))).toString('base64url')
    : null;
  return {items, nextCursor, total: matches.length, focused: query.focusId ? rows.find(row => row.id === query.focusId) ?? null : null};
}

/** Select a normal page before copying/sanitizing large historical before/after snapshots.
 * Search retains the full projection so matching and redaction remain identical.
 */
export function buildPagedAuditFeed(input:AuditFeedInput,query:AuditPageQuery) {
  if(query.search)return pageAuditFeed(buildAuditFeed(input),query);
  const project=auditFeedProjector(input);
  const loaders=new Map<AuditLog,()=>AuditLog>();
  const positions:AuditLog[]=[];
  for(const log of input.logs){
    const position={id:log.id,timestamp:log.timestamp,action:log.action,entityType:log.entityType,emailDeliveryId:log.emailDeliveryId,source:'activity'} as AuditLog;
    positions.push(position);loaders.set(position,()=>project.activity(log));
  }
  for(const record of input.deliveries){
    const position={id:`email-delivery:${record.id}`,timestamp:record.updatedAt||record.createdAt,action:'EMAIL_ENVIO_PENDENTE',entityType:'email_delivery',source:'email'} as AuditLog;
    positions.push(position);loaders.set(position,()=>project.email(record));
  }
  positions.sort(compareAuditRows);
  const page=pageAuditFeed(positions,query);
  const loaded=new Map<AuditLog,AuditLog>();
  const materialize=(position:AuditLog)=>{
    let row=loaded.get(position);
    if(!row){row=loaders.get(position)!();loaded.set(position,row);}
    return row;
  };
  return {...page,items:page.items.map(materialize),focused:page.focused?materialize(page.focused):null};
}

/** Plain text of the last attempted message; protected messages disclose metadata only. */
export function emailDeliveryPreview(record: EmailDeliveryRecord): {subject:string;text:string;sensitive:boolean} {
  const sensitive = record.auditCopyMode === 'sensitive' || hasPersonalEmailAccess(record.renderedText || '', record.renderedHtml || '');
  const subject = String(safeAuditValue(record.subject));
  if (sensitive) return {subject,text:'Esta mensagem contém um código ou link pessoal. A auditoria mostra os destinatários, horários e resultados, sem divulgar esse acesso.',sensitive:true};
  const text = record.renderedText || (record.renderedHtml || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<br\s*\/?\s*>|<\/(?:p|div|li|tr)>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
  return {subject,text:text || 'O conteúdo desta mensagem antiga não foi registrado.',sensitive:false};
}
