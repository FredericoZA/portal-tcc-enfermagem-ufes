import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { ShieldAlert, KeyRound, Mail, AlertTriangle, ShieldCheck } from 'lucide-react';
import { PortalModalShell } from './PortalModalShell';

interface EmergencyRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSecretKey?: string;
}

export const EmergencyRecoveryModal: React.FC<EmergencyRecoveryModalProps> = ({
  isOpen,
  onClose,
  defaultSecretKey = ''
}) => {
  const { refreshAuth } = useAuth();
  const [secretKey, setSecretKey] = useState(defaultSecretKey);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [newMasterEmail, setNewMasterEmail] = useState('');
  const [verificationCode,setVerificationCode]=useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (defaultSecretKey) {
      setSecretKey(defaultSecretKey);
    }
  }, [defaultSecretKey]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!secretKey.trim()) {
      setErrorMsg('Informe a chave secreta de recuperação de emergência.');
      return;
    }
    if (!recoveryEmail.trim() || !recoveryEmail.includes('@')) {
      setErrorMsg('Informe um e-mail de segurança válido.');
      return;
    }
    if (!newMasterEmail.trim() || !newMasterEmail.includes('@')) {
      setErrorMsg('Informe o novo e-mail do Administrador Master.');
      return;
    }
    if(!/^\d{6}$/.test(verificationCode)){setErrorMsg('Informe o código de seis dígitos enviado ao e-mail de segurança.');return;}

    setIsSubmitting(true);
    try {
      const res = await apiClient.emergencyRecoverMaster({
        secretKey: secretKey.trim(),
        recoveryEmail: recoveryEmail.trim(),
        verificationCode:verificationCode.trim(),
        newMasterEmail: newMasterEmail.trim()
      });

      if (res.success) {
        setSuccessMsg(res.message);
        await refreshAuth();
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setErrorMsg('Não foi possível realizar a troca de dono.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar recuperação de emergência.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PortalModalShell
      open={isOpen}
      onClose={onClose}
      title="Protocolo de emergência"
      subtitle="Recuperação de dono / troca da conta Master do Portal"
      icon={ShieldAlert}
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="portal-modal-card p-4 text-xs text-slate-800">
          <p className="flex items-center gap-1.5 font-black"><AlertTriangle className="h-4 w-4 text-amber-700" />Garantia de segurança e recuperação de conta</p>
          <p className="mt-1 leading-5">Procedimento reservado para perda de acesso ou comprometimento da conta. A validação exige a chave secreta, um e-mail de segurança cadastrado e o código de verificação.</p>
        </section>
        {errorMsg && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">{errorMsg}</div>}
        {successMsg && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-900">{successMsg}</div>}
        <section className="portal-modal-card space-y-3 p-4">
          <label className="block text-xs font-bold text-slate-800"><span className="mb-1 flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" />Chave secreta de recuperação</span><input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder="Chave configurada pela instituição" className="portal-input font-mono" /></label>
          <label className="block text-xs font-bold text-slate-800"><span className="mb-1 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />E-mail de segurança cadastrado</span><input type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} className="portal-input" /></label>
          <div className="flex gap-2"><input inputMode="numeric" maxLength={6} value={verificationCode} onChange={event=>setVerificationCode(event.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Código de 6 dígitos" className="portal-input min-w-0 flex-1 font-bold tracking-[0.25em]"/><button type="button" onClick={async()=>{setErrorMsg('');try{const result=await apiClient.requestRecoveryCode(recoveryEmail.trim());setSuccessMsg(result.message);}catch(error){setErrorMsg(error instanceof Error?error.message:'Não foi possível solicitar o código.');}}} disabled={!recoveryEmail.includes('@')} className="portal-action disabled:opacity-40">Enviar código</button></div>
          <label className="block text-xs font-bold text-slate-800"><span className="mb-1 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Novo e-mail do Administrador Master</span><input type="email" value={newMasterEmail} onChange={(e) => setNewMasterEmail(e.target.value)} className="portal-input" /></label>
        </section>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="portal-action">Cancelar</button>
          <button type="submit" disabled={isSubmitting} className="portal-action border-red-700 bg-red-700 text-white disabled:opacity-50">{isSubmitting ? 'Processando...' : 'Transferir dono do site'}</button>
        </div>
      </form>
    </PortalModalShell>
  );
};
