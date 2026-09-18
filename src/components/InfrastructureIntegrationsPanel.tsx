import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Cloud, Copy, Database, ExternalLink, KeyRound, Loader2, RefreshCw, Server, Settings2, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface IntegrationState {
  asten: { enabled: boolean; configured: boolean; callbackConfigured: boolean; callbackUrl?: string; dispatchEnabled: boolean; mode: string; securityMessage: string };
  googleDrive: { configured: boolean; rootFolderIdPresent: boolean };
  supabase: { configured: boolean; durablePersistenceReady: boolean; normalizedSchemaReady: boolean; transactionalRuntimeReady: boolean; keyMode: string; message: string };
  vercel: { detected: boolean; production: boolean; projectIdPresent: boolean; message: string };
  persistence: { provider: string; snapshotReady: boolean; normalizedSchemaReady: boolean; transactionalRuntimeReady: boolean; productionSafe: boolean; message: string };
}

const compactCard = 'rounded-lg border border-slate-300 bg-[#d5dce0] p-2';
const action = 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-40';
const input = 'min-h-8 min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[10px] text-slate-800 outline-none focus:border-[#337959]';

function State({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{ok ? <CheckCircle2 className="h-3 w-3"/> : <ShieldAlert className="h-3 w-3"/>}{label}</span>;
}

export const InfrastructureIntegrationsPanel: React.FC<{ isMaster: boolean }> = ({ isMaster }) => {
  const [status, setStatus] = useState<IntegrationState | null>(null);
  const [token, setToken] = useState('');
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [homologation, setHomologation] = useState<Array<{ id: string; label: string; status: 'PASS' | 'FAIL' | 'PENDING'; message: string }>>([]);
  const [toolsOpen,setToolsOpen]=useState(false);
  const toolsRef=useRef<HTMLDivElement>(null);

  const load = async () => {
    try { setStatus(await apiClient.getInfrastructureStatus()); }
    catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Falha ao consultar integrações.' }); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(()=>{if(!toolsOpen)return;const close=(event:MouseEvent)=>{if(toolsRef.current&&!toolsRef.current.contains(event.target as Node))setToolsOpen(false);};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close);},[toolsOpen]);

  const connectAsten = async () => {
    setWorking('asten'); setMessage(null);
    try { await apiClient.connectAsten(token.trim()); setToken(''); setMessage({ ok: true, text: 'Asten conectada. Token validado e armazenado somente no servidor.' }); await load(); }
    catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Não foi possível validar a Asten.' }); }
    finally { setWorking(''); }
  };
  const testSupabase = async () => {
    setWorking('supabase'); setMessage(null);
    try { const result = await apiClient.testSupabaseConnection(); setMessage({ ok: result.connected, text: result.message }); await load(); }
    catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Falha no teste do Supabase.' }); }
    finally { setWorking(''); }
  };
  const runHomologation = async () => {
    setWorking('homologation'); setMessage(null);
    try { const result = await apiClient.runInfrastructureHomologation(); setHomologation(result.checks); setMessage({ ok: result.readyForProduction, text: result.readyForProduction ? 'Integrações essenciais aprovadas para produção.' : 'Há pendências de integração a resolver.' }); await load(); }
    catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Falha ao testar as integrações.' }); }
    finally { setWorking(''); }
  };

  if (!isMaster) return <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs font-semibold text-amber-900">As credenciais de infraestrutura são exclusivas da administração.</div>;

  const astenReady = Boolean(status?.asten.configured && status?.asten.callbackConfigured && status?.asten.dispatchEnabled);
  const googleReady = Boolean(status?.googleDrive.configured && status?.googleDrive.rootFolderIdPresent);
  const supabaseReady = Boolean(status?.supabase.transactionalRuntimeReady);
  const vercelReady = Boolean(status?.vercel.detected && status?.vercel.projectIdPresent);

  return <section id="infrastructure-integrations-panel" className="overflow-visible rounded-xl border border-slate-300 bg-[#e1e6e9] shadow-sm">
    <div className="relative flex flex-col gap-2 border-b-2 border-white bg-[#337959] px-3 py-2 text-white sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0"><h3 className="text-xs font-black uppercase tracking-wide">Integrações da plataforma</h3><p className="text-[9px] text-white/80">Asten em primeiro plano; infraestrutura auxiliar concentrada em um único painel.</p></div>
      <div className="relative flex flex-wrap gap-2" ref={toolsRef}>
        <button type="button" onClick={()=>setToolsOpen(value=>!value)} className={action}><Settings2 className="h-3.5 w-3.5"/>Conexões</button>
        <button type="button" onClick={runHomologation} disabled={working === 'homologation'} className={action}>{working === 'homologation' ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <RefreshCw className="h-3.5 w-3.5"/>}Executar testes</button>
        {toolsOpen&&<div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(460px,calc(100vw-2rem))] rounded-xl border border-slate-300 bg-[#e1e6e9] p-2.5 text-slate-900 shadow-2xl">
          <div className="mb-2 flex items-center justify-between border-b border-slate-300 pb-2"><strong className="text-[10px] font-black uppercase">Conexões auxiliares</strong><button type="button" onClick={()=>setToolsOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-3.5 w-3.5"/></button></div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className={compactCard}><div className="flex items-center justify-between gap-1"><span className="flex items-center gap-1 text-[9px] font-black uppercase"><Cloud className="h-3.5 w-3.5 text-[#337959]"/>Google Drive</span><State ok={googleReady} label={googleReady?'Conectado':'Pendente'}/></div><button type="button" onClick={()=>{window.location.href='/api/integrations/google/oauth/start?returnTo=/?google=connected';}} className={`${action} mt-2 w-full`}><ExternalLink className="h-3 w-3"/>Conectar</button></div>
            <div className={compactCard}><div className="flex items-center justify-between gap-1"><span className="flex items-center gap-1 text-[9px] font-black uppercase"><Database className="h-3.5 w-3.5 text-[#337959]"/>Supabase</span><State ok={supabaseReady} label={supabaseReady?'Pronto':'Pendente'}/></div><button type="button" onClick={testSupabase} disabled={working==='supabase'||!status?.supabase.configured} className={`${action} mt-2 w-full`}>{working==='supabase'?<Loader2 className="h-3 w-3 animate-spin"/>:<Database className="h-3 w-3"/>}Testar</button></div>
            <div className={compactCard}><div className="flex items-center justify-between gap-1"><span className="flex items-center gap-1 text-[9px] font-black uppercase"><Server className="h-3.5 w-3.5 text-[#337959]"/>Vercel</span><State ok={vercelReady} label={vercelReady?'Detectado':'Pendente'}/></div><p className="mt-2 line-clamp-3 text-[8px] leading-3.5 text-slate-500">{status?.vercel.message||'Aguardando ambiente.'}</p></div>
          </div>
        </div>}
      </div>
    </div>

    <div className="space-y-2 p-2.5">
      {message && <div role="status" className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${message.ok ? 'border-slate-200 bg-white text-slate-800' : 'border-red-200 bg-red-50 text-red-900'}`}>{message.text}</div>}
      <section className={compactCard} aria-labelledby="asten-integration-title">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-1.5"><KeyRound className="h-4 w-4 shrink-0 text-[#337959]"/><div><h4 id="asten-integration-title" className="text-[10px] font-black uppercase text-slate-900">Asten</h4><p className="text-[8px] text-slate-500">Assinatura eletrônica de documentos do fluxo.</p></div></div><State ok={astenReady} label={astenReady ? 'Pronta' : 'Pendente'}/></div>
        <div className="mt-2 flex gap-1.5"><input aria-label="Token da API Asten" type="password" autoComplete="new-password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Token da API Asten" className={`${input} flex-1`}/><button type="button" onClick={connectAsten} disabled={working === 'asten' || !token.trim() || !status?.asten.enabled} className={action}>{working === 'asten' ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <ShieldCheck className="h-3.5 w-3.5"/>}Conectar</button></div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[8px] text-slate-500"><span className="min-w-0 flex-1 truncate">Callback: {status?.asten.callbackConfigured ? 'configurado' : 'pendente'} · envio {status?.asten.dispatchEnabled ? 'habilitado' : 'bloqueado'} · modo {status?.asten.mode||'não confirmado'}</span>{status?.asten.callbackUrl && <button type="button" title="Copiar callback" onClick={() => void navigator.clipboard?.writeText(status.asten.callbackUrl || '')} className="rounded border border-slate-300 bg-white p-1 text-slate-700"><Copy className="h-3 w-3"/></button>}</div>
      </section>

      {homologation.length > 0 && <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">{homologation.map((check) => <div key={check.id} className={`rounded-lg border px-2 py-1.5 text-[9px] ${check.status === 'PASS' ? 'border-emerald-200 bg-white text-emerald-900' : check.status === 'PENDING' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-900'}`}><strong>{check.label}</strong><span className="ml-1">— {check.message}</span></div>)}</div>}
    </div>
  </section>;
};
