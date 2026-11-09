import {AuditDocumentSummary} from '../components/AuditDocumentSummary';
import {WorkflowRecoveryPanel} from '../components/WorkflowRecoveryPanel';
import {formatAuditTimestamp} from '../utils/formatters';
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Download, FileCheck2, Upload, ListFilter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient, ApiRequestError } from '../services/apiClient';
import { portalConfirm, portalNotice } from '../services/portalDialogs';
import type { AuditLog } from '../types';
import { SearchPopover } from '../components/SearchPopover';
import { HeaderSettingsPopover } from '../components/HeaderSettingsPopover';
import { SettingsWorkspaceHeaderPortal } from '../components/SettingsWorkspaceModal';
import { TableScrollWrapper } from '../components/TableScrollWrapper';
import { loadTableConfig, type ColumnDef } from '../components/TableColumnSelectorPanel';
import { loadGlobalTableConfig, type TableTextFormat } from '../utils/tableFormatters';
import { AuditLogDetails } from '../components/AuditLogDetails';
import { auditLogPageReducer, auditLogPageView, initialAuditLogPageState, waitForAuditLogRetry } from '../utils/auditLogPageState';
import { auditActionLabel, auditIsReservationEmailDecision, auditActor, auditReference, canRestoreAudit, emailAuditData, isEmailAudit } from '../utils/auditLogPresentation';

const LOG_COLUMNS: ColumnDef[] = [
  { key: 'timestamp', label: 'Data / Hora', isFixed: true },
  { key: 'actorEmail', label: 'Usuário' },
  { key: 'action', label: 'Ação / Atividade' },
  { key: 'reference', label: 'Referência do Trabalho' },
  { key: 'options', label: 'Ações' },
];
const MOBILE_CELLS: Record<string, string> = { timestamp: 'summary', options: 'actions' };
const DEFAULT_ORDER = LOG_COLUMNS.map(column => column.key);
const DEFAULT_VISIBLE = Object.fromEntries(LOG_COLUMNS.map(column => [column.key, true]));

export const AuditLogsPage: React.FC<{ embedded?: boolean; processId?:string }> = ({ embedded = false,processId }) => {
  const { isMasterAdmin, isAuthenticated, userEmail } = useAuth();
  const identityKey = isMasterAdmin && isAuthenticated ? userEmail.trim().toLocaleLowerCase('pt-BR') : '';
  const initialConfig = loadTableConfig('audit_logs', DEFAULT_ORDER, DEFAULT_VISIBLE, 25);
  const [pageState, dispatchPage] = useReducer(auditLogPageReducer, undefined, initialAuditLogPageState);
  const [search, setSearch] = useState('');
  const [remindersOpen,setRemindersOpen]=useState(false);
  const [kind, setKind] = useState<'all' | 'activity' | 'email'>('all');
  const [recordsLimit, setRecordsLimit] = useState<number | 'all'>(initialConfig.recordsLimit || 25);
  const [startDate, setStartDate] = useState(initialConfig.startDate || '');
  const [endDate, setEndDate] = useState(initialConfig.endDate || '');
  const [columnOrder, setColumnOrder] = useState(initialConfig.columnOrder || DEFAULT_ORDER);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(initialConfig.visibleColumns || DEFAULT_VISIBLE);
  const [textFormat] = useState<TableTextFormat>(() => ({ ...loadGlobalTableConfig(), ...(initialConfig.textFormat || {}) }));
  const [selectedLogSelection, setSelectedLogSelection] = useState<{key: string; log: AuditLog} | null>(null);
  const [rollingBack, setRollingBack] = useState('');
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const queryKey = JSON.stringify([identityKey, search.trim(), kind, startDate, endDate,processId]);
  const currentQueryKey = useRef(queryKey);
  currentQueryKey.current = queryKey;
  const selectedLog = identityKey && selectedLogSelection?.key === queryKey ? selectedLogSelection.log : null;
  const view = auditLogPageView(pageState, identityKey ? queryKey : '');
  const {items: shown, nextCursor, total, loading, loadingOlder, error: loadError} = view;

  const load = useCallback(async ({silent = false, before, focusId}: {silent?: boolean; before?: string; focusId?: string} = {}) => {
    if (!identityKey || currentQueryKey.current !== queryKey) return;
    request.current?.abort();
    const controller = new AbortController();
    const requestId = ++requestSequence.current;
    request.current = controller;
    const isCurrent = () => !controller.signal.aborted && request.current === controller && currentQueryKey.current === queryKey;
    dispatchPage({type:'start', key:queryKey, requestId, mode:before ? 'append' : silent ? 'refresh' : 'replace', before});
    try {
      let page: Awaited<ReturnType<typeof apiClient.getAuditLogPage>> | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!isCurrent()) return;
        try {
          page = await apiClient.getAuditLogPage({q:search.trim(), kind, start:startDate, end:endDate, before, focusId,processId}, controller.signal);
          break;
        } catch (error) {
          const retryAfter = error instanceof ApiRequestError ? error.retryAfterSeconds : undefined;
          const busy = attempt === 0 && error instanceof ApiRequestError && error.status === 503 && error.code === 'RUNTIME_BUSY'
            && typeof retryAfter === 'number' && Number.isFinite(retryAfter) && retryAfter >= 0 && retryAfter <= 30;
          if (!busy || !isCurrent()) throw error;
          await waitForAuditLogRetry(controller.signal, retryAfter * 1000 + 100 + Math.floor(Math.random() * 150));
        }
      }
      if (!page) return;
      if (!isCurrent()) return;
      dispatchPage({type:'success', key:queryKey, requestId, page});
      if (focusId) setSelectedLogSelection(current => current?.key === queryKey && current.log.id === focusId
        ? page.focused ? {key:queryKey, log:page.focused} : null : current);
    }
    catch (error) {
      if (!isCurrent()) return;
      const message = error instanceof ApiRequestError && [401,403].includes(error.status)
        ? 'Não foi possível confirmar seu acesso ao registro de logs. Confira a sessão Master.'
        : error instanceof ApiRequestError && [429,503].includes(error.status)
          ? 'O registro de logs está temporariamente indisponível. Aguarde alguns segundos e tente carregar novamente.'
          : 'Não foi possível carregar o registro de logs. Os registros não foram confirmados; tente carregar novamente.';
      dispatchPage({type:'failure', key:queryKey, requestId, message});
    }
  }, [identityKey, queryKey, search, kind, startDate, endDate,processId]);
  useEffect(() => {
    setSelectedLogSelection(null);
    if (!identityKey) {
      request.current?.abort();
      dispatchPage({type:'reset'});
      return;
    }
    const timer = window.setTimeout(() => void load(), search.trim() ? 300 : 0);
    return () => {
      window.clearTimeout(timer);
      request.current?.abort();
    };
  }, [identityKey, load, search]);

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
    try { await apiClient.rollbackAuditLog(log.id); await load({silent:true, focusId:selectedLog?.id}); }
    catch (error: any) { portalNotice(`Erro ao restaurar registro: ${error?.message || 'falha inesperada'}`); }
    finally { setRollingBack(''); }
  };

  if (!identityKey) return <section className="rounded-xl border border-slate-300 bg-white p-6 text-sm font-semibold text-slate-700">Registro de logs disponível somente para o usuário Master.</section>;

  const renderCell = (log: AuditLog, key: string, timestamp: string) => {
    if (key === 'timestamp') return <>
      <span className="portal-record-desktop-label font-mono text-[11px] whitespace-nowrap">{timestamp}</span>
      <div className="portal-record-summary">
        <strong className="block">{auditActionLabel(log)}</strong>
        <span className="block text-slate-600">{timestamp}</span>
        <span className="block">{auditReference(log).title}</span>
      </div>
    </>;
    if (key === 'actorEmail') {
      const actor = auditActor(log);
      return <span className="break-words text-[11px] font-semibold">{actor.name}{auditIsReservationEmailDecision(log) && <span className="block text-[10px] font-normal text-slate-600">Destinatário do link de resposta</span>}{actor.email && actor.email !== actor.name && <span className="mt-0.5 block break-all text-[10px] font-normal text-slate-600">{actor.email}</span>}</span>;
    }
    if (key === 'action') {
      const email = isEmailAudit(log) ? emailAuditData(log) : null;
      return <span className="block font-semibold text-[11px] normal-case text-slate-900">{auditActionLabel(log)}<AuditDocumentSummary log={log}/>{email && <span className="mt-0.5 block max-w-[52ch] truncate text-[10px] font-normal text-slate-600" title={`${email.subject} · ${email.recipient}`}>{email.subject}<span className="block truncate">{email.recipient}</span></span>}</span>;
    }
    if (key === 'reference') {
      const reference = auditReference(log);
      return <span className="block min-w-0 text-[11px] font-semibold">{reference.title}{reference.detail && <span className="mt-0.5 block max-w-[52ch] truncate text-[10px] font-normal text-slate-600" title={reference.detail}>{reference.detail}</span>}</span>;
    }
    return <div className="portal-record-actions flex justify-center gap-1.5 whitespace-nowrap">
      <button type="button" onClick={() => setSelectedLogSelection({key:queryKey, log})} className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[9px] font-bold hover:bg-slate-50">
        {log.emailDeliveryId && log.processId && isEmailAudit(log) && emailAuditData(log).canRetry ? 'Reenviar e-mail' : 'Detalhes'}
      </button>
      {canRestoreAudit(log) && <button type="button" onClick={() => void rollback(log)} disabled={rollingBack === log.id} className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[9px] font-bold hover:bg-slate-50 disabled:opacity-50">{rollingBack === log.id ? 'Restaurando…' : 'Restaurar'}</button>}
    </div>;
  };

  const toolbar = <div className="portal-audit-toolbar flex flex-wrap items-center justify-end gap-1.5">
    <label className="portal-settings-header-selector !h-8 !min-h-8 !gap-1 !px-2 !py-0 text-[10px]" title="Filtrar registro de logs">
      <ListFilter className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <select className="!w-[138px] !min-w-0 !text-[10px]" aria-label="Tipo de registro" value={kind} onChange={event => setKind(event.target.value as 'all' | 'activity' | 'email')}>
        <option value="all">Todos os registros</option><option value="activity">Atividades do Portal</option><option value="email">E-mails e notificações</option>
      </select>
    </label>
    {!processId&&<><button type="button" onClick={() => void downloadBackup()} className="portal-toolbar-icon-button" title="Baixar backup JSON" aria-label="Baixar backup JSON"><Download className="h-3.5 w-3.5"/></button>
    <button type="button" onClick={() => restoreInputRef.current?.click()} className="portal-toolbar-icon-button" title="Restaurar backup JSON" aria-label="Restaurar backup JSON"><Upload className="h-3.5 w-3.5"/></button>
    <input ref={restoreInputRef} type="file" accept=".json,application/json" className="hidden" onChange={event => restoreBackup(event.target.files?.[0])}/></>}
    <span className="portal-toolbar-group-divider" role="separator" aria-orientation="vertical" />
    <SearchPopover value={search} onChange={setSearch} placeholder="Nome, e-mail, atividade ou TCC" textFormat={textFormat}/>
    <HeaderSettingsPopover recordsLimit={recordsLimit} setRecordsLimit={setRecordsLimit} allowedLimits={[25,50,100,'all']} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} allColumns={LOG_COLUMNS} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} columnOrder={columnOrder} setColumnOrder={setColumnOrder} storageKey="audit_logs" defaultColumnOrder={DEFAULT_ORDER} defaultVisibleColumns={DEFAULT_VISIBLE} defaultRecordsLimit={25} defaultTableTitle="Registro de logs"/>
  </div>;

  return <div id="audit-logs-page" data-settings-sheet="true" data-embedded={embedded ? 'true' : 'false'} className={embedded ? 'flex min-h-0 flex-col' : 'space-y-0 overflow-hidden rounded-2xl border border-slate-300 shadow-sm'} style={{ backgroundColor: embedded ? 'var(--portal-surface-panel)' : 'var(--portal-surface-page)' }}>
    {embedded&&!processId ? <SettingsWorkspaceHeaderPortal>{toolbar}</SettingsWorkspaceHeaderPortal> : <header className="flex flex-wrap items-center justify-between gap-3 border-b-[16px] border-white px-4 py-3 text-white" style={{ backgroundColor: 'var(--portal-brand-header)' }}><div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 shrink-0"/><h1 className="text-sm font-black normal-case tracking-wide">{processId?'Registro de logs deste TCC':'Registro de logs'}</h1></div>{toolbar}</header>}

    {identityKey&&!processId&&<details className="m-3 rounded-lg border border-slate-300 p-3" onToggle={event=>setRemindersOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer font-semibold">Prazos e histórico de lembretes</summary>
      {remindersOpen&&<div key={identityKey} className="mt-3"><WorkflowRecoveryPanel historyOnly/></div>}
    </details>}
    <div className="portal-audit-table-shell flex min-h-0 flex-1 flex-col">
      {view.showCount && <p role="status" className="px-3 py-1 text-[10px] font-semibold text-slate-700">{shown.length} de {total} registros</p>}
      {loadError && <div role="alert" className="portal-error m-3 rounded-lg border p-3 text-xs">
        <p>{loadError}</p>
        {shown.length > 0 && <p className="mt-1">Os registros abaixo pertencem à última consulta confirmada; a atualização não foi concluída.</p>}
        <button type="button" className="portal-action mt-2" disabled={loading} onClick={() => void load({before:view.retryBefore})}>Tentar carregar novamente</button>
      </div>}
      <TableScrollWrapper fillHeight>
        <table className="portal-spreadsheet-table portal-responsive-records portal-audit-table w-full min-w-[860px] border-collapse text-center text-xs">
          <thead><tr>{activeColumns.map(key => <th key={key} data-portal-column-key={key} data-portal-mobile-cell={MOBILE_CELLS[key]} className={`px-3 py-1.5 text-[10px] font-black normal-case tracking-wide ${key === 'options' ? 'text-center' : ''}`}>{LOG_COLUMNS.find(column => column.key === key)?.label || key}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-200">{((loading && !loadingOlder) || view.showEmpty) && <tr><td colSpan={activeColumns.length} className="portal-sheet-empty-cell" role="status">{loading ? 'Carregando histórico…' : 'Nenhum registro encontrado com os filtros atuais.'}</td></tr>}{shown.map(log => {
            const timestamp = formatAuditTimestamp(log.timestamp);
            return <tr key={log.id} data-portal-row-id={log.id}>{activeColumns.map(key => <td key={key} data-portal-mobile-cell={MOBILE_CELLS[key]} data-portal-filter-value={key === 'timestamp' ? timestamp : undefined} data-portal-sort-value={key === 'timestamp' ? String(Date.parse(log.timestamp) || 0) : undefined} className={`px-3 py-1 text-slate-950 ${key === 'options' ? 'text-center' : ''}`}>{renderCell(log, key, timestamp)}</td>)}</tr>;
          })}</tbody>
        </table>
      </TableScrollWrapper>
      {nextCursor && <div className="flex justify-center border-t border-slate-300 p-2">
        <button type="button" className="portal-action" disabled={loading || loadingOlder} onClick={() => void load({before:nextCursor})}>
          {loadingOlder ? 'Carregando…' : 'Carregar registros anteriores'}
        </button>
      </div>}
    </div>

    {selectedLog && <AuditLogDetails log={selectedLog} onClose={() => setSelectedLogSelection(null)} onRefresh={() => load({silent:true, focusId:selectedLog.id})} />}
  </div>;
};
