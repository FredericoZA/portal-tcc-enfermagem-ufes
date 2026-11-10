import React from 'react';
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

export function EmailRecipientRolePicker({template,onChange}:{template:RecipientTemplate;onChange:(value:{recipientRoles?:EmailRecipientRole[];ccRoles?:EmailRecipientRole[]})=>void}){
  const selection=getEmailRecipientSelection(template);
  const personalRequest=template.id==='email-reserva';
  const invitation=template.id==='email-convite';
  const change=(field:'recipientRoles'|'ccRoles',roles:EmailRecipientRole[])=>onChange({[field]:roles});
  return <div className="space-y-2" aria-label="Destinatários por papel">
    <div className="grid gap-3 sm:grid-cols-2">
      {(personalRequest?(['recipientRoles'] as const):(['recipientRoles','ccRoles'] as const)).map(field=>{
        const title=field==='recipientRoles'?'Para':'Cópia';
        const selected=selection[field];
        const legacy=field==='recipientRoles'?selection.legacyRecipient:selection.legacyCc;
        return <fieldset key={field} className="min-w-0 space-y-2">
          <legend className="text-xs font-semibold text-slate-700">{title}</legend>
          <div className="space-y-1">
            {(personalRequest ? selected : EMAIL_RECIPIENT_ROLES).map(role => {
              const checked = selected.includes(role);
              const required = personalRequest || (invitation && field === 'recipientRoles' && role === 'EXAMINERS');
              const otherField = field === 'recipientRoles' ? 'ccRoles' : 'recipientRoles';
              const inOtherField = selection[otherField].includes(role);
              return <label key={role} className="flex min-h-8 items-center gap-2 text-xs text-slate-800">
                <input type="checkbox" checked={checked} disabled={required || inOtherField}
                  onChange={() => change(field, checked ? selected.filter(value => value !== role) : [...selected, role])}
                  className="size-4 accent-[var(--portal-brand-action)]"/>
                <span>{EMAIL_RECIPIENT_ROLE_LABELS[role]}{required && <small className="ml-1 text-slate-600">{personalRequest ? 'Automático' : 'Obrigatório'}</small>}
                  {inOtherField && !required && <small className="ml-1 text-slate-600">{field === 'recipientRoles' ? 'Em cópia' : 'Em Para'}</small>}</span>
              </label>;
            })}
          </div>
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
