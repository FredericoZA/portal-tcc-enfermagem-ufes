import React from 'react';
import {Download, Eye, FileCheck} from 'lucide-react';
import {PortalModalShell} from './PortalModalShell';
import {apiClient} from '../services/apiClient';
import {portalNotice} from '../services/portalDialogs';
import type {ReservationReceiptSummary} from '../types/workflowOperations';
import {formatDateNumericWithWeekday, formatTime24h} from '../utils/formatters';

const DocumentFilePreview=React.lazy(()=>import('./DocumentFilePreview').then(module=>({default:module.DocumentFilePreview})));

function ProcessDocumentActions({available, working = false, onView, onDownload, viewRef}: {available: boolean; working?: boolean; onView: () => void; onDownload: () => void; viewRef?: React.Ref<HTMLButtonElement>}) {
  return <div className="portal-document-actions flex flex-wrap items-stretch gap-2 pt-2.5 border-t border-slate-100">
    <button ref={viewRef} type="button" onClick={onView} disabled={!available || working} className="portal-document-view basis-20 flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer disabled:cursor-not-allowed" title="Visualizar documento em tela"><Eye className="w-3.5 h-3.5"/><span>Ver</span></button>
    <button type="button" onClick={onDownload} disabled={!available || working} className={`portal-document-download basis-20 flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-2xs ${available ? 'text-white bg-[var(--portal-brand-header)] hover:bg-[#004827] cursor-pointer' : 'bg-slate-200 text-[var(--portal-text-muted)] cursor-not-allowed'}`} title="Baixar PDF do documento"><Download className="w-3.5 h-3.5"/><span>{working ? 'Baixando…' : 'Baixar PDF'}</span></button>
  </div>;
}

/** Shared presentation for current process documents and imported originals. */
export function ProcessDocumentCard({title, signerLabel = 'Assinatura', signerNote, status, statusDescription, tone = 'pending', available, unavailable = !available, working = false, onView, onDownload, viewRef, children}: {
  key?: string; title: React.ReactNode; signerLabel?: string; signerNote: string;
  status: string; statusDescription?: string; tone?: 'available' | 'pending' | 'error' | 'denied';
  available: boolean; unavailable?: boolean; working?: boolean;
  onView: () => void; onDownload: () => void; viewRef?: React.Ref<HTMLButtonElement>; children?: React.ReactNode;
}) {
  const titleId = React.useId();
  return <article aria-labelledby={titleId} className={`portal-tcc-document-card ${unavailable ? 'portal-document-unavailable' : ''} border border-slate-200/90 rounded-xl p-3.5`}>
    <div className="portal-document-heading flex items-center gap-2.5 min-w-0">
      <div className="w-8 h-8 rounded-lg bg-[var(--portal-surface-inner)] text-[var(--portal-brand-header)] border border-[var(--portal-border)] flex items-center justify-center shrink-0"><FileCheck className="w-4 h-4 text-[var(--portal-brand-header)]" aria-hidden="true"/></div>
      <h3 id={titleId} className="portal-document-title min-w-0 font-extrabold text-xs sm:text-[13px] text-slate-900 leading-snug">{title}</h3>
    </div>
    <div className="portal-document-signers p-1.5 bg-white border border-slate-200 rounded text-[10px] text-slate-600 font-medium"><span className="font-bold">{signerLabel}</span><span>{signerNote}</span></div>
    <div className={`portal-document-status font-black normal-case text-[10px] px-2.5 py-0.5 rounded-md border tracking-wide ${tone === 'available' ? 'portal-document-status-available' : tone === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' : tone === 'denied' ? 'bg-red-50 text-red-800 border-red-300' : 'bg-[var(--portal-surface-inner)] text-[var(--portal-text-muted)] border-[var(--portal-border)]'}`}>
      {status}{statusDescription && <span className="block text-[11px] font-medium normal-case leading-snug tracking-normal">{statusDescription}</span>}
    </div>
    <div className="portal-document-extra">{children}</div>
    <ProcessDocumentActions available={available} working={working} onView={onView} onDownload={onDownload} viewRef={viewRef}/>
  </article>;
}

type ReservationStatus = 'PENDENTE' | 'CONFIRMADO' | 'RECUSADO' | 'NEGADO' | 'REJEITADO';
type ReceiptCollection = {scope: string; loading: boolean; items: ReservationReceiptSummary[]; currentStatus?: ReservationStatus; error?: string};

function protocolFromReceiptUrl(downloadUrl?: string): string | undefined {
  if (!downloadUrl) return undefined;
  try {
    const target = new URL(downloadUrl, 'https://portal.local');
    const match = /^\/api\/public\/processes\/([^/]+)\/reservation-receipt$/.exec(target.pathname);
    return match ? decodeURIComponent(match[1]) : undefined;
  } catch { return undefined; }
}

/** Receipt links always use the public, privacy-filtered renderer. */
function receiptPreviewUrl(protocol: string, item: ReservationReceiptSummary): string {
  const target = new URL(item.url, window.location.origin);
  const path = `/api/public/processes/${encodeURIComponent(protocol)}/reservation-receipt`;
  if (target.origin !== window.location.origin || target.pathname !== path || target.searchParams.get('receipt') !== item.id) {
    throw new Error('O endereço do comprovante não está disponível.');
  }
  return target.pathname + target.search;
}

export function ReservationReceiptCard({protocol, currentStatus, revision, downloadUrl, historical = false}: {
  protocol?: string; currentStatus?: ReservationStatus; revision?: number; downloadUrl?: string; historical?: boolean;
}) {
  const receiptProtocol = protocol || protocolFromReceiptUrl(downloadUrl);
  const scope = JSON.stringify([receiptProtocol, currentStatus, revision, downloadUrl, historical]);
  const scopeRef = React.useRef(scope);
  scopeRef.current = scope;
  const [collection, setCollection] = React.useState<ReceiptCollection>({scope: '', loading: false, items: []});
  const [retry, setRetry] = React.useState(0);
  const [picker, setPicker] = React.useState<{scope: string; mode: 'view' | 'download'} | null>(null);
  const [preview, setPreview] = React.useState<{scope: string; item: ReservationReceiptSummary; url: string} | null>(null);
  const [downloadingScope, setDownloadingScope] = React.useState<string | null>(null);
  const downloadingRef = React.useRef(false);
  const viewButtonRef = React.useRef<HTMLButtonElement>(null);
  const previewTitleId = React.useId();

  React.useEffect(() => {
    let active = true;
    setPicker(null);
    setPreview(null);
    if (!receiptProtocol) {
      setCollection({scope, loading: false, items: []});
      return () => { active = false; };
    }
    setCollection({scope, loading: true, items: []});
    void apiClient.getReservationReceipts(receiptProtocol).then(result => {
      if (active) setCollection({scope, loading: false, items: result.items, currentStatus: result.currentStatus});
    }).catch(error => {
      if (active) setCollection({scope, loading: false, items: [], error: error instanceof Error ? error.message : 'Não foi possível consultar os comprovantes.'});
    });
    return () => { active = false; };
  }, [receiptProtocol, scope, retry]);

  const loaded = collection.scope === scope;
  const loading = Boolean(receiptProtocol) && (!loaded || collection.loading);
  const items = loaded ? collection.items : [];
  const error = loaded ? collection.error : undefined;
  const effectiveStatus = loaded ? collection.currentStatus || currentStatus : currentStatus;
  const refused = ['RECUSADO', 'NEGADO', 'REJEITADO'].includes(effectiveStatus || '');
  const pending = effectiveStatus === 'PENDENTE';
  const accepted = effectiveStatus === 'CONFIRMADO';
  const currentReceipt = items.find(item => item.current &&
    (item.decision === 'CONFIRMED' ? accepted : refused));
  const available = !loading && !error && items.length > 0;
  const downloading = downloadingScope === scope;
  const visiblePreview = preview?.scope === scope ? preview : null;
  const visiblePicker = picker?.scope === scope ? picker : null;
  const closePreview = () => { setPreview(null); viewButtonRef.current?.focus(); };
  const closePicker = () => setPicker(null);
  const view = (item: ReservationReceiptSummary) => {
    if (!receiptProtocol) return;
    try { setPreview({scope, item, url: receiptPreviewUrl(receiptProtocol, item)}); }
    catch (error) { portalNotice(error instanceof Error ? error.message : 'Não foi possível abrir o comprovante.'); }
  };
  const download = async (item: ReservationReceiptSummary) => {
    if (!receiptProtocol || downloadingRef.current) return;
    downloadingRef.current = true;
    setDownloadingScope(scope);
    try {
      receiptPreviewUrl(receiptProtocol, item);
      const {blob, fileName} = await apiClient.downloadReservationReceipt(receiptProtocol, item.id);
      const objectUrl = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = objectUrl; anchor.download = fileName; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    } catch (error) {
      if (scopeRef.current === scope) portalNotice(error instanceof Error ? error.message : 'Não foi possível baixar o comprovante.');
    } finally { downloadingRef.current = false; setDownloadingScope(null); }
  };
  const choose = (mode: 'view' | 'download') => {
    if (!available) return;
    if (items.length > 1 || !currentReceipt) { setPicker({scope, mode}); return; }
    if (mode === 'view') view(currentReceipt); else void download(currentReceipt);
  };
  const select = (item: ReservationReceiptSummary) => {
    const mode = visiblePicker?.mode;
    setPicker(null);
    if (mode === 'view') view(item); else if (mode === 'download') void download(item);
  };
  const hasCurrentReceipt = available && Boolean(currentReceipt);
  const historyDescription = available ? 'Os comprovantes dos pedidos anteriores estão disponíveis para consulta.' : undefined;
  const status = refused ? 'Reserva recusada' : accepted ? 'Reserva aceita' : loading ? 'Consultando comprovantes…' : error ? 'Consulta indisponível' : pending ? 'Aguardando resposta da reserva' : historical ? 'Não disponível' : 'Ainda não solicitado';
  const statusDescription = error ? 'Não foi possível consultar o histórico. Tente novamente.'
    : refused ? hasCurrentReceipt ? 'O comprovante da recusa está disponível para consulta.' : historyDescription
    : accepted ? hasCurrentReceipt ? 'O comprovante está disponível para consulta.' : historyDescription
    : loading ? undefined
    : pending && available ? 'O pedido atual aguarda resposta. Os comprovantes anteriores continuam disponíveis.'
    : available ? undefined
    : historical ? 'Comprovante não localizado no acervo importado.' : pending ? 'Aguarda o aceite ou a recusa do responsável pelo local.' : undefined;

  return <><ProcessDocumentCard title={available ? `Comprovante de reserva (${items.length})` : 'Comprovante de reserva'} signerNote="Não necessária"
    status={status} statusDescription={statusDescription}
    tone={refused ? 'denied' : accepted ? 'available' : 'pending'} available={available} unavailable={false} working={downloading}
    viewRef={viewButtonRef} onView={() => choose('view')} onDownload={() => choose('download')}>
    {error && <button type="button" className="text-xs font-bold underline text-[var(--portal-brand-header)]" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button>}
  </ProcessDocumentCard>
    <PortalModalShell open={Boolean(visiblePicker)} onClose={closePicker} title="Escolher comprovante de reserva" icon={FileCheck} maxWidthClass="max-w-2xl" heightClass="max-h-[85vh]" bodyClassName="p-3 sm:p-4 overflow-auto" footer={<button type="button" className="portal-action" onClick={closePicker}>Cancelar</button>}>
      <div className="space-y-2">
        {items.map(item => <button key={item.id} type="button" onClick={() => select(item)} style={{borderRadius: 8}} className="w-full text-left rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface-inner)] p-3 hover:border-[var(--portal-brand-header)] focus-visible:outline-2 focus-visible:outline-[var(--portal-brand-header)]" aria-label={`${visiblePicker?.mode === 'download' ? 'Baixar' : 'Ver'} comprovante de reserva ${item.decision === 'CONFIRMED' ? 'confirmada' : 'recusada'} de ${formatDateNumericWithWeekday(item.startAt)} às ${formatTime24h(item.startAt)}`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><span className={`rounded-md border px-2 py-0.5 text-xs font-bold ${item.decision === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-300'}`}>{item.decision === 'CONFIRMED' ? 'Reserva confirmada' : 'Reserva recusada'}</span><span className="text-[11px] font-bold text-slate-600">{item === currentReceipt ? 'Pedido atual' : 'Pedido anterior'}</span></div>
          <p className="mt-2 text-xs font-bold text-slate-900">{formatDateNumericWithWeekday(item.startAt)} · {formatTime24h(item.startAt)}{item.endAt ? ` às ${formatTime24h(item.endAt)}` : ''}</p>
          <p className="mt-1 text-xs text-slate-700 break-words">{item.local}</p>
          {item.respondedAt && <p className="mt-1 text-[11px] text-slate-600">Resposta: {formatDateNumericWithWeekday(item.respondedAt)}, {formatTime24h(item.respondedAt)}.</p>}
        </button>)}
      </div>
    </PortalModalShell>
    <PortalModalShell open={Boolean(visiblePreview)} onClose={closePreview} title="Comprovante de reserva" labelledBy={previewTitleId} icon={FileCheck} maxWidthClass="max-w-5xl" heightClass="max-h-[90vh]" bodyClassName="p-3 overflow-auto" footer={<button type="button" className="portal-action" autoFocus onClick={closePreview}>Fechar</button>}>
      {visiblePreview && <React.Suspense fallback={<p role="status">Carregando comprovante…</p>}><DocumentFilePreview url={visiblePreview.url} format="pdf" label="Comprovante de reserva"/></React.Suspense>}
    </PortalModalShell>
  </>;
}

export function ProcessDocumentsPanel({id = 'documents-panel-section', count, columns = 5, toolbar, notices, children}: {id?: string; count: number; columns?: 5 | 6; toolbar?: React.ReactNode; notices?: React.ReactNode; children: React.ReactNode}) {
  return <div id={id} className="portal-card overflow-hidden space-y-0">
    <div className="px-4 pt-3 flex items-center justify-end gap-2"><div className="flex items-center gap-2">{toolbar}<span className="text-[11px] text-slate-500 font-medium">{count} documento(s)</span></div></div>
    <div className="p-3 sm:p-4 space-y-3">{notices}<div className="portal-process-documents-grid" data-columns={columns}>{children}</div></div>
  </div>;
}
