import {formatDateTimeWithWeekday} from '../utils/formatters';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileCheck2, Upload, ListFilter, MailCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { portalConfirm, portalNotice } from '../services/portalDialogs';
import type { AuditLog } from '../types';
import { SearchPopover } from '../components/SearchPopover';
import { HeaderSettingsPopover } from '../components/HeaderSettingsPopover';
import { SettingsWorkspaceHeaderPortal } from '../components/SettingsWorkspaceModal';
import { TableScrollWrapper } from '../components/TableScrollWrapper';
import { loadTableConfig, type ColumnDef } from '../components/TableColumnSelectorPanel';
import { loadGlobalTableConfig, type TableTextFormat } from '../utils/tableFormatters';
import { AuditLogDetails } from '../components/AuditLogDetails';
import { auditActionLabel, auditIsReservationEmailDecision, auditActor, auditReference, auditSearchText, canRestoreAudit, emailAuditData, isEmailAudit, isEmailNotificationAudit } from '../utils/auditLogPresentation';

const LOG_COLUMNS: ColumnDef[] = [
  { key: 'timestamp', label: 'Data / Hora', isFixed: true },
  { key: 'actorEmail', label: 'Usuário' },
  { key: 'action', label: 'Ação / Atividade' },
  { key: 'reference', label: 'Referência do Trabalho' },
  { key: 'options', label: 'Ações' },
];
const DEFAULT_ORDER = LOG_COLUMNS.map(column => column.key);
const DEFAULT_VISIBLE = Object.fromEntries(LOG_COLUMNS.map(column => [column.key, true]));

export const AuditLogsPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { isMasterAdmin } = useAuth();
  const initialConfig = loadTableConfig('audit_logs', DEFAULT_ORDER, DEFAULT_VISIBLE, 25);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<'all' | 'activity' | 'email'>('all');
  const [recordsLimit, setRecordsLimit] = useState<number | 'all'>(initialConfig.recordsLimit || 25);
  const [startDate, setStartDate] = useState(initialConfig.startDate || '');
  const [endDate, setEndDate] = useState(initialConfig.endDate || '');
  const [columnOrder, setColumnOrder] = useState(initialConfig.columnOrder || DEFAULT_ORDER);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(initialConfig.visibleColumns || DEFAULT_VISIBLE);
  const [textFormat] = useState<TableTextFormat>(() => ({ ...loadGlobalTableConfig(), ...(initialConfig.textFormat || {}) }));
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [rollingBack, setRollingBack] = useState('');
  const [recoveringNotices, setRecoveringNotices] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const rows = (await apiClient.getAuditLogs()) || [];
      setLogs(rows);
      setSelectedLog(current => current ? rows.find(row => row.id === current.id) || current : null);
    }
    catch (error) { console.error('Erro ao carregar logs:', error); portalNotice('Não foi possível carregar o registro de logs.'); }
    finally { if (!silent) setLoading(false); }
  };
  useEffect(() => { if (isMasterAdmin) void load(); }, [isMasterAdmin]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : 0;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    return logs.filter(log => {
      const notification = isEmailNotificationAudit(log);
      if ((kind === 'email' && !notification) || (kind === 'activity' && notification)) return false;
      const timestamp = new Date(log.timestamp).getTime();
      if (Number.isFinite(timestamp) && (timestamp < start || timestamp > end)) return false;
      if (!term) return true;
      return auditSearchText(log).includes(term);
    });
  }, [logs, search, startDate, endDate, kind]);
  const shown = filtered;
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

  const recoverReservationNotices = async () => {
    if (recoveringNotices) return;
    setRecoveringNotices(true); setRecoveryMessage('');
    try {
      const result = await apiClient.recoverReservationNotices();
      setRecoveryMessage(result.checked
        ? `${result.checked} aviso(s) processado(s). ${result.checked - result.failed} aceito(s) pelo Gmail e ${result.failed} sem envio confirmado.`
        : 'Nenhum aviso de reserva elegível para reprocessamento neste momento.');
    } catch (error) {
      setRecoveryMessage(error instanceof Error ? error.message : 'Não foi possível confirmar o resultado. Confira os registros antes de repetir.');
    } finally {
      await load(true);
      setRecoveringNotices(false);
    }
  };

  if (!isMasterAdmin) return <section className="rounded-xl border border-slate-300 bg-white p-6 text-sm font-semibold text-slate-700">Registro de logs disponível somente para o usuário Master.</section>;

  const renderCell = (log: AuditLog, key: string) => {
    if (key === 'timestamp') return <span className="font-mono text-[11px] whitespace-nowrap">{formatDateTimeWithWeekday(log.timestamp)}</span>;
    if (key === 'actorEmail') {
      const actor = auditActor(log);
      return <span className="break-words text-[11px] font-semibold">{actor.name}{auditIsReservationEmailDecision(log) && <span className="block text-[10px] font-normal text-slate-600">Destinatário do link de resposta</span>}{actor.email && actor.email !== actor.name && <span className="mt-0.5 block break-all text-[10px] font-normal text-slate-600">{actor.email}</span>}</span>;
    }
    if (key === 'action') {
      const email = isEmailAudit(log) ? emailAuditData(log) : null;
      return <span className="block font-semibold text-[11px] normal-case text-slate-900">{auditActionLabel(log)}{email && <span className="mt-0.5 block max-w-[52ch] truncate text-[10px] font-normal text-slate-600" title={`${email.subject} · ${email.recipient}`}>{email.subject}<span className="block truncate">{email.recipient}</span></span>}</span>;
    }
    if (key === 'reference') {
      const reference = auditReference(log);
      return <span className="block min-w-0 text-[11px] font-semibold">{reference.title}{reference.detail && <span className="mt-0.5 block max-w-[52ch] truncate text-[10px] font-normal text-slate-600" title={reference.detail}>{reference.detail}</span>}</span>;
    }
    return <div className="flex justify-center gap-1.5 whitespace-nowrap">
      <button type="button" onClick={() => setSelectedLog(log)} className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[9px] font-bold hover:bg-slate-50">Detalhes</button>
      {canRestoreAudit(log) && <button type="button" onClick={() => void rollback(log)} disabled={rollingBack === log.id} className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[9px] font-bold hover:bg-slate-50 disabled:opacity-50">{rollingBack === log.id ? 'Restaurando…' : 'Restaurar'}</button>}
    </div>;
  };

  const toolbar = <div className="portal-audit-toolbar flex flex-wrap items-center justify-end gap-1.5">
    <label className="portal-settings-header-selector text-[10px]" title="Filtrar registro de logs">
      <ListFilter className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <select aria-label="Tipo de registro" value={kind} onChange={event => setKind(event.target.value as 'all' | 'activity' | 'email')}>
        <option value="all">Todos os registros</option><option value="activity">Atividades do Portal</option><option value="email">E-mails e notificações</option>
      </select>
    </label>
    <button type="button" onClick={() => void recoverReservationNotices()} disabled={loading || recoveringNotices} className="portal-settings-header-selector inline-flex items-center gap-1.5 text-[10px] disabled:opacity-50" title="Tentar enviar os avisos de reserva que ainda estão pendentes" aria-label="Reprocessar avisos de reserva"><MailCheck className={`h-3.5 w-3.5${recoveringNotices ? ' animate-pulse' : ''}`} aria-hidden="true"/><span>{recoveringNotices ? 'Reprocessando avisos…' : 'Reprocessar avisos'}</span></button>
    <button type="button" onClick={() => void downloadBackup()} className="portal-toolbar-icon-button" title="Baixar backup JSON" aria-label="Baixar backup JSON"><Download className="h-3.5 w-3.5"/></button>
    <button type="button" onClick={() => restoreInputRef.current?.click()} className="portal-toolbar-icon-button" title="Restaurar backup JSON" aria-label="Restaurar backup JSON"><Upload className="h-3.5 w-3.5"/></button>
    <input ref={restoreInputRef} type="file" accept=".json,application/json" className="hidden" onChange={event => restoreBackup(event.target.files?.[0])}/>
    <span className="portal-toolbar-group-divider" role="separator" aria-orientation="vertical" />
    <SearchPopover value={search} onChange={setSearch} placeholder="Nome, e-mail, atividade ou TCC" textFormat={textFormat}/>
    <HeaderSettingsPopover recordsLimit={recordsLimit} setRecordsLimit={setRecordsLimit} allowedLimits={[25,50,100,'all']} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} allColumns={LOG_COLUMNS} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} columnOrder={columnOrder} setColumnOrder={setColumnOrder} storageKey="audit_logs" defaultColumnOrder={DEFAULT_ORDER} defaultVisibleColumns={DEFAULT_VISIBLE} defaultRecordsLimit={25} defaultTableTitle="Registro de logs"/>
  </div>;

  return <div id="audit-logs-page" data-settings-sheet="true" data-embedded={embedded ? 'true' : 'false'} className={embedded ? 'flex min-h-0 flex-col' : 'space-y-0 overflow-hidden rounded-2xl border border-slate-300 shadow-sm'} style={{ backgroundColor: embedded ? 'var(--portal-surface-panel)' : 'var(--portal-surface-page)' }}>
    {embedded ? <SettingsWorkspaceHeaderPortal>{toolbar}</SettingsWorkspaceHeaderPortal> : <header className="flex flex-wrap items-center justify-between gap-3 border-b-[16px] border-white px-4 py-3 text-white" style={{ backgroundColor: 'var(--portal-brand-header)' }}><div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 shrink-0"/><h1 className="text-sm font-black normal-case tracking-wide">Registro de logs</h1></div>{toolbar}</header>}

    <div className="portal-audit-table-shell flex min-h-0 flex-1 flex-col">
      {recoveryMessage && <p role="status" className="border-b border-slate-300 px-4 py-3 text-xs leading-5 text-slate-800">{recoveryMessage}</p>}
      <TableScrollWrapper fillHeight>
        <table className="portal-spreadsheet-table portal-audit-table w-full min-w-[860px] border-collapse text-center text-xs">
          <thead><tr>{activeColumns.map(key => <th key={key} data-portal-column-key={key} className={`px-3 py-1.5 text-[10px] font-black normal-case tracking-wide ${key === 'options' ? 'text-center' : ''}`}>{LOG_COLUMNS.find(column => column.key === key)?.label || key}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-200">{(loading || shown.length === 0) && <tr><td colSpan={activeColumns.length} className="portal-sheet-empty-cell" role="status">{loading ? 'Carregando histórico…' : 'Nenhum registro encontrado com os filtros atuais.'}</td></tr>}{shown.map(log => <tr key={log.id}>{activeColumns.map(key => <td key={key} className={`px-3 py-1 text-slate-950 ${key === 'options' ? 'text-center' : ''}`}>{renderCell(log, key)}</td>)}</tr>)}</tbody>
        </table>
      </TableScrollWrapper>
    </div>

    {selectedLog && <AuditLogDetails log={selectedLog} onClose={() => setSelectedLog(null)} onRefresh={() => load(true)} />}
  </div>;
};
