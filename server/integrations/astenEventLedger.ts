import { createHash } from 'crypto';
import {deriveSignatureSigners,publicationRequested} from '../workflow/signaturePolicy';
import type { ProcessData } from '../../src/types';
import type { SignatureJobStatus } from '../../src/types/signatures';
import type {
  AstenDashboardJob,
  AstenEnvelopeTimeline,
  AstenEventStatus,
  AstenOperationalDashboard,
  AstenWebhookEvent,
  CanonicalSignaturePlan
} from '../../src/types/automation';

const SENSITIVE_KEYS = /token|secret|senha|password|linkassinatura|link_assinatura|conteudo|base64|api.?key/i;

function sanitizePayload(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizePayload(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !SENSITIVE_KEYS.test(key)).map(([key, child]) => [key, sanitizePayload(child, depth + 1)]));
  }
  if (typeof value === 'string') return value.slice(0, 1000);
  return value;
}

function visit(value: unknown, keys: RegExp): string | undefined {
  if (Array.isArray(value)) {
    for (const child of value) { const found = visit(child, keys); if (found) return found; }
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (keys.test(key) && (typeof child === 'string' || typeof child === 'number')) return String(child);
      const found = visit(child, keys); if (found) return found;
    }
  }
  return undefined;
}

export function extractAstenEnvelopeId(payload: unknown): string | undefined {
  const outer=payload as any;
  const id=outer?.envelope?.id??outer?.Envelope?.id??outer?.idEnvelope??outer?.envelopeId;
  return id===undefined||id===null?visit(payload,/^(idEnvelope|envelopeId|id_envelope)$/i):String(id);
}

export function inferAstenEventStatus(payload: unknown): AstenEventStatus {
  const numeric = Number(visit(payload, /^(status|statusEnvelope|status_envelope)$/i));
  if (numeric === 2) return 'SENT';
  if (numeric === 3) return 'SIGNED';
  if (numeric === 5) return 'CANCELED';
  if (numeric === 6) return 'EXPIRED';
  const operation = String(visit(payload, /^(operacao|evento|event|descricao|statusDescricao)$/i) || '').toLowerCase();
  if (/recus|declin/.test(operation)) return 'DECLINED';
  if (/cancel/.test(operation)) return 'CANCELED';
  if (/expir/.test(operation)) return 'EXPIRED';
  if (/erro|falha/.test(operation)) return 'ERROR';
  if (/parcial|assinatura.*realizada|signatario.*assin/.test(operation)) return 'PARTIALLY_SIGNED';
  if (/conclu|finaliz|assinado/.test(operation)) return 'SIGNED';
  if (/encaminh|enviad/.test(operation)) return 'SENT';
  if (/cri|inseri/.test(operation)) return 'CREATED';
  return 'UNMATCHED';
}

export function astenWebhookFingerprint(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(sanitizePayload(payload))).digest('hex');
}

export function normalizeAstenWebhookEvent(input: {
  payload: unknown;
  receivedAt?: string;
  knownFingerprints?: ReadonlySet<string>;
  jobs?: AstenDashboardJob[];
}): AstenWebhookEvent {
  const fingerprint = astenWebhookFingerprint(input.payload);
  const envelopeId = extractAstenEnvelopeId(input.payload);
  const safePayload = Object.fromEntries(Object.entries({
    envelopeId,
    event: visit(input.payload, /^(operacao|evento|event|descricao)$/i),
    status: visit(input.payload, /^(status|statusEnvelope|status_envelope|statusDescricao)$/i),
    occurredAt: visit(input.payload, /^(data|dataEvento|eventAt|occurredAt|timestamp)$/i),
    processReference: visit(input.payload, /^(referencia|reference|codigoProcesso|processCode)$/i)
  }).filter(([, value]) => value !== undefined)) as Record<string, unknown>;
  const matchedJob = envelopeId ? input.jobs?.find((job) => job.providerEnvelopeId === envelopeId) : undefined;
  const receivedAt = input.receivedAt || new Date().toISOString();
  return {
    id: `asten_event_${fingerprint.slice(0, 24)}`,
    fingerprint,
    envelopeId,
    status: inferAstenEventStatus(input.payload),
    receivedAt,
    duplicate: Boolean(input.knownFingerprints?.has(fingerprint)),
    matchedJobId: matchedJob?.id,
    safePayload
  };
}

/** Worker: não reprocessar ACKs já concluídos ou reivindicados por outra instância. */
export function isReconcileableAstenWebhookEvent(event:AstenWebhookEvent,now=Date.now()):boolean{
  if(event.duplicate||!event.matchedJobId||event.processedAt||event.safePayload?.processedAt)return false;
  if(event.retryAfter&&Date.parse(event.retryAfter)>now)return false;
  if(event.processingLeaseUntil&&Date.parse(event.processingLeaseUntil)>now)return false;
  return true;
}

const EVENT_RANK: Record<AstenEventStatus, number> = { UNMATCHED: 0, CREATED: 1, SENT: 2, PARTIALLY_SIGNED: 3, SIGNED: 4, DECLINED: 4, CANCELED: 4, EXPIRED: 4, ERROR: 4 };
const TERMINAL = new Set<AstenEventStatus>(['SIGNED', 'DECLINED', 'CANCELED', 'EXPIRED']);

export function reduceAstenTimeline(events: AstenWebhookEvent[]): AstenEnvelopeTimeline[] {
  const timelines = new Map<string, AstenEnvelopeTimeline>();
  for (const event of events.filter((item) => !item.duplicate && item.envelopeId).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))) {
    const envelopeId = event.envelopeId!;
    const current = timelines.get(envelopeId);
    if (!current) {
      timelines.set(envelopeId, { envelopeId, jobId: event.matchedJobId, status: event.status, firstSeenAt: event.receivedAt, lastSeenAt: event.receivedAt, eventIds: [event.id] });
      continue;
    }
    current.eventIds.push(event.id);
    current.lastSeenAt = event.receivedAt;
    current.jobId ||= event.matchedJobId;
    if (!TERMINAL.has(current.status) && EVENT_RANK[event.status] >= EVENT_RANK[current.status]) current.status = event.status;
  }
  return Array.from(timelines.values()).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export function mapAstenEventToJobStatus(event: AstenEventStatus, current: SignatureJobStatus): SignatureJobStatus {
  if (current === 'ARCHIVED') return current;
  if (current === 'DRIVE_SYNC_PENDING' && event !== 'SIGNED') return current;
  if (event === 'SIGNED') return 'SIGNED';
  if (event === 'DECLINED') return 'DECLINED';
  if (event === 'CANCELED') return 'CANCELED';
  if (event === 'EXPIRED') return 'EXPIRED';
  if (event === 'PARTIALLY_SIGNED') return 'PARTIALLY_SIGNED';
  if (event === 'SENT') return 'SENT';
  if (event === 'ERROR') return 'PROVIDER_ERROR';
  return current;
}

export function publicationAuthorizationRequired(process: ProcessData): boolean {
  return publicationRequested(process);
}

export function buildCanonicalSignaturePlan(
  process: ProcessData,
  documentType: 'ATA' | 'TERMO' | 'DECLARACAO',
  president: { name: string; email: string }
): CanonicalSignaturePlan {
  if (documentType==='TERMO'&&!publicationAuthorizationRequired(process)) return { documentType, required: false, reason: 'O aluno não solicitou publicação do trabalho nem do resumo expandido.', signers: [] };
  const signers:CanonicalSignaturePlan['signers']=deriveSignatureSigners(process,documentType,{commissionPresidentName:president.name,commissionPresidentEmail:president.email}).map(signer=>({role:signer.role,name:signer.name,email:signer.email,order:1 as const}));
  return { documentType, required: true, signers };
}

export function buildAstenOperationalDashboard(input: { jobs: AstenDashboardJob[]; events: AstenWebhookEvent[]; now?: string }): AstenOperationalDashboard {
  const jobsByStatus: AstenOperationalDashboard['jobsByStatus'] = {};
  for (const job of input.jobs) jobsByStatus[job.status] = (jobsByStatus[job.status] || 0) + 1;
  const attentionStatuses = new Set<SignatureJobStatus>(['WAITING_INTEGRATION', 'PROVIDER_ERROR', 'DRIVE_SYNC_PENDING', 'DECLINED', 'EXPIRED']);
  return {
    generatedAt: input.now || new Date().toISOString(),
    totalJobs: input.jobs.length,
    jobsByStatus,
    envelopes: reduceAstenTimeline(input.events),
    unmatchedEvents: input.events.filter((event) => !event.duplicate && !event.matchedJobId),
    duplicateEvents: input.events.filter((event) => event.duplicate).length,
    needsAttention: input.jobs.filter((job) => attentionStatuses.has(job.status)).map((job) => ({ jobId: job.id, processId: job.processId, protocol: job.protocol, documentType: job.documentType, status: job.status, reason: job.lastError || (job.status === 'DRIVE_SYNC_PENDING' ? 'PDF assinado aguarda arquivamento no Drive.' : 'Ação administrativa necessária.') })),
    recentEvents: input.events.slice().sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).slice(0, 100)
  };
}
