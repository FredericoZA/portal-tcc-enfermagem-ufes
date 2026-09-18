import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Plus, Save, Trash2, UserRoundCog, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { portalConfirm } from '../services/portalDialogs';

interface Props { isMaster: boolean; }
interface CommissionMemberInfo { id: string; name: string; email?: string; startDate?: string; endDate?: string; active: boolean; }

const inputClass = 'w-full min-h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 outline-none focus:border-[#337959] focus:ring-2 focus:ring-[#337959]/15';
const actionClass = 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

function makeId(): string { return `commission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function legacyMembers(settings: any): CommissionMemberInfo[] {
  return [settings?.commissionMember2Name, settings?.commissionMember3Name, settings?.commissionMember4Name, settings?.commissionMember5Name]
    .map((value) => String(value || '').trim()).filter(Boolean)
    .map((name, index) => ({ id: `legacy-${index + 2}`, name, email: '', startDate: '', endDate: '', active: true }));
}
function normalizeMembers(members: CommissionMemberInfo[]): CommissionMemberInfo[] {
  return members.map((member) => ({ id: String(member.id || makeId()), name: String(member.name || '').trim(), email: String(member.email || '').trim().toLowerCase(), startDate: String(member.startDate || ''), endDate: String(member.endDate || ''), active: member.active !== false })).filter((member) => member.name);
}
function validEmail(value: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
async function durableRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await operation(); }
    catch (error: any) {
      lastError = error;
      const transient = error?.status === 503 || /banco durável|persistência|temporariamente/i.test(String(error?.message || ''));
      if (!transient || attempt === 2) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

export const CommissionIdentityPanel: React.FC<Props> = ({ isMaster }) => {
  const { settings, refreshAuth, isCommissionPresident } = useAuth();
  const typedSettings = settings as any;
  const initialMembers = useMemo(() => {
    const current = Array.isArray(typedSettings?.commissionMembers) ? typedSettings.commissionMembers : [];
    return current.length ? normalizeMembers(current) : legacyMembers(typedSettings);
  }, [typedSettings]);

  const [presidentName, setPresidentName] = useState(String(typedSettings?.commissionPresidentName || ''));
  const [presidentEmail, setPresidentEmail] = useState(String(typedSettings?.commissionPresidentEmail || ''));
  const [secretaryName, setSecretaryName] = useState(String(typedSettings?.portalMaintainerName || ''));
  const [secretaryEmail, setSecretaryEmail] = useState(String(typedSettings?.contactEmail || ''));
  const [whatsappUrl, setWhatsappUrl] = useState(String(typedSettings?.whatsappUrl || ''));
  const [members, setMembers] = useState<CommissionMemberInfo[]>(initialMembers);
  const [masterTransferEmail, setMasterTransferEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [transferringMaster, setTransferringMaster] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => setMembers(initialMembers), [initialMembers]);
  useEffect(() => {
    setPresidentName(String(typedSettings?.commissionPresidentName || ''));
    setPresidentEmail(String(typedSettings?.commissionPresidentEmail || ''));
    setSecretaryName(String(typedSettings?.portalMaintainerName || ''));
    setSecretaryEmail(String(typedSettings?.contactEmail || ''));
    setWhatsappUrl(String(typedSettings?.whatsappUrl || ''));
  }, [typedSettings?.commissionPresidentName, typedSettings?.commissionPresidentEmail, typedSettings?.portalMaintainerName, typedSettings?.contactEmail, typedSettings?.whatsappUrl]);

  if (!isMaster) return null;

  const updateMember = (id: string, updates: Partial<CommissionMemberInfo>) => setMembers((prev) => prev.map((member) => member.id === id ? { ...member, ...updates } : member));
  const addMember = () => { setMembers((prev) => [...prev, { id: makeId(), name: '', email: '', startDate: '', endDate: '', active: true }]); setFeedback(null); };

  const saveAdministrativeIdentity = async () => {
    setSaving(true); setFeedback(null);
    try {
      const normalizedPresidentName = presidentName.trim();
      const normalizedPresidentEmail = presidentEmail.trim().toLowerCase();
      const normalizedSecretaryEmail = secretaryEmail.trim().toLowerCase();
      const normalizedMembers = normalizeMembers(members);
      if (!normalizedPresidentName) throw new Error('Informe o nome da Presidência da Comissão.');
      if (!normalizedPresidentEmail || !validEmail(normalizedPresidentEmail)) throw new Error('Informe um e-mail válido para a Presidência da Comissão.');
      if (normalizedSecretaryEmail && !validEmail(normalizedSecretaryEmail)) throw new Error('O e-mail da Secretaria é inválido.');
      const invalidMember = normalizedMembers.find((member) => member.email && !validEmail(member.email));
      if (invalidMember) throw new Error(`E-mail inválido para ${invalidMember.name}.`);
      const normalizedWhatsapp = whatsappUrl.trim();
      if (normalizedWhatsapp) { const parsed = new URL(normalizedWhatsapp); if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('O WhatsApp precisa usar uma URL http ou https.'); }

      await durableRetry(() => apiClient.updateSettings({ commissionPresidentName: normalizedPresidentName, commissionMembers: normalizedMembers, portalMaintainerName: secretaryName.trim(), contactEmail: normalizedSecretaryEmail, whatsappUrl: normalizedWhatsapp } as any));
      const currentPresidentEmail = String(typedSettings?.commissionPresidentEmail || '').trim().toLowerCase();
      let transferStarted = false;
      if (normalizedPresidentEmail !== currentPresidentEmail) { await apiClient.createAdministrationTransfer('COMMISSION_PRESIDENT', normalizedPresidentEmail); transferStarted = true; }
      setMembers(normalizedMembers); await refreshAuth();
      setFeedback({ ok: true, text: transferStarted ? 'Dados do rodapé salvos. A troca do e-mail da Presidência foi iniciada com confirmação segura.' : 'Dados do rodapé e membros da comissão salvos no banco durável.' });
    } catch (error: any) {
      const needsReauth = error?.status === 428;
      setFeedback({ ok: false, text: needsReauth ? 'Os dados foram preservados. Entre novamente no Portal antes de trocar um e-mail administrativo.' : error instanceof Error ? error.message : 'Não foi possível salvar os dados do rodapé.' });
    } finally { setSaving(false); }
  };

  const startMasterTransfer = async () => {
    if (!isCommissionPresident) return;
    const targetEmail = masterTransferEmail.trim().toLowerCase();
    if (!validEmail(targetEmail)) { setFeedback({ ok: false, text: 'Informe um novo e-mail válido para o Usuário Master.' }); return; }
    if (targetEmail === String(typedSettings?.masterEmail || '').trim().toLowerCase()) { setFeedback({ ok: false, text: 'Esse e-mail já é o Usuário Master atual.' }); return; }
    if (!(await portalConfirm(`Iniciar a troca segura do Usuário Master para ${targetEmail}? O novo titular deverá confirmar o acesso.`))) return;
    setTransferringMaster(true); setFeedback(null);
    try { await apiClient.createAdministrationTransfer('MASTER_ADMIN', targetEmail); setMasterTransferEmail(''); setFeedback({ ok: true, text: 'Troca do Usuário Master iniciada. O novo e-mail precisa concluir a confirmação segura.' }); }
    catch (error: any) { setFeedback({ ok: false, text: error?.status === 428 ? 'Entre novamente no Portal antes de trocar o Usuário Master.' : (error instanceof Error ? error.message : 'Não foi possível iniciar a troca do Usuário Master.') }); }
    finally { setTransferringMaster(false); }
  };

  return (
    <section className="portal-commission-identity-panel overflow-hidden rounded-xl border border-slate-300 bg-[#e1e6e9] shadow-sm" aria-labelledby="commission-management-title">
      <div className="portal-administration-details">
        <div className="flex flex-col gap-2 border-b-2 border-white bg-[#337959] px-3 py-2 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2"><Users className="h-4 w-4" /><div><h3 id="commission-management-title" className="text-xs font-black uppercase tracking-wide">Sincronização do rodapé</h3><p className="text-[9px] text-white/80">Presidência, Secretaria e Comissão alimentam os contatos exibidos no Portal.</p></div></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={addMember} className={actionClass}><Plus className="h-3.5 w-3.5" />Adicionar membro</button><button type="button" onClick={() => void saveAdministrativeIdentity()} disabled={saving} className={actionClass}><Save className="h-3.5 w-3.5" />{saving ? 'Salvando…' : 'Salvar'}</button></div>
        </div>

        <div className="grid gap-2 p-2.5 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-300 bg-[#d5dce0] p-2.5">
            <div className="mb-2 flex items-center gap-1.5"><UserRoundCog className="h-4 w-4 text-[#337959]"/><h4 className="text-[10px] font-black uppercase tracking-wider text-slate-800">Presidência da Comissão</h4></div>
            <div className="grid gap-2 sm:grid-cols-2"><label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">Nome</span><input value={presidentName} onChange={(event) => setPresidentName(event.target.value)} className={inputClass} /></label><label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">E-mail</span><input type="email" value={presidentEmail} onChange={(event) => setPresidentEmail(event.target.value)} className={inputClass} /></label></div>
            <p className="mt-1.5 text-[9px] leading-4 text-slate-500">Troca de e-mail exige confirmação segura antes de transferir a Presidência.</p>
          </div>

          <div className="rounded-lg border border-slate-300 bg-[#d5dce0] p-2.5">
            <div className="mb-2 flex items-center gap-1.5"><Mail className="h-4 w-4 text-[#337959]"/><h4 className="text-[10px] font-black uppercase tracking-wider text-slate-800">Secretaria</h4></div>
            <div className="grid gap-2 sm:grid-cols-3"><label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">Nome</span><input value={secretaryName} onChange={(event) => setSecretaryName(event.target.value)} className={inputClass} /></label><label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">E-mail</span><input type="email" value={secretaryEmail} onChange={(event) => setSecretaryEmail(event.target.value)} className={inputClass} /></label><label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">WhatsApp</span><input value={whatsappUrl} onChange={(event) => setWhatsappUrl(event.target.value)} className={inputClass} placeholder="https://wa.me/..." /></label></div>
          </div>
        </div>

        <div className="border-t border-slate-300 px-2.5 pb-2.5 pt-2">
          <div className="mb-1.5 flex items-center justify-between gap-2"><h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700">Membros da Comissão</h4><span className="text-[9px] font-bold text-slate-500">{members.length} cadastrado(s)</span></div>
          <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
            <table className="w-full min-w-[520px] border-collapse text-left"><thead className="bg-[#5d9679] text-[9px] font-black uppercase tracking-wider text-white"><tr><th className="px-2.5 py-2">Nome</th><th className="px-2.5 py-2">E-mail</th><th className="w-12 px-2.5 py-2 text-center">Excluir</th></tr></thead><tbody className="divide-y divide-slate-100">{members.length === 0 && <tr><td colSpan={3} className="px-3 py-3 text-center text-[10px] text-slate-500">Nenhum membro adicional cadastrado.</td></tr>}{members.map((member) => <tr key={member.id}><td className="p-1.5"><input value={member.name} onChange={(event) => updateMember(member.id, { name: event.target.value })} className={inputClass} placeholder="Nome completo" /></td><td className="p-1.5"><input type="email" value={member.email || ''} onChange={(event) => updateMember(member.id, { email: event.target.value })} className={inputClass} placeholder="email@instituicao.br" /></td><td className="p-1.5 text-center"><button type="button" onClick={() => setMembers((prev) => prev.filter((item) => item.id !== member.id))} className="rounded-lg border p-1.5" aria-label={`Excluir ${member.name || 'membro'}`}><Trash2 className="h-3.5 w-3.5" /></button></td></tr>)}</tbody></table>
          </div>
        </div>
      </div>

      {isCommissionPresident && <div className="portal-president-master-transfer border-t border-slate-300 bg-[#d5dce0] p-2.5"><div className="flex flex-col gap-2 lg:flex-row lg:items-end"><div className="min-w-0 flex-1"><span className="block text-[10px] font-black uppercase text-slate-700">Usuário Master</span><p className="mt-0.5 text-[10px] text-slate-500">Somente a Presidência pode iniciar a troca do e-mail Master. Atual: <strong>{typedSettings?.masterEmail || 'não informado'}</strong>.</p></div><label className="w-full lg:max-w-sm"><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">Novo e-mail do Usuário Master</span><input type="email" value={masterTransferEmail} onChange={(event) => setMasterTransferEmail(event.target.value)} className={inputClass} placeholder="novo-master@instituicao.br" /></label><button type="button" onClick={() => void startMasterTransfer()} disabled={transferringMaster || !masterTransferEmail.trim()} className={actionClass}>{transferringMaster ? 'Enviando…' : 'Iniciar troca segura'}</button></div></div>}

      {feedback && <div className="border-t border-slate-300 bg-white px-3 py-2 text-[10px] font-semibold" role="status"><span className={feedback.ok ? 'text-slate-700' : 'text-[#b42318]'}>{feedback.text}</span></div>}
    </section>
  );
};
