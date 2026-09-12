import React, { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Plus, Save, Trash2, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { NursingEmblemLogo } from './NursingEmblemLogo';

interface Props {
  isMaster: boolean;
}

interface CommissionMemberInfo {
  id: string;
  name: string;
  email?: string;
  startDate?: string;
  endDate?: string;
  active: boolean;
}

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

function makeId(): string {
  return `commission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function legacyMembers(settings: any): CommissionMemberInfo[] {
  const names = [
    settings?.commissionMember2Name,
    settings?.commissionMember3Name,
    settings?.commissionMember4Name,
    settings?.commissionMember5Name,
  ].map((value) => String(value || '').trim()).filter(Boolean);
  return names.map((name, index) => ({ id: `legacy-${index + 2}`, name, email: '', startDate: '', endDate: '', active: true }));
}

function normalizeMembers(members: CommissionMemberInfo[]): CommissionMemberInfo[] {
  return members
    .map((member) => ({
      id: String(member.id || makeId()),
      name: String(member.name || '').trim(),
      email: String(member.email || '').trim().toLowerCase(),
      startDate: String(member.startDate || ''),
      endDate: String(member.endDate || ''),
      active: member.active !== false,
    }))
    .filter((member) => member.name);
}

export const CommissionIdentityPanel: React.FC<Props> = ({ isMaster }) => {
  const { settings, refreshAuth } = useAuth();
  const typedSettings = settings as any;
  const initialMembers = useMemo(() => {
    const current = Array.isArray(typedSettings?.commissionMembers) ? typedSettings.commissionMembers : [];
    return current.length ? normalizeMembers(current) : legacyMembers(typedSettings);
  }, [typedSettings]);
  const [members, setMembers] = useState<CommissionMemberInfo[]>(initialMembers);
  const [presidentName, setPresidentName] = useState(String(typedSettings?.commissionPresidentName || ''));
  const [maintainerName, setMaintainerName] = useState(String(typedSettings?.portalMaintainerName || ''));
  const [contactEmail, setContactEmail] = useState(String(typedSettings?.contactEmail || ''));
  const [whatsappUrl, setWhatsappUrl] = useState(String(typedSettings?.whatsappUrl || ''));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => setMembers(initialMembers), [initialMembers]);
  useEffect(() => {
    setPresidentName(String(typedSettings?.commissionPresidentName || ''));
    setMaintainerName(String(typedSettings?.portalMaintainerName || ''));
    setContactEmail(String(typedSettings?.contactEmail || ''));
    setWhatsappUrl(String(typedSettings?.whatsappUrl || ''));
  }, [typedSettings?.commissionPresidentName, typedSettings?.portalMaintainerName, typedSettings?.contactEmail, typedSettings?.whatsappUrl]);

  if (!isMaster) return null;

  const updateMember = (id: string, updates: Partial<CommissionMemberInfo>) => {
    setMembers((previous) => previous.map((member) => member.id === id ? { ...member, ...updates } : member));
  };

  const addMember = () => {
    setMembers((previous) => [...previous, { id: makeId(), name: '', email: '', startDate: '', endDate: '', active: true }]);
    setFeedback(null);
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const normalized = normalizeMembers(members);
      const invalidEmail = normalized.find((member) => member.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email));
      if (invalidEmail) throw new Error(`E-mail inválido para ${invalidEmail.name}.`);
      const invalidPeriod = normalized.find((member) => member.startDate && member.endDate && member.endDate < member.startDate);
      if (invalidPeriod) throw new Error(`A data final de ${invalidPeriod.name} não pode ser anterior à data inicial.`);
      const normalizedContactEmail = contactEmail.trim().toLowerCase();
      if (normalizedContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedContactEmail)) throw new Error('O e-mail público de contato é inválido.');
      const normalizedWhatsapp = whatsappUrl.trim();
      if (normalizedWhatsapp) {
        let parsed: URL;
        try { parsed = new URL(normalizedWhatsapp); } catch { throw new Error('Informe uma URL completa de WhatsApp, começando com https://.'); }
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('A URL de WhatsApp precisa usar http ou https.');
      }
      await apiClient.updateSettings({
        commissionPresidentName: presidentName.trim(),
        commissionMembers: normalized,
        portalMaintainerName: maintainerName.trim(),
        contactEmail: normalizedContactEmail,
        whatsappUrl: normalizedWhatsapp,
      } as any);
      setMembers(normalized);
      await refreshAuth();
      setFeedback({ ok: true, text: 'Dados salvos. Presidente, membros ativos e suporte já alimentam automaticamente o rodapé público.' });
    } catch (error) {
      setFeedback({ ok: false, text: error instanceof Error ? error.message : 'Não foi possível salvar os dados da Comissão.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="commission-management-title">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-700" />
              <h3 id="commission-management-title" className="text-xs font-black uppercase tracking-wide text-slate-950">Gestão da Comissão de TCC</h3>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-slate-600">Os dados desta área alimentam diretamente a identificação da Comissão no rodapé público.</p>
          </div>
          <button type="button" onClick={addMember} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase text-emerald-900 hover:bg-emerald-100">
            <Plus className="h-3.5 w-3.5" />Adicionar membro
          </button>
        </div>

        <div className="grid gap-4 border-b border-slate-200 px-4 py-4 lg:grid-cols-2">
          <label className="space-y-1.5">
            <span className="block text-[10px] font-black uppercase tracking-wide text-slate-600">Presidente da Comissão</span>
            <input value={presidentName} onChange={(event) => setPresidentName(event.target.value)} className={inputClass} placeholder="Nome completo do presidente" />
            <span className="block text-[10px] leading-4 text-slate-500">O e-mail que concede o papel de Presidente continua protegido pelo fluxo de transferência administrativa.</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="block text-[10px] font-black uppercase tracking-wide text-slate-600">Desenvolvimento e suporte</span>
              <input value={maintainerName} onChange={(event) => setMaintainerName(event.target.value)} className={inputClass} placeholder="Responsável ou equipe" />
            </label>
            <label className="space-y-1.5">
              <span className="block text-[10px] font-black uppercase tracking-wide text-slate-600">E-mail público de contato</span>
              <input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className={inputClass} placeholder="contato@ufes.br" />
            </label>
            <label className="space-y-1.5">
              <span className="block text-[10px] font-black uppercase tracking-wide text-slate-600">Link do WhatsApp</span>
              <input value={whatsappUrl} onChange={(event) => setWhatsappUrl(event.target.value)} className={inputClass} placeholder="https://wa.me/..." />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-700">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">E-mail</th>
                <th className="px-3 py-2">Início</th>
                <th className="px-3 py-2">Fim</th>
                <th className="px-3 py-2 text-center">Ativo</th>
                <th className="w-12 px-3 py-2" aria-label="Ações" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500">Nenhum membro adicional cadastrado. Use “Adicionar membro”.</td></tr>
              )}
              {members.map((member) => (
                <tr key={member.id} className="align-middle hover:bg-slate-50/70">
                  <td className="px-3 py-2"><input aria-label="Nome do membro" value={member.name} onChange={(event) => updateMember(member.id, { name: event.target.value })} className={inputClass} placeholder="Nome completo" /></td>
                  <td className="px-3 py-2"><input aria-label="E-mail do membro" type="email" value={member.email || ''} onChange={(event) => updateMember(member.id, { email: event.target.value })} className={inputClass} placeholder="nome@ufes.br" /></td>
                  <td className="px-3 py-2"><input aria-label="Início do mandato" type="date" value={member.startDate || ''} onChange={(event) => updateMember(member.id, { startDate: event.target.value })} className={inputClass} /></td>
                  <td className="px-3 py-2"><input aria-label="Fim do mandato" type="date" value={member.endDate || ''} onChange={(event) => updateMember(member.id, { endDate: event.target.value })} className={inputClass} /></td>
                  <td className="px-3 py-2 text-center"><input aria-label={`Membro ${member.name || 'sem nome'} ativo`} type="checkbox" checked={member.active !== false} onChange={(event) => updateMember(member.id, { active: event.target.checked })} className="h-4 w-4 accent-emerald-700" /></td>
                  <td className="px-3 py-2 text-center"><button type="button" onClick={() => setMembers((previous) => previous.filter((item) => item.id !== member.id))} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 hover:text-rose-800" aria-label={`Excluir ${member.name || 'membro'}`}><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-5 text-[11px] font-semibold" role="status">
            {feedback && <span className={feedback.ok ? 'text-emerald-700' : 'text-rose-700'}>{feedback.text}</span>}
          </div>
          <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#005830] px-4 py-2.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm hover:bg-[#004724] disabled:cursor-not-allowed disabled:opacity-50">
            <Save className="h-3.5 w-3.5" />{saving ? 'Salvando…' : 'Salvar Comissão e Rodapé'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="visual-identity-title">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <ImageIcon className="h-4 w-4 text-emerald-700" />
          <div>
            <h3 id="visual-identity-title" className="text-xs font-black uppercase tracking-wide text-slate-950">Identidade Visual</h3>
            <p className="mt-0.5 text-[11px] text-slate-600">Identidade institucional fixa desta instalação.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
          <div className="flex min-h-40 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
            <NursingEmblemLogo size={128} className="max-w-full" customSrc="/colenf-logo.png" />
          </div>
          <div className="space-y-3">
            <div><span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Instituição</span><strong className="text-sm text-slate-950">Universidade Federal do Espírito Santo</strong></div>
            <div><span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Curso</span><strong className="text-sm text-slate-950">Curso de Graduação em Enfermagem e Obstetrícia</strong></div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] leading-5 text-emerald-950"><strong>Marca institucional protegida.</strong> O Portal preserva a proporção do PNG transparente e possui fallback visual caso o arquivo estático não possa ser carregado.</div>
          </div>
        </div>
      </section>
    </div>
  );
};
