import React, { useEffect, useRef, useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { apiClient, ApiRequestError } from '../services/apiClient';
import type { PortalNotification, PortalNotificationDetail } from '../types/courseOperations';
import { formatDateTimeWithWeekday } from '../utils/formatters';
import { PORTAL_LIVE_UPDATE_EVENT } from '../utils/portalLiveEvents';
import { setProcessLink } from '../utils/processLink';

const CACHE_MS = 20_000;
const LIVE_DEBOUNCE_MS = 250;
const statusLabels: Record<string,string> = {
  FAILED:'Falhou', RETRY:'Nova tentativa pendente', PROVIDER_ERROR:'Falha no provedor',
  DECLINED:'Recusada', EXPIRED:'Expirada', DRIVE_SYNC_PENDING:'Aguardando arquivamento no Drive',
  PARTIAL_FAILURE:'Falha parcial', FAILED_VALIDATION:'Falha de validação',
};

export const NotificationBell: React.FC = () => {
  const details = useRef<HTMLDetailsElement>(null);
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<PortalNotification | null>(null);
  const [event, setEvent] = useState<PortalNotificationDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  const [saving, setSaving] = useState(false);
  const detailRequest = useRef<AbortController | null>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const bell = useRef<HTMLElement>(null);

  useEffect(() => {
    if (selected) backButton.current?.focus();
  }, [selected]);

  useEffect(() => {
    const panel = details.current;
    if (!panel) return;
    let active = true;
    let inFlight = false;
    let lastLoadedAt = 0;
    let revision = 0;
    let timer: number | undefined;

    const scheduleRefresh = () => {
      if (!panel.open || inFlight || timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        if (Date.now() - lastLoadedAt >= CACHE_MS) void load();
      }, LIVE_DEBOUNCE_MS);
    };
    const load = async () => {
      if (!active || !panel.open || inFlight) return;
      const requestedRevision = revision;
      inFlight = true;
      setLoading(true);
      setFailed(false);
      try {
        const data = await apiClient.getNotifications();
        if (!active) return;
        setItems(previous => {
          const read = new Set(previous.filter(item => item.read).map(item => `${item.id}|${item.createdAt}`));
          return data.map(item => ({...item,read:item.read||read.has(`${item.id}|${item.createdAt}`)}));
        });
        setSelected(previous=>previous&&data.some(item=>item.id===previous.id&&item.createdAt===previous.createdAt)?previous:null);
        setLoaded(true);
        if (revision === requestedRevision) lastLoadedAt = Date.now();
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiRequestError && [401, 403].includes(error.status)) {
          setItems([]);
          setSelected(null);
        }
        setFailed(true);
      } finally {
        inFlight = false;
        if (active) {
          setLoading(false);
          if (revision !== requestedRevision) scheduleRefresh();
        }
      }
    };
    const onToggle = () => {
      if (panel.open && Date.now() - lastLoadedAt >= CACHE_MS) void load();
      if (!panel.open) {
        detailRequest.current?.abort();
        setSelected(null);
      }
    };
    const onLiveUpdate = () => {
      revision += 1;
      lastLoadedAt = 0;
      scheduleRefresh();
    };
    const onOutsidePointer = (event: PointerEvent) => {
      if (panel.open && !event.composedPath().includes(panel)) panel.open = false;
    };
    panel.addEventListener('toggle', onToggle);
    document.addEventListener('pointerdown', onOutsidePointer, true);
    window.addEventListener(PORTAL_LIVE_UPDATE_EVENT, onLiveUpdate);
    return () => {
      active = false;
      detailRequest.current?.abort();
      window.clearTimeout(timer);
      panel.removeEventListener('toggle', onToggle);
      document.removeEventListener('pointerdown', onOutsidePointer, true);
      window.removeEventListener(PORTAL_LIVE_UPDATE_EVENT, onLiveUpdate);
    };
  }, []);
  const showDetails = async (item: PortalNotification) => {
    detailRequest.current?.abort();
    const request = new AbortController();
    detailRequest.current = request;
    setSelected(item);
    setEvent(null);
    setDetailError('');
    try {
      const result = await apiClient.getNotification(item.id,request.signal);
      if (!request.signal.aborted) setEvent(result);
    } catch (error) {
      if (request.signal.aborted) return;
      setDetailError(error instanceof ApiRequestError && error.status === 404
        ? 'A notificação não está mais disponível ou seu acesso foi alterado.'
        : 'Não foi possível abrir os detalhes. Volte à lista e tente novamente.');
    }
  };
  const markRead = async (item: PortalNotificationDetail) => {
    setSaving(true);
    setDetailError('');
    try {
      await apiClient.markNotificationRead(item.id,item.createdAt);
      setItems(previous=>previous.map(value=>value.id===item.id&&value.createdAt===item.createdAt?{...value,read:true}:value));
      setEvent(previous=>previous?.id===item.id&&previous.createdAt===item.createdAt?{...previous,read:true}:previous);
    } catch (error) {
      if (error instanceof ApiRequestError && [401,403,404,409].includes(error.status)) setEvent(null);
      setDetailError(error instanceof ApiRequestError ? error.message : 'Não foi possível marcar a notificação como lida.');
    } finally {
      setSaving(false);
    }
  };
  const unreadCount = items.filter(item=>!item.read).length;
  const destination = event?.destination;
  return <details ref={details} className="relative" onKeyDown={event=>{
    if(event.key!=='Escape'||!details.current?.open)return;
    event.preventDefault();
    details.current.open=false;
    detailRequest.current?.abort();
    setSelected(null);
    bell.current?.focus();
  }}>
    <summary ref={bell} className="relative flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" aria-label={`Notificações${unreadCount ? `: ${unreadCount} não lida(s)` : ''}`}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Bell className="h-4 w-4"/>}
      {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1 text-center text-[9px] font-black leading-5 text-white">{Math.min(unreadCount, 99)}</span>}
    </summary>
    <div className="portal-modal-surface absolute right-0 z-50 mt-2 w-[min(90vw,360px)] overflow-hidden">
      <div className="portal-modal-header px-3"><Bell className="h-3.5 w-3.5 text-white"/><div><strong className="text-xs text-white">Central de notificações</strong><p className="mt-0.5 text-[9px] text-white/80">Falhas e pendências dos TCCs aos quais você tem acesso.</p></div></div>
      <div className="portal-modal-divider" aria-hidden="true" />
      {selected ? <div className="max-h-80 space-y-2 overflow-y-auto bg-[var(--portal-surface-page)] p-3 text-xs">
        <button ref={backButton} type="button" className="font-semibold text-[var(--portal-brand-action)] underline" onClick={()=>{detailRequest.current?.abort();setSelected(null);bell.current?.focus();}}>Voltar às notificações</button>
        {detailError && <p role="alert">{detailError}</p>}
        {!event && !detailError && <p role="status">Carregando detalhes…</p>}
        {event && <>
          <h3 className="font-bold">{event.title}</h3>
          <p>{event.message}</p>
          <p>{statusLabels[event.status]||event.status}</p>
          <p>{event.protocol && `${event.protocol} · `}<time dateTime={event.createdAt}>{formatDateTimeWithWeekday(event.createdAt)}</time></p>
          {event.context && <p>{event.context}</p>}
          <div className="flex flex-wrap gap-3 pt-1">
            {event.read ? <span className="font-semibold">Lida</span> : <button type="button" className="font-semibold text-[var(--portal-brand-action)] underline" disabled={saving} onClick={()=>void markRead(event)}>Marcar como lida</button>}
            {destination?.kind==='PROCESS' && <a
              className="font-semibold text-[var(--portal-brand-action)] underline"
              href={`?${new URLSearchParams({tcc:destination.processId,secao:destination.section})}`}
              onClick={click=>{
                if(click.ctrlKey||click.metaKey||click.shiftKey||click.altKey)return;
                click.preventDefault();
                if(details.current)details.current.open=false;
                setProcessLink(destination.processId,destination.section,true);
                window.dispatchEvent(new CustomEvent('portal:open-process',{detail:{id:destination.processId}}));
              }}>Abrir TCC</a>}
            {destination?.kind==='PRESIDENCY' && <button type="button" className="font-semibold text-[var(--portal-brand-action)] underline" onClick={()=>{
              if(details.current)details.current.open=false;
              window.dispatchEvent(new CustomEvent('portal:navigate',{detail:'coordenador'}));
            }}>Abrir área da Presidência</button>}
          </div>
        </>}
      </div> : <div className="max-h-80 overflow-y-auto bg-[var(--portal-surface-page)] p-2" aria-busy={loading}>
        {failed && <p role="status" className="p-3 text-center text-xs text-slate-600">Não foi possível atualizar as notificações. Feche e abra para tentar novamente.</p>}
        {items.map(item => <article key={item.id} className="mb-2 rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2"><strong className="text-[11px] text-slate-900">{item.title}</strong><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[8px] font-black">{item.read?'Lida':'Não lida'}</span></div>
          <p className="mt-1 text-[10px] leading-4 text-slate-600">{item.message}</p>
          <p className="mt-1 text-[10px] text-slate-600">{item.protocol && `${item.protocol} · `}<time dateTime={item.createdAt}>{formatDateTimeWithWeekday(item.createdAt)}</time></p>
          <p className="mt-1 flex items-center justify-between gap-2 text-[10px]">
            <span>{statusLabels[item.status]||item.status}</span>
            <button type="button" className="font-semibold text-[var(--portal-brand-action)] underline" aria-label={`Detalhes: ${item.title} ${item.protocol||''}`} onClick={()=>void showDetails(item)}>Ver detalhes</button>
          </p>
        </article>)}
        {!items.length && !failed && <p role="status" className="p-5 text-center text-xs text-slate-500">
          {loaded && !loading ? 'Nenhuma pendência no momento.' : 'Carregando notificações…'}
        </p>}
      </div>}
    </div>
  </details>;
};
