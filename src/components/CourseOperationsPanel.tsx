import { portalConfirm } from '../services/portalDialogs';
import React, { useEffect, useState } from 'react';
import { Accessibility, Bell, CalendarDays, DatabaseBackup, FileClock, HeartPulse, Languages, Loader2, RefreshCw, Scale, ShieldCheck } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { ContinuousIntelligencePanel } from './ContinuousIntelligencePanel';
import { WorkflowRecoveryPanel } from './WorkflowRecoveryPanel';

const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase disabled:cursor-not-allowed disabled:opacity-40';

export const CourseOperationsPanel: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [preferences, setPreferences] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [retention, setRetention] = useState<any>(null);
  const [holds, setHolds] = useState<any[]>([]);
  const [privacy, setPrivacy] = useState<any[]>([]);
  const [drill, setDrill] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const [holdDraft, setHoldDraft] = useState({ processId: '', reason: '' });
  const [privacyDraft, setPrivacyDraft] = useState({ kind: 'INFORMATION', description: '' });

  const load = async () => {
    setWorking('load');
    const results = await Promise.allSettled([
      apiClient.getOperationalHealth(), apiClient.getNotificationPreferences(), apiClient.getNotifications(),
      apiClient.getStudioVersions(), apiClient.getRetentionPreview(), apiClient.getLegalHolds(), apiClient.getPrivacyRequests()
    ]);
    if (results[0].status === 'fulfilled') setHealth(results[0].value);
    if (results[1].status === 'fulfilled') setPreferences(results[1].value);
    if (results[2].status === 'fulfilled') setNotifications(results[2].value);
    if (results[3].status === 'fulfilled') setVersions(results[3].value);
    if (results[4].status === 'fulfilled') setRetention(results[4].value);
    if (results[5].status === 'fulfilled') setHolds(results[5].value);
    if (results[6].status === 'fulfilled') setPrivacy(results[6].value);
    const failures = results.filter((result) => result.status === 'rejected');
    setMessage(failures.length ? `${failures.length} consulta(s) não puderam ser concluídas.` : '');
    setWorking('');
  };
  useEffect(() => { void load(); }, []);

  const savePreferences = async () => { setWorking('preferences'); try { setPreferences(await apiClient.updateNotificationPreferences(preferences)); setMessage('Preferências de notificação atualizadas.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao salvar.'); } finally { setWorking(''); } };
  const runDrill = async () => { setWorking('drill'); try { setDrill(await apiClient.runBackupDrill()); setMessage('Ensaio concluído sem alterar os dados atuais.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha no ensaio.'); } finally { setWorking(''); } };
  const compare = async (revision: number) => { setWorking(`compare-${revision}`); try { setComparison(await apiClient.compareStudioVersion(revision)); } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao comparar.'); } finally { setWorking(''); } };
  const restore = async (revision: number) => { if (!(await portalConfirm(`Restaurar a revisão ${revision} como uma nova versão?`))) return; setWorking(`restore-${revision}`); try { await apiClient.restoreStudioVersion(revision); await load(); setMessage('Versão restaurada como nova revisão.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao restaurar.'); } finally { setWorking(''); } };
  const createHold = async (event: React.FormEvent) => { event.preventDefault(); setWorking('hold'); try { await apiClient.createLegalHold(holdDraft.processId, holdDraft.reason); setHoldDraft({ processId: '', reason: '' }); await load(); setMessage('Bloqueio legal criado; o processo não entrará em descartes futuros.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao criar bloqueio.'); } finally { setWorking(''); } };
  const createPrivacy = async (event: React.FormEvent) => { event.preventDefault(); setWorking('privacy'); try { await apiClient.createPrivacyRequest(privacyDraft); setPrivacyDraft({ kind: 'INFORMATION', description: '' }); await load(); setMessage('Solicitação LGPD registrada com rastreabilidade.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao registrar.'); } finally { setWorking(''); } };

  return <div className="space-y-4">
    <WorkflowRecoveryPanel/>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div><h3 className="font-black text-slate-950">Operação contínua do curso</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">Versões, notificações, acessibilidade, agenda, retenção, direitos LGPD, backup e saúde ficam sob a mesma governança do Master.</p></div><button type="button" onClick={() => void load()} disabled={Boolean(working)} className={`${button} border-slate-300 bg-white text-slate-800`}>{working === 'load' ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}Atualizar</button></div>
    {message && <p role="status" className="rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-800">{message}</p>}
    <ContinuousIntelligencePanel />
    <div className="grid gap-4 xl:grid-cols-2">
      <section className={card}><div className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-emerald-700"/><h4 className="font-black">Saúde e homologação</h4></div><p className="mt-1 text-xs text-slate-600">“Não confirmado” significa que a configuração existe, mas ainda depende de um piloto real com a conta do curso.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{(health?.checks || []).map((check: any) => <div key={check.id} className={`rounded-xl border p-3 ${check.status === 'PASS' ? 'border-emerald-200 bg-emerald-50' : check.status === 'FAIL' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}><strong className="text-xs">{check.label} · {check.status}</strong><p className="mt-1 text-[10px] leading-4 text-slate-600">{check.message}</p></div>)}</div></section>

      <section className={card}><div className="flex items-center gap-2"><Bell className="h-5 w-5 text-blue-700"/><h4 className="font-black">Notificações e entregas</h4></div>{preferences && <div className="mt-3 grid gap-2 sm:grid-cols-2">{[['email','E-mail'],['inPortal','Central no portal'],['dailyDigest','Resumo diário'],['workflowEvents','Eventos do fluxo'],['signatureEvents','Assinaturas'],['failureEvents','Falhas']].map(([key,label]) => <label key={key} className="flex items-center gap-2 rounded-xl border bg-slate-50 p-2 text-xs font-bold"><input type="checkbox" checked={Boolean(preferences[key])} onChange={(event) => setPreferences((current: any) => ({ ...current, [key]: event.target.checked }))}/>{label}</label>)}</div>}<button type="button" onClick={() => void savePreferences()} disabled={!preferences || Boolean(working)} className={`${button} mt-3 border-blue-700 bg-blue-700 text-white`}>Salvar preferências</button><details className="mt-3 rounded-xl border p-3"><summary className="cursor-pointer text-xs font-black">Pendências da central ({notifications.length})</summary><div className="mt-2 space-y-2">{notifications.slice(0,10).map(item => <div key={item.id} className="rounded-lg bg-slate-50 p-2 text-[10px]"><strong>{item.title}</strong><p>{item.message}</p></div>)}</div></details></section>

      <section className={card}><div className="flex items-center gap-2"><FileClock className="h-5 w-5 text-violet-700"/><h4 className="font-black">Versões do Estúdio</h4></div><p className="mt-1 text-xs text-slate-600">Cada publicação válida preserva metadados dos modelos, formulários, e-mails, variáveis e fluxo. O conteúdo dos documentos continua apenas no Drive.</p><div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{versions.map(version => <div key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-slate-50 p-3"><div><strong className="text-xs">Revisão #{version.revision} · nota {version.validationScore}</strong><p className="text-[10px] text-slate-500">{new Date(version.createdAt).toLocaleString('pt-BR')} · {version.counts.documents} docs · {version.counts.forms} forms · {version.counts.stages} etapas</p></div><div className="flex gap-1"><button type="button" onClick={() => void compare(version.revision)} className={`${button} border-slate-300 bg-white`}>Comparar</button><button type="button" onClick={() => void restore(version.revision)} className={`${button} border-violet-700 bg-violet-700 text-white`}>Restaurar</button></div></div>)}</div>{comparison && <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-3 text-[10px] text-slate-100">{JSON.stringify(comparison, null, 2)}</pre>}</section>

      <section className={card}><div className="flex items-center gap-2"><DatabaseBackup className="h-5 w-5 text-amber-700"/><h4 className="font-black">Backup e ensaio de restauração</h4></div><p className="mt-1 text-xs leading-5 text-slate-600">O ensaio serializa, reabre e valida o estado sem substituir o portal atual.</p><button type="button" onClick={() => void runDrill()} disabled={Boolean(working)} className={`${button} mt-3 border-amber-700 bg-amber-600 text-white`}>Executar ensaio seguro</button>{drill && <div className={`mt-3 rounded-xl border p-3 text-xs ${drill.restorable ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}><strong>{drill.restorable ? 'Backup restaurável' : 'Backup com pendências'}</strong><p className="mt-1">Checksum: {drill.checksumValid ? 'válido' : 'inválido'} · {JSON.stringify(drill.counts)}</p></div>}</section>

      <section className={card}><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-slate-700"/><h4 className="font-black">Retenção e bloqueio legal</h4></div><p className="mt-1 text-xs text-slate-600">A prévia nunca apaga dados. Um processo bloqueado fica fora de qualquer política futura de descarte.</p>{retention && <div className="mt-3 rounded-xl border bg-slate-50 p-3 text-xs"><strong>Prévia de candidatos</strong><p className="mt-1">E-mails: {retention.candidates.emailDeliveries} · Logs: {retention.candidates.auditLogs} · bloqueios ativos: {retention.legalHolds}</p></div>}<form onSubmit={createHold} className="mt-3 grid gap-2 sm:grid-cols-[.7fr_1.3fr_auto]"><input required value={holdDraft.processId} onChange={(event) => setHoldDraft(current => ({ ...current, processId: event.target.value }))} className={input} placeholder="ID do processo"/><input required value={holdDraft.reason} onChange={(event) => setHoldDraft(current => ({ ...current, reason: event.target.value }))} className={input} placeholder="Justificativa"/><button className={`${button} border-slate-800 bg-slate-800 text-white`}>Bloquear</button></form><div className="mt-2 space-y-1">{holds.filter(item => item.active).slice(0,8).map(item => <div key={item.id} className="rounded-lg border p-2 text-[10px]"><strong>{item.processId}</strong> · {item.reason}</div>)}</div></section>

      <section className={card}><div className="flex items-center gap-2"><Scale className="h-5 w-5 text-teal-700"/><h4 className="font-black">Direitos LGPD</h4></div><form onSubmit={createPrivacy} className="mt-3 space-y-2"><select value={privacyDraft.kind} onChange={(event) => setPrivacyDraft(current => ({ ...current, kind: event.target.value }))} className={input}><option value="ACCESS">Acesso aos dados</option><option value="CORRECTION">Correção</option><option value="ANONYMIZATION">Anonimização</option><option value="PORTABILITY">Portabilidade</option><option value="INFORMATION">Informações</option></select><textarea required minLength={10} rows={3} value={privacyDraft.description} onChange={(event) => setPrivacyDraft(current => ({ ...current, description: event.target.value }))} className={input} placeholder="Descreva o pedido"/><button className={`${button} border-teal-700 bg-teal-700 text-white`}>Registrar solicitação</button></form><div className="mt-3 space-y-2">{privacy.slice(0,8).map(item => <div key={item.id} className="rounded-xl border bg-slate-50 p-2 text-[10px]"><strong>{item.kind} · {item.status}</strong><p>{item.description}</p></div>)}</div></section>

      <section className={card}><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-indigo-700"/><h4 className="font-black">Agenda interoperável</h4></div><p className="mt-1 text-xs leading-5 text-slate-600">O arquivo ICS usa horários absolutos e pode ser assinado no Google Calendar, Outlook ou Apple Calendar.</p><a href="/api/public/calendar.ics" className={`${button} mt-3 border-indigo-700 bg-indigo-700 text-white`}><CalendarDays className="h-4 w-4"/>Baixar agenda ICS</a></section>

      <section className={card}><div className="flex items-center gap-2"><Accessibility className="h-5 w-5 text-rose-700"/><h4 className="font-black">Acessibilidade contínua</h4></div><p className="mt-1 text-xs leading-5 text-slate-600">O Estúdio bloqueia contraste insuficiente e centraliza foco visível, alvo mínimo e redução de movimento. A auditoria automatizada complementa — não substitui — testes por teclado e leitor de tela.</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-800"><Accessibility className="mr-1 inline h-3 w-3"/>Contraste validado</span><span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black text-blue-800"><Languages className="mr-1 inline h-3 w-3"/>pt-BR · en-US · es-ES</span></div></section>
    </div>
  </div>;
};
