import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
  return createPortal(<dialog ref={dialog} className="portal-feedback-dialog portal-modal-surface" aria-labelledby="portal-feedback-title" aria-describedby="portal-feedback-message"
    onCancel={event => { event.preventDefault(); cancel(); }} onKeyDown={event => event.stopPropagation()}>
    <form onSubmit={event => { event.preventDefault(); finishPortalDialog(current.kind === 'prompt' ? value : true); }}>
      <header className="portal-modal-header p-5"><h2 id="portal-feedback-title" className="text-lg font-bold">{current.kind === 'notice' ? 'Mensagem do portal' : current.kind === 'confirm' ? 'Confirmar ação' : 'Preencher informação'}</h2></header>
      <div className="space-y-4 p-5"><p id="portal-feedback-message" className="whitespace-pre-wrap">{current.message}</p>
        {current.kind === 'prompt' && <label className="block"><span className="sr-only">Resposta</span><input autoFocus className="portal-input" value={value} onChange={event => setValue(event.target.value)} /></label>}
      </div>
      <footer className="flex justify-end gap-3 border-t p-4">
        {current.kind !== 'notice' && <button autoFocus={current.kind === 'confirm'} type="button" className="portal-action" onClick={cancel}>Cancelar</button>}
        <button autoFocus={current.kind === 'notice'} type="submit" className="portal-action portal-action-primary">{current.kind === 'notice' ? 'Entendi' : 'Confirmar'}</button>
      </footer>
    </form>
  </dialog>, document.body);
}
