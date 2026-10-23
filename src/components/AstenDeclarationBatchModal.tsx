import React,{useEffect,useState} from 'react';
import {Shield} from 'lucide-react';
import {PortalModalShell} from './PortalModalShell';
import {apiClient} from '../services/apiClient';
import type {AstenDeclarationCheck} from '../types/signatures';

interface Props {processIds:string[];dispatchReady:boolean;onClose:()=>void;onSend:(ids:string[])=>void;}
export const AstenDeclarationBatchModal:React.FC<Props>=({processIds,dispatchReady,onClose,onSend})=>{
  const [items,setItems]=useState<AstenDeclarationCheck[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const selectionKey=JSON.stringify(processIds);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');
    apiClient.inspectAstenDeclarations(JSON.parse(selectionKey)).then(result=>{if(active)setItems(result);}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Não foi possível conferir as declarações.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[selectionKey]);
  const ready=items.filter(item=>item.ready).map(item=>item.processId);
  return <PortalModalShell open title="Assinatura em lote · asten" icon={Shield} onClose={onClose} maxWidthClass="max-w-3xl" bodyClassName="max-h-[70dvh] overflow-y-auto p-4" footer={<><button type="button" className="portal-action" onClick={onClose}>Fechar</button><button type="button" disabled={loading||!!error||!ready.length||!dispatchReady} className="portal-action portal-button-primary disabled:cursor-not-allowed" onClick={()=>onSend(ready)}>Enviar {ready.length} pela Asten</button></>}>
    <div className="space-y-3 text-xs">
      <p role="status">{processIds.length} selecionado(s) · {ready.length} pronto(s) para envio{loading?' · Conferindo…':''}</p>
      {!dispatchReady&&<p className="rounded-lg border border-amber-300 bg-amber-50 p-3">A integração Asten precisa ser configurada em Configurações → Integrações e Plataforma antes de enviar o lote.</p>}
      {error&&<p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3">{error}</p>}
      {!loading&&items.map(item=><div key={item.processId} className="rounded-lg border border-slate-300 bg-white p-3"><strong>{item.protocol}</strong><p className={`mt-1 ${item.ready?'text-emerald-800':'text-amber-900'}`}>{item.reason}</p></div>)}
    </div>
  </PortalModalShell>;
};
