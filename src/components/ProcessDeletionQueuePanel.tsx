import React,{useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {apiClient} from '../services/apiClient';
import {subscribeDeletionQueueRefresh} from '../utils/deletionQueueRefresh';
import {formatDateTimeWithWeekday} from '../utils/formatters';
import type {ProcessDeletionSummary} from '../../server/workflow/processDeletion';

export function ProcessDeletionQueuePanel(){
 const {isMasterAdmin,userEmail}=useAuth();
 const identityKey=isMasterAdmin?userEmail.trim().toLocaleLowerCase('pt-BR'):'';
 const currentIdentity=useRef(identityKey);currentIdentity.current=identityKey;
 const inFlight=useRef<{identity:string;epoch:number}|null>(null);
 const epoch=useRef(0),retryInProgress=useRef(false);
 const [tasks,setTasks]=useState<ProcessDeletionSummary[]|null>(null);
 const [loadError,setLoadError]=useState('');
 const [message,setMessage]=useState('');
 const [busyId,setBusyId]=useState('');
 const load=useCallback(async()=>{
  if(!identityKey||currentIdentity.current!==identityKey||inFlight.current?.identity===identityKey)return;
  const request={identity:identityKey,epoch:epoch.current};inFlight.current=request;
  const current=()=>currentIdentity.current===identityKey&&epoch.current===request.epoch&&inFlight.current===request;
  try{const result=await apiClient.getProcessDeletions();if(current()){setTasks(result);setLoadError('');}}
  catch{if(current())setLoadError('Não foi possível atualizar a fila de limpeza. Os dados exibidos são da última consulta confirmada.');}
  finally{if(inFlight.current===request)inFlight.current=null;}
 },[identityKey]);
 useEffect(()=>{
  setTasks(null);setLoadError('');setMessage('');setBusyId('');retryInProgress.current=false;
  if(identityKey)void load();
  return()=>{epoch.current++;inFlight.current=null;};
 },[identityKey,load]);
 const pending=Boolean(tasks?.some(task=>task.status==='PENDING'));
 useEffect(()=>{
  if(!identityKey||busyId)return;
  return subscribeDeletionQueueRefresh(pending,()=>void load(),{document,window});
 },[identityKey,busyId,pending,load]);
 if(!isMasterAdmin)return null;
 const retry=async(task:ProcessDeletionSummary)=>{
  if(retryInProgress.current||currentIdentity.current!==identityKey)return;
  retryInProgress.current=true;epoch.current++;inFlight.current=null;
  setBusyId(task.id);setMessage('');
  try{
   const result=await apiClient.retryProcessDeletion(task.id);
   await load();
   if(currentIdentity.current!==identityKey)return;
   setMessage(result.status==='COMPLETED'?'Limpeza dos recursos do Portal concluída.':Date.parse(result.processingUntil||'')>Date.now()?'A limpeza já está em processamento.':'A limpeza continua pendente. Consulte a situação abaixo.');
  }catch(e){if(currentIdentity.current===identityKey)setMessage(e instanceof Error?e.message:'Falha na limpeza.');}
  finally{if(currentIdentity.current===identityKey){retryInProgress.current=false;setBusyId('');}}
 };
 return <section className="mt-4 space-y-3" aria-label="Limpezas de TCC pendentes">
  <h4 className="text-sm font-bold">Limpezas de TCC pendentes</h4>
  {message&&<p role="status" className="text-xs">{message}</p>}
  {loadError&&<div role="status" className="text-xs"><p>{loadError}</p><button type="button" className="portal-action mt-2" disabled={Boolean(busyId)} onClick={()=>void load()}>Atualizar consulta</button></div>}
  {!loadError&&tasks===null&&<p role="status" className="text-xs text-slate-600">Consultando a fila de limpeza…</p>}
  {!loadError&&tasks?.length===0&&<p className="text-xs text-slate-600">Nenhuma limpeza pendente.</p>}
  {tasks?.filter(task=>task.status==='PENDING').map(task=>{
   const processing=Date.parse(task.processingUntil||'')>Date.now();
   const status=processing?'Em processamento':task.nextRetryAt?'Aguardando nova tentativa automática':task.attemptCount?'Falha que exige intervenção':'Pendente';
   return <article key={task.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
    <strong>{task.protocol} · {status}</strong>
    {task.lastAttemptAt&&<p className="mt-2">Tentativas registradas: {task.attemptCount}. Última tentativa em {formatDateTimeWithWeekday(task.lastAttemptAt)}.</p>}
    {!processing&&task.nextRetryAt&&<p className="mt-2">Nova tentativa automática a partir de {formatDateTimeWithWeekday(task.nextRetryAt)}.</p>}
    {task.errors.map((error,i)=><p key={i} className="mt-2">{error}</p>)}
    {task.externalPending>0&&<p className="mt-2">Asten: {task.externalPending} envelope(s) aguardam confirmação ou intervenção no provedor.</p>}
    <button type="button" disabled={Boolean(busyId)||processing} onClick={()=>void retry(task)} className="portal-action mt-2">{busyId===task.id?'Verificando…':'Verificar e tentar limpeza novamente'}</button>
   </article>;
  })}
 </section>;
}
