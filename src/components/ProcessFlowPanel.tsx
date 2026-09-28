import React, { useEffect, useState } from 'react';
import type { ProcessData, SignatureJob } from '../types';
import { apiClient } from '../services/apiClient';

export function ProcessFlowPanel({
  process,
  jobs: _jobs,
  canConfirm,
  onUpdated,
}: {
  process: ProcessData;
  jobs: SignatureJob[];
  canConfirm: boolean;
  onUpdated: () => Promise<void>;
}) {
  const [local, setLocal] = useState(process.defesa.local || '');
  const [received, setReceived] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setLocal(process.defesa.local || '');
    setReceived(false);
    setFile(null);
  }, [process.id, process.defesa.local]);

  useEffect(() => {
    setMessage('');
  }, [process.id]);

  const needsLocationConfirmation = process.defesa.localStatus !== 'CONFIRMADO';
  const canShowConfirmationForm = needsLocationConfirmation && canConfirm;
  const hasLocationProof = Boolean(process.defesa.locationProof);
  const hasConfirmedLocation = !needsLocationConfirmation && Boolean(process.defesa.localConfirmedAt);

  const download = async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = await apiClient.downloadLocationProof(process.id);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.fileName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível abrir o comprovante.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (file) await apiClient.uploadLocationProof(process.id, file);
      const result = await apiClient.confirmDefenseLocation(process.id, {
        local: local.trim(),
        confirmationReceived: received,
      });
      setFile(null);
      await onUpdated();
      setMessage(
        result.workflowPending
          ? `Confirmação salva. O convite ainda está pendente: ${result.workflowError || 'a secretaria deve retomar a etapa.'}`
          : 'Confirmação registrada e convite enviado. O fluxo do processo foi atualizado.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível confirmar.');
      await onUpdated();
    } finally {
      setBusy(false);
    }
  };

  // O progresso visual pertence exclusivamente ao EtapaProgressBar. Este
  // componente só aparece quando há ação disponível, confirmação, comprovante
  // ou mensagem operacional efetivamente útil para o usuário.
  if (!canShowConfirmationForm && !hasLocationProof && !hasConfirmedLocation && !message) {
    return null;
  }

  return (
    <section
      id="process-operational-actions"
      className="portal-process-operational-actions rounded-xl border border-slate-300 p-3 sm:p-4"
      style={{ backgroundColor: 'var(--portal-surface-inner)' }}
      aria-label="Ações operacionais da defesa"
    >
      {canShowConfirmationForm && (
        <form onSubmit={confirm} className="space-y-3">
          <div>
            <h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Confirmação do local da defesa</h2>
            <p className="mt-1 text-[11px] leading-4 text-slate-600">
              Registre a resposta do departamento. A confirmação libera a geração e o envio do convite à banca.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-700">
              Local confirmado
              <input
                required
                className="portal-input mt-1"
                value={local}
                maxLength={200}
                onChange={(event) => setLocal(event.target.value)}
                list="confirmation-places"
              />
            </label>
            <datalist id="confirmation-places">
              {[...new Set([
                process.defesa.local,
                process.registrationAnswers?.LOCAL_PREFERENCIAL,
                process.registrationAnswers?.LOCAL_ALTERNATIVO,
              ].filter(Boolean).map(String))].map((place) => <option key={place}>{place}</option>)}
            </datalist>

            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-700">
              Comprovante da resposta — PDF até 1 MB
              <input
                className="portal-input mt-1"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-700">
            <input
              className="mt-0.5 h-4 w-4"
              type="checkbox"
              checked={received}
              required
              onChange={(event) => setReceived(event.target.checked)}
            />
            <span>Recebi a confirmação do departamento para este local, na data e no horário cadastrados.</span>
          </label>

          <button
            className="portal-action portal-action-primary"
            disabled={busy || !received || !local.trim()}
            type="submit"
          >
            {busy ? 'Registrando…' : 'Confirmar local e enviar convite'}
          </button>
        </form>
      )}

      {hasConfirmedLocation && (
        <div className="text-[11px] text-slate-700">
          Local confirmado: <strong>{process.defesa.local}</strong> · {new Date(process.defesa.localConfirmedAt!).toLocaleString('pt-BR')}
        </div>
      )}

      {hasLocationProof && (
        <button type="button" className="portal-action mt-3" disabled={busy} onClick={() => void download()}>
          {needsLocationConfirmation ? 'Abrir comprovante enviado' : 'Abrir comprovante da reserva'}
        </button>
      )}

      {message && <p role="status" className="mt-3 rounded-lg border border-slate-300 bg-white p-2.5 text-xs">{message}</p>}
    </section>
  );
}
