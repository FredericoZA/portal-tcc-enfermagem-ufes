import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AlertCircle, Download, Info, ShieldCheck } from 'lucide-react';
import { createPortal } from 'react-dom';
import { currentPortalDialog, finishPortalDialog, subscribePortalDialogs } from '../services/portalDialogs';

/** Native dialog supplies focus containment and the top layer; all styling is shared. */
export function PortalDialogs() {
  const current = useSyncExternalStore(subscribePortalDialogs, currentPortalDialog, () => null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState('');
  useEffect(() => {
    if (!current || !dialog.current) return;
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setValue(current.initialValue);
    element.showModal();
    return () => { element.close(); previousFocus?.focus(); };
  }, [current]);
  if (!current) return null;
  const cancel = () => finishPortalDialog(current.kind === 'confirm' ? false : null);
  const isError = /(^|\b)(erro|falha|não foi possível|não pôde)/i.test(current.message);
  const TitleIcon = /baixar|download/i.test(current.title) ? Download : /identidade|acesso|segurança/i.test(current.title) ? ShieldCheck : isError ? AlertCircle : Info;
  return createPortal(<dialog ref={dialog} className="portal-feedback-dialog portal-modal-surface" aria-labelledby="portal-feedback-title" aria-describedby="portal-feedback-message"
    onMouseDown={event => { if (event.target === event.currentTarget) cancel(); }}
    onCancel={event => { event.preventDefault(); cancel(); }} onKeyDown={event => event.stopPropagation()}>
    <form onSubmit={event => { event.preventDefault(); finishPortalDialog(current.kind === 'prompt' ? value : true); }}>
      <header className="portal-modal-header p-4"><TitleIcon className="h-4 w-4 shrink-0 text-white" aria-hidden="true"/><h2 id="portal-feedback-title" className="text-[14px] font-bold">{current.title}</h2></header>
      <div className="portal-modal-divider" aria-hidden="true" />
      <div className="space-y-4 p-4"><div className="flex items-start gap-2.5">{isError && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden="true"/>}<p id="portal-feedback-message" className="whitespace-pre-wrap text-[13px] leading-5">{current.message}</p></div>
        {current.kind === 'prompt' && <label className="block"><span className="sr-only">Resposta</span><input autoFocus className="portal-input" value={value} onChange={event => setValue(event.target.value)} /></label>}
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-300 p-3">
        {current.kind !== 'notice' && <button autoFocus={current.kind === 'confirm'} type="button" className="portal-action" onClick={cancel}>{current.cancelLabel}</button>}
        <button autoFocus={current.kind === 'notice'} type="submit" className="portal-action portal-action-primary">{current.confirmLabel}</button>
      </footer>
    </form>
  </dialog>, document.body);
}
