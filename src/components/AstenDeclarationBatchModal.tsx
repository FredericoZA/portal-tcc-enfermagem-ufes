import {formatDateTimeWithWeekday} from '../utils/formatters';
import {ASTEN_SIGNATURE_GUIDANCE} from '../utils/signatureGuidance';
import React,{useEffect,useState} from 'react';
import {Shield} from 'lucide-react';
import {PortalModalShell} from './PortalModalShell';
import {apiClient} from '../services/apiClient';
import type {AstenDeclarationCheck} from '../types/signatures';

interface Props {processIds:string[];onClose:()=>void;onSend:(ids:string[])=>void;onRefresh?:()=>void;}
export const AstenDeclarationBatchModal:React.FC<Props>=({processIds,onClose,onSend,onRefresh})=>{
  const [items,setItems]=useState<AstenDeclarationCheck[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [refreshing,setRefreshing]=useState('');
  const refresh=async(jobId:string)=>{setRefreshing(jobId);setError('');try{await apiClient.reconcileSignatureJob(jobId);setItems(await apiClient.inspectAstenDeclarations(processIds));onRefresh?.();}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível atualizar o andamento.');}finally{setRefreshing('');}};
  const selectionKey=JSON.stringify(processIds);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');setItems([]);setSelected([]);
    apiClient.inspectAstenDeclarations(JSON.parse(selectionKey)).then(result=>{if(active){setItems(result);setSelected(result.filter(item=>item.ready).map(item=>item.processId));}}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Não foi possível conferir as declarações.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[selectionKey]);
  const ready=items.filter(item=>item.ready&&selected.includes(item.processId)).map(item=>item.processId);
  const available=items.filter(item=>item.ready).length;
  const disabled=loading||!!refreshing||!!error||!ready.length;
  return <PortalModalShell open title={processIds.length===1?'Assinatura da declaração · Asten':'Assinatura de declarações · Asten'} icon={Shield} onClose={onClose} maxWidthClass="max-w-3xl" bodyClassName="max-h-[70dvh] overflow-y-auto p-4" footer={<><button type="button" className="portal-action" onClick={onClose}>Fechar</button>{(loading||available>0)&&<button type="button" disabled={disabled} className="portal-action portal-signature-provider-action" onClick={()=>onSend(ready)}>{loading?'Conferindo declarações…':!available?'Nenhuma declaração disponível':!ready.length?'Selecione uma declaração':ready.length===1?'Gerar e enviar à Asten':`Gerar e enviar ${ready.length} declarações à Asten`}</button>}</>}>
    <div className="space-y-3 text-xs">
      <p className="portal-instruction p-3">{ASTEN_SIGNATURE_GUIDANCE}</p>
      <p role="status">{processIds.length} declaração(ões){available>0?` · ${ready.length} selecionada(s) para envio`:loading?' · Conferindo…':' · Confira o andamento abaixo'}</p>
      {error&&<p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3">{error}</p>}
      {!loading&&items.map(item=><div key={item.processId} className={`flex items-start gap-3 rounded-lg border border-slate-300 p-3 ${item.ready?'bg-white':'bg-[var(--portal-surface-panel)]'}`}>
        {item.ready&&<input type="checkbox" className="mt-1 h-4 w-4 shrink-0" aria-label={`Selecionar ${item.protocol}`} disabled={!item.ready} checked={item.ready&&selected.includes(item.processId)} onChange={event=>setSelected(current=>event.target.checked?[...current,item.processId]:current.filter(id=>id!==item.processId))}/>}
        <span><strong>{item.protocol}</strong>{item.recipientEmail&&<span className="mt-1 block">Assinatura da presidência: {item.recipientName} · {item.recipientEmail}</span>}<span className={`mt-1 block ${item.ready?'text-emerald-800':'text-amber-900'}`}>{item.reason}</span>{item.sentAt&&<span className="mt-1 block text-slate-600">Enviada em {formatDateTimeWithWeekday(item.sentAt)}</span>}{item.jobId&&<button type="button" className="portal-action mt-3" disabled={!!refreshing} onClick={()=>void refresh(item.jobId!)}>{refreshing===item.jobId?'Atualizando…':'Atualizar andamento na Asten'}</button>}</span>
      </div>)}
    </div>
  </PortalModalShell>;
};
