import React from 'react';
import type {EmailRecipientRole,SignatureRecipientRole} from '../types/integrationStudio';
import {emailRecipientSummary} from './EmailRecipientRolePicker';
import {formRecipientSummary} from '../utils/formRecipientRoles';
import {getSignatureRecipientRoles,signatureRecipientSummary} from '../utils/signatureRecipientRoles';

type Template={id?:string;type?:string;recipient?:string;cc?:string;recipientRoles?:EmailRecipientRole[];ccRoles?:EmailRecipientRole[];signatureRecipientRoles?:SignatureRecipientRole[];targetRole?:string};
export function WorkflowRecipientCell({kind,template,invitationEmail,onOpen,editor}:{kind:string;template?:Template;invitationEmail?:Template;onOpen:(kind:'documents'|'emails'|'forms',id:string)=>void;editor?:React.ReactNode}){
  if(kind==='action')return <span className="text-[10px] text-slate-600">Rotina interna do Portal</span>;
  if(!template?.id)return <span className="text-[10px] font-semibold text-amber-900">Item não encontrado. Revise o vínculo.</span>;
  const invitation=kind==='doc'&&(template.type==='CONVITE'||template.id==='tmpl-convite');
  const signature=kind==='doc'&&getSignatureRecipientRoles(template).length>0;
  const summary=kind==='email'?emailRecipientSummary(template):kind==='form'?formRecipientSummary(template):signature?signatureRecipientSummary(template):invitation&&invitationEmail?emailRecipientSummary(invitationEmail):'Arquivo do processo · sem envio próprio';
  const target=invitation&&invitationEmail?.id?{kind:'emails' as const,id:invitationEmail.id}:{kind:kind==='email'?'emails' as const:kind==='form'?'forms' as const:'documents' as const,id:template.id};
  if(editor)return <details className="rounded-lg border border-slate-300 bg-white text-left"><summary className="cursor-pointer p-2 text-[10px] font-semibold leading-4 text-[var(--portal-brand-action)]" aria-label={`Selecionar destinatários: ${summary}`}><span className="block">Selecionar destinatários</span><span className="block font-normal text-slate-700">{summary}</span></summary><div className="min-w-[260px] space-y-3 border-t border-slate-200 p-3">{editor}<button type="button" onClick={()=>onOpen(target.kind,target.id)} className="text-xs font-semibold underline underline-offset-2">Abrir configuração completa</button></div></details>;
  return <button type="button" onClick={()=>onOpen(target.kind,target.id)} title={`Abrir configuração: ${summary}`} aria-label={`Configurar destinatários: ${summary}`} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-center text-[10px] font-semibold leading-4 text-[var(--portal-brand-action)] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--portal-brand-action)]">{summary||'Selecionar destinatários no cadastro do item'}{invitation&&<span className="mt-0.5 block text-[9px] font-normal text-slate-600">Envio pelo e-mail de convite</span>}</button>;
}
