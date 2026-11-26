import React, {useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Download, FileSpreadsheet, FileText, FileType2, LoaderCircle, X} from 'lucide-react';
import type {TableExportFormat, TableExportSnapshot} from '../utils/tableExportFiles';

interface TableExportPopoverProps {
  getSnapshot: () => TableExportSnapshot | null;
  fileName: string;
  disabled?: boolean;
  /** Cancels an in-flight file when the viewer's access context changes. */
  contextKey?: string;
}

const formats = [
  {format: 'xlsx' as const, label: 'Excel', extension: '.xlsx', description: 'Planilha editável, com cabeçalhos e filtros.', Icon: FileSpreadsheet},
  {format: 'csv' as const, label: 'CSV', extension: '.csv', description: 'Dados para abrir em outras planilhas.', Icon: FileType2},
  {format: 'pdf' as const, label: 'PDF', extension: '.pdf', description: 'Documento para imprimir e compartilhar.', Icon: FileText},
];

export const TableExportPopover: React.FC<TableExportPopoverProps> = ({getSnapshot, fileName, disabled = false, contextKey = ''}) => {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const requestRef = useRef(0);
  const busyRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({top: 0, left: 0, width: 336, maxHeight: 480});
  const [summary, setSummary] = useState({rows: 0, columns: 0});
  const [busy, setBusy] = useState<TableExportFormat | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    mountedRef.current = true;
    return () => {mountedRef.current = false; requestRef.current += 1;};
  }, []);

  useEffect(() => {
    requestRef.current += 1;
    busyRef.current = false;
    setBusy(null);
    setOpen(false);
    setError('');
    setMessage('');
  }, [contextKey, disabled]);

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  const toggle = () => {
    if (open) {close(); return;}
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(336, window.innerWidth - 24);
    const maxHeight = Math.min(480, window.innerHeight - 24);
    const height = Math.min(370, maxHeight);
    const top = rect.bottom + height + 8 <= window.innerHeight - 12
      ? rect.bottom + 8
      : Math.max(12, rect.top - height - 8);
    setPosition({top, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)), width, maxHeight});
    try {
      const snapshot = getSnapshot();
      setSummary({rows: snapshot?.rows.length ?? 0, columns: snapshot?.columns.length ?? 0});
      setError('');
    } catch {
      setSummary({rows: 0, columns: 0});
      setError('Não foi possível preparar a lista. Feche e tente novamente.');
    }
    setMessage('');
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open || !popupRef.current || !buttonRef.current) return;
    const button = buttonRef.current.getBoundingClientRect();
    const height = Math.min(popupRef.current.getBoundingClientRect().height, window.innerHeight - 24);
    const top = button.bottom + height + 8 <= window.innerHeight - 12
      ? button.bottom + 8
      : Math.max(12, Math.min(button.top - height - 8, window.innerHeight - height - 12));
    setPosition(previous => previous.top === top ? previous : {...previous, top});
  }, [open, summary.rows, summary.columns, message, error]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const first = popupRef.current?.querySelector<HTMLButtonElement>('[data-export-format]:not(:disabled)') || popupRef.current?.querySelector<HTMLButtonElement>('button');
      first?.focus({preventScroll: true});
    });
    const outside = (event: PointerEvent) => {
      if (!popupRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const focusOutside = (event: FocusEvent) => {
      if (!popupRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {event.preventDefault(); setOpen(false); buttonRef.current?.focus();}
    };
    const resize = () => setOpen(false);
    const scroll = (event: Event) => {if (!popupRef.current?.contains(event.target as Node)) setOpen(false);};
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('focusin', focusOutside);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', scroll, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', focusOutside);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [open]);

  const download = async (format: TableExportFormat) => {
    if (busyRef.current || disabled) return;
    const request = ++requestRef.current;
    busyRef.current = true;
    setBusy(format);
    setError('');
    setMessage('');
    try {
      // Read at the click, after any change made in the table's own controls.
      const snapshot = getSnapshot();
      if (!snapshot?.rows.length || !snapshot.columns.length) throw new Error('Nenhuma defesa disponível para os filtros selecionados.');
      setSummary({rows: snapshot.rows.length, columns: snapshot.columns.length});
      const {createTableExportFile} = await import('../utils/tableExportFiles');
      const file = await createTableExportFile(snapshot, format);
      if (!mountedRef.current || request !== requestRef.current) return;
      const blob = new Blob([new Uint8Array(file.bytes)], {type: file.mimeType});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = fileName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+/, '').trim() || 'lista-de-defesas';
      link.download = `${safeName}.${file.extension}`;
      document.body.appendChild(link);
      try {link.click();} finally {link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000);}
      setMessage(`Arquivo ${format.toUpperCase()} preparado para download.`);
    } catch (cause) {
      if (mountedRef.current && request === requestRef.current) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível gerar o arquivo. Tente novamente.');
      }
    } finally {
      if (mountedRef.current && request === requestRef.current) {busyRef.current = false; setBusy(null);}
    }
  };

  const unavailable = !summary.rows || !summary.columns;
  return <>
    <button ref={buttonRef} type="button" onClick={toggle} disabled={disabled}
      className="portal-toolbar-icon-button portal-table-export-trigger"
      title="Baixar lista de defesas" aria-label="Baixar lista de defesas"
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}>
      {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true"/> : <Download className="h-3.5 w-3.5" aria-hidden="true"/>}
    </button>
    <span className="sr-only" role="status" aria-live="polite">{busy ? 'Preparando arquivo para download.' : message}</span>
    {open && createPortal(
      <div ref={popupRef} id={id} role="dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
        className="portal-table-export-popover portal-modal-surface" style={position}>
        <div className="portal-modal-header portal-table-export-heading">
          <h3 id={`${id}-title`}><Download size={16} aria-hidden="true"/>Baixar lista</h3>
          <button type="button" onClick={() => close(true)} className="portal-modal-header-close" aria-label="Fechar opções de download"><X size={15}/></button>
        </div>
        <div className="portal-modal-divider" aria-hidden="true"/>
        <div className="portal-table-export-body">
          <div className="portal-table-export-summary">{summary.rows} {summary.rows === 1 ? 'defesa' : 'defesas'}<span aria-hidden="true"> · </span>{summary.columns} {summary.columns === 1 ? 'coluna' : 'colunas'}</div>
          <p id={`${id}-description`} className="portal-table-export-description">Mantém as colunas, a ordem e os filtros da sua lista.</p>
          <div className="portal-table-export-options" aria-busy={busy !== null}>
            {formats.map(({format, label, extension, description, Icon}) => <button key={format} type="button" data-export-format={format}
              className="portal-table-export-option" disabled={unavailable || busy !== null} onClick={() => void download(format)}>
              <span className="portal-table-export-format-icon" data-format={format}><Icon size={20} aria-hidden="true"/></span>
              <span className="portal-table-export-option-copy"><span className="portal-table-export-option-title">{label}<span className="portal-table-export-extension">{extension}</span></span><span className="portal-table-export-option-description">{description}</span></span>
              {busy === format ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true"/> : <Download size={14} className="portal-table-export-option-arrow" aria-hidden="true"/>}
            </button>)}
          </div>
          {unavailable && !error && <p className="portal-table-export-description">Nenhuma defesa disponível para os filtros selecionados.</p>}
          {error && <p role="alert" className="portal-table-export-error">{error}</p>}
          {message && <p className="portal-table-export-success">{message}</p>}
          <p className="portal-table-export-footnote">Inclui todas as páginas dos resultados filtrados.</p>
        </div>
      </div>, document.body)}
  </>;
};
