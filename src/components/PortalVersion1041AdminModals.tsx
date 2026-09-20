import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AuditLogsPage } from '../pages/AuditLogsPage';
import { AstenLogsPage } from '../pages/AstenLogsPage';

type RecordModal = 'signatures' | 'logs' | null;

export default function PortalVersion1041AdminModals() {
  const [open, setOpen] = useState<RecordModal>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string }>).detail?.type;
      if (detail === 'signatures' || detail === 'logs') setOpen(detail);
    };
    window.addEventListener('portal:open-config-records', handler as EventListener);
    return () => window.removeEventListener('portal:open-config-records', handler as EventListener);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const isSignature = open === 'signatures';
  return (
    <div className="portal1041-admin-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setOpen(null);
    }}>
      <section
        className="portal1041-admin-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isSignature ? 'Registros de Assinatura' : 'Registro de Logs'}
      >
        <header className="portal1041-admin-modal-header">
          <div className="portal1041-admin-modal-title">
            <span aria-hidden="true">{isSignature ? '✍️' : '🧾'}</span>
            <strong>{isSignature ? 'REGISTROS DE ASSINATURA' : 'REGISTRO DE LOGS'}</strong>
          </div>
          <button type="button" onClick={() => setOpen(null)} aria-label="Fechar" title="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="portal1041-admin-modal-body">
          {isSignature ? <AstenLogsPage /> : <AuditLogsPage />}
        </div>
      </section>
    </div>
  );
}
