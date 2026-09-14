import React, { useEffect, useState } from 'react';
import { KeyRound, Save, ShieldCheck, UserCog, UserRoundCheck } from 'lucide-react';
import { apiClient, ApiRequestError } from '../services/apiClient';
import type { GlobalSettings } from '../types';
import { portalNotice } from '../services/portalDialogs';

interface Props {
  settings: GlobalSettings;
  onSettingsUpdated: (updated: GlobalSettings) => void;
  showNotification: (msg: string) => void;
}

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200';
const labelClass = 'block text-[10px] font-black uppercase tracking-wide text-slate-600';
const recoveryPresidentEmail = (settings: GlobalSettings): string => String(settings.commissionPresidentEmail || settings.masterRecoveryEmails?.[0] || '').trim().toLowerCase();

export const AdministrativeAccountsPanel: React.FC<Props> = ({ settings, onSettingsUpdated, showNotification }) => {
  const [masterName, setMasterName] = useState(settings.ownerName || settings.portalMaintainerName || 'Administrador Master');
  const [masterEmail, setMasterEmail] = useState(settings.masterEmail || '');
  const [presidentName, setPresidentName] = useState(settings.commissionPresidentName || '');
  const [presidentEmail, setPresidentEmail] = useState(recoveryPresidentEmail(settings));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMasterName(settings.ownerName || settings.portalMaintainerName || 'Administrador Master');
    setMasterEmail(settings.masterEmail || '');
    setPresidentName(settings.commissionPresidentName || '');
    setPresidentEmail(recoveryPresidentEmail(settings));
  }, [settings]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const normalizedMaster = masterEmail.trim().toLowerCase();
      const normalizedPresident = presidentEmail.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedMaster)) throw new Error('Informe um e-mail válido para o Master.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedPresident)) throw new Error('Informe um e-mail válido para a Presidente.');

      const updated = await apiClient.updateSettings({
        ownerName: masterName.trim(),
        commissionPresidentName: presidentName.trim()
      });

      const transfers: string[] = [];
      const currentPresident = recoveryPresidentEmail(settings);
      if (normalizedPresident !== currentPresident || !settings.commissionPresidentEmail) {
        await apiClient.createAdministrationTransfer('COMMISSION_PRESIDENT', normalizedPresident);
        transfers.push('Presidência');
      }
      if (normalizedMaster !== String(settings.masterEmail || '').toLowerCase()) {
        await apiClient.createAdministrationTransfer('MASTER_ADMIN', normalizedMaster);
        transfers.push('Master');
      }

      onSettingsUpdated(updated);
      showNotification(transfers.length
        ? `Dados salvos. Convite de transferência enviado para ${transfers.join(' e ')}.`
        : 'Contas administrativas atualizadas.');
    } catch (error) {
      const detail = error instanceof ApiRequestError && error.status === 428
        ? 'Por segurança, entre novamente no Portal e repita a transferência administrativa.'
        : error instanceof Error ? error.message : 'Não foi possível salvar as contas administrativas.';
      portalNotice(detail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><UserCog className="h-5 w-5 text-[#435649]"/><h3 className="font-black uppercase tracking-wide text-slate-950">Contas administrativas</h3></div>
          <p className="mt-0.5 text-xs text-slate-600">Master e Presidência no mesmo bloco. A Presidente é o contato institucional de recuperação do Master.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[10px] font-black uppercase text-slate-700"><ShieldCheck className="h-3.5 w-3.5"/>Trocas exigem código e aceite</div>
      </div>

      <form onSubmit={save} className="p-3">
        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="mb-2 flex items-center gap-2"><KeyRound className="h-4 w-4 text-slate-600"/><h4 className="text-xs font-black uppercase tracking-wide text-slate-800">Usuário Master</h4></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1"><span className={labelClass}>Nome</span><input value={masterName} onChange={(e) => setMasterName(e.target.value)} required className={inputClass}/></label>
              <label className="space-y-1"><span className={labelClass}>E-mail de acesso</span><input type="email" value={masterEmail} onChange={(e) => setMasterEmail(e.target.value)} required className={inputClass}/></label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><UserRoundCheck className="h-4 w-4 text-slate-600"/><h4 className="text-xs font-black uppercase tracking-wide text-slate-800">Presidente da Comissão</h4></div><span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[9px] font-black uppercase text-slate-600">Recuperação do Master</span></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1"><span className={labelClass}>Nome</span><input value={presidentName} onChange={(e) => setPresidentName(e.target.value)} required className={inputClass}/></label>
              <label className="space-y-1"><span className={labelClass}>E-mail de acesso e recuperação</span><input type="email" value={presidentEmail} onChange={(e) => setPresidentEmail(e.target.value)} required className={inputClass}/></label>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-slate-500">A Presidente autenticada também pode iniciar a transferência do Master. O novo titular recebe código e precisa aceitar o convite; nenhuma troca é imediata.</p>
          </div>
        </div>

        <div className="mt-3 flex justify-end"><button type="submit" disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-600 bg-slate-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"><Save className="h-4 w-4"/>{saving ? 'Salvando…' : 'Salvar contas'}</button></div>
      </form>
    </section>
  );
};
