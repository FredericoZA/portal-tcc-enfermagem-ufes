import type {ProcessData} from '../../src/types';
import type {EmailDeliveryRecord,WorkflowRun} from '../../src/types/automation';
import {operationalEmailRecipients,invitationEmailCopies} from './operationalEmailRecipients';

/** A file pointer or an unrelated email is never proof that the board was invited. */
export function confirmedInvitationDelivery(process:ProcessData,run:WorkflowRun,emails:readonly EmailDeliveryRecord[],audience?:{to?:string[];cc?:string[]}):EmailDeliveryRecord|undefined{
 if(run.eventCode!=='LOCATION_CONFIRMED'||run.status!=='COMPLETED'||run.processId!==process.id||run.sourceDataRevision!==process.dataRevision)return;
 const ids=new Set(run.actions.filter(action=>action.kind==='EMAIL'&&action.status==='COMPLETED').flatMap(action=>String(action.externalId||'').split(',')));
 if(!ids.size)return;
 const examiners=operationalEmailRecipients('email-convite',process,'',[]);
 const normalize=(emails:readonly string[])=>new Set(emails.map(email=>email.trim().toLowerCase()));
 const expected=normalize(audience?.to??examiners);
 if(examiners.some(email=>!expected.has(email)))return;
 const copies=[...normalize(audience?.cc??invitationEmailCopies(process))].filter(email=>!expected.has(email));
 return emails.find(mail=>{
  if(!ids.has(mail.id)||mail.processId!==process.id||mail.templateId!=='email-convite'||mail.status!=='ACCEPTED_BY_GMAIL'||mail.dispatchState||mail.sourceDataRevision!==process.dataRevision)return false;
  if(Number(mail.workflowEventVariables?.RESERVATION_REVISION??-1)!==(process.defesa.reservationRevision||0))return false;
  if(!mail.attempts.some(attempt=>attempt.status==='ACCEPTED_BY_GMAIL'&&attempt.gmailMessageId))return false;
  const to=new Set([mail.recipient,...(mail.additionalRecipients||[])].map(email=>email.trim().toLowerCase()));
  const cc=new Set((audience?.cc!==undefined?(mail.workflowCc??mail.cc??[]):mail.cc||[]).map(email=>email.trim().toLowerCase()));
  return to.size===expected.size&&[...expected].every(email=>to.has(email))&&copies.every(email=>cc.has(email))&&(audience?.cc===undefined||cc.size===copies.length);
 });
}
