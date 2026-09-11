import { portalNotice } from '../services/portalDialogs';
import React, { useState } from 'react';
import { ProcessDocument } from '../types';
import { X, Send, AlertTriangle } from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface CorrectionRequestModalProps {
  document: ProcessDocument | null;
  processId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const CorrectionRequestModal: React.FC<CorrectionRequestModalProps> = ({
  document,
  processId,
  onClose,
  onSuccess
}) => {
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
      await apiClient.requestCorrection(processId, document.id, {
        description: description.trim()
      });
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
    <div id="correction-request-modal-backdrop" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div id="correction-request-modal" className="portal-modal-surface portal-modal-correction bg-white shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
        
        <div className="portal-modal-header bg-slate-900 text-white p-4 border-l-4 border-emerald-600 flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Solicitar Ajuste em Documento</span>
          </div>
          <button
            id="close-correction-request-modal-btn"
            onClick={onClose}
            aria-label="Fechar solicitação de ajuste"
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              Documento Selecionado
            </label>
            <input
              type="text"
              readOnly
              value={document.title}
              className="w-full bg-slate-100 border border-slate-300 rounded-sm px-3 py-2 text-xs font-bold text-slate-800 uppercase"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              Descrição do Erro ou Incorreção <span className="text-red-500">*</span>
            </label>
            <textarea
              id="correction-description-input"
              rows={4}
              required
              placeholder="Descreva o que precisa ser ajustado (ex: digitação no nome do aluno, alteração do título, horario incorreto...)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-slate-300 rounded-sm p-3 text-xs focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none"
            />
          </div>

          {errorMsg && (
            <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-sm border border-red-200">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-sm"
            >
              Cancelar
            </button>
            <button
              id="submit-correction-request-btn"
              type="submit"
              disabled={isSubmitting}
              className="portal-modal-primary flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 rounded-sm shadow-2xs transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Enviando...' : 'Enviar Solicitação'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
