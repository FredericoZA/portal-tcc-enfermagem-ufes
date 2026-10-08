import React, { useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { portalConfirm, portalNotice } from '../services/portalDialogs';
import type { SignatureJob, SignatureJobStatus, SignatureSignerSnapshot } from '../types';
import { SearchPopover } from '../components/SearchPopover';
import { HeaderSettingsPopover } from '../components/HeaderSettingsPopover';
import { TableScrollWrapper } from '../components/TableScrollWrapper';
import { SettingsWorkspaceHeaderPortal } from '../components/SettingsWorkspaceModal';
import { loadTableConfig, type ColumnDef } from '../components/TableColumnSelectorPanel';
import { loadGlobalTableConfig, type TableTextFormat } from '../utils/tableFormatters';

const SIGNATURE_COLUMNS: ColumnDef[] = [
  { key: 'createdAt', label: 'Solicitado em', isFixed: true },
  { key: 'createdBy', label: 'Solicitado por' },
  { key: 'protocol', label: 'Processo' },
  { key: 'documentTitle', label: 'Documento' },
  { key: 'provider', label: 'Método' },
  { key: 'status', label: 'Situação' },
  { key: 'signers', label: 'Signatários' },
  { key: 'signedBy', label: 'Quem assinou' },
  { key: 'signedAt', label: 'Assinado em' },
  { key: 'providerEnvelopeId', label: 'Protocolo externo' },
  { key: 'attempts', label: 'Tentativas' },
  { key: 'sentAt', label: 'Enviado em' },
  { key: 'completedAt', label: 'Concluído em' },
  { key: 'signedSha256', label: 'Hash assinado' },
  { key: 'lastError', label: 'Último erro' },
  { key: 'actions', label: 'Ações', isFixed: true },
];
const DEFAULT_ORDER = SIGNATURE_COLUMNS.map((column) => column.key);
const DEFAULT_VISIBLE = Object.fromEntries(SIGNATURE_COLUMNS.map((column) => [column.key, !['attempts','signedSha256','lastError'].includes(column.key)]));
const dateTime = (value?: string) => value ? new Date(value).toLocaleString('pt-BR') : '—';
const providerLabel = (value?: string) => value === 'ASTEN' ? 'Asten' : value === 'GOV_BR' ? 'Gov.br' : (value || '—');
const RETRYABLE_STATUSES = new Set<SignatureJobStatus>(['PROVIDER_ERROR', 'WAITING_INTEGRATION', 'DRIVE_SYNC_PENDING', 'EXPIRED']);
const FINAL_STATUSES = new Set<SignatureJobStatus>(['ARCHIVED', 'CANCELED', 'DECLINED']);

const roleLabel = (role: SignatureSignerSnapshot['role']) => role === 'ADVISOR' ? 'Orientador(a)' : role === 'STUDENT' ? 'Aluno(a)' : 'Presidência';
const signerSummary = (signers: SignatureSignerSnapshot[]) => signers.length ? signers.map((signer) => signer.name || signer.email).join('; ') : '—';
const signedSigners = (job: SignatureJob) => job.signers.filter((signer) => signer.status === 'SIGNED');
const signedBySummary = (job: SignatureJob) => {
  const signed = signedSigners(job);
  if (signed.length) return signed.map((signer) => signer.name || signer.email).join('; ');
  if (['SIGNED', 'DRIVE_SYNC_PENDING', 'ARCHIVED'].includes(job.status)) return 'Concluído pelo provedor; detalhe individual não informado';
  return '—';
};

const DEMO_JOB = {
  id: 'demo-signature-local', createdAt: '2026-09-24T12:00:00-03:00', updatedAt: '2026-09-24T12:01:00-03:00', createdBy: 'demonstração@portal.local',
  processId: 'demo-process', protocol: '2026-000', documentTitle: 'Declaração de participação — demonstração', documentType: 'DECLARACAO', documentVersion: 1,
  sourceDataRevision: 1, fileName: 'declaracao-demo.pdf', mimeType: 'application/pdf', contentSha256: 'demo', idempotencyKey: 'demo',
  signers: [{ id: 'demo-signer', role: 'ADVISOR', name: 'Prof. Demonstração', email: 'demo@portal.local', signingOrder: 1, status: 'SIGNED', signedAt: '2026-09-24T12:01:00-03:00' }],
  provider: 'ASTEN', status: 'SIGNED', providerEnvelopeId: 'DEMO-LOCAL', sentAt: '2026-09-24T12:00:00-03:00', completedAt: '2026-09-24T12:01:00-03:00', signedAt: '2026-09-24T12:01:00-03:00',
} as SignatureJob;

const statusToneClass = (status: SignatureJobStatus) => {
  if (['SIGNED', 'ARCHIVED'].includes(status)) return 'portal-tone-signed';
  if (['WAITING_INTEGRATION', 'QUEUED', 'READY_FOR_REVIEW', 'APPROVED', 'SENDING', 'SENT', 'PARTIALLY_SIGNED', 'DRIVE_SYNC_PENDING'].includes(status)) return 'portal-tone-pending';
  return 'portal-tone-neutral';
};

export const AstenLogsPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { isMasterAdmin } = useAuth();
  const initialConfig = loadTableConfig('signature_logs', DEFAULT_ORDER, DEFAULT_VISIBLE, 25);
  const [jobs, setJobs] = useState<SignatureJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [recordsLimit, setRecordsLimit] = useState<number | 'all'>(initialConfig.recordsLimit || 25);
  const [startDate, setStartDate] = useState(initialConfig.startDate || '');
  const [endDate, setEndDate] = useState(initialConfig.endDate || '');
  const [columnOrder, setColumnOrder] = useState<string[]>(initialConfig.columnOrder || DEFAULT_ORDER);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(initialConfig.visibleColumns || DEFAULT_VISIBLE);
  const [textFormat] = useState<TableTextFormat>(() => ({ ...loadGlobalTableConfig(), ...(initialConfig.textFormat || {}) }));
  const [selectedJob, setSelectedJob] = useState<SignatureJob | null>(null);
  useEffect(() => {
    if (!selectedJob) return;
    const closeSelectedSignatureOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedJob(null); };
    window.addEventListener('keydown', closeSelectedSignatureOnEscape);
    return () => window.removeEventListener('keydown', closeSelectedSignatureOnEscape);
  }, [selectedJob]);
  const [workingId, setWorkingId] = useState('');

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try { setJobs(await apiClient.getSignatureJobs() || []); }
    catch (error) { console.error('Erro ao carregar registros de assinatura:', error); portalNotice('Não foi possível carregar os registros de assinatura.'); }
    finally { if (!silent) setLoading(false); }
  };
  useEffect(() => { if (isMasterAdmin) void load(); }, [isMasterAdmin]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : 0;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    return jobs.filter((job) => {
      const created = new Date(job.createdAt).getTime();
      if (Number.isFinite(created) && (created < start || created > end)) return false;
      if (!term) return true;
      return [job.createdBy, job.protocol, job.processId, job.documentTitle, job.documentType, job.provider, job.status, job.providerEnvelopeId, job.lastError, signerSummary(job.signers), signedBySummary(job)]
        .filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(term);
    });
  }, [jobs, search, startDate, endDate]);

  const shown = filtered;
  const showDemo = jobs.length === 0 && !search.trim() && !startDate && !endDate;
  const renderedJobs = showDemo ? [DEMO_JOB] : shown;
  const activeColumns = columnOrder.filter((key) => visibleColumns[key] !== false || key === 'actions');

  const retry = async (job: SignatureJob) => {
    if (job.id === DEMO_JOB.id) return;
    if (!(await portalConfirm(`Reenviar a solicitação de assinatura do processo ${job.protocol || job.processId}?`))) return;
    setWorkingId(job.id);
    try { await apiClient.retrySignatureJob(job.id); await load(true); }
    catch (error: any) { portalNotice(error?.message || 'Não foi possível reenviar a solicitação.'); }
    finally { setWorkingId(''); }
  };

  const reconcile = async (job: SignatureJob) => {
    if (job.id === DEMO_JOB.id) return;
    setWorkingId(job.id);
    try { await apiClient.reconcileSignatureJob(job.id); await load(true); }
    catch (error: any) { portalNotice(error?.message || 'Não foi possível reconciliar o estado da assinatura.'); }
    finally { setWorkingId(''); }
  };

  if (!isMasterAdmin) return <section className="rounded-xl border border-slate-300 bg-white p-6 text-sm font-semibold text-slate-700">Registros de Assinatura disponíveis somente para o usuário Master.</section>;

  const renderActions = (job: SignatureJob) => {
    const busy = workingId === job.id;
    const demo = job.id === DEMO_JOB.id;
    const canRetry = !demo && RETRYABLE_STATUSES.has(job.status) && job.providerCreationState !== 'UNCERTAIN';
    const canReconcile = !demo && Boolean(job.providerEnvelopeId) && !FINAL_STATUSES.has(job.status);
    return <div className="flex items-center justify-end gap-1 whitespace-nowrap">
      <button type="button" onClick={() => setSelectedJob(job)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[9px] font-bold text-slate-900 hover:bg-slate-50"><Eye className="h-3 w-3"/>Auditar</button>
      {canRetry && <button type="button" onClick={() => void retry(job)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[9px] font-bold text-slate-900 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`}/>Reenviar</button>}
      {canReconcile && <button type="button" onClick={() => void reconcile(job)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[9px] font-bold text-slate-900 hover:bg-slate-50 disabled:opacity-50"><RotateCcw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`}/>Reconciliar</button>}
    </div>;
  };

  const renderCell = (job: SignatureJob, key: string) => {
    if (key === 'createdAt') return dateTime(job.createdAt);
    if (key === 'createdBy') return job.createdBy || 'Sistema';
    if (key === 'protocol') return job.protocol || job.processId || '—';
    if (key === 'documentTitle') return job.documentTitle || job.documentType || '—';
    if (key === 'provider') return providerLabel(job.provider);
    if (key === 'status') return <span className={`inline-flex rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${statusToneClass(job.status)}`}>{job.status}</span>;
    if (key === 'signers') return signerSummary(job.signers);
    if (key === 'signedBy') return signedBySummary(job);
    if (key === 'signedAt') return dateTime(job.signedAt || job.completedAt);
    if (key === 'providerEnvelopeId') return job.providerEnvelopeId || '—';
    if (key === 'attempts') return String((job as SignatureJob & { attempts?: number; retryCount?: number }).attempts ?? (job as SignatureJob & { retryCount?: number }).retryCount ?? '—');
    if (key === 'sentAt') return dateTime(job.sentAt);
    if (key === 'completedAt') return dateTime(job.completedAt || job.signedAt);
    if (key === 'signedSha256') return job.signedSha256 || '—';
    if (key === 'lastError') return job.lastError || '—';
    if (key === 'actions') return renderActions(job);
    return '—';
  };

  const toolbar = <div className="flex items-center gap-1.5">
    <SearchPopover value={search} onChange={setSearch} placeholder="Pessoa, processo, documento, método, status ou protocolo" textFormat={textFormat}/>
    <HeaderSettingsPopover recordsLimit={recordsLimit} setRecordsLimit={setRecordsLimit} allowedLimits={[25,50,100,'all']} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} allColumns={SIGNATURE_COLUMNS} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} columnOrder={columnOrder} setColumnOrder={setColumnOrder} storageKey="signature_logs" defaultColumnOrder={DEFAULT_ORDER} defaultVisibleColumns={DEFAULT_VISIBLE} defaultRecordsLimit={25} defaultTableTitle="Registros de Assinatura"/>
  </div>;

  return <div id="asten-logs-page" data-settings-sheet="true" data-portal-signature-logs="true" data-embedded={embedded ? 'true' : 'false'} className={embedded ? 'flex h-full min-h-0 flex-col' : 'overflow-hidden rounded-2xl border border-slate-300 shadow-sm'} style={{ backgroundColor: 'var(--portal-surface-page)' }}>
    {embedded ? <SettingsWorkspaceHeaderPortal>{toolbar}</SettingsWorkspaceHeaderPortal> : <header className="flex flex-wrap items-center justify-between gap-3 border-b-[16px] border-white px-4 py-3 text-white" style={{ backgroundColor: 'var(--portal-brand-header)' }}><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 shrink-0"/><h1 className="text-sm font-black uppercase tracking-wide">Registros de Assinatura</h1></div>{toolbar}</header>}

    <div className="portal-signature-table-shell flex min-h-0 flex-1 flex-col p-0">
      {loading ? <div className="m-3 rounded-xl border border-slate-300 p-8 text-center text-xs font-semibold text-slate-700" style={{ backgroundColor: 'var(--portal-surface-inner)' }}>Carregando registros de assinatura…</div> : renderedJobs.length === 0 ? <div className="m-3 rounded-xl border border-dashed border-slate-400 p-8 text-center text-xs font-semibold text-slate-700" style={{ backgroundColor: 'var(--portal-surface-inner)' }}>Nenhum registro de assinatura encontrado com os filtros atuais.</div> : <>
        {showDemo && <div className="border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-[9px] font-semibold text-amber-900">Demonstração visual: este registro existe apenas na interface, não é salvo e não entra em estatísticas.</div>}
        <TableScrollWrapper fillHeight>
          <table className="portal-spreadsheet-table w-full min-w-[1900px] border-collapse text-left text-xs">
            <thead><tr>{activeColumns.map((key) => <th key={key} data-portal-column-key={key} className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${key === 'actions' ? 'sticky right-0 z-20 text-right' : ''}`} style={key === 'actions' ? { backgroundColor: 'var(--portal-brand-header)' } : undefined}>{SIGNATURE_COLUMNS.find((column) => column.key === key)?.label || key}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-200">{renderedJobs.map((job) => <tr key={job.id}>{activeColumns.map((key) => <td key={key} className={`px-3 py-1 text-slate-950 ${key === 'actions' ? 'sticky right-0 z-10 border-l border-slate-200 bg-white text-right' : ''}`}>{renderCell(job, key)}</td>)}</tr>)}</tbody>
          </table>
        </TableScrollWrapper>
      </>}
    </div>

    {selectedJob && <div className="portal-modal-backdrop fixed inset-0 z-[1000009] flex items-center justify-center p-4" onClick={() => setSelectedJob(null)}>
      <section role="dialog" aria-modal="true" aria-label="Auditoria do registro de assinatura" className="portal-standard-modal portal-modal-surface w-full max-w-5xl overflow-hidden" style={{ backgroundColor: 'var(--portal-surface-page)' }} onClick={(event) => event.stopPropagation()}>
        <header className="portal-modal-header px-4"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true"/><strong className="text-xs uppercase">Auditoria da assinatura</strong></header><div className="portal-modal-divider" aria-hidden="true" />
        <div className="max-h-[78vh] overflow-y-auto p-3" style={{ backgroundColor: 'var(--portal-surface-page)' }}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[
            ['Processo', selectedJob.protocol || selectedJob.processId], ['Documento', selectedJob.documentTitle], ['Método', providerLabel(selectedJob.provider)],
            ['Situação', selectedJob.status], ['Solicitado por', selectedJob.createdBy], ['Solicitado em', dateTime(selectedJob.createdAt)],
            ['Protocolo externo', selectedJob.providerEnvelopeId || '—'], ['Enviado em', dateTime(selectedJob.sentAt)], ['Assinado / concluído em', dateTime(selectedJob.signedAt || selectedJob.completedAt)],
            ['Hash assinado', selectedJob.signedSha256 || '—'], ['Último erro', selectedJob.lastError || '—'],
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-300 p-3" style={{ backgroundColor: 'var(--portal-surface-panel)' }}><div className="text-[9px] font-black uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 break-words text-xs font-semibold text-slate-900">{value}</div></div>)}</div>

          <section className="mt-3 overflow-hidden rounded-xl border border-slate-300 bg-white">
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white" style={{ backgroundColor: 'var(--portal-brand-header)' }}>Signatários e evidências</div>
            <div className="overflow-x-auto"><table className="portal-spreadsheet-table w-full min-w-[760px] border-collapse text-left text-xs"><thead><tr><th className="px-3 py-1.5">Ordem</th><th className="px-3 py-1.5">Pessoa</th><th className="px-3 py-1.5">E-mail</th><th className="px-3 py-1.5">Papel</th><th className="px-3 py-1.5">Estado</th><th className="px-3 py-1.5">Assinado em</th></tr></thead><tbody>{selectedJob.signers.length ? selectedJob.signers.slice().sort((a,b)=>a.signingOrder-b.signingOrder).map((signer)=><tr key={signer.id}><td className="px-3 py-1">{signer.signingOrder}</td><td className="px-3 py-1 font-semibold">{signer.name || '—'}</td><td className="px-3 py-1">{signer.email}</td><td className="px-3 py-1">{roleLabel(signer.role)}</td><td className="px-3 py-1">{signer.status}</td><td className="px-3 py-1">{dateTime(signer.signedAt)}</td></tr>) : <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-500">Nenhum signatário registrado.</td></tr>}</tbody></table></div>
          </section>
          <div className="mt-3 rounded-xl border border-slate-300 bg-white p-3 text-[10px] leading-4 text-slate-600">O Portal preserva a identidade dos signatários, documento, método, protocolo externo e marcos temporais disponíveis. Quando o provedor não devolve horário individual por signatário, o sistema exibe apenas o horário confirmado do documento, sem inventar evidência individual.</div>
        </div>
      </section>
    </div>}
  </div>;
};
