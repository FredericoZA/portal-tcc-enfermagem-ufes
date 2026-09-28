import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { operationalConfig } from '../utils/operationalConfig';

const inputClass = 'w-full min-h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-[#337959] focus:ring-2 focus:ring-emerald-100';
const buttonClass = 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-[9px] font-black uppercase tracking-wide text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-50';

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const ReservationEmailConfigPanel: React.FC = () => {
  const { settings, refreshAuth } = useAuth();
  const typedSettings = settings as any;
  const resolved = useMemo(() => operationalConfig(typedSettings?.integrationStudio), [typedSettings?.integrationStudio]);
  const [recipientName, setRecipientName] = useState(resolved.reservation.recipientName || '');
  const [departmentEmail, setDepartmentEmail] = useState(resolved.reservation.departmentEmail || '');
  const [emailSubject, setEmailSubject] = useState(resolved.reservation.emailSubject || '');
  const [emailBody, setEmailBody] = useState(resolved.reservation.emailBody || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setRecipientName(resolved.reservation.recipientName || '');
    setDepartmentEmail(resolved.reservation.departmentEmail || '');
    setEmailSubject(resolved.reservation.emailSubject || '');
    setEmailBody(resolved.reservation.emailBody || '');
  }, [resolved.reservation.recipientName, resolved.reservation.departmentEmail, resolved.reservation.emailSubject, resolved.reservation.emailBody]);

  const save = async () => {
    const normalizedEmail = departmentEmail.trim().toLowerCase();
    if (!validEmail(normalizedEmail)) { setMessage('Informe um e-mail válido para a solicitação de espaço físico.'); return; }
    if (!emailSubject.trim() || !emailBody.trim()) { setMessage('Assunto e texto do e-mail são obrigatórios.'); return; }
    setSaving(true); setMessage('');
    try {
      const currentStudio = typedSettings?.integrationStudio || {};
      const currentOperational = operationalConfig(currentStudio);
      const nextStudio = {
        ...currentStudio,
        operationalConfig: {
          ...currentOperational,
          reservation: {
            ...currentOperational.reservation,
            recipientName: recipientName.trim(),
            departmentEmail: normalizedEmail,
            emailSubject: emailSubject.trim(),
            emailBody,
          },
        },
      };
      await apiClient.updateSettings({ integrationStudio: nextStudio } as any);
      await refreshAuth();
      setMessage('Configuração salva. O próximo pedido de reserva usará estes dados.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a configuração do pedido de reserva.');
    } finally { setSaving(false); }
  };

  return <section className="border-t border-slate-300 px-3 py-3" style={{ backgroundColor: 'var(--portal-surface-layer-1)' }} aria-labelledby="reservation-email-config-title">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-[#337959]"/><div><h3 id="reservation-email-config-title" className="text-[11px] font-black uppercase tracking-wide text-slate-950">Solicitação de espaço físico</h3><p className="text-[9px] text-slate-600">Destinatário e mensagem usados automaticamente quando o TCC dispara o pedido de reserva.</p></div></div>
      <button type="button" onClick={() => void save()} disabled={saving} className={buttonClass}><Save className="h-3.5 w-3.5"/>{saving ? 'Salvando…' : 'Salvar'}</button>
    </div>
    <div className="grid gap-2 md:grid-cols-2">
      <label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">Destinatário</span><input className={inputClass} value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Ex.: Departamento de Enfermagem"/></label>
      <label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">E-mail da solicitação de espaço físico</span><input type="email" className={inputClass} value={departmentEmail} onChange={(event) => setDepartmentEmail(event.target.value)} placeholder="reservas@instituicao.br"/></label>
      <label className="md:col-span-2"><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">Assunto</span><input className={inputClass} value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} placeholder="Solicitação de reserva de local — {{TITULO}}"/></label>
      <label className="md:col-span-2"><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">Texto do e-mail</span><textarea rows={7} className={inputClass} value={emailBody} onChange={(event) => setEmailBody(event.target.value)}/><span className="mt-1 block text-[9px] text-slate-500">Variáveis aceitas: {'{{TITULO}}'}, {'{{ALUNOS_NOMES}}'}, {'{{ORIENTADOR_NOME}}'}, {'{{DEFESA_DATA_HORA}}'}, {'{{DEFESA_LOCAL}}'} e {'{{LOCAL_ALTERNATIVO}}'}.</span></label>
    </div>
    {message && <div role="status" className={`mt-2 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${message.startsWith('Configuração salva') ? 'border-emerald-200 bg-white text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>{message}</div>}
  </section>;
};
