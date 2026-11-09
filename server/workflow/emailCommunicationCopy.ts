import type {EmailDeliveryRecord} from '../../src/types/automation';
import {hasPersonalEmailAccess} from '../integrations/emailAuditCopy';
import {dispatchTrackedEmail,type TrackedGmailPorts} from '../integrations/trackedGmail';

export type CommunicationCopyBlocker={code:string;error:string};
export function communicationCopyBlocker(record:EmailDeliveryRecord,now=Date.now()):CommunicationCopyBlocker|undefined{
 const block=(error:string)=>({code:'EMAIL_COPY_NOT_ELIGIBLE',error});
 if(record.communicationCopy)return block('Consulte a mensagem original para autorizar outra cópia.');
 if(!record.processId||!record.templateId||!record.renderedText)return block('O conteúdo operacional original não está disponível para copiar.');
 if(record.auditCopyMode==='sensitive'||hasPersonalEmailAccess(record.renderedText,record.renderedHtml)||/otp|access|codigo|teste:/i.test(record.templateId))return block('Mensagens de acesso ou decisão pessoal não permitem cópia.');
 if(record.dispatchState==='SENDING'&&record.dispatchLeaseUntil&&Date.parse(record.dispatchLeaseUntil)>now)return block('O envio ainda está em processamento. Aguarde antes de conferir a caixa Enviados.');
 if(record.status!=='ACCEPTED_BY_GMAIL'&&!record.dispatchState)return block('Para este resultado, utilize a retomada da tentativa original.');
 if(!Array.isArray(record.workflowCc))return block('As cópias operacionais originais não foram registradas com segurança.');
 if(!Array.isArray(record.attachmentManifest))return block('O registro antigo não confirma seus anexos. A cópia permanece bloqueada para não enviar uma mensagem incompleta.');
 if(record.attachmentManifest.length)return block('Esta mensagem contém anexos. A cópia exige recuperar os mesmos arquivos e ainda não está disponível.');
 return;
}

export async function sendConsciousCommunicationCopy(input:{record:EmailDeliveryRecord;actorEmail:string;body:any;ports:TrackedGmailPorts;currentBlocker?:CommunicationCopyBlocker;now?:()=>Date}){
 const {record,body}=input;
 const reason=typeof body.reason==='string'?body.reason.trim():'';
 const operationId=typeof body.operationId==='string'?body.operationId:'';
 if(body.checkedSentFolder!==true||reason.length<10||reason.length>500||!/^[-a-zA-Z0-9_]{20,80}$/.test(operationId))throw Object.assign(new Error('Confira Enviados, informe um motivo de 10 a 500 caracteres e confirme uma nova cópia.'),{status:400,code:'EMAIL_COPY_CONFIRMATION_REQUIRED'});
 const blocker=communicationCopyBlocker(record,(input.now?.()||new Date()).getTime())||input.currentBlocker;
 if(blocker)throw Object.assign(new Error(blocker.error),{status:409,code:blocker.code});
 const idempotencyKey=`communication-copy:${record.id}:${operationId}`;
 const previous=await input.ports.journal.findByIdempotencyKey(idempotencyKey);
 if(previous){
  const copy=previous.communicationCopy;
  if(copy?.sourceDeliveryId!==record.id||copy.reason!==reason||copy.confirmedBy!==input.actorEmail)throw Object.assign(new Error('Esta confirmação já foi utilizada para outra solicitação.'),{status:409,code:'EMAIL_COPY_OPERATION_CONFLICT'});
  // A submitted copy is a single conscious operation, including rejected or uncertain replies.
  return previous;
 }
 const now=(input.now?.()||new Date()).toISOString();
 const copy=await dispatchTrackedEmail({processId:record.processId,protocol:record.protocol,sourceDataRevision:record.sourceDataRevision,studioRevision:record.studioRevision,
  recipient:record.recipient,additionalRecipients:[...(record.additionalRecipients||[])],cc:[...(record.workflowCc||[])],workflowCc:[...(record.workflowCc||[])],subject:record.subject,text:record.renderedText!,html:record.renderedHtml,
  templateId:`communication-copy:${record.templateId}`,requestedBy:input.actorEmail,replyThreadId:record.replyThreadId,replyMessageId:record.replyMessageId,
  idempotencyKey,maxAttempts:1,attachments:[],communicationCopy:{sourceDeliveryId:record.id,sourceTemplateId:record.templateId,operationId,reason,confirmedBy:input.actorEmail,confirmedAt:now},
 },input.ports);
 return copy;
}
