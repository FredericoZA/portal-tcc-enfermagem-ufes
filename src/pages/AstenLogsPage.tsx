import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import type { SignatureJob } from '../types';
import { SearchPopover } from '../components/SearchPopover';
import { HeaderSettingsPopover } from '../components/HeaderSettingsPopover';
import { TableScrollWrapper } from '../components/TableScrollWrapper';
import { loadTableConfig, type ColumnDef } from '../components/TableColumnSelectorPanel';
import { loadGlobalTableConfig, type TableTextFormat } from '../utils/tableFormatters';

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
];
const DEFAULT_ORDER = SIGNATURE_COLUMNS.map((column) => column.key);
const DEFAULT_VISIBLE = Object.fromEntries(SIGNATURE_COLUMNS.map((column) => [column.key, true]));
const dateTime = (value?: string) => value ? new Date(value).toLocaleString('pt-BR') : '—';
const providerLabel = (value?: string) => value === 'ASTEN' ? 'Asten' : value === 'GOVBR' ? 'Gov.br' : (value || '—');

const DEMO_JOB = {
  id: 'demo-signature-local',
  createdAt: '2026-09-24T12:00:00-03:00',
  updatedAt: '2026-09-24T12:00:00-03:00',
  createdBy: 'demonstração@portal.local',
  processId: 'demo-process',
  protocol: '2026-000',
  documentTitle: 'Declaração de participação — demonstração',
  documentType: 'DECLARACAO',
  provider: 'ASTEN',
  status: 'SIGNED',
  providerEnvelopeId: 'DEMO-LOCAL',
  sentAt: '2026-09-24T12:00:00-03:00',
  completedAt: '2026-09-24T12:01:00-03:00',
} as SignatureJob;

export const AstenLogsPage: React.FC = () => {
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

  const renderCell = (job: SignatureJob, key: string) => {
    if (key === 'createdAt') return dateTime(job.createdAt);
    if (key === 'createdBy') return job.createdBy || 'Sistema';
    if (key === 'protocol') return job.protocol || job.processId || '—';
    if (key === 'documentTitle') return job.documentTitle || job.documentType || '—';
    if (key === 'provider') return providerLabel(job.provider);
    if (key === 'status') return <span className="inline-flex rounded-md border border-slate-400 bg-white px-2 py-0.5 text-[9px] font-black uppercase text-slate-900">{job.status}</span>;
    if (key === 'providerEnvelopeId') return job.providerEnvelopeId || '—';
    if (key === 'attempts') return String((job as SignatureJob & { attempts?: number; retryCount?: number }).attempts ?? (job as SignatureJob & { retryCount?: number }).retryCount ?? '—');
    if (key === 'sentAt') return dateTime(job.sentAt);
    if (key === 'completedAt') return dateTime(job.completedAt || job.signedAt);
    if (key === 'lastError') return job.lastError || '—';
    return '—';
  };

  return <div id="asten-logs-page" data-portal-signature-logs="true" className="overflow-hidden rounded-2xl border border-slate-300 bg-[#d5dce0] shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b-[16px] border-white bg-[#005830] px-4 py-3 text-white">
      <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 shrink-0"/><h1 className="text-sm font-black uppercase tracking-wide">Registros de Assinatura</h1></div>
      <div className="flex items-center gap-1.5">
        <SearchPopover value={search} onChange={setSearch} placeholder="Pessoa, processo, documento, método, status ou erro" textFormat={textFormat}/>
        <HeaderSettingsPopover recordsLimit={recordsLimit} setRecordsLimit={setRecordsLimit} allowedLimits={[25,50,100,'all']} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} allColumns={SIGNATURE_COLUMNS} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} columnOrder={columnOrder} setColumnOrder={setColumnOrder} storageKey="signature_logs" defaultColumnOrder={DEFAULT_ORDER} defaultVisibleColumns={DEFAULT_VISIBLE} defaultRecordsLimit={25} defaultTableTitle="Registros de Assinatura"/>
      </div>
    </header>
    {loading ? <div className="m-3 rounded-xl border border-slate-300 bg-[#d5dce0] p-8 text-center text-xs font-semibold text-slate-700">Carregando registros de assinatura…</div> : renderedJobs.length === 0 ? <div className="m-3 rounded-xl border border-dashed border-slate-400 bg-[#d5dce0] p-8 text-center text-xs font-semibold text-slate-700">Nenhum registro de assinatura encontrado com os filtros atuais.</div> : <>
      {showDemo && <div className="border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-[9px] font-semibold text-amber-900">Demonstração visual: este registro existe apenas na interface, não é salvo e não entra em estatísticas.</div>}
      <TableScrollWrapper>
        <table className="portal-spreadsheet-table w-full min-w-[1180px] border-collapse text-left text-xs">
          <thead><tr>{activeColumns.map((key) => <th key={key} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wide">{SIGNATURE_COLUMNS.find((column) => column.key === key)?.label || key}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-300 bg-[#d5dce0]">{renderedJobs.map((job) => <tr key={job.id} className="bg-[#d5dce0]">{activeColumns.map((key) => <td key={key} className="px-3 py-1 text-slate-950">{renderCell(job, key)}</td>)}</tr>)}</tbody>
        </table>
      </TableScrollWrapper>
    </>}
  </div>;
};