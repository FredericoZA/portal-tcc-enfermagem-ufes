import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, Plus, Save, Trash2, UserRoundCog, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';

interface Props { isMaster: boolean; }
interface CommissionMemberInfo { id: string; name: string; email?: string; startDate?: string; endDate?: string; active: boolean; }

const inputClass = 'w-full min-h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200';
const actionClass = 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

function makeId(): string { return `commission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function legacyMembers(settings: any): CommissionMemberInfo[] {
  return [settings?.commissionMember2Name, settings?.commissionMember3Name, settings?.commissionMember4Name, settings?.commissionMember5Name]
    .map((value) => String(value || '').trim()).filter(Boolean)
    .map((name, index) => ({ id: `legacy-${index + 2}`, name, email: '', startDate: '', endDate: '', active: true }));
}
function normalizeMembers(members: CommissionMemberInfo[]): CommissionMemberInfo[] {
  return members.map((member) => ({
    id: String(member.id || makeId()),
    name: String(member.name || '').trim(),
    email: String(member.email || '').trim().toLowerCase(),
    startDate: String(member.startDate || ''),
    endDate: String(member.endDate || ''),
    active: member.active !== false,
  })).filter((member) => member.name);
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
  const { settings, refreshAuth } = useAuth();
  const typedSettings = settings as any;
  const initialMembers = useMemo(() => {
    const current = Array.isArray(typedSettings?.commissionMembers) ? typedSettings.commissionMembers : [];
    return current.length ? normalizeMembers(current) : legacyMembers(typedSettings);
  }, [typedSettings]);

  const remotePresidentContact = String(typedSettings?.commissionPresidentContactEmail || typedSettings?.commissionPresidentEmail || '');
  const [presidentName, setPresidentName] = useState(String(typedSettings?.commissionPresidentName || ''));
  const [presidentEmail, setPresidentEmail] = useState(remotePresidentContact);
  const [secretaryName, setSecretaryName] = useState(String(typedSettings?.portalMaintainerName || ''));
  const [secretaryEmail, setSecretaryEmail] = useState(String(typedSettings?.contactEmail || ''));
  const [whatsappUrl, setWhatsappUrl] = useState(String(typedSettings?.whatsappUrl || ''));
  const [members, setMembers] = useState<CommissionMemberInfo[]>(initialMembers);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [savedText, setSavedText] = useState('');
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const lastSavedFingerprintRef = useRef('');
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);

  const currentFingerprint = useMemo(() => JSON.stringify({
    commissionPresidentName: presidentName.trim(),
    commissionPresidentContactEmail: presidentEmail.trim().toLowerCase(),
    commissionMembers: normalizeMembers(members),
    portalMaintainerName: secretaryName.trim(),
    contactEmail: secretaryEmail.trim().toLowerCase(),
    whatsappUrl: whatsappUrl.trim(),
  }), [presidentName, presidentEmail, members, secretaryName, secretaryEmail, whatsappUrl]);

  useEffect(() => {
    const snapshot = {
      commissionPresidentName: String(typedSettings?.commissionPresidentName || '').trim(),
      commissionPresidentContactEmail: String(typedSettings?.commissionPresidentContactEmail || typedSettings?.commissionPresidentEmail || '').trim().toLowerCase(),
      commissionMembers: initialMembers,
      portalMaintainerName: String(typedSettings?.portalMaintainerName || '').trim(),
      contactEmail: String(typedSettings?.contactEmail || '').trim().toLowerCase(),
      whatsappUrl: String(typedSettings?.whatsappUrl || '').trim(),
    };
    setPresidentName(snapshot.commissionPresidentName);
    setPresidentEmail(snapshot.commissionPresidentContactEmail);
    setMembers(snapshot.commissionMembers);
    setSecretaryName(snapshot.portalMaintainerName);
    setSecretaryEmail(snapshot.contactEmail);
    setWhatsappUrl(snapshot.whatsappUrl);
    lastSavedFingerprintRef.current = JSON.stringify(snapshot);
    hydratedRef.current = true;
  }, [typedSettings?.commissionPresidentName, typedSettings?.commissionPresidentContactEmail, typedSettings?.commissionPresidentEmail, typedSettings?.commissionMembers, typedSettings?.portalMaintainerName, typedSettings?.contactEmail, typedSettings?.whatsappUrl, initialMembers]);

  const validateAndBuildPatch = (showError: boolean) => {
    const normalizedPresidentName = presidentName.trim();
    const normalizedPresidentEmail = presidentEmail.trim().toLowerCase();
    const normalizedSecretaryEmail = secretaryEmail.trim().toLowerCase();
    const normalizedMembers = normalizeMembers(members);
    const normalizedWhatsapp = whatsappUrl.trim();
    const fail = (text: string) => { if (showError) setErrorText(text); return null; };

    if (!normalizedPresidentName) return fail('Informe o nome da Presidência da Comissão.');
    if (normalizedPresidentEmail && !validEmail(normalizedPresidentEmail)) return fail('Informe um e-mail válido para a Presidência da Comissão.');
    if (normalizedSecretaryEmail && !validEmail(normalizedSecretaryEmail)) return fail('O e-mail da Secretaria é inválido.');
    const invalidMember = normalizedMembers.find((member) => member.email && !validEmail(member.email));
    if (invalidMember) return fail(`E-mail inválido para ${invalidMember.name}.`);
    if (normalizedWhatsapp) {
      try {
        const parsed = new URL(normalizedWhatsapp);
        if (!['https:', 'http:'].includes(parsed.protocol)) return fail('O WhatsApp precisa usar uma URL http ou https.');
      } catch { return fail('Informe um link válido para o WhatsApp.'); }
    }

    return {
      commissionPresidentName: normalizedPresidentName,
      commissionPresidentContactEmail: normalizedPresidentEmail,
      commissionMembers: normalizedMembers,
      portalMaintainerName: secretaryName.trim(),
      contactEmail: normalizedSecretaryEmail,
      whatsappUrl: normalizedWhatsapp,
    };
  };

  const persistIdentity = async (manual: boolean) => {
    if (!isMaster) return false;
    const patch = validateAndBuildPatch(manual);
    if (!patch) return false;
    const fingerprint = JSON.stringify(patch);
    if (fingerprint === lastSavedFingerprintRef.current) {
      if (manual) setSavedText('Dados já estão salvos.');
      return true;
    }
    if (saveInFlightRef.current) await saveInFlightRef.current;

    const operation = (async () => {
      setSaving(true);
      setErrorText('');
      setSavedText('');
      try {
        await durableRetry(() => apiClient.updateSettings(patch as any));
        lastSavedFingerprintRef.current = fingerprint;
        await refreshAuth();
        setSavedText('Alterações salvas e atualizadas no rodapé.');
        window.setTimeout(() => setSavedText(''), 2200);
        return true;
      } catch (error: any) {
        setErrorText(error instanceof Error ? error.message : 'Não foi possível salvar os dados do rodapé.');
        return false;
      } finally {
        setSaving(false);
        saveInFlightRef.current = null;
      }
    })();
    saveInFlightRef.current = operation;
    return operation;
  };

  useEffect(() => {
    if (!isMaster || !hydratedRef.current || currentFingerprint === lastSavedFingerprintRef.current) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => { void persistIdentity(false); }, 700);
    return () => { if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current); };
  }, [currentFingerprint, isMaster]);

  if (!isMaster) return null;

  const updateMember = (id: string, updates: Partial<CommissionMemberInfo>) => setMembers((prev) => prev.map((member) => member.id === id ? { ...member, ...updates } : member));
  const addMember = () => { setMembers((prev) => [...prev, { id: makeId(), name: '', email: '', startDate: '', endDate: '', active: true }]); setErrorText(''); };
  const saveOnBlur = () => { if (currentFingerprint !== lastSavedFingerprintRef.current) void persistIdentity(false); };

  return (
    <section className="portal-commission-identity-panel portal-layer-card rounded-lg border border-slate-300" aria-labelledby="commission-management-title">
      <div className="flex flex-col gap-2 border-b border-slate-300 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--portal-brand-action)]" />
          <div>
            <h3 id="commission-management-title" className="text-xs font-black uppercase tracking-wide text-slate-950">Presidência, Secretaria e Comissão</h3>
            <p className="text-[10px] text-slate-600">Somente o usuário Master pode editar. As alterações são salvas automaticamente e refletidas no rodapé.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {savedText && <span className="text-[9px] font-bold text-emerald-800" role="status">{savedText}</span>}
          <button type="button" onClick={addMember} className={actionClass}><Plus className="h-3.5 w-3.5" />Adicionar membro</button>
          <button type="button" onClick={() => void persistIdentity(true)} disabled={saving} className={actionClass} aria-busy={saving}><Save className="h-3.5 w-3.5" />{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>

      <div className="grid gap-2 p-2.5 lg:grid-cols-2">
        <div className="portal-layer-panel rounded-lg border border-slate-300 p-2.5">
          <div className="mb-2 flex items-center gap-1.5"><UserRoundCog className="h-4 w-4 text-[var(--portal-brand-action)]"/><h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700">Presidente da Comissão</h4></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">Nome</span><input value={presidentName} onChange={(event) => setPresidentName(event.target.value)} onBlur={saveOnBlur} className={inputClass} /></label>
            <label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">E-mail de contato</span><input type="email" value={presidentEmail} onChange={(event) => setPresidentEmail(event.target.value)} onBlur={saveOnBlur} className={inputClass} placeholder="presidencia@instituicao.br" /></label>
          </div>
        </div>

        <div className="portal-layer-panel rounded-lg border border-slate-300 p-2.5">
          <div className="mb-2 flex items-center gap-1.5"><Mail className="h-4 w-4 text-[var(--portal-brand-action)]"/><h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700">Secretaria</h4></div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">Nome</span><input value={secretaryName} onChange={(event) => setSecretaryName(event.target.value)} onBlur={saveOnBlur} className={inputClass} /></label>
            <label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">E-mail</span><input type="email" value={secretaryEmail} onChange={(event) => setSecretaryEmail(event.target.value)} onBlur={saveOnBlur} className={inputClass} /></label>
            <label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">WhatsApp</span><input value={whatsappUrl} onChange={(event) => setWhatsappUrl(event.target.value)} onBlur={saveOnBlur} className={inputClass} placeholder="https://wa.me/..." /></label>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-300 px-2.5 pb-2.5 pt-2">
        <div className="mb-1.5 flex items-center justify-between gap-2"><h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700">Membros da Comissão</h4><span className="text-[9px] font-bold text-slate-500">{members.filter(member => member.name.trim()).length} cadastrado(s)</span></div>
        <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead className="portal-layer-card border-b border-slate-300 text-[9px] font-black uppercase tracking-wider text-slate-700"><tr><th className="px-2.5 py-2">Nome</th><th className="px-2.5 py-2">E-mail</th><th className="w-12 px-2.5 py-2 text-center">Excluir</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {members.length === 0 && <tr><td colSpan={3} className="px-3 py-3 text-center text-[10px] text-slate-500">Nenhum membro adicional cadastrado.</td></tr>}
              {members.map((member) => <tr key={member.id}>
                <td className="p-1.5"><input value={member.name} onChange={(event) => updateMember(member.id, { name: event.target.value })} onBlur={saveOnBlur} className={inputClass} placeholder="Nome completo" /></td>
                <td className="p-1.5"><input type="email" value={member.email || ''} onChange={(event) => updateMember(member.id, { email: event.target.value })} onBlur={saveOnBlur} className={inputClass} placeholder="email@instituicao.br" /></td>
                <td className="p-1.5 text-center"><button type="button" onClick={() => setMembers((prev) => prev.filter((item) => item.id !== member.id))} className="rounded-lg border border-slate-200 bg-white p-1.5 text-rose-700 hover:bg-rose-50" aria-label={`Excluir ${member.name || 'membro'}`}><Trash2 className="h-3.5 w-3.5" /></button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {errorText && <div className="border-t border-slate-300 bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-800" role="alert">{errorText}</div>}
    </section>
  );
};
