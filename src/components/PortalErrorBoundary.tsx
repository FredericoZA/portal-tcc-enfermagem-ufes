import React, { Component, type ErrorInfo, type ReactNode } from 'react';

const CHUNK_RECOVERY_KEY = 'portal_chunk_recovery_version';

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

  componentDidCatch(error: unknown, _info: ErrorInfo) {
    if (!isStaleLazyChunkError(error) || typeof window === 'undefined') return;

    const appVersion = String(import.meta.env.VITE_APP_VERSION || 'unknown');
    const recoveryMarker = `${appVersion}:${window.location.pathname}`;

    try {
      if (window.sessionStorage.getItem(CHUNK_RECOVERY_KEY) === recoveryMarker) return;
      window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, recoveryMarker);

      const url = new URL(window.location.href);
      url.searchParams.set('__portal_reload', appVersion);
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
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
