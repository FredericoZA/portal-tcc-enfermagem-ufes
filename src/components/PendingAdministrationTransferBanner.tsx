import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';

export const PendingAdministrationTransferBanner: React.FC = () => {
  const { isAuthenticated, refreshAuth } = useAuth();
  const [pending, setPending] = useState<any[]>([]);
  const [working, setWorking] = useState('');
  useEffect(() => { if (isAuthenticated) void apiClient.getMyPendingAdministrationTransfers().then(setPending).catch(() => setPending([])); else setPending([]); }, [isAuthenticated]);
  if (!pending.length) return null;
  return <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-950"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-5 w-5 text-amber-700"/><div><strong className="text-sm">Transferência administrativa pendente</strong><p className="text-xs">Confirme somente se você reconhece a solicitação e assumirá este portal.</p></div></div><div className="flex gap-2">{pending.map((transfer) => <button key={transfer.id} type="button" disabled={working === transfer.id} onClick={async () => { setWorking(transfer.id); try { await apiClient.acceptAdministrationTransfer(transfer.id); setPending((items) => items.filter((item) => item.id !== transfer.id)); await refreshAuth(); } finally { setWorking(''); } }} className="rounded-lg bg-amber-800 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Aceitar {transfer.role === 'MASTER_ADMIN' ? 'titularidade Master' : 'Presidência'}</button>)}</div></div></div>;
};
