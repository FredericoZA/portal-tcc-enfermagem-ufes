import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';

/** Evento unificado de atualização dos dados, independente da página ativa. */
export const PORTAL_LIVE_UPDATE_EVENT = 'portal:remote-data-changed';
export const PORTAL_LIVE_POLL_INTERVAL_MS = 15_000;

export type PortalLiveUpdate = { revision:number };

/**
 * Consulta somente a revisão transacional (não carrega todos os processos).
 * Desliga o polling quando a aba está oculta/offline. Ao voltar para a aba
 * revalida imediatamente e avisa os componentes que usam o estado remoto.
 */
export const PortalLiveSync:React.FC = () => {
  const { isAuthenticated, userEmail } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    let inFlight = false;
    let lastRevision: number | null = null;

    const poll = async () => {
      if (!active || inFlight || document.visibilityState === 'hidden' || !navigator.onLine) return;
      inFlight = true;
      try {
        const { revision } = await apiClient.getPortalSyncVersion();
        if (!active || !Number.isSafeInteger(revision) || revision < 0) return;
        if (lastRevision !== null && revision !== lastRevision) {
          window.dispatchEvent(new CustomEvent<PortalLiveUpdate>(PORTAL_LIVE_UPDATE_EVENT, {
            detail: {revision},
          }));
        }
        lastRevision=revision;
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
    void poll();
    const timer = window.setInterval(() => void poll(), PORTAL_LIVE_POLL_INTERVAL_MS);
    window.addEventListener('focus',resumed);
    window.addEventListener('online',resumed);
    document.addEventListener('visibilitychange',resumed);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus',resumed);
      window.removeEventListener('online',resumed);
      document.removeEventListener('visibilitychange',resumed);
    };
  }, [isAuthenticated, userEmail]);

  return null;
};
