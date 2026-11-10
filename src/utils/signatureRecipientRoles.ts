import type {SignatureRecipientRole} from '../types/integrationStudio';
export const SIGNATURE_RECIPIENT_ROLES:readonly SignatureRecipientRole[]=['AUTHORS','ADVISOR','EXAMINERS','COADVISOR_PRESENT','COMMISSION_PRESIDENT'];
export const SIGNATURE_RECIPIENT_LABELS:Record<SignatureRecipientRole,string>={AUTHORS:'Autores',ADVISOR:'Orientador',EXAMINERS:'Examinadores',COADVISOR_PRESENT:'Coorientador presente',COMMISSION_PRESIDENT:'Presidência da comissão'};
export function requiredSignatureRecipientRoles(type:unknown):SignatureRecipientRole[]{
 return String(type).toUpperCase()==='ATA'?['ADVISOR','EXAMINERS','AUTHORS','COADVISOR_PRESENT']:String(type).toUpperCase()==='TERMO'?['AUTHORS','ADVISOR']:String(type).toUpperCase()==='DECLARACAO'?['COMMISSION_PRESIDENT']:[];
}
export function resolveSignatureTemplateType(template:{id?:unknown;type?:unknown}):string{const explicit=String(template.type||'').toUpperCase();if(['ATA','TERMO','DECLARACAO'].includes(explicit))return explicit;const id=String(template.id||'').toLowerCase();return id==='tmpl-ata'?'ATA':id==='tmpl-termo'?'TERMO':id==='tmpl-declaracao'?'DECLARACAO':explicit;}
export function getSignatureRecipientRoles(template:{id?:unknown;type?:unknown;signatureRecipientRoles?:unknown}):SignatureRecipientRole[]{return Array.isArray(template.signatureRecipientRoles)?[...template.signatureRecipientRoles]:requiredSignatureRecipientRoles(resolveSignatureTemplateType(template));}
export function validateSignatureRecipientRoles(template:{id?:unknown;type?:unknown;signatureRecipientRoles?:unknown}):void{
 const required=requiredSignatureRecipientRoles(resolveSignatureTemplateType(template));
 if(template.signatureRecipientRoles===undefined)return;
 if(!required.length||!Array.isArray(template.signatureRecipientRoles)||template.signatureRecipientRoles.some(role=>!SIGNATURE_RECIPIENT_ROLES.includes(role))||required.some(role=>!(template.signatureRecipientRoles as unknown[]).includes(role)))throw new Error('Mantenha os signatários essenciais do documento e selecione somente papéis acadêmicos válidos.');
}
export function signatureRecipientSummary(template:{id?:unknown;type?:unknown;signatureRecipientRoles?:unknown}):string{return getSignatureRecipientRoles(template).map(role=>SIGNATURE_RECIPIENT_LABELS[role]).join(', ');}
