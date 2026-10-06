import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
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
  const isError = /^erro\b/i.test(current.message.trim()) || /^erro\b/i.test(current.title.trim());
  const cancel = () => finishPortalDialog(current.kind === 'confirm' ? false : null);
  return createPortal(<dialog ref={dialog} className="portal-feedback-dialog portal-modal-surface" aria-labelledby="portal-feedback-title" aria-describedby="portal-feedback-message"
    onCancel={event => { event.preventDefault(); cancel(); }} onKeyDown={event => event.stopPropagation()}>
    <form onSubmit={event => { event.preventDefault(); finishPortalDialog(current.kind === 'prompt' ? value : true); }}>
      <header className="portal-modal-header px-5 py-4"><h2 id="portal-feedback-title" className="text-base font-bold">{current.title}</h2></header>
      <div className="space-y-4 p-5"><p id="portal-feedback-message" className="flex items-start gap-2 whitespace-pre-wrap text-[13px] leading-5">{isError && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden="true"/>}<span>{current.message}</span></p>
        {current.kind === 'prompt' && <label className="block"><span className="sr-only">Resposta</span><input autoFocus className="portal-input" value={value} onChange={event => setValue(event.target.value)} /></label>}
      </div>
      <footer className="flex justify-end gap-3 border-t p-4">
        {current.kind !== 'notice' && <button autoFocus={current.kind === 'confirm'} type="button" className="portal-action" onClick={cancel}>{current.cancelLabel}</button>}
        <button autoFocus={current.kind === 'notice'} type="submit" className="portal-action portal-action-primary">{current.confirmLabel}</button>
      </footer>
    </form>
  </dialog>, document.body);
}
