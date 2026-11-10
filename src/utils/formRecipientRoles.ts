import type {EmailRecipientRole} from '../types/integrationStudio';

export type FormRecipientSelection = {id?:unknown;targetRole?:unknown;recipientRoles?:unknown}|Record<string,unknown>;
/** A custom form can only target roles already recognized inside the TCC. */
export const FORM_RECIPIENT_ROLES:readonly EmailRecipientRole[]=['AUTHORS','ADVISOR','COADVISOR','EXAMINERS','COMMISSION_PRESIDENT'];
const labels:Record<EmailRecipientRole,string>={AUTHORS:'Autores',ADVISOR:'Orientador',COADVISOR:'Coorientador',EXAMINERS:'Examinadores',COMMISSION_PRESIDENT:'Presidência da Comissão',RESERVATION_RESPONSIBLE:'Responsável pelo local'};
const nativeRoles:Record<string,readonly EmailRecipientRole[]>={
  'form-reserva-aluno':['AUTHORS'],
  'form-reserva-departamento':['RESERVATION_RESPONSIBLE'],
};
function legacyRoles(form:FormRecipientSelection):EmailRecipientRole[]{
  switch(String(form.targetRole||'')){
    case 'Aluno':return ['AUTHORS'];
    case 'Orientador':return ['ADVISOR','COADVISOR'];
    case 'Banca':return ['ADVISOR','COADVISOR','EXAMINERS'];
    case 'Presidente da Comissão':return ['COMMISSION_PRESIDENT'];
    default:return [];
  }
}
export function nativeFormRecipientRoles(form:FormRecipientSelection):readonly EmailRecipientRole[]|undefined{return nativeRoles[String(form.id||'')];}

/** Missing selection preserves legacy authorization; malformed explicit selection fails closed. */
export function formRecipientRoles(form:FormRecipientSelection):EmailRecipientRole[]{
  const native=nativeFormRecipientRoles(form);
  if(native)return [...native];
  if(form.recipientRoles===undefined)return legacyRoles(form);
  if(!Array.isArray(form.recipientRoles)||form.recipientRoles.some(role=>!FORM_RECIPIENT_ROLES.includes(role)))return [];
  return [...new Set(form.recipientRoles)] as EmailRecipientRole[];
}
export function validateFormRecipientSelection(form:FormRecipientSelection):void{
  if(form.recipientRoles===undefined)return;
  const native=nativeFormRecipientRoles(form);
  if(!Array.isArray(form.recipientRoles)||!form.recipientRoles.length||form.recipientRoles.some(role=>!(native||FORM_RECIPIENT_ROLES).includes(role)))throw new Error('Selecione ao menos um papel válido para responder ao formulário.');
  if(native&&(form.recipientRoles.length!==native.length||!native.every(role=>(form.recipientRoles as unknown[]).includes(role))))throw new Error('Os responsáveis por este formulário nativo são definidos pelo fluxo do TCC.');
}
export function formRecipientSummary(form:FormRecipientSelection):string{
  const roles=formRecipientRoles(form);
  return roles.length?roles.map(role=>labels[role]).join(', '):'Nenhum responsável selecionado';
}
/** Process membership/release, active access and field restrictions remain separate mandatory gates. */
export function canUseFormRecipientSelection(form:FormRecipientSelection,processRoles:readonly string[],globalRoles:readonly string[]):boolean{
  if(globalRoles.includes('MASTER_ADMIN'))return true;
  // Reservation acceptance is exclusively handled by its personal decision link.
  if(String(form.id||'')==='form-reserva-departamento')return false;
  const roles=formRecipientRoles(form);
  return roles.some(role=>role==='AUTHORS'?processRoles.includes('STUDENT'):
    role==='ADVISOR'?processRoles.includes('ADVISOR'):
    role==='COADVISOR'?processRoles.includes('CO_ADVISOR'):
    role==='EXAMINERS'?processRoles.includes('EXAMINER'):
    role==='COMMISSION_PRESIDENT'?globalRoles.includes('COMMISSION_PRESIDENT'):false);
}
