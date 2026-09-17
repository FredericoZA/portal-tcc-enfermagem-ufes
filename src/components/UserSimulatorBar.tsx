import { portalConfirm, portalNotice } from '../services/portalDialogs';
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserCheck, RefreshCw, Shield } from 'lucide-react';
import { apiClient } from '../services/apiClient';

const PRESET_USERS = [
  { label: 'Visitante / Público (Sem Login)', email: 'visitante@publico.local', role: 'Visitante' },
  { label: 'Administrador Master', email: 'master@portal.local', role: 'Administrador Master' },
  { label: 'Presidente da Comissão', email: 'presidente@portal.local', role: 'Presidente da Comissão' },
  { label: 'Professor Orientador', email: 'ana.santos@ufes.br', role: 'Orientador' },
  { label: 'Professor Coorientador', email: 'marcos.coorientador@ufes.br', role: 'Coorientador' },
  { label: 'Membro Examinador da Banca', email: 'roberto.examinador@ufes.br', role: 'Membro da Banca' },
  { label: 'Discente / Aluna (Mariana Silva)', email: 'mariana.silva@aluno.ufes.br', role: 'Aluno' },
  { label: 'Discente / Aluno (João Pedro)', email: 'joao.pedro@aluno.ufes.br', role: 'Aluno' }
];

export const UserSimulatorBar: React.FC = () => {
  const { userEmail, switchUser, refreshAuth } = useAuth();
  const [customEmail, setCustomEmail] = React.useState('');
  const [isResetting, setIsResetting] = React.useState(false);

  const handleSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val) {
      await switchUser(val);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customEmail.trim()) {
      await switchUser(customEmail.trim().toLowerCase());
      setCustomEmail('');
    }
  };

  const handleResetDemo = async () => {
    if ((await portalConfirm('Deseja restaurar os dados de demonstração originais da Fase 1?'))) {
      setIsResetting(true);
      try {
        await apiClient.resetDemoData();
        await refreshAuth();
        portalNotice('Dados de demonstração restaurados com sucesso!');
      } catch (err) {
        portalNotice('Erro ao restaurar dados de demonstração.');
      } finally {
        setIsResetting(false);
      }
    }
  };

  return (
    <div id="user-simulator-bar" className="bg-slate-950 text-slate-100 text-xs px-2 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 sm:gap-3 border-b border-slate-800 shadow-inner overflow-x-hidden">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 font-bold text-emerald-300 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-700/50 uppercase tracking-wider text-[10px]">
          <Shield className="w-3 h-3 text-emerald-400" /> SIMULAÇÃO DE PERFIL
        </span>
        <span className="text-slate-400 hidden lg:inline text-[11px] font-medium">
          Alternar e-mail para simular permissões de qualquer usuário
        </span>
      </div>

      <div className="flex min-w-0 w-full sm:w-auto items-center gap-2 sm:gap-3 flex-wrap">
        <div className="flex min-w-0 max-w-full items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-300 font-bold uppercase text-[10px] tracking-wider">Simular como:</span>
          <select
            id="preset-user-select"
            value={userEmail}
            onChange={handleSelect}
            className="min-w-0 max-w-[190px] sm:max-w-[300px] bg-slate-900 text-slate-100 border border-slate-700 rounded-full px-2 sm:px-3 py-1 text-xs focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
          >
            {PRESET_USERS.map((u) => (
              <option key={u.email} value={u.email}>
                {u.label} ({u.email})
              </option>
            ))}
            {!PRESET_USERS.some((u) => u.email === userEmail) && (
              <option value={userEmail}>E-mail personalizado: {userEmail}</option>
            )}
          </select>
        </div>

        <form onSubmit={handleCustomSubmit} className="flex items-center gap-1">
          <input
            id="custom-email-input"
            type="email"
            placeholder="Outro e-mail..."
            value={customEmail}
            onChange={(e) => setCustomEmail(e.target.value)}
            className="min-w-0 bg-slate-900 text-slate-100 border border-slate-700 rounded-full px-3 py-1 w-28 sm:w-36 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            id="switch-custom-email-btn"
            type="submit"
            className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1 rounded-full transition-colors font-bold text-[10px] uppercase tracking-wider cursor-pointer"
          >
            Entrar
          </button>
        </form>

        <button
          id="reset-demo-data-btn"
          onClick={handleResetDemo}
          disabled={isResetting}
          title="Restaurar dados de demonstração da Fase 1"
          className="flex items-center gap-1 bg-amber-900/60 hover:bg-amber-800 text-amber-200 px-3 py-1 rounded-full border border-amber-700/50 transition-colors font-bold text-[10px] uppercase tracking-wider cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${isResetting ? 'animate-spin' : ''}`} />
          <span>Restaurar Dados</span>
        </button>
      </div>
    </div>
  );
};
