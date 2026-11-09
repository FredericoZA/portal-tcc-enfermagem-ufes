import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';

export { PORTAL_LIVE_UPDATE_EVENT, PORTAL_LIVE_POLL_INTERVAL_MS } from '../utils/portalLiveEvents';
import { PORTAL_LIVE_UPDATE_EVENT, PORTAL_LIVE_POLL_INTERVAL_MS, PORTAL_PUBLIC_POLL_INTERVAL_MS, type PortalLiveUpdate } from '../utils/portalLiveEvents';

/**
 * Consulta somente a revisão transacional (não carrega todos os processos).
 * Desliga o polling quando a aba está oculta/offline. Ao voltar para a aba
 * revalida imediatamente e avisa os componentes que usam o estado remoto.
 */
export const PortalLiveSync:React.FC<{viewingPublicData: boolean}> = ({viewingPublicData}) => {
  const { isAuthenticated, userEmail } = useAuth();
  const lastRevision = useRef<string | null>(null);
  const pollingEnabled = isAuthenticated || viewingPublicData;

  useEffect(() => {
    if (!pollingEnabled) return;
    let active = true;
    let inFlight = false;
    let lastAttemptAt = 0;
    let timer: number;
    const interval = isAuthenticated ? PORTAL_LIVE_POLL_INTERVAL_MS : PORTAL_PUBLIC_POLL_INTERVAL_MS;

    const poll = async () => {
      if (!active || inFlight || document.visibilityState === 'hidden' || !navigator.onLine) return;
      const now = Date.now();
      if (now - lastAttemptAt < 5_000) return;
      lastAttemptAt = now;
      inFlight = true;
      try {
        // A revisão opaca é a mesma para todos os perfis. Os dados privados
        // continuam sendo consultados apenas pelas rotas autenticadas.
        const revision = (await apiClient.getPublicSyncVersion()).token;
        if (!active || !revision) return;
        if (lastRevision.current !== null && revision !== lastRevision.current) {
          window.dispatchEvent(new CustomEvent<PortalLiveUpdate>(PORTAL_LIVE_UPDATE_EVENT, {
            detail: {revision},
          }));
        }
        lastRevision.current = revision;
      } catch {
        // Uma falha de conexão não equivale a exclusão de TCC.
        // Mantém a última revisão até a próxima consulta bem-sucedida.
      } finally {
        inFlight = false;
      }
    };

    const resumed = () => {
      if (document.visibilityState !== 'hidden') void poll();
    };
    const schedule = () => {
      timer = window.setTimeout(() => {
        void poll();
        schedule();
      }, interval + Math.random() * 5_000);
    };
    void poll();
    schedule();
    window.addEventListener('focus',resumed);
    window.addEventListener('online',resumed);
    document.addEventListener('visibilitychange',resumed);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener('focus',resumed);
      window.removeEventListener('online',resumed);
      document.removeEventListener('visibilitychange',resumed);
    };
  }, [isAuthenticated, userEmail, pollingEnabled]);

  return null;
};
