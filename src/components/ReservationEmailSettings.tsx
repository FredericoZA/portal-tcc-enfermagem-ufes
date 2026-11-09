import React, {useEffect,useRef,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {apiClient} from '../services/apiClient';
import {reservationContact} from '../utils/reservationContact';
import type {GlobalSettings} from '../types';

export function configuredReservationContact(settings:GlobalSettings|null|undefined):string{
  const template=settings?.integrationStudio?.emailTemplates?.find(item=>item.id==='email-reserva');
  return reservationContact(template?.recipient,settings?.emailConfig?.roomReservationDepartmentEmail,settings?.emailConfig?.roomReservationEmailCentralized===true);
}

export function ReservationEmailSettingsControl({email,saving,message,error,onChange,onSave}:{email:string;saving:boolean;message:string;error:string;onChange:(value:string)=>void;onSave:()=>void}){
  return <section aria-labelledby="reservation-contact-label" className="mb-4 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-card)] p-3">
    <label htmlFor="reservation-contact" id="reservation-contact-label" className="text-xs font-semibold text-slate-900">Responsável pela reserva de salas</label>
    <p id="reservation-contact-help" className="my-2 text-[11px] leading-5 text-slate-700">Contato único para o auditório e a sala de reuniões. Os próximos pedidos e os modelos que usam o e-mail do departamento seguem esta configuração. Para outro local, o responsável continua sendo o orientador.</p>
    <div className="flex flex-wrap items-center gap-2">
      <input id="reservation-contact" type="email" autoComplete="email" required maxLength={254} value={email} disabled={saving} onChange={event=>onChange(event.target.value)} aria-describedby="reservation-contact-help" className="portal-input min-w-0 flex-1 text-[11px]" />
      <button type="button" disabled={saving||!email.trim()} onClick={onSave} className="rounded-full bg-[var(--portal-brand-action)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving?'Salvando…':'Salvar contato'}</button>
    </div>
    {message&&<p role="status" className="mt-2 text-[11px] text-[var(--portal-brand-action)]">{message}</p>}
    {error&&<p role="alert" className="mt-2 text-[11px] text-[var(--portal-danger)]">{error}</p>}
  </section>;
}

export function ReservationEmailSettings(){
  const {settings,isMasterAdmin,refreshAuth}=useAuth();
  const [email,setEmail]=useState(()=>configuredReservationContact(settings));
  const [saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const lock=useRef(false),edited=useRef(false);
  useEffect(()=>{if(!lock.current&&!edited.current)setEmail(configuredReservationContact(settings));},[settings]);
  const save=async()=>{
    if(!isMasterAdmin||!settings||lock.current)return;
    const contact=reservationContact(undefined,email,true);
    if(!contact){setError('Informe um e-mail válido para o responsável pela reserva de salas.');return;}
    lock.current=true;setSaving(true);setMessage('');setError('');
    try{
      const saved=await apiClient.updateSettings({emailConfig:{roomReservationDepartmentEmail:contact}});
      if(saved.emailConfig?.roomReservationEmailCentralized!==true||configuredReservationContact(saved)!==contact)throw new Error('O servidor não confirmou o contato. Confira antes de tentar novamente.');
      edited.current=false;setEmail(contact);setMessage('Contato salvo. Os próximos envios destinados ao departamento usarão este endereço.');
      await refreshAuth();
    }catch(failure){setError(failure instanceof Error?failure.message:'Não foi possível salvar o contato.');}
    finally{lock.current=false;setSaving(false);}
  };
  if(!isMasterAdmin||!settings)return null;
  return <ReservationEmailSettingsControl email={email} saving={saving} message={message} error={error} onChange={value=>{edited.current=true;setEmail(value);setMessage('');setError('');}} onSave={()=>void save()}/>;
}
