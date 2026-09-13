import React, { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Plus, QrCode, Save, Trash2, Upload, Users } from 'lucide-react';
import QRCode from 'qrcode';
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

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100';
const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#4f582e] bg-[#5f6937] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-[#4f582e] disabled:cursor-not-allowed disabled:opacity-50';

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

function loadImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('Não foi possível validar a imagem selecionada.'));
    image.src = dataUrl;
  });
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
  const [courseLogoDataUrl, setCourseLogoDataUrl] = useState(String(typedSettings?.courseLogoDataUrl || ''));
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => setMembers(initialMembers), [initialMembers]);
  useEffect(() => {
    setPresidentName(String(typedSettings?.commissionPresidentName || ''));
    setMaintainerName(String(typedSettings?.portalMaintainerName || ''));
    setContactEmail(String(typedSettings?.contactEmail || ''));
    setWhatsappUrl(String(typedSettings?.whatsappUrl || ''));
    setCourseLogoDataUrl(String(typedSettings?.courseLogoDataUrl || ''));
  }, [typedSettings?.commissionPresidentName, typedSettings?.portalMaintainerName, typedSettings?.contactEmail, typedSettings?.whatsappUrl, typedSettings?.courseLogoDataUrl]);

  useEffect(() => {
    let active = true;
    const value = whatsappUrl.trim();
    if (!value) {
      setQrDataUrl('');
      return () => { active = false; };
    }
    void QRCode.toDataURL(value, { width: 240, margin: 1, errorCorrectionLevel: 'M' })
      .then((dataUrl) => { if (active) setQrDataUrl(dataUrl); })
      .catch(() => { if (active) setQrDataUrl(''); });
    return () => { active = false; };
  }, [whatsappUrl]);

  if (!isMaster) return null;

  const updateMember = (id: string, updates: Partial<CommissionMemberInfo>) => {
    setMembers((previous) => previous.map((member) => member.id === id ? { ...member, ...updates } : member));
  };

  const addMember = () => {
    setMembers((previous) => [...previous, { id: makeId(), name: '', email: '', startDate: '', endDate: '', active: true }]);
    setFeedback(null);
  };

  const handleLogoUpload = async (file?: File) => {
    if (!file) return;
    setFeedback(null);
    try {
      if (file.type !== 'image/png') throw new Error('Use somente PNG. Para preservar a marca, o arquivo deve ser PNG transparente de 1024 × 1024 px.');
      if (file.size > 1024 * 1024) throw new Error('O PNG deve ter no máximo 1 MB.');
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Não foi possível ler o PNG.'));
        reader.readAsDataURL(file);
      });
      const { width, height } = await loadImageDimensions(dataUrl);
      if (width !== 1024 || height !== 1024) throw new Error(`O símbolo precisa ter exatamente 1024 × 1024 px. O arquivo selecionado possui ${width} × ${height} px.`);
      setCourseLogoDataUrl(dataUrl);
      setFeedback({ ok: true, text: 'PNG validado. Clique em “Salvar Comissão” para publicar o símbolo no Portal.' });
    } catch (error) {
      setFeedback({ ok: false, text: error instanceof Error ? error.message : 'Não foi possível carregar o símbolo.' });
    }
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
        courseLogoDataUrl: courseLogoDataUrl || undefined,
      } as any);
      setMembers(normalized);
      await refreshAuth();
      setFeedback({ ok: true, text: 'Comissão, contatos, QR Code e identidade visual salvos.' });
    } catch (error) {
      setFeedback({ ok: false, text: error instanceof Error ? error.message : 'Não foi possível salvar os dados da Comissão.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="commission-management-title">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-800" />
              <h3 id="commission-management-title" className="font-black uppercase tracking-wide text-slate-950">Gestão da Comissão de TCC</h3>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-600">Cadastro único da Presidência, integrantes, suporte e contatos exibidos no rodapé público.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addMember} className={actionClass}>
              <Plus className="h-4 w-4" />Adicionar membro
            </button>
            <button type="button" onClick={() => void save()} disabled={saving} className={actionClass}>
              <Save className="h-4 w-4" />{saving ? 'Salvando…' : 'Salvar Comissão'}
            </button>
          </div>
        </div>

        <div className="grid gap-4 border-b border-slate-200 p-4 xl:grid-cols-[1fr_1fr_220px]">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-600">Presidência</h4>
            <label className="mt-3 block space-y-1.5">
              <span className="block text-[10px] font-black uppercase tracking-wide text-slate-600">Nome da Presidente</span>
              <input value={presidentName} onChange={(event) => setPresidentName(event.target.value)} className={inputClass} placeholder="Nome completo da presidente" />
            </label>
            <p className="mt-2 text-[10px] leading-4 text-slate-500">O e-mail de acesso da Presidência é administrado na área de contas, com confirmação do novo titular.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-600">Desenvolvimento e contato</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 sm:col-span-2">
                <span className="block text-[10px] font-black uppercase tracking-wide text-slate-600">Desenvolvimento e suporte</span>
                <input value={maintainerName} onChange={(event) => setMaintainerName(event.target.value)} className={inputClass} placeholder="Responsável ou equipe" />
              </label>
              <label className="space-y-1.5">
                <span className="block text-[10px] font-black uppercase tracking-wide text-slate-600">E-mail público</span>
                <input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className={inputClass} placeholder="contato@ufes.br" />
              </label>
              <label className="space-y-1.5">
                <span className="block text-[10px] font-black uppercase tracking-wide text-slate-600">WhatsApp</span>
                <input value={whatsappUrl} onChange={(event) => setWhatsappUrl(event.target.value)} className={inputClass} placeholder="https://wa.me/..." />
              </label>
            </div>
          </div>

          <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3 text-center">
            <QrCode className="mb-2 h-4 w-4 text-emerald-800" />
            {qrDataUrl ? <img src={qrDataUrl} alt="QR Code do WhatsApp" className="h-32 w-32 object-contain" /> : <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[10px] font-semibold text-slate-500">Informe o link do WhatsApp para gerar o QR Code</div>}
            <span className="mt-2 text-[10px] font-black uppercase tracking-wide text-slate-500">QR Code automático</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead className="bg-[#4f582e] text-[10px] font-black uppercase tracking-wider text-white">
              <tr>
                <th className="px-3 py-3">Nome</th>
                <th className="px-3 py-3">E-mail</th>
                <th className="px-3 py-3">Início</th>
                <th className="px-3 py-3">Fim</th>
                <th className="px-3 py-3 text-center">Ativo</th>
                <th className="w-12 px-3 py-3" aria-label="Ações" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-7 text-center text-xs text-slate-500">Nenhum integrante adicional cadastrado.</td></tr>
              )}
              {members.map((member) => (
                <tr key={member.id} className="align-middle hover:bg-slate-50/70">
                  <td className="px-3 py-2"><input aria-label="Nome do membro" value={member.name} onChange={(event) => updateMember(member.id, { name: event.target.value })} className={inputClass} placeholder="Nome completo" /></td>
                  <td className="px-3 py-2"><input aria-label="E-mail do membro" type="email" value={member.email || ''} onChange={(event) => updateMember(member.id, { email: event.target.value })} className={inputClass} placeholder="nome@ufes.br" /></td>
                  <td className="px-3 py-2"><input aria-label="Início do mandato" type="date" value={member.startDate || ''} onChange={(event) => updateMember(member.id, { startDate: event.target.value })} className={inputClass} /></td>
                  <td className="px-3 py-2"><input aria-label="Fim do mandato" type="date" value={member.endDate || ''} onChange={(event) => updateMember(member.id, { endDate: event.target.value })} className={inputClass} /></td>
                  <td className="px-3 py-2 text-center"><input aria-label={`Membro ${member.name || 'sem nome'} ativo`} type="checkbox" checked={member.active !== false} onChange={(event) => updateMember(member.id, { active: event.target.checked })} className="h-4 w-4 accent-[#5f6937]" /></td>
                  <td className="px-3 py-2 text-center"><button type="button" onClick={() => setMembers((previous) => previous.filter((item) => item.id !== member.id))} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 hover:text-rose-800" aria-label={`Excluir ${member.name || 'membro'}`}><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="min-h-12 border-t border-slate-200 px-4 py-3 text-[11px] font-semibold" role="status">
          {feedback && <span className={feedback.ok ? 'text-emerald-800' : 'text-rose-700'}>{feedback.text}</span>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="visual-identity-title">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <ImageIcon className="h-5 w-5 text-emerald-800" />
          <div>
            <h3 id="visual-identity-title" className="font-black uppercase tracking-wide text-slate-950">Símbolo do curso</h3>
            <p className="mt-0.5 text-xs text-slate-600">Arquivo institucional usado sem recorte, deformação ou alteração de proporção.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-5 lg:grid-cols-[220px_1fr] lg:items-center">
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
            <NursingEmblemLogo size={150} className="max-w-full" customSrc={courseLogoDataUrl || '/colenf-logo.png'} />
          </div>
          <div className="space-y-4">
            <div>
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Formato oficial do Portal</span>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-800">PNG transparente, exatamente 1024 × 1024 px, até 1 MB. O Portal guarda o arquivo original e exibe com <code>object-contain</code>, portanto não estica nem recorta a marca.</p>
            </div>
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#4f582e] bg-[#5f6937] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white hover:bg-[#4f582e]">
              <Upload className="h-4 w-4" />Adicionar / substituir símbolo
              <input type="file" accept="image/png,.png" className="sr-only" onChange={(event) => void handleLogoUpload(event.target.files?.[0])} />
            </label>
            <p className="text-xs text-slate-500">Instituição: <strong>Universidade Federal do Espírito Santo</strong><br />Curso: <strong>Curso de Graduação em Enfermagem e Obstetrícia</strong></p>
          </div>
        </div>
      </section>
    </div>
  );
};