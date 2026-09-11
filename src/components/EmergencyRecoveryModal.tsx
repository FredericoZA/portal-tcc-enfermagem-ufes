import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { ShieldAlert, KeyRound, Mail, CheckCircle2, AlertTriangle, X, ShieldCheck } from 'lucide-react';

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
    <div className="fixed inset-0 bg-slate-900/85 z-50 overflow-y-auto p-4 backdrop-blur-xs flex items-center justify-center animate-fadeIn">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-2xl border border-red-300 overflow-hidden relative animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-red-900 via-rose-900 to-slate-900 text-white flex items-center justify-between border-b border-red-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-800/80 border border-red-500/50 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 text-red-300 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg uppercase tracking-wider text-red-100 flex items-center gap-2">
                <span>🚨 Protocolo de Emergência</span>
              </h3>
              <p className="text-xs text-red-300 font-medium">
                Recuperação de Dono / Troca da Conta Master do Portal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar recuperação de emergência"
            className="text-red-300 hover:text-white p-1 rounded-lg hover:bg-red-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-slate-50">
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 font-medium space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Garantia de Segurança & Recuperação de Conta:</span>
            </p>
            <p>
              Este procedimento é reservado para casos de perda de acesso ou comprometimento da conta. Ao validar a chave secreta e um dos 3 e-mails alternativos de segurança cadastrados, o portal transferirá o perfil <strong>Master Admin</strong> para o novo e-mail informado.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-xs text-red-800 font-bold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                <span>Chave Secreta de Recuperação:</span>
              </label>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="Chave de recuperação configurada pela instituição"
                className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>E-mail de Segurança Cadastrado (1 dos 3):</span>
              </label>
              <input
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="Ex: lucas.recovery@ufes.br"
                className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
              <div className="mt-2 flex gap-2"><input inputMode="numeric" maxLength={6} value={verificationCode} onChange={event=>setVerificationCode(event.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Código de 6 dígitos" className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold tracking-[0.25em]"/><button type="button" onClick={async()=>{setErrorMsg('');try{const result=await apiClient.requestRecoveryCode(recoveryEmail.trim());setSuccessMsg(result.message);}catch(error){setErrorMsg(error instanceof Error?error.message:'Não foi possível solicitar o código.');}}} disabled={!recoveryEmail.includes('@')} className="rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold disabled:opacity-40">Enviar código</button></div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                <span>Novo E-mail do Administrador Master (Novo Dono):</span>
              </label>
              <input
                type="email"
                value={newMasterEmail}
                onChange={(e) => setNewMasterEmail(e.target.value)}
                placeholder="Ex: novo.master@ufes.br"
                className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>Processando...</span>
              ) : (
                <>
                  <span>🚨 Transferir Dono do Site</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
