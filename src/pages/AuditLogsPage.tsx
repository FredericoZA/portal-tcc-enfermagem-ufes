import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileCheck2, RefreshCw, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { portalConfirm, portalNotice } from '../services/portalDialogs';
import type { AuditLog } from '../types';
import { SearchPopover } from '../components/SearchPopover';
import { HeaderSettingsPopover } from '../components/HeaderSettingsPopover';
import { loadTableConfig, type ColumnDef } from '../components/TableColumnSelectorPanel';
import { loadGlobalTableConfig, type TableTextFormat } from '../utils/tableFormatters';

const LOG_COLUMNS: ColumnDef[] = [
  { key: 'timestamp', label: 'Data / Hora', isFixed: true },
  { key: 'actorEmail', label: 'Usuário' },
  { key: 'action', label: 'Ação / Atividade' },
  { key: 'reference', label: 'Referência do Trabalho' },
  { key: 'options', label: 'Ações' },
];
const DEFAULT_ORDER = LOG_COLUMNS.map(column => column.key);
const DEFAULT_VISIBLE = Object.fromEntries(LOG_COLUMNS.map(column => [column.key, true]));

export const AuditLogsPage: React.FC = () => {
  const { isMasterAdmin } = useAuth();
  const initialConfig = loadTableConfig('audit_logs', DEFAULT_ORDER, DEFAULT_VISIBLE, 25);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [recordsLimit, setRecordsLimit] = useState<number | 'all'>(initialConfig.recordsLimit || 25);
  const [startDate, setStartDate] = useState(initialConfig.startDate || '');
  const [endDate, setEndDate] = useState(initialConfig.endDate || '');
  const [columnOrder, setColumnOrder] = useState(initialConfig.columnOrder || DEFAULT_ORDER);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(initialConfig.visibleColumns || DEFAULT_VISIBLE);
  const [textFormat] = useState<TableTextFormat>(() => ({ ...loadGlobalTableConfig(), ...(initialConfig.textFormat || {}) }));
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [rollingBack, setRollingBack] = useState('');
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const load = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try { setLogs((await apiClient.getAuditLogs()) || []); }
    catch (error) { console.error('Erro ao carregar logs:', error); portalNotice('Não foi possível carregar o registro de logs.'); }
    finally { if (silent) window.setTimeout(() => setRefreshing(false), 300); else setLoading(false); }
  };
  useEffect(() => { if (isMasterAdmin) void load(); }, [isMasterAdmin]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : 0;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    return logs.filter(log => {
      const timestamp = new Date(log.timestamp).getTime();
      if (Number.isFinite(timestamp) && (timestamp < start || timestamp > end)) return false;
      if (!term) return true;
      return [log.actorEmail, log.action, log.processId, log.entityType, log.entityId].filter(Boolean).join(' ').toLowerCase().includes(term);
    });
  }, [logs, search, startDate, endDate]);
  const shown = recordsLimit === 'all' ? filtered : filtered.slice(0, recordsLimit);
  const activeColumns = columnOrder.filter(key => visibleColumns[key] !== false);

  const downloadBackup = async () => {
    try {
      const backup = await apiClient.getFullBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `backup-portal-tcc-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url);
    } catch (error: any) { portalNotice(`Erro ao gerar backup: ${error?.message || 'falha inesperada'}`); }
  };

  const restoreBackup = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const parsed = JSON.parse(String(event.target?.result || ''));
        if (!parsed.processes && !parsed.settings) throw new Error('Arquivo JSON de backup inválido.');
        const preview = await apiClient.restoreFullBackup(parsed);
        if (!preview.requiresConfirmation || !preview.confirmHash) throw new Error('O servidor não devolveu a prévia segura da restauração.');
        const count = preview.summary?.processCount ?? '?';
        if (!(await portalConfirm(`Backup validado: ${count} processo(s). Master, Presidência e auditoria atual serão preservados. Confirmar restauração?`))) return;
        await apiClient.restoreFullBackup({ ...parsed, confirmHash: preview.confirmHash }); window.location.reload();
      } catch (error: any) { portalNotice(`Erro ao restaurar backup: ${error?.message || 'falha inesperada'}`); }
      finally { if (restoreInputRef.current) restoreInputRef.current.value = ''; }
    };
    reader.readAsText(file);
  };

  const rollback = async (log: AuditLog) => {
    if (!(await portalConfirm('Deseja restaurar o estado registrado neste ponto do histórico?'))) return;
    setRollingBack(log.id);
    try { await apiClient.rollbackAuditLog(log.id); await load(true); }
    catch (error: any) { portalNotice(`Erro ao restaurar registro: ${error?.message || 'falha inesperada'}`); }
    finally { setRollingBack(''); }
  };

  if (!isMasterAdmin) return <section className="rounded-xl border border-slate-300 bg-white p-6 text-sm font-semibold text-slate-700">Registro de logs disponível somente para o usuário Master.</section>;

  const renderCell = (log: AuditLog, key: string) => {
    if (key === 'timestamp') return <span className="font-mono text-[11px] whitespace-nowrap">{new Date(log.timestamp).toLocaleString('pt-BR')}</span>;
    if (key === 'actorEmail') return <span className="font-semibold break-all">{log.actorEmail || 'Sistema'}</span>;
    if (key === 'action') return <span className="inline-flex rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-black uppercase">{log.action || '—'}</span>;
    if (key === 'reference') return <span className="font-mono text-[11px]">{log.processId ? `TCC ${log.processId}` : `${log.entityType || 'Sistema'}${log.entityId ? ` · ${log.entityId}` : ''}`}</span>;
    return <div className="flex justify-end gap-1.5 whitespace-nowrap">
      {(log.before || log.after) && <button type="button" onClick={() => setSelectedLog(log)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold hover:bg-slate-50">Detalhes</button>}
      <button type="button" onClick={() => void rollback(log)} disabled={rollingBack === log.id} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold hover:bg-slate-50 disabled:opacity-50">{rollingBack === log.id ? 'Restaurando…' : 'Restaurar'}</button>
    </div>;
  };

  return <div id="audit-logs-page" className="space-y-0 overflow-hidden rounded-2xl border border-slate-300 bg-[#d5dce0] shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-3 bg-[#005830] px-4 py-3 text-white">
      <div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 shrink-0"/><h1 className="text-sm font-black uppercase tracking-wide">Registro de logs</h1></div>
      <div className="portal-audit-toolbar flex flex-wrap items-center justify-end gap-1.5">
        <div className="portal-audit-actions flex items-center gap-1.5">
          <button type="button" onClick={() => void downloadBackup()} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase text-slate-900 shadow-sm"><Download className="h-3.5 w-3.5"/>Backup</button>
          <button type="button" onClick={() => restoreInputRef.current?.click()} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase text-slate-900 shadow-sm"><Upload className="h-3.5 w-3.5"/>Restaurar</button>
          <input ref={restoreInputRef} type="file" accept=".json,application/json" className="hidden" onChange={event => restoreBackup(event.target.files?.[0])}/>
        </div>
        <div className="portal-audit-table-controls flex items-center gap-1.5">
          <SearchPopover value={search} onChange={setSearch} placeholder="Usuário, ação, processo ou entidade" textFormat={textFormat}/>
          <button type="button" onClick={() => void load(true)} title="Atualizar dados da tabela" aria-label="Atualizar dados da tabela" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-50"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}/></button>
          <HeaderSettingsPopover recordsLimit={recordsLimit} setRecordsLimit={setRecordsLimit} allowedLimits={[25,50,100,'all']} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} allColumns={LOG_COLUMNS} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} columnOrder={columnOrder} setColumnOrder={setColumnOrder} storageKey="audit_logs" defaultColumnOrder={DEFAULT_ORDER} defaultVisibleColumns={DEFAULT_VISIBLE} defaultRecordsLimit={25} defaultTableTitle="Registro de logs"/>
        </div>
      </div>
    </header>

    <div className="portal-audit-table-shell">
      {loading ? <div className="m-3 rounded-xl border border-slate-300 bg-white p-8 text-center text-xs font-semibold text-slate-500">Carregando histórico…</div> : shown.length === 0 ? <div className="m-3 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs font-semibold text-slate-500">Nenhum registro encontrado com os filtros atuais.</div> : <div className="overflow-x-auto bg-white">
        <table className="w-full min-w-[860px] border-collapse text-left text-xs">
          <thead><tr>{activeColumns.map(key => <th key={key} className={`px-3 py-2.5 text-[10px] font-black uppercase tracking-wide ${key === 'options' ? 'text-right' : ''}`}>{LOG_COLUMNS.find(column => column.key === key)?.label || key}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-200">{shown.map(log => <tr key={log.id} className="hover:bg-slate-50">{activeColumns.map(key => <td key={key} className={`px-3 py-2.5 text-slate-700 ${key === 'options' ? 'text-right' : ''}`}>{renderCell(log, key)}</td>)}</tr>)}</tbody>
        </table>
      </div>}
    </div>

    {selectedLog && <div className="fixed inset-0 z-[1000002] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
      <div role="dialog" aria-modal="true" aria-label="Detalhes do registro de log" className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b-2 border-white bg-[#005830] px-4 py-3 text-white"><div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4"/><strong className="text-xs uppercase">Detalhes do registro</strong></div><button type="button" onClick={() => setSelectedLog(null)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-black uppercase text-slate-900">Fechar</button></div>
        <div className="grid max-h-[75vh] gap-3 overflow-y-auto bg-slate-100 p-4 md:grid-cols-2">
          <section className="rounded-xl border border-slate-300 bg-white p-3"><strong className="text-[10px] uppercase text-slate-600">Estado anterior</strong><pre className="mt-2 max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[10px]">{selectedLog.before ? JSON.stringify(selectedLog.before, null, 2) : '(sem estado anterior)'}</pre></section>
          <section className="rounded-xl border border-slate-300 bg-white p-3"><strong className="text-[10px] uppercase text-slate-600">Estado posterior</strong><pre className="mt-2 max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[10px]">{selectedLog.after ? JSON.stringify(selectedLog.after, null, 2) : '(sem estado posterior)'}</pre></section>
        </div>
      </div>
    </div>}
  </div>;
};
