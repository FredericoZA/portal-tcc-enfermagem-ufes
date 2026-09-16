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

const card = 'rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm';

export const InfrastructureIntegrationsPanel: React.FC<Props> = ({ isMaster }) => {
  const [status, setStatus] = useState<IntegrationState | null>(null);
  const [token, setToken] = useState('');
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [homologation, setHomologation] = useState<Array<{id:string;label:string;status:'PASS'|'FAIL'|'PENDING';message:string}>>([]);
  const [operational, setOperational] = useState<any>(null);
  const [backupReport, setBackupReport] = useState<any>(null);
  const [integrityReport, setIntegrityReport] = useState<any>(null);

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

  const loadOperational = async () => { setWorking('health'); setMessage(null); try { const result=await apiClient.getOperationalHealth(); setOperational(result); setMessage({ok:result.overall==='HEALTHY',text:result.overall==='HEALTHY'?'Saúde operacional sem bloqueios.':'Saúde operacional carregada. Revise os itens marcados antes da abertura.'}); } catch(error){ setMessage({ok:false,text:error instanceof Error?error.message:'Falha ao consultar a saúde operacional.'}); } finally { setWorking(''); } };
  const runBackup = async () => { setWorking('backup'); setMessage(null); try { const result=await apiClient.runBackupDrill(); setBackupReport(result); setMessage({ok:Boolean(result.restorable),text:result.restorable?'Backup cifrado salvo no Drive e restauração simulada com sucesso.':'O ensaio de restauração encontrou pendências.'}); } catch(error){ setMessage({ok:false,text:error instanceof Error?error.message:'Falha no ensaio de backup.'}); } finally { setWorking(''); } };
  const runIntegrity = async () => { setWorking('integrity'); setMessage(null); try { const result=await apiClient.runDriveIntegrityCheck(); setIntegrityReport(result); setMessage({ok:Boolean(result.ok),text:result.ok?'Integridade entre Portal e Drive confirmada para os arquivos registrados.':`${result.failures} divergência(s) encontrada(s) no Drive.`}); } catch(error){ setMessage({ok:false,text:error instanceof Error?error.message:'Falha na verificação de integridade.'}); } finally { setWorking(''); } };

  if (!isMaster) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">As credenciais de infraestrutura são exclusivas do Master e do Presidente da Comissão.</div>;

  const readiness=[
    {label:'Supabase',ok:Boolean(status?.persistence.snapshotReady)},
    {label:'Google Workspace',ok:Boolean(status?.googleDrive.configured)},
    {label:'Drive privado',ok:Boolean(status?.googleDrive.rootFolderIdPresent)},
    {label:'Persistência segura',ok:Boolean(status?.persistence.transactionalRuntimeReady)}
  ];
  const readyCount=readiness.filter(item=>item.ok).length;
  const astenOptionalReady=Boolean(status?.asten.configured&&status?.asten.callbackConfigured);

  return <div className="space-y-4">
    <section className={card} aria-label="Checklist de ativação do portal">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><h3 className="font-black text-slate-950">Ativação inicial</h3><p className="mt-1 text-xs text-slate-600">Confirme somente os serviços essenciais antes do uso real.</p></div>
        <div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-xs font-black ${readyCount===readiness.length?'bg-emerald-100 text-emerald-950':'bg-amber-100 text-amber-950'}`}>{readyCount}/{readiness.length} essenciais</span><button type="button" onClick={runHomologation} disabled={working==='homologation'} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-600 px-4 py-2 text-xs font-black text-white hover:bg-slate-700 disabled:opacity-40">{working==='homologation'?<Loader2 className="h-4 w-4 animate-spin"/>:<ShieldCheck className="h-4 w-4"/>}Testar ativação</button></div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{readiness.map(item=><div key={item.label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-bold ${item.ok?'border-emerald-300 bg-slate-50 text-emerald-950':'border-amber-300 bg-amber-50 text-amber-950'}`}>{item.ok?<CheckCircle2 className="h-4 w-4 shrink-0"/>:<ShieldAlert className="h-4 w-4 shrink-0"/>}{item.label}</div>)}</div>
      {homologation.length>0&&<div className="mt-3 grid gap-2 sm:grid-cols-2">{homologation.map(check=><div key={check.id} className={`rounded-xl border p-3 text-xs ${check.status==='PASS'?'border-slate-200 bg-slate-50 text-emerald-950':check.status==='PENDING'?'border-amber-200 bg-amber-50 text-amber-950':'border-red-200 bg-red-50 text-red-950'}`}><strong>{check.label}: {check.status==='PASS'?'aprovado':check.status==='PENDING'?'pendente':'reprovado'}</strong><p className="mt-1 leading-5">{check.message}</p></div>)}</div>}
    </section>
    {message && <div className={`rounded-xl border p-3 text-sm font-semibold ${message.ok ? 'border-slate-200 bg-slate-50 text-slate-800' : 'border-red-200 bg-red-50 text-red-900'}`}>{message.text}</div>}
    <div className="grid gap-3 lg:grid-cols-2">
      <section className={card}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-slate-600"/><h3 className="font-black">Asten Assinatura · opcional</h3></div><State ok={astenOptionalReady} label={astenOptionalReady ? 'Pronta' : 'Opcional'}/></div>
        <p className="mt-2 text-xs leading-5 text-slate-600">Cole o <strong>token da API da sua conta</strong>, não a URL da documentação. Após a validação, ele será criptografado e nunca reexibido.</p>
        <input type="password" autoComplete="new-password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Token da API Asten" className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/>
        <button type="button" onClick={connectAsten} disabled={working === 'asten' || !token.trim() || !status?.asten.enabled} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{working === 'asten' ? <Loader2 className="h-4 w-4 animate-spin"/> : <ShieldCheck className="h-4 w-4"/>}Conectar conta Asten</button>
        <p className="mt-3 text-[11px] leading-4 text-slate-500">Callback: {status?.asten.callbackConfigured ? 'configurado' : 'pendente'} · envio explícito, auditado e protegido pela outbox transacional contra envelopes duplicados.</p>
        {status?.asten.callbackUrl&&<div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2"><span className="block text-[10px] font-black uppercase text-slate-600">URL do callback Asten</span><div className="mt-1 flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto text-[10px] text-slate-700">{status.asten.callbackUrl}</code><button type="button" onClick={()=>void navigator.clipboard?.writeText(status.asten.callbackUrl||'')} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-black">Copiar</button></div></div>}
      </section>
      <section className={card}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Cloud className="h-5 w-5 text-slate-600"/><h3 className="font-black">Google Drive</h3></div><State ok={Boolean(status?.googleDrive.rootFolderIdPresent)} label={status?.googleDrive.rootFolderIdPresent ? 'Raiz definida' : 'Pendente'}/></div>
        <p className="mt-2 text-xs leading-5 text-slate-600">Autoriza a conta Google e organiza modelos, histórico, gerados e assinados na pasta raiz escolhida.</p>
        <button type="button" onClick={()=>{window.location.href='/api/integrations/google/oauth/start?returnTo=/?google=connected';}} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-800"><ExternalLink className="h-4 w-4"/>Autorizar Google Workspace</button>
      </section>
      <section className={card}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Database className="h-5 w-5 text-slate-600"/><h3 className="font-black">Supabase</h3></div><State ok={Boolean(status?.persistence.transactionalRuntimeReady)} label={status?.persistence.transactionalRuntimeReady ? 'Runtime seguro v6' : status?.persistence.snapshotReady ? 'Migração v6 pendente' : 'Preparação pendente'}/></div>
        <p className="mt-2 text-xs leading-5 text-slate-600">Armazena dados, códigos de acesso, integrações criptografadas e estado operacional. O commit usa revisão otimista e atualiza as projeções normalizadas na mesma transação; a chave secreta fica somente no servidor.</p>
        <button type="button" onClick={testSupabase} disabled={working === 'supabase' || !status?.supabase.configured} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{working === 'supabase' ? <Loader2 className="h-4 w-4 animate-spin"/> : <Database className="h-4 w-4"/>}Testar banco</button>
        <p className="mt-3 text-[11px] leading-4 text-slate-500">{status?.supabase.message || 'Consultando configuração…'}</p>
      </section>
      <section className={card}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Server className="h-5 w-5 text-slate-700"/><h3 className="font-black">Vercel</h3></div><State ok={Boolean(status?.vercel.detected && status?.persistence.productionSafe)} label={status?.vercel.detected ? (status?.persistence.productionSafe?'Produção homologada':'Ambiente detectado') : 'Não implantado'}/></div>
        <p className="mt-2 text-xs leading-5 text-slate-600">A Vercel hospeda o portal; ela não é uma sincronização de dados. A implantação só fica segura com persistência durável no Supabase.</p>
        <div className={`mt-3 flex gap-2 rounded-xl border p-3 text-xs ${status?.persistence.productionSafe ? 'border-slate-200 bg-slate-50 text-slate-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}><ShieldAlert className="h-4 w-4 shrink-0"/>{status?.persistence.message || 'Consultando ambiente…'}</div>
      </section>
    </div>
  </div>;
};

const State: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase ${ok ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{ok ? <CheckCircle2 className="h-3 w-3"/> : <ShieldAlert className="h-3 w-3"/>}{label}</span>;
