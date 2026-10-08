import { portalNotice } from '../services/portalDialogs';
import React, { useState } from 'react';
import { ProcessDocument } from '../types';
import { Send, AlertTriangle } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { PortalModalShell } from './PortalModalShell';

interface CorrectionRequestModalProps {
  document: ProcessDocument | null;
  processId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const CorrectionRequestModal: React.FC<CorrectionRequestModalProps> = ({ document, processId, onClose, onSuccess }) => {
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  if (!document) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg('Por favor, descreva detalhadamente a correção desejada.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await apiClient.requestCorrection(processId, document.id, { description: description.trim() });
      portalNotice('Solicitação de ajuste enviada com sucesso! O Administrador Master receberá o ticket para análise.');
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao enviar solicitação de ajuste.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PortalModalShell open={Boolean(document)} onClose={onClose} title="Solicitar ajuste em documento" subtitle={document.title} icon={AlertTriangle} maxWidthClass="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="portal-modal-card p-4">
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-600">Documento selecionado</label>
          <input type="text" readOnly value={document.title} className="portal-input font-bold" />
        </section>
        <section className="portal-modal-card p-4">
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-600">Descrição do erro ou incorreção *</label>
          <textarea id="correction-description-input" rows={5} required placeholder="Descreva o que precisa ser ajustado." value={description} onChange={(e) => setDescription(e.target.value)} className="portal-input min-h-28" />
        </section>
        {errorMsg && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">{errorMsg}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="portal-action">Cancelar</button>
          <button id="submit-correction-request-btn" type="submit" disabled={isSubmitting} className="portal-action portal-action-primary disabled:opacity-50">
            <Send className="h-3.5 w-3.5" /><span>{isSubmitting ? 'Enviando...' : 'Enviar solicitação'}</span>
          </button>
        </div>
      </form>
    </PortalModalShell>
  );
};
