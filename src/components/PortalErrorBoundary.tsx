import React, { Component, type ReactNode } from 'react';

/** A failed page or outdated lazy chunk must leave an actionable screen. */
export class PortalErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  declare readonly props: Readonly<{ children: ReactNode }>;
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section role="alert" className="portal-card mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-bold">Não foi possível abrir esta tela</h1>
      <p>Atualize o portal para tentar novamente. Os registros já enviados continuam disponíveis no processo; campos ainda não enviados podem precisar ser preenchidos outra vez.</p>
      <button type="button" className="portal-action portal-action-primary" onClick={() => window.location.reload()}>Atualizar o portal</button>
    </section>;
  }
}
