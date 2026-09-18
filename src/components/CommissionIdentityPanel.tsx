import React, { useEffect, useMemo, useState } from 'react';
import { Plus, QrCode, Save, Trash2, Users } from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';

interface Props { isMaster: boolean; }
interface CommissionMemberInfo { id: string; name: string; email?: string; startDate?: string; endDate?: string; active: boolean; }

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200';
const actionClass = 'inline-flex min-h-8 items-center justify-center gap-2 rounded-lg border border-slate-500 bg-slate-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50';

function makeId(): string { return `commission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function legacyMembers(settings: any): CommissionMemberInfo[] {
  return [settings?.commissionMember2Name, settings?.commissionMember3Name, settings?.commissionMember4Name, settings?.commissionMember5Name]
    .map((value) => String(value || '').trim()).filter(Boolean)
    .map((name, index) => ({ id: `legacy-${index + 2}`, name, email: '', startDate: '', endDate: '', active: true }));
}
function normalizeMembers(members: CommissionMemberInfo[]): CommissionMemberInfo[] {
  return members.map((member) => ({
    id: String(member.id || makeId()), name: String(member.name || '').trim(), email: String(member.email || '').trim().toLowerCase(),
    startDate: String(member.startDate || ''), endDate: String(member.endDate || ''), active: member.active !== false,
  })).filter((member) => member.name);
}

export const CommissionIdentityPanel: React.FC<Props> = ({ isMaster }) => {
  const { settings, refreshAuth } = useAuth();
  const typedSettings = settings as any;
  const initialMembers = useMemo(() => {
    const current = Array.isArray(typedSettings?.commissionMembers) ? typedSettings.commissionMembers : [];
    return current.length ? normalizeMembers(current) : legacyMembers(typedSettings);
  }, [typedSettings]);
  const [members, setMembers] = useState<CommissionMemberInfo[]>(initialMembers);
  const [maintainerName, setMaintainerName] = useState(String(typedSettings?.portalMaintainerName || ''));
  const [contactEmail, setContactEmail] = useState(String(typedSettings?.contactEmail || ''));
  const [whatsappUrl, setWhatsappUrl] = useState(String(typedSettings?.whatsappUrl || ''));
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => setMembers(initialMembers), [initialMembers]);
  useEffect(() => {
    setMaintainerName(String(typedSettings?.portalMaintainerName || ''));
    setContactEmail(String(typedSettings?.contactEmail || ''));
    setWhatsappUrl(String(typedSettings?.whatsappUrl || ''));
  }, [typedSettings?.portalMaintainerName, typedSettings?.contactEmail, typedSettings?.whatsappUrl]);
  useEffect(() => {
    let active = true; const value = whatsappUrl.trim();
    if (!value) { setQrDataUrl(''); return () => { active = false; }; }
    void QRCode.toDataURL(value, { width: 360, margin: 0, errorCorrectionLevel: 'M' })
      .then((dataUrl) => { if (active) setQrDataUrl(dataUrl); }).catch(() => { if (active) setQrDataUrl(''); });
    return () => { active = false; };
  }, [whatsappUrl]);

  if (!isMaster) return null;
  const updateMember = (id: string, updates: Partial<CommissionMemberInfo>) => setMembers((prev) => prev.map((m) => m.id === id ? { ...m, ...updates } : m));
  const addMember = () => { setMembers((prev) => [...prev, { id: makeId(), name: '', email: '', startDate: '', endDate: '', active: true }]); setFeedback(null); };
  const save = async () => {
    setSaving(true); setFeedback(null);
    try {
      const normalized = normalizeMembers(members);
      const invalidEmail = normalized.find((m) => m.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email));
      if (invalidEmail) throw new Error(`E-mail inválido para ${invalidEmail.name}.`);
      const invalidPeriod = normalized.find((m) => m.startDate && m.endDate && m.endDate < m.startDate);
      if (invalidPeriod) throw new Error(`A data final de ${invalidPeriod.name} não pode ser anterior à data inicial.`);
      const normalizedContactEmail = contactEmail.trim().toLowerCase();
      if (normalizedContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedContactEmail)) throw new Error('O e-mail público de contato é inválido.');
      const normalizedWhatsapp = whatsappUrl.trim();
      if (normalizedWhatsapp) { const parsed = new URL(normalizedWhatsapp); if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('A URL de WhatsApp precisa usar http ou https.'); }
      await apiClient.updateSettings({ commissionMembers: normalized, portalMaintainerName: maintainerName.trim(), contactEmail: normalizedContactEmail, whatsappUrl: normalizedWhatsapp } as any);
      setMembers(normalized); await refreshAuth(); setFeedback({ ok: true, text: 'Comissão, contatos e QR Code salvos.' });
    } catch (error) { setFeedback({ ok: false, text: error instanceof Error ? error.message : 'Não foi possível salvar os dados da Comissão.' }); }
    finally { setSaving(false); }
  };

  return <section className="portal-commission-identity-panel overflow-hidden rounded-lg border border-slate-300 bg-[#d5dce0]" aria-labelledby="commission-management-title">
    <div className="flex flex-col gap-2 border-b border-slate-300 px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
      <div><div className="flex items-center gap-2"><Users className="h-5 w-5 text-slate-600"/><h3 id="commission-management-title" className="font-black uppercase tracking-wide text-slate-950">Desenvolvimento, contato e membros da Comissão</h3></div><p className="mt-0.5 text-xs text-slate-600">Responsável técnico, contato público e integrantes adicionais da Comissão.</p></div>
      <div className="flex gap-2"><button type="button" onClick={addMember} className={actionClass}><Plus className="h-4 w-4"/>Adicionar membro</button><button type="button" onClick={() => void save()} disabled={saving} className={actionClass}><Save className="h-4 w-4"/>{saving ? 'Salvando…' : 'Salvar Comissão'}</button></div>
    </div>

    <div className="grid gap-2 border-b border-slate-300 p-2.5 xl:grid-cols-[1fr_150px]">
      <div className="rounded-lg border border-slate-200 bg-white p-2.5"><h4 className="text-[10px] font-black uppercase tracking-wider text-slate-600">Desenvolvimento e contato</h4><div className="mt-2 grid gap-2 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-1 block text-[10px] font-black uppercase text-slate-600">Desenvolvimento e suporte</span><input value={maintainerName} onChange={(e) => setMaintainerName(e.target.value)} className={inputClass}/></label><label><span className="mb-1 block text-[10px] font-black uppercase text-slate-600">E-mail público</span><input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass}/></label><label><span className="mb-1 block text-[10px] font-black uppercase text-slate-600">WhatsApp</span><input value={whatsappUrl} onChange={(e) => setWhatsappUrl(e.target.value)} className={inputClass}/></label></div></div>
      <div className="flex min-h-28 items-center justify-center rounded-lg border border-slate-200 bg-white p-1">{qrDataUrl ? <img src={qrDataUrl} alt="QR Code do WhatsApp" className="h-28 w-28 object-contain"/> : <div className="flex h-24 w-24 flex-col items-center justify-center text-center text-[10px] text-slate-500"><QrCode className="mb-1 h-5 w-5"/>Informe o WhatsApp</div>}</div>
    </div>

    <div className="overflow-x-auto"><table className="w-full min-w-[820px] border-collapse text-left"><thead className="bg-[#344125] text-[10px] font-black uppercase tracking-wider text-white"><tr><th className="px-3 py-2.5">Nome</th><th className="px-3 py-2.5">E-mail</th><th className="px-3 py-2.5">Início</th><th className="px-3 py-2.5">Fim</th><th className="px-3 py-2.5 text-center">Ativo</th><th className="w-12 px-3 py-2.5"/></tr></thead><tbody className="divide-y divide-slate-100">{members.length===0&&<tr><td colSpan={6} className="px-4 py-4 text-center text-xs text-slate-500">Nenhum integrante adicional cadastrado.</td></tr>}{members.map((m)=><tr key={m.id} className="hover:bg-slate-50"><td className="px-2 py-1.5"><input value={m.name} onChange={(e)=>updateMember(m.id,{name:e.target.value})} className={inputClass} placeholder="Nome completo"/></td><td className="px-2 py-1.5"><input type="email" value={m.email||''} onChange={(e)=>updateMember(m.id,{email:e.target.value})} className={inputClass}/></td><td className="px-2 py-1.5"><input type="date" value={m.startDate||''} onChange={(e)=>updateMember(m.id,{startDate:e.target.value})} className={inputClass}/></td><td className="px-2 py-1.5"><input type="date" value={m.endDate||''} onChange={(e)=>updateMember(m.id,{endDate:e.target.value})} className={inputClass}/></td><td className="px-2 py-1.5 text-center"><input type="checkbox" checked={m.active!==false} onChange={(e)=>updateMember(m.id,{active:e.target.checked})} className="h-4 w-4 accent-slate-600"/></td><td className="px-2 py-1.5"><button type="button" onClick={()=>setMembers((prev)=>prev.filter((x)=>x.id!==m.id))} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" aria-label={`Excluir ${m.name || 'membro'}`}><Trash2 className="h-4 w-4"/></button></td></tr>)}</tbody></table></div>
    {feedback&&<div className="border-t border-slate-200 px-4 py-2 text-[11px] font-semibold" role="status"><span className={feedback.ok?'text-slate-700':'text-rose-700'}>{feedback.text}</span></div>}
  </section>;
};
