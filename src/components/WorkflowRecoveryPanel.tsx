import {formatAuditTimestamp} from '../utils/formatters';
import {processLink} from '../utils/processLink';
import { portalConfirm } from '../services/portalDialogs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { withBlockingPortalOperation } from '../services/portalOperations';
import { PORTAL_REPOSITORY_CHANGED_EVENT } from '../utils/portalLiveEvents';
type WorkflowRecoveryProps=({processId:string;historyOnly?:false}|{processId?:never;historyOnly:true})&{onUpdated?:()=>void|Promise<void>};
export function WorkflowRecoveryPanel({processId,onUpdated,historyOnly=false}:WorkflowRecoveryProps){
  const [data,setData]=useState<any>(null),[busy,setBusy]=useState(''),[message,setMessage]=useState('');
  const actionInProgress=useRef(false);
  const load=useCallback(async(preserveResult=false)=>{
    if(!preserveResult)setBusy('load');
    try{const current=await apiClient.getWorkflowOperations(processId,historyOnly?'reminders':'recovery');if(processId&&current.processId!==processId)throw new Error('A consulta retornou outro processo. Atualize o andamento.');setData(current);}
    catch(e){setMessage(previous=>preserveResult
      ? `${previous} Não foi possível atualizar a lista. O resultado acima foi mantido; use Atualizar andamento antes de repetir a ação.`
      :e instanceof Error?e.message:'Não foi possível consultar o andamento.');}
    finally{if(!preserveResult)setBusy('');}
  },[processId,historyOnly]);
  useEffect(()=>{void load();},[load]);
  const retry=async(path:string)=>{
    if(actionInProgress.current)return;
    actionInProgress.current=true;setBusy(path);
    try{
      const warning=path.includes('/reminders/')?'Confira no Gmail se este lembrete já foi entregue. Confirmar uma nova tentativa?':path.includes('/invitations/')?'Retomar o envio da carta-convite deste TCC pelo fluxo publicado?':path.includes('/ata-signatures/')?'Retomar a solicitação de assinatura da ata pela ASTEN pelo fluxo publicado?':`Retomar usando a revisão ${data.studioRevision} publicada? As ações já concluídas serão preservadas.`;
      if(!(await portalConfirm(warning)))return;
      await withBlockingPortalOperation('Retomando o processo e atualizando o andamento…',async()=>{
        setMessage('Retomada em andamento. Aguarde a confirmação do Portal.');
        const result=await apiClient.retryWorkflowOperation(path,data.studioRevision);
        const confirmation=typeof result?.confirmationMessage==='string'?result.confirmationMessage
          :result?.status==='ARCHIVED'?'Formulário arquivado no Drive. Confira o andamento atualizado abaixo.'
          :'Retomada processada. Confira o andamento atualizado abaixo.';
        const pending=result?.workflowPending===true?' Há uma continuação do fluxo pendente.':'';
        const error=typeof result?.workflowError==='string'?` ${result.workflowError}`:'';
        setMessage(confirmation+pending+error);
        window.dispatchEvent(new CustomEvent(PORTAL_REPOSITORY_CHANGED_EVENT));
        await load(true);
        await onUpdated?.();
      });
    }catch(e){setMessage(e instanceof Error?e.message:'A retomada não foi confirmada. Atualize o andamento antes de tentar novamente.');}
    finally{actionInProgress.current=false;setBusy('');}
  };
  return <section className="portal-card space-y-4 p-5" aria-labelledby={historyOnly?'workflow-reminders-title':'workflow-recovery-title'}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 id={historyOnly?'workflow-reminders-title':'workflow-recovery-title'} className="text-lg font-bold">{historyOnly?'Prazos e histórico de lembretes':'Andamento e retomada do processo'}</h3>{!historyOnly&&<p className="mt-1">Acompanhe o que impede este TCC de avançar e preserve os documentos e envios já concluídos.</p>}</div><button type="button" className="portal-action" disabled={Boolean(busy)} onClick={()=>void load()}>{historyOnly?'Atualizar lembretes':'Atualizar andamento'}</button></div>
    {message&&<p role="status" className="rounded-lg border p-3">{message}</p>}
    {data&&<>
      {data.planningError&&<p role="alert" className="rounded-lg border border-amber-500 bg-amber-50 p-3 text-amber-950">Os prazos publicados estão incoerentes: {data.planningError} Corrija e publique novamente o Estúdio antes de executar lembretes.</p>}
{!historyOnly&&<><p>{data.queueTotal} pendência(s) de fluxo, documentos ou arquivamento. {data.deadlineOverdueTotal} prazo(s) vencido(s).{data.queueTotal>data.queue.length||data.deadlineTotal>data.deadlines.length?' A tela mostra os 500 primeiros registros; use os filtros dos TCCs para investigar o restante.':''}</p>

      <div className="grid gap-3 lg:grid-cols-2">{data.queue.map((item:any)=><article key={`${item.kind}:${item.id}`} className="portal-card space-y-3 p-4"><h4 className="font-bold">{item.protocol} · {item.title}</h4><p>{item.reason}</p>{item.completedActions.length>0&&<p className="text-sm">Já preservado: {item.completedActions.join('; ')}.</p>}{item.retryPath?<button className="portal-action" disabled={Boolean(busy)} aria-busy={busy===item.retryPath} type="button" onClick={()=>void retry(item.retryPath)}>{busy===item.retryPath?'Retomando…':item.actionLabel}</button>:<p className="text-sm">Confira o resultado no serviço de envio antes de tentar novamente.</p>}</article>)}</div>
      </>}{historyOnly&&<><details className="rounded-lg border p-4"><summary className="cursor-pointer font-semibold">Prazos e lembretes publicados</summary><div className="mt-3 overflow-x-auto"><table className="portal-data-table"><caption className="sr-only">Prazos por TCC</caption><thead><tr><th scope="col">TCC</th><th scope="col">Etapa</th><th scope="col">Data limite</th><th scope="col">Situação</th></tr></thead><tbody>{data.deadlines.length===0&&<tr><td colSpan={4}>Nenhum prazo pendente nas regras publicadas.</td></tr>}{data.deadlines.map((item:any)=><tr key={`${item.processId}:${item.rule.id}`}><th scope="row">{item.protocol}</th><td>{item.label}</td><td>{item.dueDate.split('-').reverse().join('/')}</td><td>{item.overdue?'Prazo vencido':'No prazo'}</td></tr>)}</tbody></table></div></details>
      <details className="rounded-lg border p-4"><summary className="cursor-pointer font-semibold">Histórico de lembretes (últimos 200)</summary>{data.reminders.length===0&&<p className="mt-3">Nenhum lembrete registrado.</p>}<ul className="mt-3 space-y-3">{data.reminders.map((item:any)=><li className="rounded-lg border p-3" key={item.id}><p className="break-words"><a className="underline" href={processLink(window.location.href,item.processId,'andamento')}>{item.protocol||'Abrir TCC'}</a> · {formatAuditTimestamp(item.createdAt)} · {item.recipient} · prazo {item.dueDate} · tentativa {item.ordinal}: {item.status==='SENT'?'Aceito pelo Gmail':item.status==='FAILED'?'Falha de envio':'Resultado ainda não confirmado'}</p>{item.error&&<p>{item.error}</p>}{item.status==='FAILED'&&<button type="button" className="portal-action mt-2" disabled={Boolean(busy)} onClick={()=>void retry(`/api/admin/workflow/reminders/${item.id}/retry`)}>Revisar e tentar novamente</button>}</li>)}</ul></details>
    </>}</>}
  </section>;
}
