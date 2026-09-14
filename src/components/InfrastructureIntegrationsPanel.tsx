import React, { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, Copy, Database, Download, ExternalLink, FileSignature, KeyRound, Loader2, Server, ShieldAlert, ShieldCheck } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { CommissionIdentityPanel } from './CommissionIdentityPanel';

interface IntegrationState {
  asten: { enabled: boolean; configured: boolean; callbackConfigured: boolean; callbackUrl?:string; dispatchEnabled: boolean; mode: string; securityMessage: string };
  googleDrive: { configured: boolean; rootFolderIdPresent: boolean };
  supabase: { configured: boolean; durablePersistenceReady: boolean; normalizedSchemaReady:boolean; transactionalRuntimeReady:boolean; keyMode: string; message: string };
  vercel: { detected: boolean; production: boolean; projectIdPresent: boolean; message: string };
  persistence: { provider: string; snapshotReady: boolean; normalizedSchemaReady:boolean; transactionalRuntimeReady:boolean; productionSafe: boolean; message: string };
}

interface Props { isMaster: boolean; }
const card = 'rounded-xl border border-slate-200 bg-white p-3 shadow-sm';
const secondaryButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-[11px] font-black uppercase text-slate-800 transition-colors hover:bg-slate-200 disabled:opacity-40';
const primaryButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-600 px-3.5 py-2 text-[11px] font-black uppercase text-white transition-colors hover:bg-slate-700 disabled:opacity-40';

function sanitizeReplicationValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeReplicationValue);
  if (!value || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) {
    if (/(secret|token|password|api.?key|drivefile|folderid|oauth|clientsecret|recovery)/i.test(key)) continue;
    output[key] = sanitizeReplicationValue(item);
  }
  return output;
}

export const InfrastructureIntegrationsPanel: React.FC<Props> = ({ isMaster }) => {
  const { settings } = useAuth();
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
  useEffect(() => { void load(); }, []);

  const connectAsten = async () => {
    setWorking('asten'); setMessage(null);
    try {
      await apiClient.connectAsten(token.trim()); setToken('');
      setMessage({ ok: true, text: 'Conta Asten conectada. O token ficou cifrado no servidor.' }); await load();
    } catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Não foi possível validar a Asten.' }); }
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
    try {
      const result = await apiClient.runInfrastructureHomologation(); setHomologation(result.checks);
      setMessage({ ok: result.readyForProduction, text: result.readyForProduction ? 'Homologação concluída.' : 'Há itens pendentes na ativação.' }); await load();
    } catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Falha ao executar a homologação.' }); }
    finally { setWorking(''); }
  };

  const loadOperational = async () => { setWorking('health'); setMessage(null); try { const result=await apiClient.getOperationalHealth(); setOperational(result); setMessage({ok:result.overall==='HEALTHY',text:result.overall==='HEALTHY'?'Saúde operacional sem bloqueios.':'Saúde operacional carregada; revise os alertas.'}); } catch(error){ setMessage({ok:false,text:error instanceof Error?error.message:'Falha ao consultar a saúde operacional.'}); } finally { setWorking(''); } };
  const runBackup = async () => { setWorking('backup'); setMessage(null); try { const result=await apiClient.runBackupDrill(); setBackupReport(result); setMessage({ok:Boolean(result.restorable),text:result.restorable?'Backup cifrado e restauração simulada concluídos.':'O ensaio de restauração encontrou pendências.'}); } catch(error){ setMessage({ok:false,text:error instanceof Error?error.message:'Falha no ensaio de backup.'}); } finally { setWorking(''); } };
  const runIntegrity = async () => { setWorking('integrity'); setMessage(null); try { const result=await apiClient.runDriveIntegrityCheck(); setIntegrityReport(result); setMessage({ok:Boolean(result.ok),text:result.ok?'Integridade Portal × Drive confirmada.':`${result.failures} divergência(s) encontrada(s).`}); } catch(error){ setMessage({ok:false,text:error instanceof Error?error.message:'Falha na verificação de integridade.'}); } finally { setWorking(''); } };

  const downloadReplicationPackage = async () => {
    setWorking('replication'); setMessage(null);
    try {
      const profile = await apiClient.getInstallationProfile();
      const payload = {
        schema: 'portal-tcc-ufes-replication-v1',
        generatedAt: new Date().toISOString(),
        purpose: 'Base reutilizável para implantação do Portal TCC em outra secretaria de curso da UFES. Não contém credenciais, tokens, dados pessoais, IDs privados do Drive ou dados de TCCs.',
        installationProfile: sanitizeReplicationValue(profile),
        integrationStudio: sanitizeReplicationValue(settings?.integrationStudio || null),
        evaluationOutcomeOptions: settings?.evaluationOutcomeOptions || [],
        instructions: [
          'Crie uma nova instalação com banco, Drive e contas próprias da secretaria.',
          'Importe/reconstrua o Estúdio com este pacote e revise formulários, fluxos e modelos.',
          'Cadastre modelos documentais e credenciais da nova secretaria separadamente.',
          'Execute homologação, piloto real e auditoria antes de liberar usuários.'
        ]
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `portal-tcc-pacote-replicacao-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
      setMessage({ ok: true, text: 'Pacote seguro de replicação gerado sem credenciais e sem dados pessoais.' });
    } catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Não foi possível gerar o pacote de replicação.' }); }
    finally { setWorking(''); }
  };

  if (!isMaster) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">As credenciais de infraestrutura são exclusivas do Master e do Presidente da Comissão.</div>;

  const readiness=[
    {label:'Supabase',ok:Boolean(status?.persistence.snapshotReady)},
    {label:'Google',ok:Boolean(status?.googleDrive.configured)},
    {label:'Drive',ok:Boolean(status?.googleDrive.rootFolderIdPresent)},
    {label:'Asten',ok:Boolean(status?.asten.configured&&status?.asten.callbackConfigured)},
    {label:'Runtime v6',ok:Boolean(status?.persistence.transactionalRuntimeReady)}
  ];
  const readyCount=readiness.filter(item=>item.ok).length;

  return <div className="space-y-3">
    <CommissionIdentityPanel isMaster={isMaster} />

    <section className={card} aria-label="Checklist de ativação do portal">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div><h3 className="font-black text-slate-950">Ativação inicial</h3><p className="text-xs text-slate-600">Resumo dos cinco serviços essenciais.</p></div>
        <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-1.5 text-xs font-black ${readyCount===readiness.length?'border-slate-400 bg-slate-100 text-slate-800':'border-amber-300 bg-amber-50 text-amber-900'}`}>{readyCount}/{readiness.length} prontos</span><button type="button" onClick={runHomologation} disabled={working==='homologation'} className={primaryButton}>{working==='homologation'?<Loader2 className="h-4 w-4 animate-spin"/>:<ShieldCheck className="h-4 w-4"/>}Testar ativação</button><button type="button" onClick={downloadReplicationPackage} disabled={Boolean(working)} className={secondaryButton}><Copy className="h-4 w-4"/>Replicar para outra secretaria</button></div>
      </div>
      <div className="mt-2 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">{readiness.map(item=><div key={item.label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-bold ${item.ok?'border-slate-300 bg-slate-50 text-slate-800':'border-amber-300 bg-amber-50 text-amber-900'}`}>{item.ok?<CheckCircle2 className="h-4 w-4 shrink-0"/>:<ShieldAlert className="h-4 w-4 shrink-0"/>}{item.label}</div>)}</div>
      {homologation.length>0&&<details className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2"><summary className="cursor-pointer text-xs font-black text-slate-700">Detalhes da homologação</summary><div className="mt-2 grid gap-2 sm:grid-cols-2">{homologation.map(check=><div key={check.id} className={`rounded-lg border p-2 text-xs ${check.status==='PASS'?'border-slate-300 bg-white text-slate-800':check.status==='PENDING'?'border-amber-200 bg-amber-50 text-amber-950':'border-red-200 bg-red-50 text-red-950'}`}><strong>{check.label}: {check.status==='PASS'?'aprovado':check.status==='PENDING'?'pendente':'reprovado'}</strong><p className="mt-1 leading-5">{check.message}</p></div>)}</div></details>}
    </section>

    {message && <div className={`rounded-xl border px-3 py-2 text-sm font-semibold ${message.ok ? 'border-slate-300 bg-slate-50 text-slate-800' : 'border-red-200 bg-red-50 text-red-900'}`}>{message.text}</div>}

    <section className={card} aria-label="Operação e confiabilidade">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black text-slate-950">Operação e confiabilidade</h3><p className="text-xs text-slate-600">Saúde, integridade e recuperação em uma linha de ações.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={loadOperational} disabled={Boolean(working)} className={secondaryButton}>Saúde</button><button type="button" onClick={runIntegrity} disabled={Boolean(working)} className={secondaryButton}>Integridade</button><button type="button" onClick={runBackup} disabled={Boolean(working)} className={secondaryButton}>Backup + restauração</button></div></div>
      {operational&&<details className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2"><summary className="cursor-pointer text-xs font-black text-slate-700">Diagnóstico operacional · {operational.overall}</summary><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{(operational.checks||[]).map((check:any)=><div key={check.id} className={`rounded-lg border p-2 text-xs ${check.status==='PASS'?'border-slate-300 bg-white text-slate-800':check.status==='FAIL'?'border-red-200 bg-red-50 text-red-950':'border-amber-200 bg-amber-50 text-amber-950'}`}><strong>{check.label} · {check.status}</strong><p className="mt-1 leading-5">{check.message}</p></div>)}</div></details>}
      {(integrityReport||backupReport)&&<div className="mt-2 grid gap-2 sm:grid-cols-2">{integrityReport&&<div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs"><strong>Integridade:</strong> {integrityReport.checked} arquivo(s), {integrityReport.failures} divergência(s).</div>}{backupReport&&<div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs"><strong>Backup:</strong> {backupReport.restorable?'restaurável':'com pendências'} · checksum {backupReport.checksumValid?'válido':'inválido'}.</div>}</div>}
    </section>

    <div className="grid gap-3 xl:grid-cols-4">
      <section className={card}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-slate-600"/><h3 className="font-black">Asten</h3></div><State ok={Boolean(status?.asten.configured&&status?.asten.callbackConfigured)} label={status?.asten.configured ? (status?.asten.callbackConfigured?'Conectada':'Callback pendente') : 'Pendente'}/></div>
        <p className="mt-1 text-[11px] leading-4 text-slate-600">Via automática. Se estiver indisponível, o Portal continua operacional e a assinatura pode seguir pelo Gov.br.</p>
        <div className="mt-2 flex gap-2"><input type="password" autoComplete="new-password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Token da API Asten" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs"/><button type="button" onClick={connectAsten} disabled={working === 'asten' || !token.trim() || !status?.asten.enabled} className={primaryButton}>{working === 'asten' ? <Loader2 className="h-4 w-4 animate-spin"/> : <ShieldCheck className="h-4 w-4"/>}Conectar</button></div>
        {status?.asten.callbackUrl&&<div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"><code className="min-w-0 flex-1 truncate text-[10px] text-slate-600" title={status.asten.callbackUrl}>{status.asten.callbackUrl}</code><button type="button" onClick={()=>void navigator.clipboard?.writeText(status.asten.callbackUrl||'')} className="text-[10px] font-black text-slate-700">Copiar</button></div>}
      </section>

      <section className={card}>
        <div className="flex items-center gap-2"><FileSignature className="h-5 w-5 text-slate-600"/><h3 className="font-black">Gov.br</h3></div>
        <p className="mt-1 text-[11px] leading-4 text-slate-600">Via de contingência externa: o usuário baixa o PDF, assina na conta Gov.br e devolve o documento assinado ao processo. Não depende da API Asten.</p>
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[10px] font-semibold text-slate-700">Disponibilidade independente da Asten · validação do arquivo no retorno ao Portal.</div>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Cloud className="h-5 w-5 text-slate-600"/><h3 className="font-black">Google Drive</h3></div><State ok={Boolean(status?.googleDrive.rootFolderIdPresent)} label={status?.googleDrive.rootFolderIdPresent ? 'Raiz definida' : 'Pendente'}/></div>
        <p className="mt-1 text-[11px] leading-4 text-slate-600">Modelos, histórico, gerados e assinados na pasta institucional.</p>
        <button type="button" onClick={()=>{window.location.href='/api/integrations/google/oauth/start?returnTo=/?google=connected';}} className={`${secondaryButton} mt-2`}><ExternalLink className="h-4 w-4"/>Autorizar Google</button>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Database className="h-5 w-5 text-slate-600"/><h3 className="font-black">Supabase / Vercel</h3></div><State ok={Boolean(status?.persistence.transactionalRuntimeReady&&status?.vercel.production)} label={status?.persistence.transactionalRuntimeReady?'Runtime v6':'Pendente'}/></div>
        <p className="mt-1 text-[11px] leading-4 text-slate-600">Persistência transacional e execução de produção.</p>
        <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={testSupabase} disabled={working === 'supabase' || !status?.supabase.configured} className={secondaryButton}>{working === 'supabase' ? <Loader2 className="h-4 w-4 animate-spin"/> : <Database className="h-4 w-4"/>}Testar banco</button><span className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[10px] font-black text-slate-700"><Server className="h-3.5 w-3.5"/>{status?.vercel.production?'Produção':'Preview'}</span></div>
      </section>
    </div>
  </div>;
};

const State: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase ${ok ? 'border-slate-300 bg-slate-100 text-slate-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{ok ? <CheckCircle2 className="h-3 w-3"/> : <ShieldAlert className="h-3 w-3"/>}{label}</span>;