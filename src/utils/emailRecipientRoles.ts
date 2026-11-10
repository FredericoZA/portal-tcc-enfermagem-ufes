import {invitedExaminers} from './invitationEmail';
import type {EmailRecipientRole,EmailRecipientSelection} from '../types/integrationStudio';
import type {ProcessData} from '../types';
export const EMAIL_RECIPIENT_ROLES:readonly EmailRecipientRole[]=['RESERVATION_RESPONSIBLE','AUTHORS','ADVISOR','COADVISOR','EXAMINERS','COMMISSION_PRESIDENT'];
export function validateEmailRecipientSelection(template:Record<string,unknown>):void{
 for(const field of ['recipientRoles','ccRoles'] as const){
  const value=template[field];
  if(value!==undefined&&(!Array.isArray(value)||value.some(role=>!EMAIL_RECIPIENT_ROLES.includes(role))))throw new Error('Seleção de destinatários inválida.');
 }
 if(template.recipientRoles!==undefined&&!(template.recipientRoles as unknown[]).length)throw new Error('Selecione ao menos um papel destinatário.');
 if(template.id==='email-convite'&&template.recipientRoles!==undefined&&!(template.recipientRoles as unknown[]).includes('EXAMINERS'))throw new Error('O convite deve manter os examinadores como destinatários. Acrescente outros papéis sem remover a banca.');
 if(template.id==='email-reserva'&&(template.recipientRoles!==undefined||template.ccRoles!==undefined)){
  if(JSON.stringify(template.recipientRoles)!==JSON.stringify(['RESERVATION_RESPONSIBLE'])||(template.ccRoles as unknown[]|undefined)?.length)throw new Error('O pedido pessoal de reserva deve ser enviado somente ao responsável. Configure outros papéis no aviso informativo.');
 }
}
export function resolveEmailRecipientRoles(roles:readonly EmailRecipientRole[],process:Pick<ProcessData,'aluno1'|'aluno2'|'orientador'|'coorientador'|'banca'>,responsible:string,president?:string):string[]{
 const selected=roles.flatMap(role=>role==='RESERVATION_RESPONSIBLE'?[responsible]:role==='AUTHORS'?[process.aluno1.email,process.aluno2?.email]:role==='ADVISOR'?[process.orientador.email]:role==='COADVISOR'?[process.coorientador?.email]:role==='EXAMINERS'?invitedExaminers(process).map(person=>person.email):role==='COMMISSION_PRESIDENT'?[president]:[]).filter(Boolean).map(email=>String(email).trim().toLowerCase());
 if(selected.some(email=>!/^([^\s@]+)@([^\s@]+)\.([^\s@]+)$/.test(email)))throw new Error('Confira os e-mails dos papéis selecionados.');
 return [...new Set(selected)];
}
export function configuredEmailAudience(template:Record<string,unknown>|undefined,process:Parameters<typeof resolveEmailRecipientRoles>[1],responsible:string,president?:string):{to?:string[];cc?:string[]}|undefined{
 if(!template||template.recipientRoles===undefined&&template.ccRoles===undefined)return undefined;
 validateEmailRecipientSelection(template);
 const selection=template as Record<string,unknown>&EmailRecipientSelection;
 const to=selection.recipientRoles===undefined?undefined:resolveEmailRecipientRoles(selection.recipientRoles,process,responsible,president);
 const cc=selection.ccRoles===undefined?undefined:resolveEmailRecipientRoles(selection.ccRoles,process,responsible,president).filter(email=>!to?.includes(email));
 if(to&&!to.length)throw new Error('Os papéis selecionados não possuem destinatários neste TCC.');
 return {to,cc};
}
const DEFAULT_ROLE_SELECTIONS:Record<string,{recipientRoles:EmailRecipientRole[];ccRoles:EmailRecipientRole[]}>= {
 'email-reserva':{recipientRoles:['RESERVATION_RESPONSIBLE'],ccRoles:[]},
 'email-reserva-autores':{recipientRoles:['AUTHORS','ADVISOR'],ccRoles:[]},
 'email-comprovante-reserva':{recipientRoles:['RESERVATION_RESPONSIBLE','AUTHORS','ADVISOR'],ccRoles:[]},
 'email-local-indisponivel':{recipientRoles:['RESERVATION_RESPONSIBLE','AUTHORS','ADVISOR'],ccRoles:[]},
 'email-convite':{recipientRoles:['EXAMINERS'],ccRoles:['AUTHORS','ADVISOR','COADVISOR']},
 'email-entrega-repositorio':{recipientRoles:['AUTHORS','ADVISOR'],ccRoles:[]},
 'email-assinatura-termo':{recipientRoles:['AUTHORS','ADVISOR'],ccRoles:[]},
 'email-conclusao':{recipientRoles:['AUTHORS','ADVISOR','COADVISOR','EXAMINERS','COMMISSION_PRESIDENT'],ccRoles:[]},
};
export function getEmailRecipientSelection(template:{id?:unknown;recipient?:unknown;cc?:unknown;recipientRoles?:unknown;ccRoles?:unknown}):{recipientRoles:EmailRecipientRole[];ccRoles:EmailRecipientRole[];legacyRecipient?:string;legacyCc?:string}{
 const defaults=DEFAULT_ROLE_SELECTIONS[String(template.id)]||{recipientRoles:[],ccRoles:[]};
 const raw=String(template.recipient||'').trim();
 const variables:Record<string,EmailRecipientRole>={DEPARTAMENTO_EMAIL:'RESERVATION_RESPONSIBLE',ALUNO_1_EMAIL:'AUTHORS',ALUNO_2_EMAIL:'AUTHORS',ORIENTADOR_EMAIL:'ADVISOR',COORIENTADOR_EMAIL:'COADVISOR',BANCA_EMAILS:'EXAMINERS',PRESIDENTE_EMAIL:'COMMISSION_PRESIDENT'};
 const tokens=raw.match(/\{\{\s*([A-Z_0-9]+)\s*\}\}|<<\s*([A-Z_0-9]+)\s*>>/g)||[];
 const inferred=tokens.map(token=>variables[token.replace(/[{}<>\s]/g,'')]).filter(Boolean);
 const residue=raw.replace(/\{\{\s*[A-Z_0-9]+\s*\}\}|<<\s*[A-Z_0-9]+\s*>>/g,'').replace(/[,;\s]/g,'');
 const known=tokens.length>0&&inferred.length===tokens.length&&!residue;
 const rawCc=String(template.cc||'').trim();
 const ccTokens=rawCc.match(/\{\{\s*([A-Z_0-9]+)\s*\}\}|<<\s*([A-Z_0-9]+)\s*>>/g)||[];
 const inferredCc=ccTokens.map(token=>variables[token.replace(/[{}<>\s]/g,'')]).filter(Boolean);
 const ccKnown=ccTokens.length>0&&inferredCc.length===ccTokens.length&&!rawCc.replace(/\{\{\s*[A-Z_0-9]+\s*\}\}|<<\s*[A-Z_0-9]+\s*>>/g,'').replace(/[,;\s]/g,'');
 return {recipientRoles:Array.isArray(template.recipientRoles)?template.recipientRoles as EmailRecipientRole[]:DEFAULT_ROLE_SELECTIONS[String(template.id)]?defaults.recipientRoles:known?[...new Set(inferred)]:[],ccRoles:Array.isArray(template.ccRoles)?template.ccRoles as EmailRecipientRole[]:ccKnown?[...new Set(inferredCc)]:defaults.ccRoles,...(raw&&!known&&template.recipientRoles===undefined&&!DEFAULT_ROLE_SELECTIONS[String(template.id)]?{legacyRecipient:raw}:{}),...(template.ccRoles===undefined&&rawCc&&!ccKnown?{legacyCc:rawCc}:{})};
}
