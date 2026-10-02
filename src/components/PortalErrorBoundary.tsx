import React, { Component, type ErrorInfo, type ReactNode } from 'react';

const CHUNK_RECOVERY_KEY = 'portal_chunk_recovery_version';
const CHUNK_RECOVERY_PARAM = '__portal_reload';

const isStaleLazyChunkError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|dynamically imported module/i.test(message);
};

/**
 * A failed page must leave an actionable screen.
 * If a deployment invalidated a lazy-loaded chunk, recover once automatically
 * by fetching the current HTML/bundle instead of trapping the user on an error.
 */
export class PortalErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  declare readonly props: Readonly<{ children: ReactNode }>;
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidMount() {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    if (!url.searchParams.has(CHUNK_RECOVERY_PARAM)) return;

    try {
      window.sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
    } catch {
      // O parâmetro na URL é o guard primário quando storage estiver indisponível.
    }

    url.searchParams.delete(CHUNK_RECOVERY_PARAM);
    window.history.replaceState(window.history.state, '', url.toString());
  }

  componentDidCatch(error: unknown, _info: ErrorInfo) {
    if (!isStaleLazyChunkError(error) || typeof window === 'undefined') return;

    const appVersion = String(import.meta.env.VITE_APP_VERSION || 'unknown');
    const recoveryMarker = `${appVersion}:${window.location.pathname}`;
    const currentUrl = new URL(window.location.href);

    // Guard independente de storage: após uma tentativa automática, um novo
    // erro permanece no fallback acionável em vez de entrar em loop.
    if (currentUrl.searchParams.get(CHUNK_RECOVERY_PARAM) === appVersion) return;

    try {
      if (window.sessionStorage.getItem(CHUNK_RECOVERY_KEY) === recoveryMarker) return;
      window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, recoveryMarker);
    } catch {
      // Restrições de privacidade podem bloquear sessionStorage. A query string
      // abaixo ainda limita a recuperação automática a uma única tentativa.
    }

    currentUrl.searchParams.set(CHUNK_RECOVERY_PARAM, appVersion);
    window.location.replace(currentUrl.toString());
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section role="alert" className="portal-card mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-bold">Não foi possível abrir esta tela</h1>
      <p>Atualize o portal para tentar novamente. Os registros já enviados continuam disponíveis no processo; campos ainda não enviados podem precisar ser preenchidos outra vez.</p>
      <button type="button" className="portal-action portal-action-primary" onClick={() => window.location.reload()}>Atualizar o portal</button>
    </section>;
  }
}
