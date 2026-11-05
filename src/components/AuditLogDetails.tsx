import React, { useEffect, useState } from 'react';
import { FileCheck2, RefreshCw } from 'lucide-react';
import { ApiRequestError, apiClient } from '../services/apiClient';
import { PortalModalShell } from './PortalModalShell';
import { formatDateTimeWithWeekday } from '../utils/formatters';
import { auditActionLabel, auditIsReservationEmailDecision, auditActor, auditChangesTable, auditReference, emailAuditData, emailDeliveryStatusLabel, isEmailAudit, redactAuditText, type ReadableAuditLog } from '../utils/auditLogPresentation';

type MailPreview = { subject: string; text: string; sensitive: boolean };
function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-[10px] font-semibold text-slate-600">{label}</dt><dd className="mt-1 break-words text-xs font-semibold text-slate-900">{children}</dd></div>;
}

export function EmailDeliveryRetryAction({ log, working, onRetry }: { log: ReadableAuditLog; working: boolean; onRetry: () => void }) {
  if (!log.emailDeliveryId || !log.processId || !isEmailAudit(log) || !emailAuditData(log).canRetry) return null;
  return <button type="button" onClick={onRetry} disabled={working} className="portal-action mt-3 inline-flex items-center gap-2 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5${working ? ' animate-spin' : ''}`} aria-hidden="true" />{working ? 'Conferindo nova tentativa…' : 'Tentar envio novamente'}</button>;
}

/** Human-readable audit data only. Message HTML is never executed in the administration. */
export function AuditLogDetails({ log, onClose, onRefresh }: { log: ReadableAuditLog | null; onClose: () => void; onRefresh?: () => Promise<void> }) {
  const [preview, setPreview] = useState<{ id: string; data?: MailPreview; error?: string } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState('');
  const emailId = log?.emailDeliveryId;
  useEffect(() => { setRetryMessage(''); }, [emailId]);
  useEffect(() => {
    if (!emailId) return;
    let active = true;
    setPreview({ id: emailId });
    apiClient.getEmailDeliveryPreview(emailId).then(data => {
      if (active) setPreview({ id: emailId, data });
    }).catch(() => {
      if (active) setPreview({ id: emailId, error: 'Não foi possível consultar o conteúdo desta mensagem. Feche e abra os detalhes para tentar novamente.' });
    });
    return () => { active = false; };
  }, [emailId]);
  if (!log) return null;
  const actor = auditActor(log), reference = auditReference(log), email = isEmailAudit(log) ? emailAuditData(log) : null;
  const changes = email ? [] : auditChangesTable(log);
  const currentPreview = preview?.id === emailId ? preview : null;
  const retryEmail = async () => {
    if (retrying || !emailId || !log.processId || !email?.canRetry) return;
    setRetrying(true); setRetryMessage('');
    try {
      const result = await apiClient.retryEmailDelivery(emailId);
      setRetryMessage(emailDeliveryStatusLabel(result));
    } catch (error) {
      setRetryMessage(error instanceof ApiRequestError && error.status === 409 && !error.code
        ? 'A nova tentativa não foi confirmada. Confira a situação atualizada deste registro.'
        : error instanceof Error ? error.message : 'Não foi possível confirmar o resultado. Confira este registro e a caixa Enviados do Gmail antes de repetir.');
    } finally {
      await onRefresh?.();
      setRetrying(false);
    }
  };
  return <PortalModalShell open={Boolean(log)} onClose={onClose} closeOnBackdrop={!retrying} closeOnEscape={!retrying} title="Detalhes do registro" icon={FileCheck2} maxWidthClass="max-w-4xl" bodyClassName="p-3 sm:p-4" footer={<div className="flex justify-end"><button type="button" className="portal-action disabled:opacity-50" disabled={retrying} onClick={onClose}>Fechar</button></div>}>
    <section aria-label="Resumo da atividade" className="rounded-lg border border-slate-300 p-3" style={{ backgroundColor: 'var(--portal-surface-card)' }}>
      <h3 className="mb-3 text-sm font-bold text-slate-950">{auditActionLabel(log)}</h3>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <DetailField label="Data e horário">{formatDateTimeWithWeekday(log.timestamp)}</DetailField>
        <DetailField label={auditIsReservationEmailDecision(log) ? "Link de resposta enviado a" : "Responsável"}>{actor.name}{actor.email && actor.email !== actor.name && <span className="block font-normal">{actor.email}</span>}</DetailField>
        <DetailField label="Referência">{reference.title}</DetailField>
        {reference.detail && <DetailField label="Trabalho">{reference.detail}</DetailField>}
      </dl>
      {auditIsReservationEmailDecision(log) && <p className="mt-3 text-[11px] leading-5 text-slate-600">A resposta foi registrada pelo link enviado a esse endereço. O registro identifica o destinatário do link, sem confirmar a identidade de quem o acionou.</p>}
    </section>
    {email ? <div className="mt-3 space-y-3">
      <section aria-label="Registro do envio" className="rounded-lg border border-slate-300 p-3" style={{ backgroundColor: 'var(--portal-surface-panel)' }}>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <DetailField label="Remetente">{email.sender}</DetailField><DetailField label="Para">{email.recipient}</DetailField><DetailField label="Em cópia">{email.cc}</DetailField>
          <DetailField label="Assunto">{email.subject}</DetailField><DetailField label="Solicitado por">{email.requestedBy}</DetailField>
          <DetailField label="Serviço de envio">{email.provider}</DetailField><DetailField label="Situação">{email.status}</DetailField>
          {email.acceptedAt && <DetailField label="Aceito pelo Gmail em">{email.acceptedAt}</DetailField>}
          {email.nextRetryAt && <DetailField label="Nova tentativa pendente a partir de">{email.nextRetryAt}</DetailField>}
        </dl>
        <p className="mt-3 text-xs leading-5 text-slate-700">{email.explanation}</p>
        {retryMessage && <p role="status" className="mt-3 text-xs font-semibold leading-5 text-slate-800">{retryMessage}</p>}
        <EmailDeliveryRetryAction log={log} working={retrying} onRetry={() => void retryEmail()} />
      </section>
      {email.attempts.length > 0 && <section aria-label="Tentativas de envio" className="overflow-x-auto rounded-lg border border-slate-300">
        <table className="w-full min-w-[460px] border-collapse text-left text-[11px]"><thead style={{ backgroundColor: 'var(--portal-surface-card)' }}><tr><th className="px-3 py-2">Tentativa</th><th className="px-3 py-2">Data e horário</th><th className="px-3 py-2">Resultado</th></tr></thead><tbody className="divide-y divide-slate-200">{email.attempts.map((attempt, index) => <tr key={index}><td className="px-3 py-2">{attempt.number}</td><td className="px-3 py-2">{attempt.at}</td><td className="px-3 py-2">{attempt.status}{attempt.error && <p className="mt-1 max-w-[50ch] break-words text-red-800">{attempt.error}</p>}</td></tr>)}</tbody></table>
      </section>}
      <section aria-label="Conteúdo do e-mail" className="rounded-lg border border-slate-300 p-3" style={{ backgroundColor: 'var(--portal-surface-inner)' }}>
        <h3 className="text-xs font-bold">Mensagem</h3>
        {emailId ? currentPreview?.error ? <p role="alert" className="mt-2 text-xs text-red-800">{currentPreview.error}</p> : currentPreview?.data ? <>
          <p className="mt-2 text-xs font-semibold">{currentPreview.data.subject}</p>
          <div className="mt-3 max-w-[75ch] whitespace-pre-wrap break-words text-xs leading-5">{redactAuditText(currentPreview.data.text)}</div>
          {currentPreview.data.sensitive && <p className="mt-3 border-t border-slate-200 pt-2 text-[11px] text-slate-600">Códigos de acesso e links pessoais são omitidos nesta consulta.</p>}
        </> : <p role="status" className="mt-2 text-xs text-slate-600">Carregando a mensagem registrada…</p> : <p className="mt-2 text-xs text-slate-600">{email.sensitive ? 'Códigos de acesso e links pessoais são omitidos da auditoria. Os dados do envio disponíveis aparecem acima.' : 'O conteúdo não foi preservado neste registro histórico. Os dados do envio disponíveis aparecem acima.'}</p>}
      </section>
    </div> : changes.length > 0 ? <section aria-label="Dados registrados ou alterados" className="mt-3 overflow-x-auto rounded-lg border border-slate-300">
      <table className="w-full min-w-[480px] table-fixed border-collapse text-left text-[11px]"><thead style={{ backgroundColor: 'var(--portal-surface-card)' }}><tr><th className="w-1/3 px-3 py-2">Informação</th><th className="px-3 py-2">Antes</th><th className="px-3 py-2">Depois</th></tr></thead><tbody className="divide-y divide-slate-200">{changes.map((change, index) => <tr key={index}><th scope="row" className="break-words px-3 py-2 font-semibold">{change.field}</th><td className="whitespace-pre-wrap break-words px-3 py-2">{change.before}</td><td className="whitespace-pre-wrap break-words px-3 py-2">{change.after}</td></tr>)}</tbody></table>
    </section> : <p className="mt-3 text-xs leading-5 text-slate-700">A atividade foi registrada com a data, o responsável e a referência acima. Este evento não possui outros campos de alteração.</p>}
  </PortalModalShell>;
}
