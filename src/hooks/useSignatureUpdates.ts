import { useEffect, useRef } from 'react';
import { apiClient } from '../services/apiClient';
import type { SignatureJob } from '../types';
import { createSignatureUpdateWatcher, hasPendingSignatureUpdates } from '../utils/signatureUpdates';

interface UseSignatureUpdatesOptions {
  jobs: SignatureJob[];
  onChange: () => Promise<unknown> | void;
  enabled?: boolean;
  watchWithoutJobs?: boolean;
  /** Omit for the administrator's signature list; process pages use their authorized endpoint. */
  processId?: string;
  scopeKey?: string;
  fetchJobs?: () => Promise<SignatureJob[]>;
}

export function useSignatureUpdates(options: UseSignatureUpdatesOptions): void {
  const latest = useRef(options);
  latest.current = options;
  const enabled = options.enabled !== false && (options.watchWithoutJobs || hasPendingSignatureUpdates(options.jobs));
  const processId = options.processId;
  const scopeKey = options.scopeKey;

  useEffect(() => {
    if (!enabled) return;
    const watcher = createSignatureUpdateWatcher({
      watchWithoutJobs: () => latest.current.watchWithoutJobs === true,
      getKnownJobs: () => latest.current.jobs,
      fetchJobs: () => latest.current.fetchJobs?.() ?? (processId ? apiClient.getProcessSignatureJobs(processId) : apiClient.getSignatureJobs()),
      onChange: () => latest.current.onChange(),
      isActive: () => document.visibilityState !== 'hidden',
    });
    const onVisibilityChange = () => document.visibilityState === 'hidden' ? watcher.pause() : watcher.wake();
    const onFocus = () => watcher.wake();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    watcher.start();
    return () => {
      watcher.stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, processId, scopeKey]);
}
