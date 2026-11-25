import { ChevronDown, User, Users } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { PortalModalShell } from './PortalModalShell';

type Account = Awaited<ReturnType<typeof apiClient.getAccountViewTargets>>[number];
const searchText = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLocaleLowerCase('pt-BR');

export function AccountViewControl() {
  const { userEmail, viewingAccount, accountView, changeAccountView } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const openAccounts = async () => {
    setOpen(true);
    setQuery('');
    setError('');
    setAccounts([]);
    setLoading(true);
    try { setAccounts(await apiClient.getAccountViewTargets()); }
    catch { setError('Não foi possível carregar as contas. Tente novamente.'); }
    finally { setLoading(false); }
  };

  const selectAccount = async (email: string | null) => {
    setError('');
    setBusy(true);
    try { await changeAccountView(email); }
    catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível trocar a visualização.');
      setBusy(false);
    }
  };

  const masterEmail = accountView?.masterEmail || userEmail;
  const viewName = accountView?.targetName || 'Usuário Master';
  const needle = searchText(query);
  const visibleAccounts = accounts.filter(account => searchText(`${account.name} ${account.email}`).includes(needle));

  return (
    <>
      <div id="user-profile-summary" className="flex min-w-0 max-w-full items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-1.5">
        <User className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <div className="min-w-0 text-xs">
          <p className="truncate font-bold text-slate-900" title={masterEmail}>{masterEmail}</p>
          <button type="button" aria-haspopup="dialog" aria-expanded={open} disabled={busy}
            onClick={() => void openAccounts()} className="flex max-w-full items-center gap-1 py-0.5 text-left font-semibold text-emerald-800 hover:underline">
            <span className="truncate" title={viewingAccount ?? masterEmail}>Visão de {viewName}</span>
            <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
          </button>
          {viewingAccount && (
            <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-700">
              <span>Somente consulta</span>
              <button type="button" disabled={busy} onClick={() => void selectAccount(null)}
                className="py-0.5 text-left font-semibold underline">
                Voltar à visão Master
              </button>
            </div>
          )}
        </div>
      </div>

      {!open && error && <p role="alert" className="text-xs text-red-800">{error}</p>}
      <PortalModalShell open={open} onClose={() => setOpen(false)} title="Visão de outra conta" icon={Users}
        maxWidthClass="max-w-lg" closeOnEscape={!busy} closeOnBackdrop={!busy}
        footer={<button type="button" className="portal-action ml-auto" disabled={busy} onClick={() => setOpen(false)}>Fechar</button>}>
        <p className="mb-3 text-sm text-slate-700">Somente consulta. A sessão continua sendo do Master.</p>
        <label htmlFor="account-view-search" className="text-xs font-semibold text-slate-800">Buscar por nome ou e-mail</label>
        <input id="account-view-search" type="search" className="portal-input mt-1 w-full" value={query} disabled={busy}
          onChange={event => setQuery(event.target.value)} />
        {error && (
          <div className="mt-3 text-sm text-red-800">
            <p role="alert">{error}</p>
            {!accounts.length && <button type="button" className="portal-action mt-2" onClick={() => void openAccounts()}>Tentar novamente</button>}
          </div>
        )}
        {loading && <p role="status" className="mt-3 text-sm">Carregando contas…</p>}
        {!loading && !error && !visibleAccounts.length && <p className="mt-3 text-sm text-slate-600">Nenhuma conta encontrada.</p>}
        {!!visibleAccounts.length && (
          <ul className="mt-3 max-h-[45vh] divide-y divide-slate-200 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {visibleAccounts.map(account => (
              <li key={account.email}>
                <button type="button" disabled={busy || viewingAccount === account.email} onClick={() => void selectAccount(account.email)}
                  className="block w-full px-3 py-2 text-left text-sm enabled:hover:bg-emerald-50 disabled:bg-slate-50">
                  <span className="block break-words font-semibold text-slate-900">{account.name}</span>
                  <span className="block break-all text-xs text-slate-600">{account.email}{viewingAccount === account.email && ' · Visão atual'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PortalModalShell>
    </>
  );
}
