import React, {useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowDown, ArrowUp, CalendarDays, Columns3, Download, LoaderCircle} from 'lucide-react';
import {reservationPeriodError, type ReservationPeriod} from '../utils/confirmedReservations';
import type {TableExportFormat, TableExportSnapshot} from '../utils/tableExportFiles';

interface TableExportPopoverProps {
  getSnapshot: (period: ReservationPeriod, columns: string[]) => TableExportSnapshot | null;
  fileName: string;
  initialPeriod: ReservationPeriod;
  optionalPeriod?: boolean;
  triggerLabel: string;
  columns: {key: string; label: string}[];
  visibleColumns: Record<string, boolean>;
  disabled?: boolean;
  /** Cancels an in-flight file when the viewer's access context changes. */
  contextKey?: string;
}

const formats: {format: TableExportFormat; label: string}[] = [
  {format: 'xlsx', label: 'Excel'},
  {format: 'csv', label: 'CSV'},
  {format: 'pdf', label: 'PDF'},
];

export const TableExportPopover: React.FC<TableExportPopoverProps> = ({
  getSnapshot, fileName, initialPeriod, optionalPeriod = false, triggerLabel,
  columns, visibleColumns, disabled = false, contextKey = '',
}) => {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);
  const busyRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({top: 12, left: 12, maxHeight: 600});
  const [period, setPeriod] = useState<ReservationPeriod>({startDate: '', endDate: ''});
  const [order, setOrder] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [selectedFormats, setSelectedFormats] = useState<Set<TableExportFormat>>(new Set(['xlsx']));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const {startDate, endDate} = period;
  const periodError = optionalPeriod
    ? startDate || endDate ? reservationPeriodError({startDate: startDate || endDate, endDate: endDate || startDate}) : ''
    : reservationPeriodError(period);
  const columnLabels = new Map(columns.map(column => [column.key, column.label]));
  const fileFormats = formats.filter(({format}) => selectedFormats.has(format));
  const downloadLabel = fileFormats.length > 1 ? 'Baixar ZIP'
    : fileFormats.length === 1 ? `Baixar ${fileFormats[0].label}` : 'Baixar';

  useLayoutEffect(() => {
    busyRef.current = false;
    setBusy(false);
    setOpen(false);
    setError('');
    setMessage('');
    return () => {requestRef.current += 1;};
  }, [contextKey, disabled]);

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus({preventScroll: true});
  };

  const toggle = () => {
    if (open) {close(); return;}
    setPeriod(initialPeriod);
    setOrder(columns.map(column => column.key));
    setSelectedColumns(new Set(columns.filter(column => visibleColumns[column.key]).map(column => column.key)));
    setSelectedFormats(new Set(['xlsx']));
    setError('');
    setMessage('');
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!buttonRef.current || !popupRef.current) return;
      const button = buttonRef.current.getBoundingClientRect();
      const width = popupRef.current.getBoundingClientRect().width;
      const maxHeight = window.innerHeight - 24;
      const height = Math.min(popupRef.current.offsetHeight, maxHeight);
      const left = Math.max(12, Math.min(button.left, window.innerWidth - width - 12));
      const top = button.bottom + height + 8 <= window.innerHeight - 12
        ? button.bottom + 8
        : Math.max(12, Math.min(button.top - height - 8, window.innerHeight - height - 12));
      setPosition(previous => previous.top === top && previous.left === left && previous.maxHeight === maxHeight
        ? previous : {top, left, maxHeight});
    };
    const reanchor = (event: Event) => {
      if (!popupRef.current?.contains(event.target as Node)) place();
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', reanchor, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', reanchor, true);
    };
  }, [open, error, message, periodError]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => popupRef.current?.querySelector('input')?.focus({preventScroll: true}));
    const outside = (event: Event) => {
      if (!popupRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {event.preventDefault(); close(true);}
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', key);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  const moveColumn = (index: number, direction: -1 | 1) => {
    const next = [...order];
    const target = index + direction;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  };

  const download = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busyRef.current || disabled || periodError || !selectedColumns.size || !selectedFormats.size) return;
    const request = ++requestRef.current;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const snapshot = getSnapshot(period, order.filter(key => selectedColumns.has(key)));
      if (!snapshot?.rows.length || !snapshot.columns.length) throw new Error('Nenhum registro disponível para o período e os filtros selecionados.');
      const {createTableExportFile} = await import('../utils/tableExportFiles');
      const safeName = fileName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+/, '').trim() || 'lista-de-defesas';
      const periodSuffix = startDate && endDate ? `${startDate}-a-${endDate}`
        : startDate ? `desde-${startDate}` : endDate ? `ate-${endDate}` : '';
      const baseName = [safeName, periodSuffix].filter(Boolean).join('-');
      const files = [];
      for (const {format} of fileFormats) {
        if (request !== requestRef.current) return;
        files.push(await createTableExportFile(snapshot, format));
      }
      let {bytes, mimeType, extension} = files[0];
      if (files.length > 1) {
        const {default: JSZip} = await import('jszip');
        const archive = new JSZip();
        for (const file of files) archive.file(`${baseName}.${file.extension}`, file.bytes);
        bytes = await archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
        mimeType = 'application/zip';
        extension = 'zip';
      }
      if (request !== requestRef.current) return;
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], {type: mimeType}));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}.${extension}`;
      document.body.appendChild(link);
      try {link.click();} finally {link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000);}
      setMessage(files.length === 1 ? 'Arquivo preparado para download.' : 'Arquivos preparados em um ZIP.');
    } catch (cause) {
      if (request === requestRef.current) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível gerar o arquivo. Tente novamente.');
      }
    } finally {
      if (request === requestRef.current) {busyRef.current = false; setBusy(false);}
    }
  };

  return <>
    <button ref={buttonRef} type="button" onClick={toggle} disabled={disabled || busy}
      className="portal-toolbar-icon-button portal-table-export-trigger"
      title={triggerLabel} aria-label={triggerLabel}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}>
      {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true"/> : <Download className="h-3.5 w-3.5" aria-hidden="true"/>}
    </button>
    {open && createPortal(
      <div ref={popupRef} id={id} role="dialog" aria-labelledby={`${id}-title`}
        className="portal-table-settings-popover portal-modal-surface portal-table-export-popover" style={position}>
        <div className="portal-settings-popover-header">
          <h3 id={`${id}-title`} className="flex items-center gap-1.5 text-[10.5px] font-black normal-case tracking-wider text-white"><Download className="h-3.5 w-3.5" aria-hidden="true"/>Baixar lista</h3>
        </div>
        <div className="portal-modal-divider" aria-hidden="true"/>
        <form className="portal-settings-popover-body" onSubmit={download} noValidate>
          <fieldset className="portal-table-export-period" disabled={busy}>
            <legend className="portal-settings-control-title flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true"/>Período da defesa</legend>
            <div className="portal-settings-date-grid">
              <label className="portal-settings-date-field">
                <span>Data de início</span>
                <input type="date" required={!optionalPeriod} value={period.startDate} aria-invalid={Boolean(periodError)}
                  aria-describedby={periodError ? `${id}-period-error` : undefined}
                  onChange={event => setPeriod({...period, startDate: event.currentTarget.value})}/>
              </label>
              <label className="portal-settings-date-field">
                <span>Data de fim</span>
                <input type="date" required={!optionalPeriod} value={period.endDate} min={period.startDate} aria-invalid={Boolean(periodError)}
                  aria-describedby={periodError ? `${id}-period-error` : undefined}
                  onChange={event => setPeriod({...period, endDate: event.currentTarget.value})}/>
              </label>
            </div>
            {optionalPeriod && <p className="mt-1 text-xs text-slate-600">Datas opcionais</p>}
            {periodError && <p id={`${id}-period-error`} role="alert" className="portal-table-export-error">{periodError}</p>}
          </fieldset>
          <fieldset className="portal-table-export-formats" disabled={busy}>
            <legend className="portal-settings-control-title">Formatos</legend>
            <div className="portal-settings-page-size-options">
              {formats.map(({format, label}) => <button key={format} type="button"
                className="portal-settings-page-size-button" aria-pressed={selectedFormats.has(format)} data-selected={selectedFormats.has(format)}
                onClick={() => setSelectedFormats(previous => {
                  const next = new Set(previous);
                  if (next.has(format)) next.delete(format); else next.add(format);
                  return next;
                })}>{label}</button>)}
            </div>
          </fieldset>
          <section className="portal-settings-columns-card" aria-labelledby={`${id}-columns`}>
            <h4 id={`${id}-columns`} className="mb-2 flex items-center gap-1.5 portal-settings-control-title"><Columns3 className="h-3.5 w-3.5" aria-hidden="true"/>Colunas e ordem</h4>
            <div className="portal-settings-column-grid">
              {order.map((key, index) => {
                const shown = selectedColumns.has(key);
                const label = columnLabels.get(key) || key;
                return <div key={key} className="portal-settings-column-item" data-visible={shown}>
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-[9.5px] font-semibold">
                    <input type="checkbox" checked={shown} disabled={busy} onChange={event => {
                      const next = new Set(selectedColumns);
                      if (event.currentTarget.checked) next.add(key); else next.delete(key);
                      setSelectedColumns(next);
                    }} className="h-3.5 w-3.5"/>
                    <span className="truncate" title={label}>{label}</span>
                  </label>
                  <div className="flex items-center">
                    <button type="button" disabled={busy || index === 0} onClick={() => moveColumn(index, -1)}
                      className="rounded p-1 text-slate-600 hover:bg-[var(--portal-surface-card)] disabled:opacity-20" aria-label={`Mover ${label} para cima`}><ArrowUp className="h-3.5 w-3.5"/></button>
                    <button type="button" disabled={busy || index === order.length - 1} onClick={() => moveColumn(index, 1)}
                      className="rounded p-1 text-slate-600 hover:bg-[var(--portal-surface-card)] disabled:opacity-20" aria-label={`Mover ${label} para baixo`}><ArrowDown className="h-3.5 w-3.5"/></button>
                  </div>
                </div>;
              })}
            </div>
          </section>
          {error && <p role="alert" className="portal-table-export-error">{error}</p>}
          {message && <p role="status" className="portal-table-export-status">{message}</p>}
          <div className="portal-settings-footer justify-end">
            <button type="button" onClick={() => close(true)} className="portal-core-clear-filter">Fechar</button>
            <button type="submit" className="portal-core-done disabled:opacity-50"
              disabled={busy || Boolean(periodError) || !selectedColumns.size || !selectedFormats.size}>
              {busy ? 'Preparando…' : downloadLabel}
            </button>
          </div>
        </form>
      </div>, document.body)}
  </>;
};
