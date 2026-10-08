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

function astenHasExternalCommitment(job?: SignatureJob): boolean {
  if (!job) return false;
  return Boolean(
    job.providerCreationState === 'UNCERTAIN' ||
    job.providerEnvelopeId ||
    ['SENDING', 'SENT', 'PARTIALLY_SIGNED', 'SIGNED', 'DRIVE_SYNC_PENDING', 'ARCHIVED'].includes(job.status)
  );
}

export function canSendDeclarationToAsten(
  queue: CoordinatorSignatureQueueItem[],
  jobs: SignatureJob[],
  processId: string
): boolean {
  if (!hasPendingDeclaration(queue, processId)) return false;

  const govJob = latestDeclarationJob(jobs, processId, 'GOV_BR');
  if (govJob && ['READY_FOR_REVIEW', 'APPROVED', 'SIGNED', 'DRIVE_SYNC_PENDING', 'ARCHIVED'].includes(govJob.status)) return false;

  const astenJob = latestDeclarationJob(jobs, processId, 'ASTEN');
  if (!astenJob) return true;
  if (astenJob.providerCreationState === 'UNCERTAIN') return false;
  return ['WAITING_INTEGRATION', 'QUEUED', 'PROVIDER_ERROR'].includes(astenJob.status);
}

export function canPrepareDeclarationForGovBr(
  queue: CoordinatorSignatureQueueItem[],
  jobs: SignatureJob[],
  processId: string
): boolean {
  if (!hasPendingDeclaration(queue, processId)) return false;

  const astenJob = latestDeclarationJob(jobs, processId, 'ASTEN');
  if (astenHasExternalCommitment(astenJob)) return false;

  const govJob = latestDeclarationJob(jobs, processId, 'GOV_BR');
  if (!govJob) return true;
  return ['READY_FOR_REVIEW', 'APPROVED'].includes(govJob.status);
}
