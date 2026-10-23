import type { SignatureJob } from '../types/signatures';

export interface CoordinatorSignatureQueueItem {
  process?: { id?: string };
  documents?: Array<{ type?: string; requiresSignature?: boolean; status?: string }>;
}

export function hasPendingDeclaration(queue: CoordinatorSignatureQueueItem[], processId: string): boolean {
  const item = queue.find(entry => entry.process?.id === processId);
  return Boolean(item?.documents?.some(document =>
    document.type === 'DECLARACAO' &&
    document.requiresSignature !== false &&
    document.status === 'AGUARDANDO_ASSINATURA'
  ));
}

export function latestDeclarationJob(
  jobs: SignatureJob[],
  processId: string,
  provider?: SignatureJob['provider']
): SignatureJob | undefined {
  return jobs
    .filter(job =>
      job.processId === processId &&
      job.documentType === 'DECLARACAO' &&
      job.status !== 'CANCELED' &&
      (!provider || job.provider === provider)
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function canSendDeclarationToAsten(
  queue: CoordinatorSignatureQueueItem[],
  jobs: SignatureJob[],
  processId: string
): boolean {
  const existingAstenJob = latestDeclarationJob(jobs, processId, 'ASTEN');
  const recoverable = existingAstenJob &&
    ['WAITING_INTEGRATION', 'QUEUED', 'PROVIDER_ERROR'].includes(existingAstenJob.status) &&
    existingAstenJob.providerCreationState !== 'UNCERTAIN' &&
    !['SENDING', 'UNCERTAIN'].includes(existingAstenJob.providerDispatchState || '');
  if (!hasPendingDeclaration(queue, processId) && !recoverable) return false;

  const govJob = latestDeclarationJob(jobs, processId, 'GOV_BR');
  if (govJob && ['READY_FOR_REVIEW', 'APPROVED', 'SIGNED', 'DRIVE_SYNC_PENDING', 'ARCHIVED'].includes(govJob.status)) return false;

  const astenJob = latestDeclarationJob(jobs, processId, 'ASTEN');
  if (!astenJob) return true;
  if (astenJob.providerCreationState === 'UNCERTAIN' ||
      ['SENDING', 'UNCERTAIN'].includes(astenJob.providerDispatchState || '')) return false;
  return ['WAITING_INTEGRATION', 'QUEUED', 'PROVIDER_ERROR'].includes(astenJob.status);
}

/** Abrir o fluxo manual não gera documentos; a elegibilidade acadêmica é validada no servidor. */
export function canReviewDeclarationWithGovbr(jobs:SignatureJob[],processId:string,dataRevision:number):boolean{
  const current=jobs.filter(job=>job.sourceDataRevision===dataRevision);
  const govbr=latestDeclarationJob(current,processId,'GOV_BR');
  if(govbr&&['ARCHIVED','SIGNED'].includes(govbr.status))return false;
  const asten=latestDeclarationJob(current,processId,'ASTEN');
  return !asten||(!asten.providerEnvelopeId&&asten.providerCreationState!=='UNCERTAIN'&&
    !['SENDING','UNCERTAIN'].includes(asten.providerDispatchState||'')&&
    !['SENDING','SENT','PARTIALLY_SIGNED','SIGNED','DRIVE_SYNC_PENDING','ARCHIVED'].includes(asten.status));
}

interface DeclarationSignatureClient {
  retrySignatureJob(jobId: string): Promise<SignatureJob>;
  signProcessDocument(processId: string, documentType: string): Promise<{ job: SignatureJob }>;
}

/** Os destinatários e a elegibilidade final sempre são resolvidos pelo servidor. */
export async function dispatchDeclarationToAsten(
  queue: CoordinatorSignatureQueueItem[],
  jobs: SignatureJob[],
  processId: string,
  client: DeclarationSignatureClient
): Promise<SignatureJob> {
  if (!canSendDeclarationToAsten(queue, jobs, processId)) {
    throw new Error('Esta declaração não está disponível para novo envio pela Asten.');
  }
  const previous = latestDeclarationJob(jobs, processId, 'ASTEN');
  const job = previous
    ? await client.retrySignatureJob(previous.id)
    : (await client.signProcessDocument(processId, 'DECLARACAO')).job;
  if (!['SENT', 'PARTIALLY_SIGNED', 'SIGNED', 'DRIVE_SYNC_PENDING', 'ARCHIVED'].includes(job.status)) {
    throw new Error(job.lastError || 'O convite ainda não foi confirmado pela Asten. Atualize a fila antes de tentar novamente.');
  }
  return job;
}

export interface DeclarationBatchResult {
  completedIds: string[];
  failures: Array<{ processId: string; message: string }>;
  unattemptedIds: string[];
}

export function remainingSelectedDeclarations(
  selectedIds: string[],
  result: DeclarationBatchResult,
  refreshed?: { queue: CoordinatorSignatureQueueItem[]; jobs: SignatureJob[] } | null
): string[] {
  return selectedIds.filter(id =>
    !result.completedIds.includes(id) &&
    (!refreshed || canSendDeclarationToAsten(refreshed.queue, refreshed.jobs, id))
  );
}

function requiresNewAuthentication(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const details = error as { status?: number; code?: string };
  return [401, 403, 428].includes(details.status || 0) || details.code === 'REAUTHENTICATION_REQUIRED';
}

/** Continua após falhas por documento; encerra o lote quando a sessão perde acesso. */
export async function dispatchDeclarationBatch(
  processIds: string[],
  send: (processId: string) => Promise<unknown>
): Promise<DeclarationBatchResult> {
  const ids = [...new Set(processIds)];
  const result: DeclarationBatchResult = { completedIds: [], failures: [], unattemptedIds: [] };
  for (const [index, processId] of ids.entries()) {
    try {
      await send(processId);
      result.completedIds.push(processId);
    } catch (error) {
      result.failures.push({ processId, message: error instanceof Error ? error.message : 'Falha no envio.' });
      if (requiresNewAuthentication(error)) {
        result.unattemptedIds = ids.slice(index + 1);
        break;
      }
    }
  }
  return result;
}

/** Bloqueio síncrono: o segundo clique é recusado antes de o React renderizar. */
export function createSignatureActionLock() {
  let inFlight = false;
  return {
    async run<T>(action: () => Promise<T>): Promise<T | undefined> {
      if (inFlight) return undefined;
      inFlight = true;
      try {
        return await action();
      } finally {
        inFlight = false;
      }
    }
  };
}
