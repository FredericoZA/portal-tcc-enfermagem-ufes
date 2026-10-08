import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { retryAfterPortalReauthentication } from '../services/reauthentication';

interface Props { isMaster: boolean; }
interface CommissionMemberInfo { id: string; name: string; email?: string; active: boolean; }

const inputClass = 'w-full min-h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200';
const fieldClass = 'rounded-lg border border-slate-300 p-2.5';
const labelClass = 'mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-600';

function makeId(): string { return `commission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function validEmail(value: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function normalizeMembers(members: CommissionMemberInfo[]): CommissionMemberInfo[] {
  return members.map(member => ({
    id: String(member.id || makeId()),
    name: String(member.name || '').trim(),
    email: String(member.email || '').trim().toLowerCase(),
    active: member.active !== false,
  })).filter(member => member.name);
}
function legacyMembers(settings: any): CommissionMemberInfo[] {
  return [settings?.commissionMember2Name, settings?.commissionMember3Name, settings?.commissionMember4Name, settings?.commissionMember5Name]
    .map((value) => String(value || '').trim()).filter(Boolean)
    .map((name, index) => ({ id: `legacy-${index + 2}`, name, email: '', active: true }));
}
async function durableRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await operation(); }
    catch (error: any) {
      lastError = error;
      const transient = error?.status === 503 || /banco durável|persistência|temporariamente/i.test(String(error?.message || ''));
      if (!transient || attempt === 2) throw error;
      await new Promise(resolve => window.setTimeout(resolve, 450 * (attempt + 1)));
    }
  }
  throw lastError;
}

export const CommissionIdentityPanel: React.FC<Props> = ({ isMaster }) => {
  const { settings, refreshAuth } = useAuth();
  const s = settings as any;
  const currentMembers = useMemo(() => {
    const configured = Array.isArray(s?.commissionMembers) ? s.commissionMembers : [];
    return configured.length ? normalizeMembers(configured) : legacyMembers(s);
  }, [s?.commissionMembers, s?.commissionMember2Name, s?.commissionMember3Name, s?.commissionMember4Name, s?.commissionMember5Name]);

  const [masterName, setMasterName] = useState(String(s?.ownerName || s?.portalMaintainerName || ''));
  const [masterEmail, setMasterEmail] = useState(String(s?.masterEmail || ''));
  const [presidentName, setPresidentName] = useState(String(s?.commissionPresidentName || ''));
  const [presidentEmail, setPresidentEmail] = useState(String(s?.commissionPresidentEmail || s?.commissionPresidentContactEmail || ''));
  const [secretaryEmail, setSecretaryEmail] = useState(String(s?.contactEmail || ''));
  const [whatsappUrl, setWhatsappUrl] = useState(String(s?.whatsappUrl || ''));
  const [members, setMembers] = useState<CommissionMemberInfo[]>(currentMembers);
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState('');
  const timerRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const lastSavedRef = useRef('');
  const masterEmailRef = useRef(String(s?.masterEmail || '').trim().toLowerCase());
  const presidentEmailRef = useRef(String(s?.commissionPresidentEmail || '').trim().toLowerCase());

  const buildPatch = () => ({
    ownerName: masterName.trim(),
    portalMaintainerName: masterName.trim(),
    commissionPresidentName: presidentName.trim(),
    commissionPresidentContactEmail: presidentEmail.trim().toLowerCase(),
    contactEmail: secretaryEmail.trim().toLowerCase(),
    whatsappUrl: whatsappUrl.trim(),
    commissionMembers: normalizeMembers(members),
  });
  const fingerprint = useMemo(() => JSON.stringify(buildPatch()), [masterName, presidentName, presidentEmail, secretaryEmail, whatsappUrl, members]);

  useEffect(() => {
    const nextMasterEmail = String(s?.masterEmail || '').trim().toLowerCase();
    const nextPresidentEmail = String(s?.commissionPresidentEmail || s?.commissionPresidentContactEmail || '').trim().toLowerCase();
    const patch = {
      ownerName: String(s?.ownerName || s?.portalMaintainerName || '').trim(),
      portalMaintainerName: String(s?.ownerName || s?.portalMaintainerName || '').trim(),
      commissionPresidentName: String(s?.commissionPresidentName || '').trim(),
      commissionPresidentContactEmail: String(s?.commissionPresidentContactEmail || nextPresidentEmail).trim().toLowerCase(),
      contactEmail: String(s?.contactEmail || '').trim().toLowerCase(),
      whatsappUrl: String(s?.whatsappUrl || '').trim(),
      commissionMembers: currentMembers,
    };
    setMasterName(patch.ownerName);
    setMasterEmail(nextMasterEmail);
    setPresidentName(patch.commissionPresidentName);
    setPresidentEmail(nextPresidentEmail);
    setSecretaryEmail(patch.contactEmail);
    setWhatsappUrl(patch.whatsappUrl);
    setMembers(currentMembers);
    masterEmailRef.current = nextMasterEmail;
    presidentEmailRef.current = String(s?.commissionPresidentEmail || '').trim().toLowerCase();
    lastSavedRef.current = JSON.stringify(patch);
    hydratedRef.current = true;
  }, [s?.masterEmail, s?.ownerName, s?.portalMaintainerName, s?.commissionPresidentName, s?.commissionPresidentEmail, s?.commissionPresidentContactEmail, s?.contactEmail, s?.whatsappUrl, currentMembers]);

  const validate = () => {
    if (!masterName.trim()) return 'Informe o nome da Secretaria / Administrador Master.';
    if (masterEmail.trim() && !validEmail(masterEmail.trim())) return 'O e-mail de acesso do Usuário Master é inválido.';
    if (!presidentName.trim()) return 'Informe o nome da Presidência da Comissão.';
    if (presidentEmail.trim() && !validEmail(presidentEmail.trim())) return 'O e-mail da Presidência é inválido.';
    if (secretaryEmail.trim() && !validEmail(secretaryEmail.trim())) return 'O e-mail de contato da Secretaria é inválido.';
    const invalidMember = normalizeMembers(members).find(member => member.email && !validEmail(member.email));
    if (invalidMember) return `E-mail inválido para ${invalidMember.name}.`;
    if (whatsappUrl.trim()) {
      try { const parsed = new URL(whatsappUrl.trim()); if (!['http:', 'https:'].includes(parsed.protocol)) return 'O WhatsApp precisa usar uma URL http ou https.'; }
      catch { return 'Informe um link válido para o WhatsApp.'; }
    }
    return '';
  };

  const reauthenticateAndTransfer = (role: 'MASTER_ADMIN' | 'COMMISSION_PRESIDENT', targetEmail: string) =>
    retryAfterPortalReauthentication(
      () => apiClient.createAdministrationTransfer(role, targetEmail),
      'Confirme sua identidade para alterar os e-mails administrativos. Você permanece no Portal.'
    );

  const persistRegularFields = async () => {
    if (!isMaster || !hydratedRef.current) return;
    const error = validate();
    if (error) { setErrorText(error); return; }
    const patch = buildPatch();
    const next = JSON.stringify(patch);
    if (next === lastSavedRef.current) return;
    setSaving(true); setErrorText('');
    try {
      await durableRetry(() => apiClient.updateSettings(patch as any));
      await refreshAuth();
      lastSavedRef.current = next;

    } catch (error: any) {
      setErrorText(error instanceof Error ? error.message : 'Não foi possível salvar os dados do rodapé.');
    } finally { setSaving(false); }
  };

  const persistSensitiveEmails = async () => {
    if (!isMaster) return;
    const error = validate();
    if (error) { setErrorText(error); return; }
    await persistRegularFields();
    const nextMaster = masterEmail.trim().toLowerCase();
    const nextPresident = presidentEmail.trim().toLowerCase();
    try {
      if (nextMaster && nextMaster !== masterEmailRef.current) {
        await reauthenticateAndTransfer('MASTER_ADMIN', nextMaster);
        masterEmailRef.current = nextMaster;
        setStatusText('Transferência segura do Master iniciada.');
      }
      if (nextPresident && nextPresident !== presidentEmailRef.current) {
        await reauthenticateAndTransfer('COMMISSION_PRESIDENT', nextPresident);
        presidentEmailRef.current = nextPresident;
        setStatusText('Transferência segura da Presidência iniciada.');
      }
    } catch (error: any) {
      setErrorText(error instanceof Error ? error.message : 'Não foi possível confirmar a alteração administrativa.');
    }
  };

  useEffect(() => {
    if (!isMaster || !hydratedRef.current || fingerprint === lastSavedRef.current) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { void persistRegularFields(); }, 700);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [fingerprint, isMaster]);

  if (!isMaster) return null;
  const updateMember = (id: string, updates: Partial<CommissionMemberInfo>) => setMembers(prev => prev.map(member => member.id === id ? { ...member, ...updates } : member));

  return (
    <section className="portal-identity-panel space-y-2 p-3 sm:p-4" style={{ backgroundColor: 'var(--portal-surface-page)' }} aria-label="Dados de rodapé e identidade">
      {statusText && <div className="text-right text-[9px] font-bold text-[var(--portal-brand-action)]">{statusText}</div>}
      <div className="grid gap-2 md:grid-cols-2">
        <label className={fieldClass} style={{ backgroundColor: 'var(--portal-surface-panel)' }}><span className={labelClass}>Nome da Secretaria / Administrador Master</span><input value={masterName} onChange={event => setMasterName(event.target.value)} onBlur={() => void persistRegularFields()} className={inputClass}/></label>
        <label className={fieldClass} style={{ backgroundColor: 'var(--portal-surface-panel)' }}><span className={labelClass}>E-mail de acesso do Usuário Master</span><input type="email" value={masterEmail} onChange={event => setMasterEmail(event.target.value)} onBlur={() => void persistSensitiveEmails()} className={inputClass}/></label>
        <label className={fieldClass} style={{ backgroundColor: 'var(--portal-surface-panel)' }}><span className={labelClass}>Nome da Presidente da Comissão</span><input value={presidentName} onChange={event => setPresidentName(event.target.value)} onBlur={() => void persistRegularFields()} className={inputClass}/></label>
        <label className={fieldClass} style={{ backgroundColor: 'var(--portal-surface-panel)' }}><span className={labelClass}>E-mail da Presidência / recuperação do Master</span><input type="email" value={presidentEmail} onChange={event => setPresidentEmail(event.target.value)} onBlur={() => void persistSensitiveEmails()} className={inputClass}/></label>
        <label className={fieldClass} style={{ backgroundColor: 'var(--portal-surface-panel)' }}><span className={labelClass}>E-mail de contato da Secretaria</span><input type="email" value={secretaryEmail} onChange={event => setSecretaryEmail(event.target.value)} onBlur={() => void persistRegularFields()} className={inputClass}/></label>
        <label className={fieldClass} style={{ backgroundColor: 'var(--portal-surface-panel)' }}><span className={labelClass}>WhatsApp da Secretaria</span><input value={whatsappUrl} onChange={event => setWhatsappUrl(event.target.value)} onBlur={() => void persistRegularFields()} className={inputClass} placeholder="https://wa.me/..."/></label>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-300" style={{ backgroundColor: 'var(--portal-surface-panel)' }}>
        <div className="flex items-center justify-between gap-2 border-b border-slate-300 px-3 py-2" style={{ backgroundColor: 'var(--portal-surface-card)' }}>
          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-800">Membros da Comissão</h4>
          <span className="text-[9px] font-bold text-slate-500">{normalizeMembers(members).length} cadastrado(s)</span>
        </div>
        <div className="divide-y divide-slate-300">
          {members.map(member => (
            <div key={member.id} className="grid gap-2 p-2 sm:grid-cols-[1fr_1fr_34px]">
              <input value={member.name} onChange={event => updateMember(member.id, { name: event.target.value })} onBlur={() => void persistRegularFields()} className={inputClass} placeholder="Nome completo"/>
              <input type="email" value={member.email || ''} onChange={event => updateMember(member.id, { email: event.target.value })} onBlur={() => void persistRegularFields()} className={inputClass} placeholder="email@instituicao.br"/>
              <button type="button" onClick={() => setMembers(prev => prev.filter(item => item.id !== member.id))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-rose-700" aria-label={`Excluir ${member.name || 'membro'}`}><Trash2 className="h-3.5 w-3.5"/></button>
            </div>
          ))}
          {members.length === 0 && <p className="px-3 py-3 text-[10px] text-slate-500">Nenhum membro adicional cadastrado.</p>}
        </div>
        <button type="button" onClick={() => setMembers(prev => [...prev, { id: makeId(), name: '', email: '', active: true }])} className="flex w-full items-center gap-2 border-t border-slate-300 px-3 py-2 text-left text-[10px] font-black text-[var(--portal-brand-action)] hover:bg-white/60"><Plus className="h-3.5 w-3.5"/>Adicionar membro</button>
      </div>
      {errorText && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-800" role="alert">{errorText}</div>}
    </section>
  );
};
