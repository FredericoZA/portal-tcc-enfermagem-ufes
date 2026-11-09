import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';

export { PORTAL_LIVE_UPDATE_EVENT, PORTAL_LIVE_POLL_INTERVAL_MS } from '../utils/portalLiveEvents';
import { PORTAL_LIVE_UPDATE_EVENT, PORTAL_LIVE_POLL_INTERVAL_MS, PORTAL_LIVE_IDLE_POLL_MAX_MS, type PortalLiveUpdate } from '../utils/portalLiveEvents';

/**
 * Consulta somente revisão, sem atualizar dados em massa.
 * O intervalo cresce até 60s quando nada muda, e volta ao início quando muda.
 * Não faz chamadas em aba oculta/offline; ao recuperar o foco revalida já.
 * A checagem de concorrência no backend continua obrigatória em TODA escrita.
 */
export const PortalLiveSync:React.FC = () => {
  const { isAuthenticated, userEmail } = useAuth();

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let lastRevision: string | null = null;
    let retryMs = PORTAL_LIVE_POLL_INTERVAL_MS;
    let timer: number | undefined;

    const schedule = (delay:number) => {
      if (timer !== undefined) window.clearTimeout(timer);
      if (active) timer = window.setTimeout(() => { void poll(); }, delay);
    };
    const poll = async () => {
      if (!active || inFlight) return;
      if (document.visibilityState === 'hidden' || !navigator.onLine) {
        schedule(PORTAL_LIVE_IDLE_POLL_MAX_MS);
        return;
      }
      inFlight = true;
      try {
        const revision = isAuthenticated
          ? String((await apiClient.getPortalSyncVersion()).revision)
          : (await apiClient.getPublicSyncVersion()).token;
        if (!active || !revision) return;
        if (lastRevision !== null && revision !== lastRevision) {
          window.dispatchEvent(new CustomEvent<PortalLiveUpdate>(PORTAL_LIVE_UPDATE_EVENT, {
            detail: {revision},
          }));
          retryMs = PORTAL_LIVE_POLL_INTERVAL_MS;
        } else {
          retryMs = Math.min(PORTAL_LIVE_IDLE_POLL_MAX_MS, Math.round(retryMs * 1.5));
        }
        lastRevision = revision;
      } catch {
        // Sem inventar "não há dados" em erros transitórios.
        // Uma falha não altera a revisão nem invalida o estado da tela.
        retryMs = Math.min(PORTAL_LIVE_IDLE_POLL_MAX_MS, retryMs * 2);
      } finally {
        inFlight = false;
        if (active) schedule(retryMs);
      }
    };

    const resumed = () => {
      if (document.visibilityState !== 'hidden' && navigator.onLine) schedule(0);
    };
    void poll();
    window.addEventListener('focus',resumed);
    window.addEventListener('online',resumed);
    document.addEventListener('visibilitychange',resumed);
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener('focus',resumed);
      window.removeEventListener('online',resumed);
      document.removeEventListener('visibilitychange',resumed);
    };
  }, [isAuthenticated, userEmail]);

  return null;
};
