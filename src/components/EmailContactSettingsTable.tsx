import React, {useEffect, useRef, useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {apiClient} from '../services/apiClient';
import {emailAuditMailbox,isEmailAuditEnabled} from '../utils/emailAuditSettings';
import {reservationContact} from '../utils/reservationContact';
import {configuredReservationContact} from './ReservationEmailSettings';
import {createDebouncedSettingsWriter} from '../utils/debouncedSettingsWriter';

type ContactRow = 'audit' | 'reservation';
type RowFeedback = {message?: string; error?: string};
export interface EmailContactSettingsTableControlProps {
  auditEmail: string;
  auditEnabled: boolean;
  reservationEmail: string;
  reservationEnabled: boolean;
  saving: ContactRow | null;
  auditFeedback?: RowFeedback;
  reservationFeedback?: RowFeedback;
  onAuditChange: (enabled: boolean) => void;
  onAuditEmailChange: (email: string) => void;
  onReservationEmailChange: (email: string) => void;
  onReservationEnabledChange: (enabled: boolean) => void;
  onSave: (row: ContactRow) => void;
}

const configuredAuditContact = (settings:Parameters<typeof emailAuditMailbox>[0]|null|undefined) => settings ? emailAuditMailbox({...settings,emailConfig:{...settings.emailConfig,auditEmailsEnabled:true}})||'' : '';
const names = {audit: 'Auditoria', reservation: 'Responsável pela reserva de salas'};

export function EmailContactSettingsTableControl(props: EmailContactSettingsTableControlProps) {
 const rows = [
  {id:'audit' as const,email:props.auditEmail,enabled:props.auditEnabled,onEmail:props.onAuditEmailChange,onToggle:props.onAuditChange,feedback:props.auditFeedback,label:'E-mail da auditoria',help:'Cópia completa dos e-mails, incluindo códigos de acesso e links pessoais.'},
  {id:'reservation' as const,email:props.reservationEmail,enabled:props.reservationEnabled,onEmail:props.onReservationEmailChange,onToggle:props.onReservationEnabledChange,feedback:props.reservationFeedback,label:'E-mail do responsável pela reserva de salas',help:'Contato do auditório e da sala de reuniões. Em outro local, o orientador confirma a reserva.'},
 ];
 return <div className="portal-email-contact-cards mb-4 grid gap-3 md:grid-cols-2" role="region" aria-label="Contatos de e-mail do Portal">{rows.map(row=><section key={row.id} className="overflow-hidden rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-panel)]" aria-labelledby={`email-contact-${row.id}-title`}>
  <header className="flex items-center justify-between gap-3 px-3 py-2"><h4 id={`email-contact-${row.id}-title`} className="text-[11px] font-bold text-slate-900">{names[row.id]}</h4>
   <button type="button" role="switch" aria-label={`Ativar ${names[row.id]}`} aria-checked={row.enabled} aria-describedby={`email-contact-${row.id}-help`} onClick={()=>row.onToggle(!row.enabled)} className="inline-flex min-h-9 min-w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--portal-focus)]">
    <span aria-hidden="true" className="inline-flex h-6 w-10 items-center rounded-full border border-[var(--portal-border)] px-0.5" style={{backgroundColor:row.enabled?'var(--portal-brand-action)':'var(--portal-surface-panel)'}}><span className="h-[18px] w-[18px] rounded-full bg-white shadow-sm" style={{transform:row.enabled?'translateX(16px)':'translateX(0)'}}/></span><span className="sr-only">{row.enabled?'Ativo':'Inativo'}</span>
   </button>
  </header>
  <div className="p-3"><label className="block text-[11px] font-semibold text-slate-700">E-mail<input aria-label={row.label} type="email" maxLength={254} value={row.email} onChange={event=>row.onEmail(event.target.value)} onBlur={()=>props.onSave(row.id)} aria-describedby={`email-contact-${row.id}-help`} className="portal-input mt-1 w-full text-[11px]"/></label></div>
  <footer className="px-3 py-2"><p id={`email-contact-${row.id}-help`} className="text-[11px] leading-4 text-slate-600">{row.help}</p><p role={row.feedback?.error?'alert':'status'} className={`mt-1 text-[11px] ${row.feedback?.error?'text-[var(--portal-danger)]':'text-slate-600'}`}>{props.saving===row.id?'Salvando automaticamente…':row.feedback?.error||row.feedback?.message||'Salvamento automático.'}</p></footer>
 </section>)}</div>;
}

type ContactDraft={email:string;enabled:boolean;revision:number};
export function EmailContactSettingsTable() {
 const {settings,isMasterAdmin,refreshAuth}=useAuth();
 const [auditEnabled,setAuditEnabled]=useState(()=>settings?isEmailAuditEnabled(settings):false);
 const [auditEmail,setAuditEmail]=useState(()=>configuredAuditContact(settings));
 const [reservationEmail,setReservationEmail]=useState(()=>configuredReservationContact(settings));
 const [reservationEnabled,setReservationEnabled]=useState(()=>settings?.emailConfig?.roomReservationDepartmentEnabled!==false);
 const [saving,setSaving]=useState<ContactRow|null>(null);
 const [feedback,setFeedback]=useState<Partial<Record<ContactRow,RowFeedback>>>({});
 const latest=useRef({settings,isMasterAdmin,refreshAuth});latest.current={settings,isMasterAdmin,refreshAuth};
 const dirty=useRef({audit:false,reservation:false});
 const drafts=useRef<Record<ContactRow,ContactDraft>>({audit:{email:auditEmail,enabled:auditEnabled,revision:0},reservation:{email:reservationEmail,enabled:reservationEnabled,revision:0}});
 const writer=useRef<ReturnType<typeof createDebouncedSettingsWriter<ContactRow,ContactDraft>>|null>(null);
 if(!writer.current)writer.current=createDebouncedSettingsWriter<ContactRow,ContactDraft>(async(row,draft)=>{
  const auth=latest.current;if(!auth.settings||!auth.isMasterAdmin)return;
  const configured=row==='audit'?configuredAuditContact(auth.settings):configuredReservationContact(auth.settings);
  const email=reservationContact(undefined,draft.email.trim()||(!draft.enabled?configured:''),true);
  if(!email){setFeedback(value=>({...value,[row]:{error:'Informe um e-mail válido para salvar automaticamente.'}}));return;}
  setSaving(row);
  try{
   const saved=await apiClient.updateSettings({emailConfig:row==='audit'?{auditCopyEmail:email,auditEmailsEnabled:draft.enabled}:{roomReservationDepartmentEmail:email,roomReservationDepartmentEnabled:draft.enabled}});
   const confirmed=row==='audit'?isEmailAuditEnabled(saved)===draft.enabled&&configuredAuditContact(saved)===email:saved.emailConfig?.roomReservationDepartmentEnabled===draft.enabled&&saved.emailConfig?.roomReservationEmailCentralized===true&&configuredReservationContact(saved)===email;
   if(!confirmed)throw new Error('O servidor não confirmou a configuração. Edite o campo ou saia dele para tentar novamente.');
   if(drafts.current[row].revision===draft.revision){dirty.current[row]=false;drafts.current[row].email=email;if(row==='audit')setAuditEmail(email);else setReservationEmail(email);setFeedback(value=>({...value,[row]:{message:draft.enabled?'Salvo automaticamente.':'Desativado e salvo automaticamente.'}}));}
   try{await auth.refreshAuth();}catch{setFeedback(value=>({...value,[row]:{message:'Configuração salva.',error:'Não foi possível atualizar a tela. Recarregue para conferir.'}}));}
  }catch(error){if(drafts.current[row].revision===draft.revision)setFeedback(value=>({...value,[row]:{error:error instanceof Error?error.message:'Não foi possível salvar. Edite o campo ou saia dele para tentar novamente.'}}));}
  finally{setSaving(null);}
 });
 useEffect(()=>{
  if(!settings)return;
  for(const row of ['audit','reservation'] as const){if(dirty.current[row])continue;
   const email=row==='audit'?configuredAuditContact(settings):configuredReservationContact(settings);
   const enabled=row==='audit'?isEmailAuditEnabled(settings):settings.emailConfig?.roomReservationDepartmentEnabled!==false;
   drafts.current[row]={...drafts.current[row],email,enabled};
   if(row==='audit'){setAuditEmail(email);setAuditEnabled(enabled);}else{setReservationEmail(email);setReservationEnabled(enabled);}
  }
 },[settings]);
 useEffect(()=>()=>{void writer.current?.flushAll().catch(()=>{});},[]);
 const change=(row:ContactRow,patch:Partial<Pick<ContactDraft,'email'|'enabled'>>)=>{
  const draft={...drafts.current[row],...patch,revision:drafts.current[row].revision+1};drafts.current[row]=draft;dirty.current[row]=true;
  if(row==='audit'){setAuditEmail(draft.email);setAuditEnabled(draft.enabled);}else{setReservationEmail(draft.email);setReservationEnabled(draft.enabled);}
  setFeedback(value=>({...value,[row]:{message:'Alteração aguardando salvamento automático…'}}));writer.current!.schedule(row,draft);
 };
 if(!isMasterAdmin||!settings)return null;
 return <EmailContactSettingsTableControl auditEmail={auditEmail} auditEnabled={auditEnabled} reservationEmail={reservationEmail} reservationEnabled={reservationEnabled} saving={saving} auditFeedback={feedback.audit} reservationFeedback={feedback.reservation}
  onAuditChange={enabled=>change('audit',{enabled})} onAuditEmailChange={email=>change('audit',{email})} onReservationEmailChange={email=>change('reservation',{email})} onReservationEnabledChange={enabled=>change('reservation',{enabled})} onSave={row=>{if(dirty.current[row])void writer.current?.flush(row).catch(()=>{});}}/>;
}
