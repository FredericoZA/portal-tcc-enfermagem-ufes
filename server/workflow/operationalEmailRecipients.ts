import type {ProcessData} from '../../src/types';
import {invitedExaminers} from '../../src/utils/invitationEmail';
import {isValidSignatureEmail} from './signaturePolicy';
import {reservationCopies} from './reservationEmail';
import {operationalEmailRouting} from '../../src/utils/studioOperationalCatalog';
/** Department action links are never copied to participants: each recipient gets its own message. */
export function operationalEmailRecipients(templateId:string,process:Parameters<typeof reservationCopies>[0]&Partial<Pick<ProcessData,'banca'|'coorientador'>>,department:string,configured:string[],president?:string):string[]{
 const audience=operationalEmailRouting(templateId)?.audience;
 if(audience==='committee'){
  const guests=invitedExaminers(process);
  if(guests.length!==2||guests.some(person=>!isValidSignatureEmail(person.email)))throw new Error('Confira os nomes e e-mails dos dois convidados da banca antes de enviar o convite.');
  if(process.coorientador?.email&&!isValidSignatureEmail(process.coorientador.email))throw new Error('Confira o e-mail do coorientador antes de enviar o convite.');
  return guests.map(person=>person.email.trim().toLowerCase());
 }
 if(audience==='all-participants'){const all=[process.aluno1.email,process.aluno2?.email,process.orientador.email,process.coorientador?.email,...(process.banca||[]).map(person=>person.email),president].filter(Boolean) as string[];if(all.some(email=>!isValidSignatureEmail(email)))throw new Error('Confira os e-mails dos participantes antes do aviso final.');return [...new Set(all.map(email=>email.trim().toLowerCase()))];}
 const participants=()=>reservationCopies(process,'');
 if(templateId==='email-assinatura-declaracao'){if(!isValidSignatureEmail(president))throw new Error('Confira o e-mail da presidência antes do aviso de assinatura da declaração.');return [president!.trim().toLowerCase()];}
 if(audience==='participants'||['email-instrucoes-cadastro','email-confirmacao','email-assinatura-ata'].includes(templateId))return participants();
 return configured;
}

export function invitationEmailCopies(process:Parameters<typeof operationalEmailRecipients>[1], masterEmail?:string):string[]{
 const examiners=new Set(operationalEmailRecipients('email-convite',process,'',[]));
 const copies=[...reservationCopies(process,''),process.coorientador?.email,masterEmail];
 return [...new Set(copies.filter(Boolean).map(email=>email!.trim().toLowerCase()))].filter(email=>!examiners.has(email));
}
