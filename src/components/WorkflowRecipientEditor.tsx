import React from 'react';
import type {EmailRecipientRole,SignatureRecipientRole} from '../types/integrationStudio';
import {EmailRecipientRolePicker,EMAIL_RECIPIENT_ROLE_LABELS} from './EmailRecipientRolePicker';
import {RoleSelectionControl} from './RoleSelectionControl';
import {FORM_RECIPIENT_ROLES,formRecipientRoles,nativeFormRecipientRoles} from '../utils/formRecipientRoles';
import {getSignatureRecipientRoles,requiredSignatureRecipientRoles,resolveSignatureTemplateType,SIGNATURE_RECIPIENT_ROLES,SIGNATURE_RECIPIENT_LABELS} from '../utils/signatureRecipientRoles';
type Template={id?:string;type?:string;recipient?:string;cc?:string;recipientRoles?:EmailRecipientRole[];ccRoles?:EmailRecipientRole[];signatureRecipientRoles?:SignatureRecipientRole[];targetRole?:string};
export function WorkflowRecipientEditor({kind,template,invitationEmail,onEmailChange,onFormChange,onSignatureChange}:{kind:string;template?:Template;invitationEmail?:Template;onEmailChange:(id:string,patch:{recipientRoles?:EmailRecipientRole[];ccRoles?:EmailRecipientRole[]})=>void;onFormChange:(id:string,roles:EmailRecipientRole[])=>void;onSignatureChange:(id:string,roles:SignatureRecipientRole[])=>void}){
 if(!template?.id)return null;
 if(kind==='email')return <EmailRecipientRolePicker template={template} onChange={patch=>onEmailChange(template.id!,patch)}/>;
 if(kind==='form'){const required=nativeFormRecipientRoles(template)||[];return <RoleSelectionControl label="Quem pode preencher este formulário" value={formRecipientRoles(template)} required={required} options={[...(nativeFormRecipientRoles(template)||FORM_RECIPIENT_ROLES)].map(value=>({value,label:EMAIL_RECIPIENT_ROLE_LABELS[value]}))} onChange={roles=>onFormChange(template.id!,roles)}/>;}
 const roles=getSignatureRecipientRoles(template);
 if(kind==='doc'&&roles.length)return <RoleSelectionControl label="Signatários ASTEN / Gov.br" value={roles} required={requiredSignatureRecipientRoles(resolveSignatureTemplateType(template))} options={SIGNATURE_RECIPIENT_ROLES.map(value=>({value,label:SIGNATURE_RECIPIENT_LABELS[value]}))} onChange={roles=>onSignatureChange(template.id!,roles)}/>;
 if(kind==='doc'&&(template.type==='CONVITE'||template.id==='tmpl-convite')&&invitationEmail?.id)return <EmailRecipientRolePicker template={invitationEmail} onChange={patch=>onEmailChange(invitationEmail.id!,patch)}/>;
 return <p className="text-xs text-slate-600">Arquivo do processo, sem destinatário de envio próprio.</p>;
}
