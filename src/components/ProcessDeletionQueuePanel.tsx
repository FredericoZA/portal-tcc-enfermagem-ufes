import React,{useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {apiClient} from '../services/apiClient';
import type {ProcessDeletionTask} from '../../server/workflow/processDeletion';
export function ProcessDeletionQueuePanel(){
 const {isMasterAdmin}=useAuth();
 const [tasks,setTasks]=useState<ProcessDeletionTask[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{try{setTasks(await apiClient.getProcessDeletions());}catch(e){setMessage(e instanceof Error?e.message:'Falha ao consultar exclusões.');}};
 useEffect(()=>{if(isMasterAdmin)void load();},[isMasterAdmin]);
 if(!isMasterAdmin)return null;
 const retry=async(task:ProcessDeletionTask)=>{setBusy(true);try{await apiClient.retryProcessDeletion(task.id);await load();setMessage('Limpeza verificada. As pendências ainda existentes permanecem abaixo.');}catch(e){setMessage(e instanceof Error?e.message:'Falha na limpeza.');}finally{setBusy(false);}};
 return <section className="mt-4 space-y-3" aria-label="Limpezas de TCC pendentes"><h4 className="text-sm font-bold">Limpezas de TCC pendentes</h4>{message&&<p role="status" className="text-xs">{message}</p>}{!tasks.length&&<p className="text-xs text-slate-600">Nenhuma limpeza pendente.</p>}{tasks.map(task=><article key={task.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs"><strong>{task.protocol}</strong>{task.errors.map((error,i)=><p key={i} className="mt-2">{error}</p>)}<button type="button" disabled={busy} onClick={()=>void retry(task)} className="portal-action mt-2">{busy?'Verificando…':'Verificar e tentar limpeza novamente'}</button></article>)}</section>;
}
