import React from 'react';
import {Download, Eye, FileCheck} from 'lucide-react';

/** Shared presentation for current process documents and imported originals. */
export function ProcessDocumentCard({title, meta, signerLabel, signerNote, status, statusDescription, tone = 'pending', available, unavailable = !available, working = false, onView, onDownload, children}: {
  key?: string; title: React.ReactNode; meta?: React.ReactNode; signerLabel: string; signerNote: string;
  status: string; statusDescription?: string; tone?: 'available' | 'pending' | 'error';
  available: boolean; unavailable?: boolean; working?: boolean;
  onView: () => void; onDownload: () => void; children?: React.ReactNode;
}) {
  return <article className={`portal-tcc-document-card ${unavailable ? 'portal-document-unavailable' : ''} border border-slate-200/90 rounded-xl p-3.5 flex flex-col gap-3`}>
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--portal-surface-inner)] text-[var(--portal-brand-header)] border border-[var(--portal-border)] flex items-center justify-center shrink-0"><FileCheck className="w-4 h-4 text-[var(--portal-brand-header)]"/></div>
          <div className="min-w-0">
            <h3 className="portal-document-title font-extrabold text-xs sm:text-[13px] text-slate-900 leading-snug">{title}</h3>
            {meta && <span className="text-[10px] font-mono font-bold text-[var(--portal-text-muted)]">{meta}</span>}
          </div>
        </div>
      </div>
      <div className="portal-document-signers p-1.5 bg-white border border-slate-200 rounded text-[10px] text-slate-600 font-medium"><span className="font-bold">{signerLabel}</span><span>{signerNote}</span></div>
      <div className="flex flex-wrap items-start justify-between gap-2 pt-1">
        <span className={`portal-document-status font-black normal-case text-[10px] px-2.5 py-0.5 rounded-md border tracking-wide ${tone === 'available' ? 'portal-document-status-available' : tone === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
          {status}{statusDescription && <span className="block text-[11px] font-medium normal-case leading-snug tracking-normal">{statusDescription}</span>}
        </span>
      </div>
    </div>
    {children}
    <div className="portal-document-actions flex items-center gap-2 pt-2.5 border-t border-slate-100">
      <button type="button" onClick={onView} disabled={!available || working} className="portal-document-view flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer disabled:cursor-not-allowed" title="Visualizar documento em tela"><Eye className="w-3.5 h-3.5"/><span>Ver</span></button>
      <button type="button" onClick={onDownload} disabled={!available || working} className={`portal-document-download flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-2xs ${available ? 'text-white bg-[var(--portal-brand-header)] hover:bg-[#004827] cursor-pointer' : 'bg-slate-200 text-[var(--portal-text-muted)] cursor-not-allowed'}`} title="Baixar PDF do documento"><Download className="w-3.5 h-3.5"/><span>{working ? 'Baixando…' : 'Baixar PDF'}</span></button>
    </div>
  </article>;
}

export function ReservationReceiptCard({downloadUrl, historical = false}: {downloadUrl?: string; historical?: boolean}) {
  return <article className={`portal-tcc-document-card ${downloadUrl ? '' : 'portal-document-unavailable'} border border-slate-200/90 rounded-xl p-3.5 flex flex-col gap-3`} aria-label="Comprovante de reserva">
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-8 h-8 rounded-lg bg-[var(--portal-surface-inner)] text-[var(--portal-brand-header)] border border-[var(--portal-border)] flex items-center justify-center shrink-0"><FileCheck className="w-4 h-4" /></div>
      <h3 className="portal-document-title font-extrabold text-xs sm:text-[13px] text-slate-900 leading-snug">Comprovante de reserva</h3>
    </div>
    <p className="text-xs">Resposta do responsável pelo local: aceite ou recusa da reserva.</p>
    <div className={`portal-document-status font-black normal-case text-[10px] px-2.5 py-0.5 rounded-md border tracking-wide ${downloadUrl ? 'portal-document-status-available' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
      {downloadUrl ? 'Disponível' : historical ? 'Não disponível' : 'Aguardando resposta'}
      {!downloadUrl && <span className="block text-[11px] font-medium normal-case leading-snug tracking-normal">{historical ? 'Comprovante não localizado no acervo importado.' : 'O comprovante será disponibilizado após o aceite ou a recusa da reserva.'}</span>}
    </div>
    <div className="portal-document-actions flex items-center gap-2 pt-2.5 border-t border-slate-100">
      {downloadUrl ? <a className="portal-action portal-button-primary w-full" href={downloadUrl} target="_blank" rel="noreferrer"><Download className="h-4 w-4"/>Baixar comprovante</a> : <button type="button" disabled className="portal-action w-full"><Download className="h-4 w-4"/>Baixar comprovante</button>}
    </div>
  </article>;
}

export function ProcessDocumentsPanel({id = 'documents-panel-section', count, toolbar, notices, children}: {id?: string; count: number; toolbar?: React.ReactNode; notices?: React.ReactNode; children: React.ReactNode}) {
  return <div id={id} className="portal-card overflow-hidden space-y-0">
    <div className="px-4 pt-3 flex items-center justify-end gap-2"><div className="flex items-center gap-2">{toolbar}<span className="text-[11px] text-slate-500 font-medium">{count} documento(s)</span></div></div>
    <div className="p-3 sm:p-4 space-y-3">{notices}<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">{children}</div></div>
  </div>;
}
