import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { retryAfterPortalReauthentication } from '../services/reauthentication';

interface Props { isMaster: boolean; }
interface CommissionMemberInfo { id: string; name: string; email?: string; active: boolean; }

const inputClass = 'w-full min-h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200';
const fieldClass = 'rounded-lg border border-slate-300 p-2.5';
const labelClass = 'mb-1 block text-[9px] font-black normal-case tracking-wide text-slate-600';

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
  const { settings, refreshAuth, globalRoles } = useAuth();
  const canApplyDirectly = globalRoles.includes('MASTER_ADMIN');
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
  const [sensitiveSaving,setSensitiveSaving]=useState(false);
  const [pendingTransfers,setPendingTransfers]=useState<any[]>([]);
  const sensitiveLock=useRef(false);
  const emailDrafts=useRef<{master?:string;president?:string}>({});
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState('');
  const timerRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const lastSavedRef = useRef('');
  const regularSaveLock = useRef(false);
  const latestFingerprint = useRef('');
  const saveLatestRegularFields = useRef<() => Promise<void>>(async () => {});
  const [regularSaveMessage, setRegularSaveMessage] = useState('');
  const masterEmailRef = useRef(String(s?.masterEmail || '').trim().toLowerCase());
  const presidentEmailRef = useRef(String(s?.commissionPresidentEmail || '').trim().toLowerCase());

  const buildPatch = () => ({
    ownerName: masterName.trim(),
    portalMaintainerName: masterName.trim(),
    commissionPresidentName: presidentName.trim(),
    contactEmail: secretaryEmail.trim().toLowerCase(),
    whatsappUrl: whatsappUrl.trim(),
    commissionMembers: normalizeMembers(members),
  });
  const fingerprint = useMemo(() => JSON.stringify(buildPatch()), [masterName, presidentName, secretaryEmail, whatsappUrl, members]);

  latestFingerprint.current = fingerprint;

  useEffect(() => {
    const nextMasterEmail = String(s?.masterEmail || '').trim().toLowerCase();
    const nextPresidentEmail = String(s?.commissionPresidentEmail || s?.commissionPresidentContactEmail || '').trim().toLowerCase();
    const patch = {
      ownerName: String(s?.ownerName || s?.portalMaintainerName || '').trim(),
      portalMaintainerName: String(s?.ownerName || s?.portalMaintainerName || '').trim(),
      commissionPresidentName: String(s?.commissionPresidentName || '').trim(),
      contactEmail: String(s?.contactEmail || '').trim().toLowerCase(),
      whatsappUrl: String(s?.whatsappUrl || '').trim(),
      commissionMembers: currentMembers,
    };
    // A slow save/refresh must not overwrite edits made while it was running.
    const preserveRegularDraft = hydratedRef.current &&
      (regularSaveLock.current || latestFingerprint.current !== lastSavedRef.current);
    if (!preserveRegularDraft) {
      setMasterName(patch.ownerName);
      setPresidentName(patch.commissionPresidentName);
      setSecretaryEmail(patch.contactEmail);
      setWhatsappUrl(patch.whatsappUrl);
      setMembers(currentMembers);
      lastSavedRef.current = JSON.stringify(patch);
    }
    if(emailDrafts.current.master===undefined||emailDrafts.current.master===nextMasterEmail){emailDrafts.current.master=undefined;setMasterEmail(nextMasterEmail);}
    if(emailDrafts.current.president===undefined||emailDrafts.current.president===nextPresidentEmail){emailDrafts.current.president=undefined;setPresidentEmail(nextPresidentEmail);}
    masterEmailRef.current = nextMasterEmail;
    presidentEmailRef.current = String(s?.commissionPresidentEmail || '').trim().toLowerCase();
    hydratedRef.current = true;
  }, [s?.masterEmail, s?.ownerName, s?.portalMaintainerName, s?.commissionPresidentName, s?.commissionPresidentEmail, s?.commissionPresidentContactEmail, s?.contactEmail, s?.whatsappUrl, currentMembers]);

  const validate = () => {
    if (!masterName.trim()) return 'Informe o nome da Secretaria / Administrador Master.';
    if (!presidentName.trim()) return 'Informe o nome da Presidência da Comissão.';
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
    if (!isMaster || !hydratedRef.current || regularSaveLock.current) return;
    const error = validate();
    if (error) { setErrorText(error); return; }
    const patch = buildPatch();
    const next = JSON.stringify(patch);
    if (next === lastSavedRef.current) return;
    regularSaveLock.current = true;
    let saved = false;
    setSaving(true); setErrorText(''); setRegularSaveMessage('');
    try {
      await durableRetry(() => apiClient.updateSettings(patch as any));
      lastSavedRef.current = next;
      saved = true;
      await refreshAuth();
      setRegularSaveMessage('Dados salvos.');

    } catch (error: any) {
      setErrorText(error instanceof Error ? error.message : 'Não foi possível salvar os dados do rodapé.');
    } finally {
      regularSaveLock.current = false;
      setSaving(false);
      // Send the latest complete draft after the acknowledged save, never in parallel.
      if (saved && latestFingerprint.current !== lastSavedRef.current) {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => { void saveLatestRegularFields.current(); }, 700);
      }
    }
  };
  saveLatestRegularFields.current = persistRegularFields;

  useEffect(()=>{
    if(!isMaster)return;let active=true;
    void apiClient.getAdministrationTransfers().then(transfers=>{
      if(!active)return;
      const pending=transfers.filter(item=>item.status==='PENDING_TARGET_ACCEPTANCE'&&Date.parse(item.expiresAt)>Date.now());
      setPendingTransfers(pending);
      for(const item of pending){
        const field=item.role==='MASTER_ADMIN'?'master':'president';
        if(emailDrafts.current[field]!==undefined)continue;
        emailDrafts.current[field]=item.targetEmail;
        if(field==='master')setMasterEmail(item.targetEmail);else setPresidentEmail(item.targetEmail);
      }
    }).catch(()=>{});
    return()=>{active=false;};
  },[isMaster]);

  const persistSensitiveEmails = async (role:'MASTER_ADMIN'|'COMMISSION_PRESIDENT',rawTarget:string) => {
    if (!isMaster||sensitiveLock.current) return;
    const target=rawTarget.trim().toLowerCase();
    if(!validEmail(target)){setErrorText('Informe um e-mail administrativo válido.');return;}
    const current=role==='MASTER_ADMIN'?masterEmailRef.current:presidentEmailRef.current;
    if(target===current)return;
    const pending=pendingTransfers.find(item=>item.role===role&&Date.parse(item.expiresAt)>Date.now());
    if(pending&&!canApplyDirectly){
      if(pending.targetEmail===target){setStatusText('Alteração pendente: o novo titular precisa entrar no Portal e aceitar a transferência.');return;}
      setErrorText(`Existe uma alteração pendente para ${pending.targetEmail}. Cancele essa alteração antes de solicitar outro endereço.`);return;
    }
    sensitiveLock.current=true;setSensitiveSaving(true);setErrorText('');setStatusText('');
    try {
      const transfer=await reauthenticateAndTransfer(role,target);
      if(transfer.status==='COMPLETED'){
        setPendingTransfers(items=>items.filter(item=>item.role!==role));
        if(role==='MASTER_ADMIN'){masterEmailRef.current=target;emailDrafts.current.master=undefined;setMasterEmail(target);}
        else{presidentEmailRef.current=target;emailDrafts.current.president=undefined;setPresidentEmail(target);}
        setStatusText(`E-mail ${role==='MASTER_ADMIN'?'do Master':'da Presidência'} atualizado para ${target}. Alteração aplicada e registrada no histórico.`);
      }else{
        setPendingTransfers(items=>[...items.filter(item=>item.role!==role),transfer]);
        setStatusText(`Alteração solicitada para ${target}. O endereço ativo só muda após o novo titular entrar no Portal e aceitar a transferência.`);
      }
      await refreshAuth();
    } catch (error: any) {
      setErrorText(error instanceof Error ? error.message : 'Não foi possível confirmar a alteração administrativa.');
    } finally {sensitiveLock.current=false;setSensitiveSaving(false);}
  };

  const cancelTransfer=async(transfer:any)=>{
    if(sensitiveLock.current)return;sensitiveLock.current=true;setSensitiveSaving(true);setErrorText('');
    try{
      await apiClient.cancelAdministrationTransfer(transfer.id);
      setPendingTransfers(items=>items.filter(item=>item.id!==transfer.id));
      if(transfer.role==='MASTER_ADMIN'){emailDrafts.current.master=undefined;setMasterEmail(masterEmailRef.current);}
      else{emailDrafts.current.president=undefined;setPresidentEmail(presidentEmailRef.current);}
      setStatusText('Alteração cancelada. O endereço ativo foi mantido.');
    }catch(error){setErrorText(error instanceof Error?error.message:'Não foi possível cancelar a alteração.');}
    finally{sensitiveLock.current=false;setSensitiveSaving(false);}
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
    <section className="portal-identity-panel space-y-[5px] p-0" style={{ backgroundColor: 'var(--portal-surface-page)' }} aria-label="Dados de rodapé e identidade">
      {(saving || (regularSaveMessage && fingerprint === lastSavedRef.current)) && <p role="status" className="text-right text-[10px] font-semibold text-slate-600">{saving ? 'Salvando alterações…' : regularSaveMessage}</p>}
      {statusText && <div className="text-right text-[9px] font-bold text-[var(--portal-brand-action)]">{statusText}</div>}
      <div className="grid gap-[5px] md:grid-cols-2">
        <label className={fieldClass} style={{ backgroundColor: 'var(--portal-surface-panel)' }}><span className={labelClass}>Nome da Secretaria / Administrador Master</span><input value={masterName} onChange={event => setMasterName(event.target.value)} onBlur={() => void persistRegularFields()} className={inputClass}/></label>
        <label className={fieldClass} style={{ backgroundColor: 'var(--portal-surface-panel)' }}><span className={labelClass}>E-mail de acesso do Usuário Master</span><input type="email" value={masterEmail} disabled={sensitiveSaving} onChange={event => {emailDrafts.current.master=event.target.value.trim().toLowerCase();setMasterEmail(event.target.value);setStatusText('');}} onBlur={event => void persistSensitiveEmails('MASTER_ADMIN',event.currentTarget.value)} className={inputClass}/></label>
        <label className={fieldClass} style={{ backgroundColor: 'var(--portal-surface-panel)' }}><span className={labelClass}>Nome da Presidente da Comissão</span><input value={presidentName} onChange={event => setPresidentName(event.target.value)} onBlur={() => void persistRegularFields()} className={inputClass}/></label>
        <label className={fieldClass} style={{ backgroundColor: 'var(--portal-surface-panel)' }}><span className={labelClass}>E-mail da Presidência / recuperação do Master</span><input type="email" value={presidentEmail} disabled={sensitiveSaving} onChange={event => {emailDrafts.current.president=event.target.value.trim().toLowerCase();setPresidentEmail(event.target.value);setStatusText('');}} onBlur={event => void persistSensitiveEmails('COMMISSION_PRESIDENT',event.currentTarget.value)} className={inputClass}/></label>
        <label className={fieldClass} style={{ backgroundColor: 'var(--portal-surface-panel)' }}><span className={labelClass}>E-mail de contato da Secretaria</span><input type="email" value={secretaryEmail} onChange={event => setSecretaryEmail(event.target.value)} onBlur={() => void persistRegularFields()} className={inputClass}/></label>
        <label className={fieldClass} style={{ backgroundColor: 'var(--portal-surface-panel)' }}><span className={labelClass}>WhatsApp da Secretaria</span><input value={whatsappUrl} onChange={event => setWhatsappUrl(event.target.value)} onBlur={() => void persistRegularFields()} className={inputClass} placeholder="https://wa.me/..."/></label>
      </div>

      {pendingTransfers.map(transfer=><div key={transfer.id} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs" role="status">
        <strong>{transfer.role==='MASTER_ADMIN'?'Master':'Presidência'}: {canApplyDirectly?'alteração ainda não aplicada':'alteração aguardando aceite'}</strong>
        <p className="mt-1 break-words">Novo endereço: {transfer.targetEmail}. {canApplyDirectly?'Você pode aplicar esta alteração imediatamente como Master.':'O titular precisa entrar no Portal com esse e-mail e aceitar a transferência.'} Até lá, o e-mail ativo continua sendo {transfer.role==='MASTER_ADMIN'?s?.masterEmail:s?.commissionPresidentEmail}.</p>
        {canApplyDirectly&&<button type="button" className="portal-action portal-button-primary mt-2 mr-2" disabled={sensitiveSaving} onClick={()=>void persistSensitiveEmails(transfer.role,transfer.targetEmail)}>Aplicar alteração</button>}
        <button type="button" className="portal-action mt-2" disabled={sensitiveSaving} onClick={()=>void cancelTransfer(transfer)}>Cancelar alteração pendente</button>
      </div>)}
      <div className="overflow-hidden rounded-lg border border-slate-300" style={{ backgroundColor: 'var(--portal-surface-panel)' }}>
        <div className="flex items-center justify-between gap-2 border-b border-slate-300 px-3 py-2" style={{ backgroundColor: 'var(--portal-surface-card)' }}>
          <h4 className="text-[10px] font-black normal-case tracking-wider text-slate-800">Membros da Comissão</h4>
          <div className="flex items-center gap-3"><span className="text-[9px] font-bold text-slate-500">{normalizeMembers(members).length} cadastrado(s)</span><button type="button" onClick={() => setMembers(prev => [...prev, { id: makeId(), name: '', email: '', active: true }])} aria-label="Adicionar membro" title="Adicionar membro" className="portal-toolbar-icon-button"><Plus className="h-3.5 w-3.5" aria-hidden="true"/></button></div>
        </div>
        <div className="space-y-1 p-1">
          {members.map(member => (
            <div key={member.id} className="grid gap-2 rounded-md bg-white p-2 sm:grid-cols-[1fr_1fr_34px]">
              <input value={member.name} onChange={event => updateMember(member.id, { name: event.target.value })} onBlur={() => void persistRegularFields()} className={inputClass} placeholder="Nome completo"/>
              <input type="email" value={member.email || ''} onChange={event => updateMember(member.id, { email: event.target.value })} onBlur={() => void persistRegularFields()} className={inputClass} placeholder="email@instituicao.br"/>
              <button type="button" onClick={() => setMembers(prev => prev.filter(item => item.id !== member.id))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-rose-700" aria-label={`Excluir ${member.name || 'membro'}`}><Trash2 className="h-3.5 w-3.5"/></button>
            </div>
          ))}
          {members.length === 0 && <p className="px-3 py-3 text-[10px] text-slate-500">Nenhum membro adicional cadastrado.</p>}
        </div>

      </div>
      {errorText && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-800" role="alert">{errorText}</div>}
    </section>
  );
};
