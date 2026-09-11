import React, { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface GoogleDriveExplorerProps {
  driveFolderUrl?: string;
  onDriveFolderUrlChange?: (url: string) => void;
  onSyncCalendar?: () => Promise<void>;
  onSyncDriveAndVariables?: () => Promise<void>;
  isSyncingCalendar?: boolean;
  syncStatus?: string | null;
  syncError?: boolean;
}

export const GoogleDriveExplorer: React.FC<GoogleDriveExplorerProps> = ({ onSyncCalendar, isSyncingCalendar=false, syncStatus }) => {
  const [status,setStatus]=useState<any>(null);const[working,setWorking]=useState(false);const[message,setMessage]=useState('');
  const load=async()=>{try{setStatus(await apiClient.getInfrastructureStatus());}catch(error){setMessage(error instanceof Error?error.message:'Não foi possível consultar o Google Workspace.');}};
  useEffect(()=>{void load();},[]);
  const synchronize=async()=>{setWorking(true);setMessage('');try{if(onSyncCalendar)await onSyncCalendar();else await apiClient.syncGoogleWorkspaceCalendar();setMessage('Calendário e estrutura institucional verificados pelo servidor.');await load();}catch(error){setMessage(error instanceof Error?error.message:'Falha na sincronização.');}finally{setWorking(false);}};
  const connected=Boolean(status?.googleDrive?.configured);
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Google Workspace seguro">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-2 text-blue-700"><Cloud className="h-5 w-5"/></span><div><h3 className="text-sm font-black text-slate-950">Google Workspace do portal</h3><p className="mt-1 text-xs leading-5 text-slate-600">Drive, Docs, Gmail e Calendar usam a autorização cifrada do servidor. Nenhum token Google é entregue ao navegador.</p></div></div><span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-black uppercase ${connected?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-amber-200 bg-amber-50 text-amber-800'}`}>{connected?<CheckCircle2 className="h-3.5 w-3.5"/>:<ShieldCheck className="h-3.5 w-3.5"/>}{connected?'Conectado':'Pendente'}</span></div>
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={()=>{window.location.href='/api/integrations/google/oauth/start?returnTo=/?google=connected';}} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-900"><ExternalLink className="h-4 w-4"/>{connected?'Reautorizar conta':'Autorizar Google'}</button><button type="button" onClick={synchronize} disabled={!connected||working||isSyncingCalendar} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${working||isSyncingCalendar?'animate-spin':''}`}/>Sincronizar calendário</button></div>
    {(message||syncStatus)&&<p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-700" aria-live="polite">{message||syncStatus}</p>}
  </section>;
};
