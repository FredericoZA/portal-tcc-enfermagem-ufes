import React, {useEffect, useRef, useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {isEmailAuditEnabled} from '../utils/emailAuditSettings';
import {apiClient} from '../services/apiClient';

interface EmailAuditSettingsControlProps {
  isMaster: boolean;
  enabled: boolean;
  saving: boolean;
  masterEmail: string;
  message?: string;
  error?: string;
  onToggle: () => void;
}

export function EmailAuditSettingsControl({isMaster,enabled,saving,masterEmail,message,error,onToggle}:EmailAuditSettingsControlProps) {
  if(!isMaster)return null;
  return <section aria-labelledby="email-audit-label" className="mb-4 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-card)] p-3">
    <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,20rem)]">
      <div>
        <div className="flex items-center justify-between gap-3">
          <strong id="email-audit-label" className="text-xs text-slate-900">Auditar envio de e-mails</strong>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-700">{enabled?'Ativada':'Desativada'}</span>
            <button type="button" role="switch" aria-checked={enabled} aria-labelledby="email-audit-label" aria-describedby="email-audit-description" disabled={saving||!masterEmail} onClick={onToggle} className="inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--portal-brand-action)] disabled:cursor-not-allowed disabled:opacity-50">
              <span aria-hidden="true" className="inline-flex h-7 w-12 items-center rounded-full border border-[var(--portal-border)] px-1" style={{backgroundColor:enabled?'var(--portal-brand-action)':'var(--portal-surface-panel)'}}>
                <span className="h-5 w-5 rounded-full bg-[var(--portal-surface-inner)] shadow-sm" style={{transform:enabled?'translateX(18px)':'translateX(0)'}} />
              </span>
            </button>
          </div>
        </div>
        <p id="email-audit-description" className="mt-2 text-[11px] leading-5 text-slate-700">Enviar ao Master uma cópia completa dos e-mails enviados pelo Portal, inclusive códigos de acesso e links pessoais. O conteúdo sensível permanece fora do Registro de logs.</p>
      </div>
      <label htmlFor="email-audit-destination" className="text-[10px] font-semibold text-slate-700">Destino da cópia de auditoria
        <input id="email-audit-destination" type="email" readOnly value={masterEmail} className="portal-input mt-1 bg-[var(--portal-surface-panel)] text-[11px]" />
      </label>
    </div>
    {saving?<p role="status" className="mt-2 text-[11px] text-slate-600">Salvando configuração…</p>:message?<p role="status" className="mt-2 text-[11px] text-[var(--portal-brand-action)]">{message}</p>:null}
    {error&&<p role="alert" className="mt-2 text-[11px] text-[var(--portal-danger)]">{error}</p>}
  </section>;
}

export function EmailAuditSettings() {
  const {settings,isMasterAdmin,refreshAuth}=useAuth();
  const [enabled,setEnabled]=useState(()=>settings?isEmailAuditEnabled(settings):false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const saveLock=useRef(false);
  const latestSettings=useRef(settings);
  latestSettings.current=settings;
  useEffect(()=>{if(settings&&!saveLock.current)setEnabled(isEmailAuditEnabled(settings));},[settings]);

  const toggle=async()=>{
    if(!isMasterAdmin||!settings||saveLock.current)return;
    const previous=enabled,next=!previous,settingsAtStart=settings;
    saveLock.current=true;setSaving(true);setEnabled(next);setMessage('');setError('');
    try{
      const saved=await apiClient.updateSettings({emailConfig:{auditEmailsEnabled:next}});
      const confirmed=isEmailAuditEnabled(saved);
      setEnabled(confirmed);
      if(confirmed!==next)throw new Error('O servidor não confirmou a opção selecionada. Confira a configuração atual.');
      setMessage(confirmed?'Auditoria de e-mails ativada.':'Auditoria de e-mails desativada.');
    }catch(failure){
      setEnabled(previous);
      setError(failure instanceof Error?failure.message:'Não foi possível confirmar a alteração. Confira a configuração atual e tente novamente.');
    }finally{
      try{await refreshAuth();}catch{setError('Não foi possível atualizar a configuração. Recarregue para conferir o estado atual.');}
      saveLock.current=false;
      if(latestSettings.current&&latestSettings.current!==settingsAtStart)setEnabled(isEmailAuditEnabled(latestSettings.current));
      setSaving(false);
    }
  };

  return <EmailAuditSettingsControl isMaster={isMasterAdmin&&Boolean(settings)} enabled={enabled} saving={saving} masterEmail={String(settings?.masterEmail||'').trim()} message={message} error={error} onToggle={()=>void toggle()} />;
}
