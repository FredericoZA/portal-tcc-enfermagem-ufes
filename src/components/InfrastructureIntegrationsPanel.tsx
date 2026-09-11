import React, { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, Database, ExternalLink, KeyRound, Loader2, Server, ShieldAlert, ShieldCheck } from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface IntegrationState {
  asten: { enabled: boolean; configured: boolean; callbackConfigured: boolean; callbackUrl?:string; dispatchEnabled: boolean; mode: string; securityMessage: string };
  googleDrive: { configured: boolean; rootFolderIdPresent: boolean };
  supabase: { configured: boolean; durablePersistenceReady: boolean; normalizedSchemaReady:boolean; transactionalRuntimeReady:boolean; keyMode: string; message: string };
  vercel: { detected: boolean; production: boolean; projectIdPresent: boolean; message: string };
  persistence: { provider: string; snapshotReady: boolean; normalizedSchemaReady:boolean; transactionalRuntimeReady:boolean; productionSafe: boolean; message: string };
}

interface Props {
  isMaster: boolean;
}

const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';

export const InfrastructureIntegrationsPanel: React.FC<Props> = ({ isMaster }) => {
  const [status, setStatus] = useState<IntegrationState | null>(null);
  const [token, setToken] = useState('');
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [homologation, setHomologation] = useState<Array<{id:string;label:string;status:'PASS'|'FAIL'|'PENDING';message:string}>>([]);

  const load = async () => {
    try { setStatus(await apiClient.getInfrastructureStatus()); }
    catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Falha ao consultar integrações.' }); }
  };
  useEffect(() => { load(); }, []);

  const connectAsten = async () => {
    setWorking('asten'); setMessage(null);
    try {
      await apiClient.connectAsten(token.trim());
      setToken('');
      setMessage({ ok: true, text: 'Conta Asten conectada. O envio ocorrerá quando um usuário autorizado clicar em “Assinar documento”.' });
      await load();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Não foi possível validar a Asten.' });
    } finally { setWorking(''); }
  };

  const testSupabase = async () => {
    setWorking('supabase'); setMessage(null);
    try {
      const result = await apiClient.testSupabaseConnection();
      setMessage({ ok: result.connected, text: result.message });
      await load();
    } catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Falha no teste do Supabase.' }); }
    finally { setWorking(''); }
  };

  const runHomologation = async () => {
    setWorking('homologation'); setMessage(null);
    try {
      const result = await apiClient.runInfrastructureHomologation();
      setHomologation(result.checks);
      setMessage({ ok: result.readyForProduction, text: result.readyForProduction ? 'Homologação concluída: portal pronto para produção.' : 'Testes concluídos. Revise os itens pendentes antes de publicar.' });
      await load();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Falha ao executar a homologação.' });
    } finally { setWorking(''); }
  };

  if (!isMaster) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">As credenciais de infraestrutura são exclusivas do Master e do Presidente da Comissão.</div>;

  const readiness=[
    {label:'Supabase conectado',ok:Boolean(status?.persistence.snapshotReady)},
    {label:'Google Workspace',ok:Boolean(status?.googleDrive.configured)},
    {label:'Pasta raiz do Drive',ok:Boolean(status?.googleDrive.rootFolderIdPresent)},
    {label:'Asten e callback',ok:Boolean(status?.asten.configured&&status?.asten.callbackConfigured)},
    {label:'Runtime seguro v6',ok:Boolean(status?.persistence.transactionalRuntimeReady)}
  ];
  const readyCount=readiness.filter(item=>item.ok).length;

  return <div className="space-y-4">
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700"/><div><h3 className="font-black text-emerald-950">Central segura de integrações</h3><p className="mt-1 text-xs leading-5 text-emerald-900">Segredos nunca entram nas configurações públicas nem nos logs. Google e Asten são autorizados uma vez e suas credenciais ficam criptografadas no servidor.</p></div></div>
    </div>
    <section className={card} aria-label="Checklist de ativação do portal"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black text-slate-950">Ativação inicial</h3><p className="mt-1 text-xs text-slate-600">Vercel e Supabase são preparados na implantação. Dentro do portal, o Master autoriza Google e Asten uma única vez.</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${readyCount===readiness.length?'bg-emerald-100 text-emerald-900':'bg-amber-100 text-amber-900'}`}>{readyCount}/{readiness.length} requisitos</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{readiness.map(item=><div key={item.label} className={`flex items-center gap-2 rounded-xl border p-2 text-[11px] font-bold ${item.ok?'border-emerald-200 bg-emerald-50 text-emerald-900':'border-amber-200 bg-amber-50 text-amber-900'}`}>{item.ok?<CheckCircle2 className="h-4 w-4 shrink-0"/>:<ShieldAlert className="h-4 w-4 shrink-0"/>}{item.label}</div>)}</div><button type="button" onClick={runHomologation} disabled={working==='homologation'} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{working==='homologation'?<Loader2 className="h-4 w-4 animate-spin"/>:<ShieldCheck className="h-4 w-4"/>}Executar homologação assistida</button>{homologation.length>0&&<div className="mt-3 grid gap-2 sm:grid-cols-2">{homologation.map(check=><div key={check.id} className={`rounded-xl border p-3 text-xs ${check.status==='PASS'?'border-emerald-200 bg-emerald-50 text-emerald-950':check.status==='PENDING'?'border-blue-200 bg-blue-50 text-blue-950':'border-red-200 bg-red-50 text-red-950'}`}><strong>{check.label}: {check.status==='PASS'?'aprovado':check.status==='PENDING'?'pendente':'reprovado'}</strong><p className="mt-1 leading-5">{check.message}</p></div>)}</div>}</section>
    {message && <div className={`rounded-xl border p-3 text-sm font-semibold ${message.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'}`}>{message.text}</div>}
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={card}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-orange-600"/><h3 className="font-black">Asten Assinatura</h3></div><State ok={Boolean(status?.asten.configured&&status?.asten.callbackConfigured)} label={status?.asten.configured ? (status?.asten.callbackConfigured?'Conectada':'Callback pendente') : 'Pendente'}/></div>
        <p className="mt-2 text-xs leading-5 text-slate-600">Cole o <strong>token da API da sua conta</strong>, não a URL da documentação. Após a validação, ele será criptografado e nunca reexibido.</p>
        <input type="password" autoComplete="new-password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Token da API Asten" className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/>
        <button type="button" onClick={connectAsten} disabled={working === 'asten' || !token.trim() || !status?.asten.enabled} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{working === 'asten' ? <Loader2 className="h-4 w-4 animate-spin"/> : <ShieldCheck className="h-4 w-4"/>}Conectar conta Asten</button>
        <p className="mt-3 text-[11px] leading-4 text-slate-500">Callback: {status?.asten.callbackConfigured ? 'configurado' : 'pendente'} · envio explícito, auditado e protegido pela outbox transacional contra envelopes duplicados.</p>
        {status?.asten.callbackUrl&&<div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2"><span className="block text-[10px] font-black uppercase text-slate-600">URL do callback Asten</span><div className="mt-1 flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto text-[10px] text-slate-700">{status.asten.callbackUrl}</code><button type="button" onClick={()=>void navigator.clipboard?.writeText(status.asten.callbackUrl||'')} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-black">Copiar</button></div></div>}
      </section>
      <section className={card}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Cloud className="h-5 w-5 text-blue-600"/><h3 className="font-black">Google Drive</h3></div><State ok={Boolean(status?.googleDrive.rootFolderIdPresent)} label={status?.googleDrive.rootFolderIdPresent ? 'Raiz definida' : 'Pendente'}/></div>
        <p className="mt-2 text-xs leading-5 text-slate-600">Autoriza a conta Google e organiza modelos, histórico, gerados e assinados na pasta raiz escolhida.</p>
        <button type="button" onClick={()=>{window.location.href='/api/integrations/google/oauth/start?returnTo=/?google=connected';}} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-black text-blue-900"><ExternalLink className="h-4 w-4"/>Autorizar Google Workspace</button>
      </section>
      <section className={card}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Database className="h-5 w-5 text-emerald-600"/><h3 className="font-black">Supabase</h3></div><State ok={Boolean(status?.persistence.transactionalRuntimeReady)} label={status?.persistence.transactionalRuntimeReady ? 'Runtime seguro v6' : status?.persistence.snapshotReady ? 'Migração v6 pendente' : 'Preparação pendente'}/></div>
        <p className="mt-2 text-xs leading-5 text-slate-600">Armazena dados, códigos de acesso, integrações criptografadas e estado operacional. O commit usa revisão otimista e atualiza as projeções normalizadas na mesma transação; a chave secreta fica somente no servidor.</p>
        <button type="button" onClick={testSupabase} disabled={working === 'supabase' || !status?.supabase.configured} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{working === 'supabase' ? <Loader2 className="h-4 w-4 animate-spin"/> : <Database className="h-4 w-4"/>}Testar banco</button>
        <p className="mt-3 text-[11px] leading-4 text-slate-500">{status?.supabase.message || 'Consultando configuração…'}</p>
      </section>
      <section className={card}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Server className="h-5 w-5 text-slate-700"/><h3 className="font-black">Vercel</h3></div><State ok={Boolean(status?.vercel.detected && status?.persistence.productionSafe)} label={status?.vercel.detected ? (status?.persistence.productionSafe?'Produção homologada':'Ambiente detectado') : 'Não implantado'}/></div>
        <p className="mt-2 text-xs leading-5 text-slate-600">A Vercel hospeda o portal; ela não é uma sincronização de dados. A implantação só fica segura com persistência durável no Supabase.</p>
        <div className={`mt-3 flex gap-2 rounded-xl border p-3 text-xs ${status?.persistence.productionSafe ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}><ShieldAlert className="h-4 w-4 shrink-0"/>{status?.persistence.message || 'Consultando ambiente…'}</div>
      </section>
    </div>
  </div>;
};

const State: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{ok ? <CheckCircle2 className="h-3 w-3"/> : <ShieldAlert className="h-3 w-3"/>}{label}</span>;
