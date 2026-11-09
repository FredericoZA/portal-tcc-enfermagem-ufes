import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AlertCircle, AlertTriangle, Download, Info, ShieldCheck } from 'lucide-react';
import { createPortal } from 'react-dom';
import {containModalTab,topmostModal} from '../utils/modalEscape';
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
    return () => {
      element.close();
      if(previousFocus?.isConnected)previousFocus.focus();
      const parent=topmostModal(document);
      // A pending action may have disabled the trigger while its confirmation was open.
      if(parent&&!parent.contains(document.activeElement))parent.focus({preventScroll:true});
    };
  }, [current]);
  if (!current) return null;
  const cancel = () => finishPortalDialog(current.kind === 'confirm' ? false : null);
  const isError = /(^|\b)(erro|falha|não foi possível|não pôde)/i.test(current.message);
  const TitleIcon = current.tone==='warning'?AlertTriangle:/baixar|download/i.test(current.title) ? Download : /identidade|acesso|segurança/i.test(current.title) ? ShieldCheck : isError ? AlertCircle : Info;
  return createPortal(<dialog ref={dialog} className="portal-feedback-dialog portal-modal-surface" data-tone={current.tone} aria-labelledby="portal-feedback-title" aria-describedby="portal-feedback-message"
    onMouseDown={event => { if (event.target === event.currentTarget) cancel(); }}
    onCancel={event => { event.preventDefault(); cancel(); }} onKeyDown={event => {containModalTab(event.currentTarget,event.nativeEvent);event.stopPropagation();}}>
    <form onSubmit={event => { event.preventDefault(); finishPortalDialog(current.kind === 'prompt' ? value : true); }}>
      <header className="portal-modal-header p-4"><TitleIcon className="h-4 w-4 shrink-0 text-white" aria-hidden="true"/><h2 id="portal-feedback-title" className="text-[14px] font-bold">{current.title}</h2></header>
      <div className="portal-modal-divider" aria-hidden="true" />
      <div className="space-y-4 p-4"><div className="flex items-start gap-2.5">{isError && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden="true"/>}<p id="portal-feedback-message" className="whitespace-pre-wrap text-[13px] leading-5">{current.message}</p></div>
        {current.kind === 'prompt' && <label className="block"><span className={current.inputLabel?'mb-2 block text-[13px] font-semibold':'sr-only'}>{current.inputLabel||'Resposta'}</span>
          {current.multiline
            ? <textarea autoFocus required={Boolean(current.minLength)} minLength={current.minLength} maxLength={current.maxLength} rows={4} className="portal-input w-full" value={value} onChange={event=>setValue(event.target.value)} />
            : <input autoFocus required={Boolean(current.minLength)} minLength={current.minLength} maxLength={current.maxLength} className="portal-input" value={value} onChange={event => setValue(event.target.value)} />}
        </label>}
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-300 p-3">
        {current.kind !== 'notice' && <button autoFocus={current.kind === 'confirm'} type="button" className="portal-action" onClick={cancel}>{current.cancelLabel}</button>}
        <button autoFocus={current.kind === 'notice'} type="submit" disabled={current.kind==='prompt'&&Boolean(current.minLength)&&value.trim().length<current.minLength!} className="portal-action portal-action-primary">{current.confirmLabel}</button>
      </footer>
    </form>
  </dialog>, document.body);
}
