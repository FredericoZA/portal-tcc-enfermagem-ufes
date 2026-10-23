import type { SignatureJob } from '../types';

type SignatureUpdateRecord = Pick<SignatureJob, 'id' | 'status' | 'updatedAt' | 'driveSignedFileId'> &
  Partial<Pick<SignatureJob, 'signedSha256' | 'signers'>>;

const TERMINAL_SIGNATURE_STATUSES = new Set<SignatureJob['status']>(['ARCHIVED', 'CANCELED', 'DECLINED', 'EXPIRED']);

export function hasPendingSignatureUpdates(jobs: readonly SignatureUpdateRecord[]): boolean {
  return jobs.some(job => !TERMINAL_SIGNATURE_STATUSES.has(job.status));
}

export function signatureUpdatesFingerprint(jobs: readonly SignatureUpdateRecord[]): string {
  return JSON.stringify(jobs.map(job => [
    job.id, job.status, job.updatedAt, job.driveSignedFileId || '', job.signedSha256 || '',
    (job.signers || []).map(signer => [signer.id, signer.status, signer.signedAt || '']).sort((a, b) => a[0].localeCompare(b[0])),
  ]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

interface SignatureUpdateWatcherOptions<T extends SignatureUpdateRecord> {
  getKnownJobs: () => readonly T[];
  fetchJobs: () => Promise<T[]>;
  onChange: (jobs: T[]) => Promise<unknown> | void;
  isActive: () => boolean;
  intervalMs?: number;
  schedule?: (callback: () => void, delay: number) => unknown;
  cancel?: (timer: unknown) => void;
}

/** Observes Portal state only; callbacks to Asten and Drive remain server responsibilities. */
export function createSignatureUpdateWatcher<T extends SignatureUpdateRecord>(options: SignatureUpdateWatcherOptions<T>) {
  const schedule = options.schedule || ((callback, delay) => setTimeout(callback, delay));
  const cancel = options.cancel || (timer => clearTimeout(timer as ReturnType<typeof setTimeout>));
  let timer: unknown;
  let disposed = false;
  let inFlight = false;

  const clearTimer = () => {
    if (timer !== undefined) cancel(timer);
    timer = undefined;
  };
  const canWatch = () => !disposed && options.isActive() && hasPendingSignatureUpdates(options.getKnownJobs());
  const queue = () => {
    clearTimer();
    if (canWatch()) timer = schedule(() => { timer = undefined; void poll(); }, options.intervalMs ?? 10_000);
  };
  const poll = async () => {
    if (inFlight || !canWatch()) return;
    inFlight = true;
    try {
      const jobs = await options.fetchJobs();
      if (disposed || !options.isActive()) return;
      if (signatureUpdatesFingerprint(jobs) !== signatureUpdatesFingerprint(options.getKnownJobs())) {
        await options.onChange(jobs);
      }
    } catch (error) {
      // Authentication failures stop background requests until the page/session reloads.
      if ([401, 403].includes(Number((error as { status?: number })?.status))) disposed = true;
    } finally {
      inFlight = false;
      queue();
    }
  };

  return {
    start: queue,
    wake: () => { clearTimer(); void poll(); },
    pause: clearTimer,
    stop: () => { disposed = true; clearTimer(); },
  };
}
