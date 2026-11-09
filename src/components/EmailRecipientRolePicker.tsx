import React from 'react';
import {X} from 'lucide-react';
import type {EmailRecipientRole} from '../types/integrationStudio';
import {EMAIL_RECIPIENT_ROLES,getEmailRecipientSelection} from '../utils/emailRecipientRoles';

export const EMAIL_RECIPIENT_ROLE_LABELS:Record<EmailRecipientRole,string>={
  RESERVATION_RESPONSIBLE:'Responsável pela reserva',
  AUTHORS:'Autores',
  ADVISOR:'Orientador',
  COADVISOR:'Coorientador',
  EXAMINERS:'Examinadores',
  COMMISSION_PRESIDENT:'Presidência da comissão',
};
type RecipientTemplate={id?:string;recipient?:string;cc?:string;recipientRoles?:EmailRecipientRole[];ccRoles?:EmailRecipientRole[]};
export function emailRecipientSummary(template:RecipientTemplate):string{
  const selection=getEmailRecipientSelection(template);
  const to=selection.legacyRecipient||selection.recipientRoles.map(role=>EMAIL_RECIPIENT_ROLE_LABELS[role]).join(', ')||'Nenhum destinatário';
  const cc=selection.legacyCc||selection.ccRoles.map(role=>EMAIL_RECIPIENT_ROLE_LABELS[role]).join(', ');
  return cc?`${to} · Cópia: ${cc}`:to;
}

export function EmailRecipientRolePicker({template,onChange}:{template:RecipientTemplate;onChange:(value:{recipientRoles:EmailRecipientRole[];ccRoles:EmailRecipientRole[]})=>void}){
  const selection=getEmailRecipientSelection(template);
  const personalRequest=template.id==='email-reserva';
  const invitation=template.id==='email-convite';
  const change=(field:'recipientRoles'|'ccRoles',roles:EmailRecipientRole[])=>onChange({recipientRoles:selection.recipientRoles,ccRoles:selection.ccRoles,[field]:roles});
  return <div className="space-y-2" aria-label="Destinatários por papel">
    <div className="grid gap-3 sm:grid-cols-2">
      {(personalRequest?(['recipientRoles'] as const):(['recipientRoles','ccRoles'] as const)).map(field=>{
        const title=field==='recipientRoles'?'Para':'Cópia';
        const selected=selection[field];
        const legacy=field==='recipientRoles'?selection.legacyRecipient:selection.legacyCc;
        return <fieldset key={field} className="min-w-0 space-y-2">
          <legend className="text-xs font-semibold text-slate-700">{title}</legend>
          <div className="flex min-h-11 flex-wrap items-center gap-1.5">
            {selected.map(role=><span key={role} className="inline-flex items-center gap-1 rounded-lg border border-[var(--portal-border)] bg-white py-1 pl-2 text-xs font-semibold text-slate-800">
              {EMAIL_RECIPIENT_ROLE_LABELS[role]}
              {personalRequest||invitation&&field==='recipientRoles'&&role==='EXAMINERS'?<span className="px-2 text-[10px] font-normal text-slate-500">{personalRequest?'Automático':'Obrigatório'}</span>:<button type="button" onClick={()=>change(field,selected.filter(value=>value!==role))} className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--portal-brand-action)]" aria-label={`Remover ${EMAIL_RECIPIENT_ROLE_LABELS[role]} de ${title}`}><X className="h-3.5 w-3.5" aria-hidden="true"/></button>}
            </span>)}
            {!selected.length&&!legacy&&<span className="text-xs text-slate-500">{field==='ccRoles'?'Sem cópia adicional':'Selecione um destinatário'}</span>}
          </div>
          {!personalRequest&&<label className="block">
            <span className="sr-only">Adicionar destinatário em {title}</span>
            <select value="" onChange={event=>{if(event.target.value)change(field,[...selected,event.target.value as EmailRecipientRole]);}} className="portal-input w-full bg-white text-xs">
              <option value="">Adicionar destinatário…</option>
              {EMAIL_RECIPIENT_ROLES.filter(role=>!selection.recipientRoles.includes(role)&&!selection.ccRoles.includes(role)).map(role=><option key={role} value={role}>{EMAIL_RECIPIENT_ROLE_LABELS[role]}</option>)}
            </select>
          </label>}
          {legacy&&<p className="break-words text-xs text-slate-600">Destinatário atual: {legacy}. Ao escolher papéis, eles substituem os destinatários atuais.</p>}
        </fieldset>;
      })}
    </div>
    {personalRequest?<p className="text-xs text-slate-600">O pedido de aceite segue para o responsável pelo local: contato central nas salas administradas ou orientador em outro local. Configure os demais destinatários no aviso informativo da solicitação.</p>:<>
      {invitation&&!selection.recipientRoles.includes('EXAMINERS')&&<p role="alert" className="text-xs font-semibold text-[var(--portal-danger)]">O convite deve ter os examinadores em Para.</p>}
      {!selection.recipientRoles.length&&!selection.legacyRecipient&&<p role="alert" className="text-xs font-semibold text-[var(--portal-danger)]">Selecione ao menos um destinatário em Para.</p>}
      <p className="text-xs text-slate-600">Os e-mails vêm dos contatos centrais e dos participantes do TCC. Papéis sem participante são ignorados. A cópia de auditoria segue a configuração em Integrações e Plataforma.</p>
    </>}
  </div>;
}
