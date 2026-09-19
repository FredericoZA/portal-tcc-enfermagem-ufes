import React, { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, Copy, Database, ExternalLink, KeyRound, Loader2, RefreshCw, Server, ShieldAlert, ShieldCheck } from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface IntegrationState {
  asten: { enabled: boolean; configured: boolean; callbackConfigured: boolean; callbackUrl?: string; dispatchEnabled: boolean; mode: string; securityMessage: string };
  googleDrive: { configured: boolean; rootFolderIdPresent: boolean };
  supabase: { configured: boolean; durablePersistenceReady: boolean; normalizedSchemaReady: boolean; transactionalRuntimeReady: boolean; keyMode: string; message: string };
  vercel: { detected: boolean; production: boolean; projectIdPresent: boolean; message: string };
  persistence: { provider: string; snapshotReady: boolean; normalizedSchemaReady: boolean; transactionalRuntimeReady: boolean; productionSafe: boolean; message: string };
}

const compactCard = 'rounded-lg border border-slate-300 bg-[#d5dce0] p-2.5';
const action = 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-40';
const input = 'min-h-8 min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[10px] text-slate-800 outline-none focus:border-slate-400';

function State({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{ok ? <CheckCircle2 className="h-3 w-3"/> : <ShieldAlert className="h-3 w-3"/>}{label}</span>;
}

export const InfrastructureIntegrationsPanel: React.FC<{ isMaster: boolean }> = ({ isMaster }) => {
  const [status, setStatus] = useState<IntegrationState | null>(null);
  const [token, setToken] = useState('');
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [homologation, setHomologation] = useState<Array<{ id: string; label: string; status: 'PASS' | 'FAIL' | 'PENDING'; message: string }>>([]);

  const load = async () => {
    try { setStatus(await apiClient.getInfrastructureStatus()); }
    catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Falha ao consultar integrações.' }); }
  };
  useEffect(() => { void load(); }, []);

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

  return <section id="infrastructure-integrations-panel" className="rounded-xl border border-slate-300 bg-[#e1e6e9] p-2.5 shadow-sm">
    <div className="mb-2 flex justify-end">
      <button type="button" onClick={runHomologation} disabled={working === 'homologation'} className={action}>{working === 'homologation' ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <RefreshCw className="h-3.5 w-3.5"/>}Executar testes</button>
    </div>

    {message && <div role="status" className={`mb-2 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${message.ok ? 'border-slate-300 bg-white text-slate-900' : 'border-red-200 bg-red-50 text-red-900'}`}>{message.text}</div>}

    <div className="grid gap-2 xl:grid-cols-4">
      <section className={compactCard} aria-labelledby="asten-integration-title">
        <div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-1.5"><KeyRound className="h-4 w-4 shrink-0 text-[#337959]"/><h4 id="asten-integration-title" className="truncate text-[10px] font-black uppercase text-slate-900">Asten</h4></div><State ok={astenReady} label={astenReady ? 'Pronta' : 'Pendente'}/></div>
        <div className="mt-2 grid gap-2"><input aria-label="Token da API Asten" type="password" autoComplete="new-password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Token da API Asten" className={input}/><button type="button" onClick={connectAsten} disabled={working === 'asten' || !token.trim() || !status?.asten.enabled} className={action}>{working === 'asten' ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <ShieldCheck className="h-3.5 w-3.5"/>}Validar e conectar</button></div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[8.5px] text-slate-700"><span className="min-w-0 flex-1">Callback: <strong>{status?.asten.callbackConfigured?'configurado':'pendente'}</strong> · envio: <strong>{status?.asten.dispatchEnabled?'habilitado':'bloqueado'}</strong></span>{status?.asten.callbackUrl&&<button type="button" title="Copiar callback" onClick={()=>void navigator.clipboard?.writeText(status.asten.callbackUrl||'')} className="rounded border border-slate-300 bg-white p-1 text-slate-700"><Copy className="h-3 w-3"/></button>}</div>
      </section>

      <section className={compactCard} aria-label="Google Drive"><div className="flex items-center justify-between gap-1"><span className="flex items-center gap-1 text-[9px] font-black uppercase"><Cloud className="h-3.5 w-3.5 text-[#337959]"/>Google Drive</span><State ok={googleReady} label={googleReady?'Conectado':'Pendente'}/></div><button type="button" onClick={()=>{window.location.href='/api/integrations/google/oauth/start?returnTo=/?google=connected';}} className={`${action} mt-3 w-full`}><ExternalLink className="h-3.5 w-3.5"/>Conectar Google</button></section>

      <section className={compactCard} aria-label="Supabase"><div className="flex items-center justify-between gap-1"><span className="flex items-center gap-1 text-[9px] font-black uppercase"><Database className="h-3.5 w-3.5 text-[#337959]"/>Supabase</span><State ok={supabaseReady} label={supabaseReady?'Pronto':'Pendente'}/></div><button type="button" onClick={testSupabase} disabled={working==='supabase'||!status?.supabase.configured} className={`${action} mt-3 w-full`}>{working==='supabase'?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Database className="h-3.5 w-3.5"/>}Testar conexão</button><p className="mt-2 text-[8.5px] leading-4 text-slate-700">{status?.supabase.message || 'Aguardando status.'}</p></section>

      <section className={compactCard} aria-label="Vercel"><div className="flex items-center justify-between gap-1"><span className="flex items-center gap-1 text-[9px] font-black uppercase"><Server className="h-3.5 w-3.5 text-[#337959]"/>Vercel</span><State ok={vercelReady} label={vercelReady?'Detectado':'Pendente'}/></div><p className="mt-3 text-[8.5px] leading-4 text-slate-700">{status?.vercel.message||'Aguardando status.'}</p></section>
    </div>

    {homologation.length > 0 && <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">{homologation.map((check) => <div key={check.id} className={`rounded-lg border px-2 py-1.5 text-[9px] ${check.status === 'PASS' ? 'border-emerald-200 bg-white text-emerald-900' : check.status === 'PENDING' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-900'}`}><strong>{check.label}</strong><span className="ml-1">— {check.message}</span></div>)}</div>}
  </section>;
};
