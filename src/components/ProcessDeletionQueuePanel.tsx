import React,{useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {apiClient} from '../services/apiClient';
import {formatDateTimeWithWeekday} from '../utils/formatters';
import type {ProcessDeletionTask} from '../../server/workflow/processDeletion';

export function ProcessDeletionQueuePanel(){
 const {isMasterAdmin}=useAuth();
 const [tasks,setTasks]=useState<ProcessDeletionTask[]|null>(null);
 const [loadError,setLoadError]=useState('');
 const [message,setMessage]=useState('');
 const [busyId,setBusyId]=useState('');
 const load=async()=>{
  try{setTasks(await apiClient.getProcessDeletions());setLoadError('');}
  catch{setLoadError('Não foi possível atualizar a fila de limpeza. O Portal tentará consultar novamente.');}
 };
 const shouldRefresh=tasks===null||tasks.length>0;
 useEffect(()=>{
  if(!isMasterAdmin)return;
  void load();
 },[isMasterAdmin]);
 useEffect(()=>{
  if(!isMasterAdmin||!shouldRefresh||busyId)return;
  const refresh=()=>{if(document.visibilityState==='visible')void load();};
  const timer=window.setInterval(refresh,60_000);
  document.addEventListener('visibilitychange',refresh);
  return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[isMasterAdmin,shouldRefresh,busyId]);
 if(!isMasterAdmin)return null;
 const retry=async(task:ProcessDeletionTask)=>{
  setBusyId(task.id);setMessage('');
  try{
   const result=await apiClient.retryProcessDeletion(task.id);
   await load();
   setMessage(result.status==='COMPLETED'?'Limpeza dos recursos do Portal concluída.':Date.parse(result.processingUntil||'')>Date.now()?'A limpeza já está em processamento.':'A limpeza continua pendente. Consulte a situação abaixo.');
  }catch(e){setMessage(e instanceof Error?e.message:'Falha na limpeza.');}
  finally{setBusyId('');}
 };
 return <section className="mt-4 space-y-3" aria-label="Limpezas de TCC pendentes">
  <h4 className="text-sm font-bold">Limpezas de TCC pendentes</h4>
  {message&&<p role="status" className="text-xs">{message}</p>}
  {loadError&&<p role="status" className="text-xs">{loadError}</p>}
  {!loadError&&tasks===null&&<p role="status" className="text-xs text-slate-600">Consultando a fila de limpeza…</p>}
  {!loadError&&tasks?.length===0&&<p className="text-xs text-slate-600">Nenhuma limpeza pendente.</p>}
  {tasks?.map(task=>{
   const processing=Date.parse(task.processingUntil||'')>Date.now();
   const status=processing?'Em processamento':task.nextRetryAt?'Aguardando nova tentativa automática':task.attemptCount?'Falha que exige intervenção':'Pendente';
   return <article key={task.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
    <strong>{task.protocol} · {status}</strong>
    {task.lastAttemptAt&&<p className="mt-2">Tentativas registradas: {task.attemptCount}. Última tentativa em {formatDateTimeWithWeekday(task.lastAttemptAt)}.</p>}
    {!processing&&task.nextRetryAt&&<p className="mt-2">Nova tentativa automática a partir de {formatDateTimeWithWeekday(task.nextRetryAt)}.</p>}
    {task.errors.map((error,i)=><p key={i} className="mt-2">{error}</p>)}
    {task.envelopes.length>0&&<p className="mt-2">Asten: {task.envelopes.length} envelope(s) para conferência no provedor.</p>}
    <button type="button" disabled={Boolean(busyId)||processing} onClick={()=>void retry(task)} className="portal-action mt-2">{busyId===task.id?'Verificando…':'Verificar e tentar limpeza novamente'}</button>
   </article>;
  })}
 </section>;
}
