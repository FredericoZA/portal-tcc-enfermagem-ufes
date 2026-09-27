import React, { useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import type { SignatureJob } from '../types';
import { SearchPopover } from '../components/SearchPopover';
import { HeaderSettingsPopover } from '../components/HeaderSettingsPopover';
import { TableScrollWrapper } from '../components/TableScrollWrapper';
import { loadTableConfig, type ColumnDef } from '../components/TableColumnSelectorPanel';
import { loadGlobalTableConfig, type TableTextFormat } from '../utils/tableFormatters';
import { getPortalToneStyle } from '../utils/portalSemanticTokens';

const SIGNATURE_COLUMNS: ColumnDef[] = [
  { key: 'createdAt', label: 'Solicitado em', isFixed: true },
  { key: 'createdBy', label: 'Solicitado por' },
  { key: 'protocol', label: 'Processo' },
  { key: 'documentTitle', label: 'Documento' },
  { key: 'provider', label: 'Método' },
  { key: 'status', label: 'Situação' },
  { key: 'providerEnvelopeId', label: 'Protocolo externo' },
  { key: 'attempts', label: 'Tentativas' },
  { key: 'sentAt', label: 'Enviado em' },
  { key: 'completedAt', label: 'Concluído em' },
  { key: 'lastError', label: 'Último erro' },
  { key: 'actions', label: 'Ações', isFixed: true },
];
const DEFAULT_ORDER = SIGNATURE_COLUMNS.map((column) => column.key);
const DEFAULT_VISIBLE = Object.fromEntries(SIGNATURE_COLUMNS.map((column) => [column.key, true]));
const dateTime = (value?: string) => value ? new Date(value).toLocaleString('pt-BR') : '—';
const providerLabel = (value?: string) => value === 'ASTEN' ? 'Asten' : value === 'GOV_BR' ? 'Gov.br' : (value || '—');

const DEMO_JOB = {
  id: 'demo-signature-local',
  createdAt: '2026-09-24T12:00:00-03:00',
  updatedAt: '2026-09-24T12:00:00-03:00',
  createdBy: 'demonstração@portal.local',
  processId: 'demo-process',
  protocol: '2026-000',
  documentTitle: 'Declaração de participação — demonstração',
  documentType: 'DECLARACAO',
  documentVersion: 1,
  sourceDataRevision: 1,
  fileName: 'declaracao-demonstracao.pdf',
  mimeType: 'application/pdf',
  contentSha256: 'demo',
  idempotencyKey: 'demo',
  signers: [],
  provider: 'ASTEN',
  status: 'SIGNED',
  providerEnvelopeId: 'DEMO-LOCAL',
  sentAt: '2026-09-24T12:00:00-03:00',
  completedAt: '2026-09-24T12:01:00-03:00',
} as SignatureJob;

const retryableStatus = new Set<SignatureJob['status']>(['PROVIDER_ERROR', 'DRIVE_SYNC_PENDING']);
const signedStatus = new Set<SignatureJob['status']>(['SIGNED', 'ARCHIVED']);

export const AstenLogsPage: React.FC = () => {
  const { isMasterAdmin } = useAuth();
  const initialConfig = loadTableConfig('signature_logs', DEFAULT_ORDER, DEFAULT_VISIBLE, 25);
  const [jobs, setJobs] = useState<SignatureJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [recordsLimit, setRecordsLimit] = useState<number | 'all'>(initialConfig.recordsLimit || 25);
  const [startDate, setStartDate] = useState(initialConfig.startDate || '');
  const [endDate, setEndDate] = useState(initialConfig.endDate || '');
  const [columnOrder, setColumnOrder] = useState<string[]>(initialConfig.columnOrder?.includes('actions') ? initialConfig.columnOrder : [...(initialConfig.columnOrder || DEFAULT_ORDER.filter((key) => key !== 'actions')), 'actions']);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({ ...DEFAULT_VISIBLE, ...(initialConfig.visibleColumns || {}), actions: true });
  const [textFormat] = useState<TableTextFormat>(() => ({ ...loadGlobalTableConfig(), ...(initialConfig.textFormat || {}) }));
  const [selectedJob, setSelectedJob] = useState<SignatureJob | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setJobs(await apiClient.getSignatureJobs() || []); }
    catch (error) { console.error('Erro ao carregar registros de assinatura:', error); }
    finally { setLoading(false); }
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
      return [job.createdBy, job.protocol, job.processId, job.documentTitle, job.documentType, job.provider, job.status, job.providerEnvelopeId, job.lastError]
        .filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(term);
    });
  }, [jobs, search, startDate, endDate]);

  const shown = recordsLimit === 'all' ? filtered : filtered.slice(0, recordsLimit);
  const showDemo = jobs.length === 0 && !search.trim() && !startDate && !endDate;
  const renderedJobs = showDemo ? [DEMO_JOB] : shown;
  const activeColumns = columnOrder.filter((key) => visibleColumns[key] !== false);

  if (!isMasterAdmin) return <section className="rounded-xl border border-slate-300 bg-white p-6 text-sm font-semibold text-slate-700">Registros de Assinatura disponíveis somente para o usuário Master.</section>;

  const retry = async (job: SignatureJob) => {
    if (job.id === DEMO_JOB.id || !retryableStatus.has(job.status)) return;
    setRetryingId(job.id);
    try {
      await apiClient.retrySignatureJob(job.id);
      await load();
    } catch (error) {
      console.error('Erro ao reenviar registro de assinatura:', error);
    } finally {
      setRetryingId(null);
    }
  };

  const renderCell = (job: SignatureJob, key: string) => {
    if (key === 'createdAt') return dateTime(job.createdAt);
    if (key === 'createdBy') return job.createdBy || 'Sistema';
    if (key === 'protocol') return job.protocol || job.processId || '—';
    if (key === 'documentTitle') return job.documentTitle || job.documentType || '—';
    if (key === 'provider') return providerLabel(job.provider);
    if (key === 'status') {
      const tone = signedStatus.has(job.status) ? 'signed' : 'pending';
      return <span className="portal-semantic-tone inline-flex rounded-md border px-2 py-0.5 text-[9px] font-black uppercase" style={getPortalToneStyle(tone)}>{job.status}</span>;
    }
    if (key === 'providerEnvelopeId') return job.providerEnvelopeId || '—';
    if (key === 'attempts') return String((job as SignatureJob & { attempts?: number; retryCount?: number }).attempts ?? (job as SignatureJob & { retryCount?: number }).retryCount ?? '—');
    if (key === 'sentAt') return dateTime(job.sentAt);
    if (key === 'completedAt') return dateTime(job.completedAt || job.signedAt);
    if (key === 'lastError') return job.lastError || '—';
    if (key === 'actions') return (
      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
        <button type="button" onClick={() => setSelectedJob(job)} className="portal-action inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[9px] font-black uppercase" title="Ver todos os dados do registro"><Eye className="h-3.5 w-3.5"/>Detalhes</button>
        {job.id !== DEMO_JOB.id && retryableStatus.has(job.status) && <button type="button" onClick={() => void retry(job)} disabled={retryingId === job.id} className="portal-action portal-action-primary inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[9px] font-black uppercase disabled:opacity-50" title="Reprocessar registro com erro"><RefreshCw className={`h-3.5 w-3.5 ${retryingId === job.id ? 'animate-spin' : ''}`}/>Reenviar</button>}
      </div>
    );
    return '—';
  };

  return <>
    <div id="asten-logs-page" data-portal-signature-logs="true" className="overflow-hidden rounded-2xl border border-[var(--portal-surface-border)] bg-[var(--portal-surface-muted)] shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-[16px] border-white bg-[var(--portal-brand-moss)] px-4 py-3 text-white">
        <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 shrink-0"/><h1 className="text-sm font-black uppercase tracking-wide">Registros de Assinatura</h1></div>
        <div className="flex items-center gap-1.5">
          <SearchPopover value={search} onChange={setSearch} placeholder="Pessoa, processo, documento, método, status ou erro" textFormat={textFormat}/>
          <HeaderSettingsPopover recordsLimit={recordsLimit} setRecordsLimit={setRecordsLimit} allowedLimits={[25,50,100,'all']} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} allColumns={SIGNATURE_COLUMNS} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} columnOrder={columnOrder} setColumnOrder={setColumnOrder} storageKey="signature_logs" defaultColumnOrder={DEFAULT_ORDER} defaultVisibleColumns={DEFAULT_VISIBLE} defaultRecordsLimit={25} defaultTableTitle="Registros de Assinatura"/>
        </div>
      </header>
      {loading ? <div className="m-3 rounded-xl border border-slate-300 bg-[var(--portal-surface-soft)] p-8 text-center text-xs font-semibold text-slate-700">Carregando registros de assinatura…</div> : renderedJobs.length === 0 ? <div className="m-3 rounded-xl border border-dashed border-slate-400 bg-[var(--portal-surface-soft)] p-8 text-center text-xs font-semibold text-slate-700">Nenhum registro de assinatura encontrado com os filtros atuais.</div> : <>
        {showDemo && <div className="border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-[9px] font-semibold text-amber-900">Demonstração visual: este registro existe apenas na interface, não é salvo e não entra em estatísticas.</div>}
        <TableScrollWrapper>
          <table className="portal-spreadsheet-table w-full min-w-[1320px] border-collapse text-left text-xs">
            <thead><tr>{activeColumns.map((key) => <th key={key} className={`${key === 'actions' ? 'sticky right-0 z-20' : ''} bg-[var(--portal-brand-moss)] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white`}>{SIGNATURE_COLUMNS.find((column) => column.key === key)?.label || key}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-300 bg-white">{renderedJobs.map((job) => <tr key={job.id} className="bg-white">{activeColumns.map((key) => <td key={key} className={`${key === 'actions' ? 'sticky right-0 z-10 border-l border-slate-200 bg-white' : ''} px-3 py-1 text-black`}>{renderCell(job, key)}</td>)}</tr>)}</tbody>
          </table>
        </TableScrollWrapper>
      </>}
    </div>

    {selectedJob && <div className="fixed inset-0 z-[1000010] flex items-center justify-center bg-slate-950/65 p-3" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedJob(null); }}>
      <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-300 bg-[var(--portal-surface-ice)] shadow-2xl" role="dialog" aria-modal="true" aria-label="Detalhes do registro de assinatura">
        <header className="flex items-center justify-between border-b-[16px] border-white bg-[var(--portal-brand-moss)] px-4 py-3 text-white"><div><div className="text-[10px] font-black uppercase text-white/75">Registro de assinatura</div><h2 className="text-sm font-black text-white">{selectedJob.protocol} — {selectedJob.documentTitle}</h2></div><button type="button" onClick={() => setSelectedJob(null)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black" aria-label="Fechar"><X className="h-4 w-4"/></button></header>
        <div className="max-h-[70vh] overflow-y-auto bg-[var(--portal-surface-soft)] p-4"><dl className="grid gap-2 sm:grid-cols-2">{[
          ['Solicitado em', dateTime(selectedJob.createdAt)], ['Solicitado por', selectedJob.createdBy || 'Sistema'], ['Processo', selectedJob.protocol || selectedJob.processId], ['Documento', selectedJob.documentTitle], ['Método', providerLabel(selectedJob.provider)], ['Situação', selectedJob.status], ['Protocolo externo', selectedJob.providerEnvelopeId || '—'], ['Enviado em', dateTime(selectedJob.sentAt)], ['Concluído em', dateTime(selectedJob.completedAt || selectedJob.signedAt)], ['Último erro', selectedJob.lastError || '—']
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><dt className="text-[9px] font-black uppercase text-slate-500">{label}</dt><dd className="mt-1 break-words text-xs font-semibold text-black">{value}</dd></div>)}</dl></div>
      </section>
    </div>}
  </>;
};
