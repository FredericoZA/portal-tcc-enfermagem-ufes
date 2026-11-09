import type {IntegrationStudioSettings} from '../../src/types/integrationStudio';
import {configuredEmailAudience} from '../../src/utils/emailRecipientRoles';
import {operationalConfig} from '../../src/utils/operationalConfig';
import {isManagedDefenseLocation} from '../../src/utils/reservationLocation';
import type {ProcessData,SignatureJob} from '../../src/types';
import type {EmailDeliveryRecord,WorkflowRun} from '../../src/types/automation';
import {confirmedInvitationDelivery} from './invitationDelivery';
import {workflowRetryBlocker} from './retryEligibility';

export interface ReservationRecoveryArchive {
 id:string;processId:string;formType:string;version:number;reservationRevision?:number;workflowStudioRevision?:number;
 status:'PENDING'|'ARCHIVED'|'FAILED';lastError?:string;updatedAt:string;
}
export function currentReservationArchive<A extends ReservationRecoveryArchive>(process:ProcessData,archives:readonly A[]):A|undefined{
 return archives.find(item=>item.processId===process.id&&item.formType==='CONFIRMACAO_LOCAL'
   &&item.version===process.dataRevision&&item.reservationRevision===(process.defesa.reservationRevision||0));
}
/** A failed legacy upload without its action identity cannot safely be regenerated.
 * A recorded file pointer is allowed only because the Drive readback must verify
 * that exact file against the computed job, private ancestry and content hash. */
export function hasStableInvitationRecoveryIdentity(process:ProcessData,run:WorkflowRun):boolean{
 const failedDocument=run.actions.find(action=>action.status==='FAILED'&&action.kind==='DOCUMENT');
 return !failedDocument||/^[a-f0-9]{64}$/.test(failedDocument.idempotencyKey||'')
   ||/^[a-zA-Z0-9_-]{10,}$/.test(process.defesa.invitationDriveFileId||'');
}
const transientTimeout=(value:unknown)=>/timeout|timed?\s*out|operation was aborted|tempo (?:limite|excedido)/i.test(String(value||''));

/** Resume one recorded confirmation through its own archive and configured event. */
export function selectConfirmedInvitationRecovery<A extends ReservationRecoveryArchive>(input:{
 processes:readonly ProcessData[];runs:readonly WorkflowRun[];archives:readonly A[];
 emails:readonly EmailDeliveryRecord[];signatures:SignatureJob[];studioRevision:number|undefined;studio?:Partial<IntegrationStudioSettings>;departmentEmail?:string;presidentEmail?:string;now?:Date;
}):{process:ProcessData;run:WorkflowRun|undefined;archive:A;actorEmail:string}|undefined{
 const candidates=input.processes.flatMap(process=>{
  if(process.legacyRecord||process.avaliacao.status==='CONCLUIDO'||process.defesa.invitationSentAt
    ||workflowRetryBlocker(process,'LOCATION_CONFIRMED',input.signatures,process.dataRevision))return [];
  const response=process.defesa.departmentResponse,revision=process.defesa.reservationRevision||0;
  if(!response||response.decision!=='CONFIRMED'||response.revision!==revision)return [];
  if(!Number.isSafeInteger(input.studioRevision))return [];
  const run=input.runs.filter(item=>item.processId===process.id&&item.eventCode==='LOCATION_CONFIRMED'&&item.sourceDataRevision===process.dataRevision)
   .slice().sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];
  let safeMail:EmailDeliveryRecord|undefined;
  let acknowledged=false;
  if(run){
    if(run.studioRevision!==input.studioRevision||!run.actorEmail?.trim())return [];
    if(run.status==='COMPLETED'){
      let audience:ReturnType<typeof configuredEmailAudience>;
      try{audience=configuredEmailAudience(input.studio?.emailTemplates?.find(item=>['email-convite','CARTA_CONVITE'].includes(String(item.id))),process,isManagedDefenseLocation(process.defesa.local,operationalConfig(input.studio).reservation.locations)?input.departmentEmail||'':process.orientador.email,input.presidentEmail);}catch{return [];}
      acknowledged=Boolean(confirmedInvitationDelivery(process,run,input.emails,audience));
      if(!acknowledged)return [];
    }else{
      if(run.status!=='PARTIAL_FAILURE')return [];
      const failed=run.actions.find(action=>action.status==='FAILED');
      if(failed?.kind==='DOCUMENT'){
        if(!transientTimeout(failed.error)||!hasStableInvitationRecoveryIdentity(process,run))return [];
      }else if(failed?.kind==='EMAIL'&&failed.idempotencyKey){
        const awaitingDispatch=!failed.externalId&&/^[a-f0-9]{64}$/.test(failed.idempotencyKey)
          &&Boolean(process.defesa.invitationDriveFileId)
          &&run.actions.some(action=>action.kind==='DOCUMENT'&&action.status==='COMPLETED'&&action.externalId===process.defesa.invitationDriveFileId);
        safeMail=input.emails.find(mail=>(awaitingDispatch||mail.id===failed.externalId)&&mail.processId===process.id&&mail.templateId==='email-convite'
          &&mail.sourceDataRevision===process.dataRevision&&Number(mail.workflowEventVariables?.RESERVATION_REVISION??-1)===revision
          &&mail.idempotencyKey===`${failed.idempotencyKey}:${mail.recipient}`);
        if((!safeMail&&!awaitingDispatch)||safeMail?.dispatchState)return [];
        if(awaitingDispatch&&input.emails.some(mail=>mail!==safeMail&&mail.processId===process.id&&mail.templateId==='email-convite'
          &&(mail.sourceDataRevision===undefined||mail.sourceDataRevision===process.dataRevision)))return [];
        if(safeMail&&safeMail.status!=='ACCEPTED_BY_GMAIL'&&(safeMail.status!=='RETRY'||safeMail.attempts.length>=safeMail.maxAttempts
          ||Boolean(safeMail.nextRetryAt&&(!Number.isFinite(Date.parse(safeMail.nextRetryAt))||Date.parse(safeMail.nextRetryAt)>(input.now||new Date()).getTime()))))return [];
      }else return [];
    }
  }
  // An ACK may finish its own run without sending again; ambiguous dispatch never auto-replays.
  if(input.emails.some(record=>record.processId===process.id&&record.templateId==='email-convite'
    &&(record.sourceDataRevision===undefined||record.sourceDataRevision===process.dataRevision)
    &&(record.dispatchState==='SENDING'||record.dispatchState==='UNCERTAIN'
      ||record.status==='ACCEPTED_BY_GMAIL'&&!acknowledged&&record!==safeMail)))return [];
  const archive=currentReservationArchive(process,input.archives);
  if(safeMail&&archive?.status!=='ARCHIVED')return [];
  if(!archive)return [];
  // A function can stop after committing the queue item and before calling Drive.
  // Wait beyond the function's execution budget before reclaiming an orphan.
  const orphaned=archive.status==='PENDING'&&Date.parse(archive.updatedAt)<=(input.now||new Date()).getTime()-6*60_000;
  if(!(archive.status==='ARCHIVED'||orphaned||archive.status==='FAILED'&&transientTimeout(archive.lastError)))return [];
  if(!run&&(archive.workflowStudioRevision!==input.studioRevision||!response.respondedBy?.trim()))return [];
  return [{process,run,archive,actorEmail:run?.actorEmail||response.respondedBy}];
 });
 return candidates.sort((a,b)=>(a.run?.completedAt||a.archive.updatedAt).localeCompare(b.run?.completedAt||b.archive.updatedAt)||a.process.id.localeCompare(b.process.id))[0];
}
