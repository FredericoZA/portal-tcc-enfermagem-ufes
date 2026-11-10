import {AuditDocumentSummary} from './AuditDocumentSummary';
import React, { useEffect, useRef, useState } from 'react';
import { FileCheck2, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { finishAuditAction } from '../utils/auditActionCompletion';
import { auditDeletionIsProcessing, auditDeletionTaskId, resumeDeletionFromAudit } from '../utils/processDeletionRecovery';
import { ApiRequestError, apiClient } from '../services/apiClient';
import { portalConfirm, portalPrompt } from '../services/portalDialogs';
import { PortalModalShell } from './PortalModalShell';
import { formatAuditTimestamp } from '../utils/formatters';
import { auditActionLabel, auditProcessPhases, auditActivityOutcome, auditOperationReference, auditIsReservationEmailDecision, auditActor, auditChangesTable, auditReference, emailAuditData, emailDeliveryStatusLabel, isEmailAudit, isEmailNotificationAudit, type ReadableAuditLog } from '../utils/auditLogPresentation';

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-[10px] font-semibold text-slate-600">{label}</dt><dd className="mt-1 break-words text-xs font-semibold text-slate-900">{children}</dd></div>;
}

export function EmailDeliveryRetryAction({ log, working, onRetry }: { log: ReadableAuditLog; working: boolean; onRetry: () => void }) {
  if (!log.emailDeliveryId || !log.processId || !isEmailAudit(log) || !emailAuditData(log).canRetry) return null;
  return <button type="button" onClick={onRetry} disabled={working} className="portal-action mt-3 inline-flex items-center gap-2 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5${working ? ' animate-spin' : ''}`} aria-hidden="true" />{working ? 'Conferindo nova tentativa…' : 'Tentar envio novamente'}</button>;
}

export function EmailCommunicationCopyAction({log,isMaster,working,onCopy}:{log:ReadableAuditLog;isMaster:boolean;working:boolean;onCopy:()=>void}){
  if(!isMaster||!log.emailDeliveryId||!log.processId||log.after?.canRequestCommunicationCopy!==true)return null;
  return <button type="button" disabled={working} onClick={onCopy} className="portal-action mt-3 disabled:opacity-50">{working?'Conferindo cópia…':'Autorizar nova cópia da comunicação'}</button>;
}

export function ProcessDeletionRetryAction({ log, isMaster, working, onRetry }: { log: ReadableAuditLog; isMaster: boolean; working: boolean; onRetry: () => void }) {
  if (!isMaster || !auditDeletionTaskId(log)) return null;
  const processing = auditDeletionIsProcessing(log);
  return <button type="button" onClick={onRetry} disabled={working || processing} className="portal-action mt-3 inline-flex items-center gap-2 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5${working ? ' animate-spin' : ''}`} aria-hidden="true" />{working ? 'Conferindo limpeza…' : processing ? 'Limpeza em processamento' : 'Retomar limpeza'}</button>;
}

/** Human-readable audit data only. Message HTML is never executed in the administration. */
export function AuditLogDetails({ log, onClose, onRefresh, allowActions = true }: { log: ReadableAuditLog | null; onClose: () => void; onRefresh?: () => Promise<void>; allowActions?: boolean }) {
  const { isMasterAdmin, userEmail } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const retryInProgress = useRef(false);
  const copyAttempt=useRef<{key:string;operationId:string;reason:string}|null>(null);
  const [retryMessage, setRetryMessage] = useState('');
  const [confirmedRetry, setConfirmedRetry] = useState<{key:string;record:Record<string,unknown>} | null>(null);
  const retryIdentity=`${userEmail}:${log?.id || ''}:${log?.emailDeliveryId || ''}`;
  const activeRetryIdentity=useRef(retryIdentity);activeRetryIdentity.current=retryIdentity;
  const emailId = log?.emailDeliveryId;
  useEffect(() => { setRetryMessage(''); }, [retryIdentity]);
  if (!log) return null;
  const displayedLog=confirmedRetry?.key===retryIdentity ? {...log,after:{...log.after,...confirmedRetry.record,recipient:log.after?.recipient,additionalRecipients:log.after?.additionalRecipients,cc:log.after?.cc}} : log;
  const actor = auditActor(log), reference = auditReference(log), email = isEmailAudit(log) ? emailAuditData(displayedLog) : null;
  const phases = auditProcessPhases(log);
  const changes = email ? [] : auditChangesTable(log);
  const operationReference = auditOperationReference(log), outcome = !email ? auditActivityOutcome(log) : '';
  const finishRetry = (refresh?: () => Promise<void>) => finishAuditAction({
    refresh,
    warn: warning => {if(activeRetryIdentity.current===retryIdentity)setRetryMessage(message => [message, warning].filter(Boolean).join(' '));},
    release: () => { retryInProgress.current = false; setRetrying(false); },
  });
  const retryEmail = async () => {
    if (retryInProgress.current || !emailId || !log.processId || !email?.canRetry) return;
    retryInProgress.current = true;
    setRetrying(true); setRetryMessage('');
    let requested = false;
    try {
      const previousAttempt = email.attempts.at(-1)?.at || 'sem tentativa registrada';
      const confirmed = await portalConfirm([
        `Solicitar nova tentativa para ${reference.title}?`,
        `Mensagem: ${email.subject}`,
        `Destinatário registrado: ${email.recipient}`,
        `Tentativas anteriores: ${email.attemptCount}. Última: ${previousAttempt}.`,
        'Uma nova tentativa pode gerar uma mensagem duplicada se o envio anterior tiver chegado. Confira o destinatário e a caixa Enviados antes de confirmar.',
      ].join('\n'));
      if (!confirmed) return;
      requested = true;
      const result = await apiClient.retryEmailDelivery(emailId);
      if(activeRetryIdentity.current!==retryIdentity)return;
      if(result?.id!==emailId)throw new Error('O retorno não corresponde a este envio. Atualize o registro antes de tentar novamente.');
      if(result.status==='ACCEPTED_BY_GMAIL'&&!result.dispatchState){
        setConfirmedRetry({key:retryIdentity,record:result});
      }
      setRetryMessage(emailDeliveryStatusLabel(result));
    } catch (error) {
      if(activeRetryIdentity.current!==retryIdentity)return;
      setRetryMessage(error instanceof ApiRequestError && error.status === 409 && !error.code
        ? 'A nova tentativa não foi confirmada. Confira a situação atualizada deste registro.'
        : error instanceof Error ? error.message : 'Não foi possível confirmar o resultado. Confira este registro e a caixa Enviados do Gmail antes de repetir.');
    } finally {
      await finishRetry(requested ? onRefresh : undefined);
    }
  };
  const copyEmail = async () => {
    if(retryInProgress.current||!isMasterAdmin||!emailId||log.after?.canRequestCommunicationCopy!==true)return;
    retryInProgress.current=true;setRetrying(true);setRetryMessage('');let requested=false;
    try{
      let attempt=copyAttempt.current?.key===retryIdentity?copyAttempt.current:null;
      const reason=attempt?.reason??await portalPrompt('Motivo para enviar uma nova cópia da comunicação (10 a 500 caracteres):');
      if(reason===null)return;
      if(reason.trim().length<10||reason.trim().length>500){setRetryMessage('Informe um motivo de 10 a 500 caracteres.');return;}
      const confirmed=await portalConfirm(`Confirme que conferiu a caixa Enviados do Gmail e os destinatários desta mensagem.\nSerá criada uma nova cópia da comunicação original, que pode chegar duplicada. A reserva, o convite e as assinaturas não serão refeitos.\nMensagem: ${email?.subject}\nMotivo: ${reason}`);
      if(!confirmed)return;
      attempt??={key:retryIdentity,operationId:crypto.randomUUID(),reason:reason.trim()};copyAttempt.current=attempt;
      requested=true;
      const result=await apiClient.retryEmailDelivery(emailId,{mode:'COMMUNICATION_COPY',checkedSentFolder:true,reason:attempt.reason,operationId:attempt.operationId});
      if(activeRetryIdentity.current!==retryIdentity)return;
      if(result.sourceDeliveryId!==emailId||!result.id)throw Error('A resposta não corresponde à cópia solicitada. Confira o registro antes de repetir.');
      setRetryMessage(`Nova cópia: ${emailDeliveryStatusLabel(result)}. O registro original foi preservado; nenhum ato do TCC foi repetido.`);
      if(!result.dispatchState)copyAttempt.current=null;
    }catch(error){if(activeRetryIdentity.current===retryIdentity)setRetryMessage(error instanceof Error?error.message:'Não foi possível confirmar a cópia. Confira o registro e Enviados antes de repetir.');}
    finally{await finishRetry(requested?onRefresh:undefined);}
  };
  const retryDeletion = async () => {
    if (retryInProgress.current || !isMasterAdmin || !auditDeletionTaskId(log)) return;
    retryInProgress.current = true;
    setRetrying(true); setRetryMessage('');
    try {
      setRetryMessage(await resumeDeletionFromAudit(log, {
        isMaster: isMasterAdmin, load: apiClient.getProcessDeletions,
        retry: apiClient.retryProcessDeletion, confirm: portalConfirm,
      }));
    } catch (error) {
      setRetryMessage(error instanceof Error ? error.message : 'A retomada não foi confirmada. Confira o registro atualizado antes de tentar novamente.');
    } finally {
      await finishRetry(onRefresh);
    }
  };
  return <PortalModalShell open={Boolean(log)} onClose={onClose} closeOnBackdrop={!retrying} closeOnEscape={!retrying} title="Detalhes do registro" icon={FileCheck2} maxWidthClass="max-w-4xl" bodyClassName="p-3 text-center sm:p-4" footer={<div className="flex justify-center"><button type="button" className="portal-action disabled:opacity-50" disabled={retrying} onClick={onClose}>Fechar</button></div>}>
    <section aria-label="Resumo da atividade" className="rounded-lg border border-slate-300 p-3" style={{ backgroundColor: 'var(--portal-surface-card)' }}>
      <h3 className="mb-3 text-sm font-bold text-slate-950">{auditActionLabel(displayedLog)}</h3>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <DetailField label="Data e horário">{formatAuditTimestamp(log.timestamp)}</DetailField>
        <DetailField label={auditIsReservationEmailDecision(log) ? "Link de resposta enviado a" : "Responsável"}>{actor.name}{actor.email && actor.email !== actor.name && <span className="block font-normal">{actor.email}</span>}</DetailField>
        <DetailField label="Categoria">{isEmailNotificationAudit(log) ? "E-mails e notificações" : "Atividades do Portal"}</DetailField>
        <DetailField label="Registro">{log.id}</DetailField>
        {operationReference && <DetailField label="Referência da operação">{operationReference}</DetailField>}
        {outcome && <DetailField label="Resultado registrado">{outcome}</DetailField>}
        <DetailField label="Referência">{reference.title}</DetailField>
        {phases.event && <DetailField label="Fase do evento">{phases.event}</DetailField>}
        {phases.current && <DetailField label="Fase atual do processo">{phases.current}</DetailField>}
        {reference.detail && <DetailField label="Trabalho">{reference.detail}</DetailField>}
      </dl>
      {log.after?.attribution==='MASTER_ADMIN'&&<p className="mt-3 text-xs text-slate-700">
        Decisão administrativa sobre a reserva. Pedido originalmente enviado a {String(log.after.originalRecipient||'—')}. Motivo: {String(log.after.reason||'—')}
      </p>}
      {auditIsReservationEmailDecision(log) && <p className="mt-3 text-[11px] leading-5 text-slate-600">A resposta foi registrada pelo link enviado a esse endereço. O registro identifica o destinatário do link, sem confirmar a identidade de quem o acionou.</p>}
    </section>
    <AuditDocumentSummary log={displayedLog} details/>
    {allowActions && isMasterAdmin && auditDeletionTaskId(log) && <section aria-label="Retomada da limpeza" className="mt-3 rounded-lg border border-slate-300 p-3">
      <p className="text-xs leading-5 text-slate-700">O TCC já foi excluído. Esta ação retoma somente a conferência e a limpeza dos recursos pendentes, mantendo as proteções do processo.</p>
      {retryMessage && <p role="status" className="mt-2 text-xs font-semibold">{retryMessage}</p>}
      <ProcessDeletionRetryAction log={log} isMaster={isMasterAdmin} working={retrying} onRetry={() => void retryDeletion()} />
    </section>}
    {email ? <div className="mt-3 space-y-3">
      <section aria-label="Registro do envio" className="rounded-lg border border-slate-300 p-3" style={{ backgroundColor: 'var(--portal-surface-panel)' }}>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <DetailField label="Remetente">{email.sender}</DetailField><DetailField label="Para">{email.recipient}</DetailField><DetailField label="Em cópia">{email.cc}</DetailField>
          <DetailField label="Assunto">{email.subject}</DetailField><DetailField label="Solicitado por">{email.requestedBy}</DetailField>
          {email.requestedAt && <DetailField label="Solicitado em">{email.requestedAt}</DetailField>}
          {email.templateId && <DetailField label="Modelo de e-mail">{email.templateId}</DetailField>}
          {email.studioRevision && <DetailField label="Revisão do Estúdio">{email.studioRevision}</DetailField>}
          {email.workflowEvent && <DetailField label="Evento do fluxo">{email.workflowEvent}</DetailField>}
          <DetailField label="Serviço de envio">{email.provider}</DetailField><DetailField label="Situação">{email.status}</DetailField>
          {email.acceptedAt && <DetailField label="Aceito pelo Gmail em">{email.acceptedAt}</DetailField>}
          {email.nextRetryAt && <DetailField label="Nova tentativa pendente a partir de">{email.nextRetryAt}</DetailField>}
        </dl>
        <p className="mt-3 text-xs leading-5 text-slate-700">{email.explanation}</p>
        {retryMessage && <p role="status" className="mt-3 text-xs font-semibold leading-5 text-slate-800">{retryMessage}</p>}
        {allowActions && <>
        {(!emailId || !log.processId || !email.canRetry) && <p className="mt-2 text-xs text-slate-600">
          {!emailId || !log.processId
            ? 'Este registro não está vinculado a um envio de TCC que possa ser repetido por aqui.'
            : email.retryBlockedReason || 'Nova tentativa indisponível para a situação atual deste envio.'}
        </p>}
        <EmailCommunicationCopyAction log={displayedLog} isMaster={isMasterAdmin} working={retrying} onCopy={()=>void copyEmail()}/>
        {isMasterAdmin&&log.after?.communicationCopyBlockedReason&&<p className="mt-2 text-xs text-slate-600">{String(log.after.communicationCopyBlockedReason)}</p>}
        <EmailDeliveryRetryAction log={displayedLog} working={retrying} onRetry={() => void retryEmail()} />
        </>}
      </section>
      {email.attempts.length > 0 && <section aria-label="Tentativas de envio" className="overflow-x-auto rounded-lg border border-slate-300">
        <table className="w-full min-w-[460px] border-collapse text-center text-[11px]"><thead style={{ backgroundColor: 'var(--portal-surface-card)' }}><tr><th className="px-3 py-2">Tentativa</th><th className="px-3 py-2">Data e horário</th><th className="px-3 py-2">Resultado</th></tr></thead><tbody className="divide-y divide-slate-200">{email.attempts.map((attempt, index) => <tr key={index}><td className="px-3 py-2">{attempt.number}</td><td className="px-3 py-2">{attempt.at}</td><td className="px-3 py-2">{attempt.status}{attempt.error && <p className="mt-1 max-w-[50ch] break-words text-red-800">{attempt.error}</p>}</td></tr>)}</tbody></table>
      </section>}
    </div> : changes.length > 0 ? <section aria-label="Dados registrados ou alterados" className="mt-3 overflow-x-auto rounded-lg border border-slate-300">
      <table className="w-full min-w-[480px] table-fixed border-collapse text-center text-[11px]"><thead style={{ backgroundColor: 'var(--portal-surface-card)' }}><tr><th className="w-1/3 px-3 py-2">Informação</th><th className="px-3 py-2">Antes</th><th className="px-3 py-2">Depois</th></tr></thead><tbody className="divide-y divide-slate-200">{changes.map((change, index) => <tr key={index}><th scope="row" className="break-words px-3 py-2 font-semibold">{change.field}</th><td className="whitespace-pre-wrap break-words px-3 py-2">{change.before}</td><td className="whitespace-pre-wrap break-words px-3 py-2">{change.after}</td></tr>)}</tbody></table>
    </section> : <p className="mt-3 text-xs leading-5 text-slate-700">A atividade foi registrada com a data, o responsável e a referência acima. Este evento não possui outros campos de alteração.</p>}
  </PortalModalShell>;
}
