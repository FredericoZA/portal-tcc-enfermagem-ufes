import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import type { AstenIntegrationStatus, SignatureJob } from '../types';
import { SearchPopover } from '../components/SearchPopover';
import { HeaderSettingsPopover } from '../components/HeaderSettingsPopover';
import { TableScrollWrapper } from '../components/TableScrollWrapper';
import { loadTableConfig, type ColumnDef } from '../components/TableColumnSelectorPanel';
import { loadGlobalTableConfig, type TableTextFormat } from '../utils/tableFormatters';

const ASTEN_COLUMNS: ColumnDef[] = [
  { key: 'createdAt', label: 'Solicitado em', isFixed: true },
  { key: 'createdBy', label: 'Solicitado por' },
  { key: 'protocol', label: 'Processo' },
  { key: 'documentTitle', label: 'Documento' },
  { key: 'status', label: 'Situação' },
  { key: 'providerEnvelopeId', label: 'Protocolo Asten' },
  { key: 'attempts', label: 'Tentativas' },
  { key: 'sentAt', label: 'Enviado em' },
  { key: 'completedAt', label: 'Concluído em' },
  { key: 'lastError', label: 'Último erro' },
];
const DEFAULT_ORDER = ASTEN_COLUMNS.map((column) => column.key);
const DEFAULT_VISIBLE = Object.fromEntries(ASTEN_COLUMNS.map((column) => [column.key, true]));

const dateTime = (value?: string) => value ? new Date(value).toLocaleString('pt-BR') : '—';

export const AstenLogsPage: React.FC = () => {
  const { isMasterAdmin } = useAuth();
  const initialConfig = loadTableConfig('asten_logs', DEFAULT_ORDER, DEFAULT_VISIBLE, 25);
  const [jobs, setJobs] = useState<SignatureJob[]>([]);
  const [status, setStatus] = useState<AstenIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [recordsLimit, setRecordsLimit] = useState<number | 'all'>(initialConfig.recordsLimit || 25);
  const [startDate, setStartDate] = useState(initialConfig.startDate || '');
  const [endDate, setEndDate] = useState(initialConfig.endDate || '');
  const [columnOrder, setColumnOrder] = useState<string[]>(initialConfig.columnOrder || DEFAULT_ORDER);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(initialConfig.visibleColumns || DEFAULT_VISIBLE);
  const [textFormat] = useState<TableTextFormat>(() => ({ ...loadGlobalTableConfig(), ...(initialConfig.textFormat || {}) }));

  const load = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [allJobs, integrationStatus] = await Promise.all([
        apiClient.getSignatureJobs(),
        apiClient.getAstenStatus(),
      ]);
      setJobs((allJobs || []).filter((job) => job.provider === 'ASTEN'));
      setStatus(integrationStatus || null);
    } catch (error) {
      console.error('Erro ao carregar registros da Asten:', error);
    } finally {
      if (silent) window.setTimeout(() => setRefreshing(false), 250); else setLoading(false);
    }
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
      return [job.createdBy, job.protocol, job.processId, job.documentTitle, job.documentType, job.status, job.providerEnvelopeId, job.lastError]
        .filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(term);
    });
  }, [jobs, search, startDate, endDate]);
  const shown = recordsLimit === 'all' ? filtered : filtered.slice(0, recordsLimit);
  const activeColumns = columnOrder.filter((key) => visibleColumns[key] !== false);

  if (!isMasterAdmin) return <section className="rounded-xl border border-slate-300 bg-white p-6 text-sm font-semibold text-slate-700">Registros da Asten disponíveis somente para o usuário Master.</section>;

  const renderCell = (job: SignatureJob, key: string) => {
    if (key === 'createdAt') return dateTime(job.createdAt);
    if (key === 'createdBy') return job.createdBy || 'Sistema';
    if (key === 'protocol') return job.protocol || job.processId || '—';
    if (key === 'documentTitle') return job.documentTitle || job.documentType || '—';
    if (key === 'status') return <span className="inline-flex rounded-md border border-slate-300 bg-white px-2 py-1 text-[9px] font-black uppercase">{job.status}</span>;
    if (key === 'providerEnvelopeId') return job.providerEnvelopeId || '—';
    if (key === 'attempts') return String((job as SignatureJob & { attempts?: number; retryCount?: number }).attempts ?? (job as SignatureJob & { retryCount?: number }).retryCount ?? '—');
    if (key === 'sentAt') return dateTime(job.sentAt);
    if (key === 'completedAt') return dateTime(job.completedAt || job.signedAt);
    if (key === 'lastError') return job.lastError || '—';
    return '—';
  };

  return <div id="asten-logs-page" className="overflow-hidden rounded-2xl border border-slate-300 bg-[#d5dce0] shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-white bg-[#005830] px-4 py-3 text-white">
      <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 shrink-0"/><h1 className="text-sm font-black uppercase tracking-wide">Registros da Asten</h1></div>
      <div className="flex items-center gap-1.5">
        <span className={`mr-2 rounded-full border px-2 py-1 text-[9px] font-black uppercase ${status?.configured ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{status?.configured ? 'Configurada' : 'Não configurada'}</span>
        <SearchPopover value={search} onChange={setSearch} placeholder="Pessoa, processo, documento, status ou erro" textFormat={textFormat}/>
        <button type="button" onClick={() => void load(true)} title="Atualizar dados da tabela" aria-label="Atualizar dados da tabela" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-50"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}/></button>
        <HeaderSettingsPopover recordsLimit={recordsLimit} setRecordsLimit={setRecordsLimit} allowedLimits={[25,50,100,'all']} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} allColumns={ASTEN_COLUMNS} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} columnOrder={columnOrder} setColumnOrder={setColumnOrder} storageKey="asten_logs" defaultColumnOrder={DEFAULT_ORDER} defaultVisibleColumns={DEFAULT_VISIBLE} defaultRecordsLimit={25} defaultTableTitle="Registros da Asten"/>
      </div>
    </header>
    {loading ? <div className="m-3 rounded-xl border border-slate-300 bg-white p-8 text-center text-xs font-semibold text-slate-500">Carregando fila e histórico da Asten…</div> : shown.length === 0 ? <div className="m-3 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs font-semibold text-slate-500">Nenhum registro da Asten encontrado com os filtros atuais.</div> : <TableScrollWrapper>
      <table className="portal-spreadsheet-table w-full min-w-[1120px] border-collapse text-left text-xs">
        <thead><tr>{activeColumns.map((key) => <th key={key} className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wide">{ASTEN_COLUMNS.find((column) => column.key === key)?.label || key}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-200 bg-white">{shown.map((job) => <tr key={job.id} className="hover:bg-slate-50">{activeColumns.map((key) => <td key={key} className="px-3 py-2 text-slate-700">{renderCell(job, key)}</td>)}</tr>)}</tbody>
      </table>
    </TableScrollWrapper>}
  </div>;
};
