import React,{useEffect,useState,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {portalOperations} from '../services/portalOperations';

/** A persistent indicator across upload preparation, transfer and confirmation. */
export function PortalOperationStatus(){
 const {label,pending}=useSyncExternalStore(portalOperations.subscribe,portalOperations.getSnapshot,portalOperations.getSnapshot);
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
  if(!pending){setVisible(false);return;}
  const timer=window.setTimeout(()=>setVisible(true),300);
  return()=>window.clearTimeout(timer);
 },[Boolean(pending)]);
 if(!pending||!visible)return null;
 return createPortal(<div className="portal-operation-status pointer-events-none fixed inset-x-3 top-1/2 -translate-y-1/2 z-[1000030] mx-auto w-auto max-w-lg rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-page)] p-4 text-[var(--portal-text-dark)] shadow-lg" role="status" aria-live="polite" aria-atomic="true">
  <p className="text-sm font-bold">{label}</p>
  <p className="mt-1 text-xs text-slate-600">Aguarde a conclusão. O resultado será informado ao terminar.</p>
  <div role="progressbar" aria-label={label} className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"><span className="portal-operation-progress block h-full w-2/5 rounded-full bg-[var(--portal-brand-header)]"/></div>
 </div>,document.body);
}
