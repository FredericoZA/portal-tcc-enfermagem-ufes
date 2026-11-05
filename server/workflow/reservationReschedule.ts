import {isManagedDefenseLocation} from '../../src/utils/reservationLocation';
import type {ProcessData} from '../../src/types';
import type {IntegrationStudioSettings} from '../../src/types/integrationStudio';
export const RESERVATION_RESCHEDULED='RESERVATION_RESCHEDULED';
export function reservationScheduleChanged(before:ProcessData,after:ProcessData):boolean{
 return (!isManagedDefenseLocation(after.defesa.local)&&before.orientador.email.trim().toLowerCase()!==after.orientador.email.trim().toLowerCase())||Date.parse(before.defesa.startAt)!==Date.parse(after.defesa.startAt)||before.defesa.local.trim()!==after.defesa.local.trim()||String(before.defesa.alternateLocation||'').trim()!==String(after.defesa.alternateLocation||'').trim();
}
export function canRestartReservation(process:ProcessData):boolean{
 return !process.avaliacao.submittedAt&&!process.acervo?.submittedAt&&process.avaliacao.status!=='CONCLUIDO'&&process.status!=='CONCLUIDO';
}
export function restartReservation(before:ProcessData,after:ProcessData,actor:string,now:string):ProcessData{
 const d=before.defesa;
 const historical={reservationRevision:d.reservationRevision||0,receiptContext:{titulo:before.titulo,aluno1:structuredClone(before.aluno1),aluno2:before.aluno2?structuredClone(before.aluno2):null,orientador:structuredClone(before.orientador),coorientador:before.coorientador?structuredClone(before.coorientador):null,banca:structuredClone(before.banca)},startAt:d.startAt,endAt:d.endAt,local:d.local,alternateLocation:d.alternateLocation,invitationDriveFileId:d.invitationDriveFileId,invitationSentAt:d.invitationSentAt,invitationRecipients:d.invitationRecipients,locationProof:d.locationProof,departmentResponse:d.departmentResponse,reservationChangeRequest:d.reservationChangeRequest?structuredClone(d.reservationChangeRequest):undefined,localStatus:d.localStatus,localConfirmedAt:d.localConfirmedAt,localConfirmedBy:d.localConfirmedBy,localEvidenceUrl:d.localEvidenceUrl,invalidatedAt:now,invalidatedBy:actor};
 return {...after,etapaAtual:'CONFIRMACAO_LOCAL',status:'AGUARDANDO_CONFIRMACAO_LOCAL',defesa:{...after.defesa,reservationRequestRecipient:undefined,reservationChangeRequest:undefined,reservationRevision:(d.reservationRevision||0)+1,reservationHistory:[...(d.reservationHistory||[]),historical],localStatus:'PENDENTE',invitationDriveFileId:undefined,invitationSentAt:undefined,invitationRecipients:undefined,departmentResponse:undefined,locationProof:undefined,localEvidenceUrl:undefined,localConfirmedAt:undefined,localConfirmedBy:undefined}};
}
/** Re-send only the reservation request; do not repeat initial forms or welcome emails. */
export function rescheduledReservationStudio(studio:IntegrationStudioSettings):IntegrationStudioSettings{
 return {...studio,workflowStages:studio.workflowStages.filter(stage=>String(stage.eventCode||stage.triggerEvent||'').toUpperCase()==='TCC_CREATED').map(stage=>({...stage,triggerEvent:RESERVATION_RESCHEDULED,eventCode:RESERVATION_RESCHEDULED,actions:(Array.isArray(stage.actions)?stage.actions:[]).filter(action=>String(action.refId||action.referenceId||'')==='email-reserva')}))};
}
