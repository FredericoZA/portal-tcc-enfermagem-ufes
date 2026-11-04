import React from 'react';
import {Download, Eye, FileCheck} from 'lucide-react';
import {PortalModalShell} from './PortalModalShell';
import {apiClient} from '../services/apiClient';
import {portalNotice} from '../services/portalDialogs';

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
  status: string; statusDescription?: string; tone?: 'available' | 'pending' | 'error';
  available: boolean; unavailable?: boolean; working?: boolean;
  onView: () => void; onDownload: () => void; viewRef?: React.Ref<HTMLButtonElement>; children?: React.ReactNode;
}) {
  const titleId = React.useId();
  return <article aria-labelledby={titleId} className={`portal-tcc-document-card ${unavailable ? 'portal-document-unavailable' : ''} border border-slate-200/90 rounded-xl p-3.5`}>
    <div className="portal-document-heading flex items-start gap-2.5 min-w-0">
      <div className="w-8 h-8 rounded-lg bg-[var(--portal-surface-inner)] text-[var(--portal-brand-header)] border border-[var(--portal-border)] flex items-center justify-center shrink-0"><FileCheck className="w-4 h-4 text-[var(--portal-brand-header)]" aria-hidden="true"/></div>
      <h3 id={titleId} className="portal-document-title min-w-0 font-extrabold text-xs sm:text-[13px] text-slate-900 leading-snug">{title}</h3>
    </div>
    <div className="portal-document-signers p-1.5 bg-white border border-slate-200 rounded text-[10px] text-slate-600 font-medium"><span className="font-bold">{signerLabel}</span><span>{signerNote}</span></div>
    <div className={`portal-document-status font-black normal-case text-[10px] px-2.5 py-0.5 rounded-md border tracking-wide ${tone === 'available' ? 'portal-document-status-available' : tone === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
      {status}{statusDescription && <span className="block text-[11px] font-medium normal-case leading-snug tracking-normal">{statusDescription}</span>}
    </div>
    <div className="portal-document-extra">{children}</div>
    <ProcessDocumentActions available={available} working={working} onView={onView} onDownload={onDownload} viewRef={viewRef}/>
  </article>;
}

export function ReservationReceiptCard({downloadUrl, historical = false}: {downloadUrl?: string; historical?: boolean}) {
  const [previewUrl,setPreviewUrl]=React.useState<string|null>(null);
  const [downloading,setDownloading]=React.useState(false);
  const viewButtonRef=React.useRef<HTMLButtonElement>(null);
  const previewTitleId=React.useId();
  const visiblePreviewUrl=downloadUrl&&previewUrl===downloadUrl?downloadUrl:null;
  const closePreview=()=>{setPreviewUrl(null);viewButtonRef.current?.focus();};
  const download=async()=>{
    if(!downloadUrl||downloading)return;
    setDownloading(true);
    try{
      const target=new URL(downloadUrl,window.location.origin);
      const match=/^\/api\/public\/processes\/([^/]+)\/reservation-receipt$/.exec(target.pathname);
      if(target.origin!==window.location.origin||!match)throw new Error('Comprovante indisponível.');
      const {blob,fileName}=await apiClient.downloadReservationReceipt(decodeURIComponent(match[1]));
      const objectUrl=URL.createObjectURL(blob),anchor=document.createElement('a');
      anchor.href=objectUrl;anchor.download=fileName;anchor.click();
      window.setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
    }catch(error){portalNotice(error instanceof Error?error.message:'Não foi possível baixar o comprovante.');}
    finally{setDownloading(false);}
  };
  return <><ProcessDocumentCard title="Comprovante de reserva" signerNote="Não necessária"
    status={downloadUrl ? 'Disponível' : historical ? 'Não disponível' : 'Aguardando resposta'}
    statusDescription={downloadUrl ? undefined : historical ? 'Comprovante não localizado no acervo importado.' : 'Aguarda o aceite ou a recusa do responsável pelo local.'}
    tone={downloadUrl ? 'available' : 'pending'} available={Boolean(downloadUrl)} working={downloading}
    viewRef={viewButtonRef} onView={()=>downloadUrl&&setPreviewUrl(downloadUrl)} onDownload={()=>void download()}/>
    <PortalModalShell open={Boolean(visiblePreviewUrl)} onClose={closePreview} title="Comprovante de reserva" labelledBy={previewTitleId} icon={FileCheck} maxWidthClass="max-w-5xl" heightClass="max-h-[90vh]" bodyClassName="p-3 overflow-auto" footer={<button type="button" className="portal-action" autoFocus onClick={closePreview}>Fechar</button>}>
      {visiblePreviewUrl&&<React.Suspense fallback={<p role="status">Carregando comprovante…</p>}><DocumentFilePreview url={visiblePreviewUrl} format="pdf" label="Comprovante de reserva"/></React.Suspense>}
    </PortalModalShell>
  </>;
}

export function ProcessDocumentsPanel({id = 'documents-panel-section', count, columns = 5, toolbar, notices, children}: {id?: string; count: number; columns?: 5 | 6; toolbar?: React.ReactNode; notices?: React.ReactNode; children: React.ReactNode}) {
  return <div id={id} className="portal-card overflow-hidden space-y-0">
    <div className="px-4 pt-3 flex items-center justify-end gap-2"><div className="flex items-center gap-2">{toolbar}<span className="text-[11px] text-slate-500 font-medium">{count} documento(s)</span></div></div>
    <div className="p-3 sm:p-4 space-y-3">{notices}<div className="portal-process-documents-grid" data-columns={columns}>{children}</div></div>
  </div>;
}
