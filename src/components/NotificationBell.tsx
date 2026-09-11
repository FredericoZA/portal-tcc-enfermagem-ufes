import React, { useEffect, useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { apiClient } from '../services/apiClient';

export const NotificationBell: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiClient.getNotifications().then(setItems).catch(() => setItems([])).finally(() => setLoading(false)); }, []);
  return <details className="relative">
    <summary className="relative flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" aria-label={`Notificações${items.length ? `: ${items.length} pendente(s)` : ''}`}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Bell className="h-4 w-4"/>}
      {items.length > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1 text-center text-[9px] font-black leading-5 text-white">{Math.min(items.length, 99)}</span>}
    </summary>
    <div className="absolute right-0 z-50 mt-2 w-[min(90vw,360px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="border-b bg-slate-50 p-3"><strong className="text-xs text-slate-950">Central de notificações</strong><p className="mt-0.5 text-[10px] text-slate-500">Falhas e pendências dos TCCs aos quais você tem acesso.</p></div>
      <div className="max-h-80 overflow-y-auto p-2">{items.length ? items.map(item => <article key={item.id} className="mb-2 rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><strong className="text-[11px] text-slate-900">{item.title}</strong><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[8px] font-black">{item.category}</span></div><p className="mt-1 text-[10px] leading-4 text-slate-600">{item.message}</p></article>) : <p className="p-5 text-center text-xs text-slate-500">Nenhuma pendência no momento.</p>}</div>
    </div>
  </details>;
};
