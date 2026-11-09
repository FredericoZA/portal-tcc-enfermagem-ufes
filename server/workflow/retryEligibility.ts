import type { ProcessData, SignatureJob } from '../../src/types';
import { effectiveDefenseReservationStatus } from '../../src/utils/defenseReservationState';
import { isConceptRegistrationReleased } from '../../src/utils/evaluationForm';
import { signatureJobMatchesCurrentRevision, publicationRequested, repositoryDataComplete } from './signaturePolicy';
import { ataArchived, declarationReady } from './gates';
import { normalizeWorkflowEventCode } from './runtime';

export function nativeFormRetryEvent(formType:string):string|undefined{
  const events:Record<string,string>={CADASTRO_INICIAL:'TCC_CREATED',CONFIRMACAO_LOCAL:'LOCATION_CONFIRMED',
    AVALIACAO:'EVALUATION_SUBMITTED',DADOS_FINAIS:'REPOSITORY_SUBMITTED'};
  return Object.hasOwn(events,formType)?events[formType]:undefined;
}

/** Retrying a stored operation never stands in for the current academic event. */
export function workflowRetryBlocker(
  process:ProcessData,event:string,jobs:SignatureJob[],sourceDataRevision?:number,
):string|undefined{
  event=normalizeWorkflowEventCode(event);
  if(sourceDataRevision!==undefined&&sourceDataRevision!==process.dataRevision)return 'Os dados do TCC mudaram desde esta execução. Consulte a etapa atual do processo.';
  if(process.status==='CONCLUIDO')return 'O processo foi concluído e não admite retomada de etapas anteriores.';
  const reservationStatus=effectiveDefenseReservationStatus(process);
  if(['TCC_CREATED','RESERVATION_RESCHEDULED'].includes(event)&&(
    reservationStatus!=='PENDENTE'||process.defesa.departmentResponse||process.defesa.invitationSentAt
  ))return 'O pedido de reserva já foi respondido ou a banca já foi convidada.';
  if(event==='LOCATION_CONFIRMED'&&(reservationStatus!=='CONFIRMADO'||process.defesa.invitationSentAt))return 'A retomada do convite exige a confirmação do local atual e um envio ainda pendente.';
  if(event==='INVITATION_SENT'&&(reservationStatus!=='CONFIRMADO'||!process.defesa.invitationSentAt))return 'O convite da reserva atual ainda não teve o envio confirmado.';
  if(event==='EVALUATION_SUBMITTED'&&(
    process.avaliacao.status!=='CONCLUIDO'||!process.avaliacao.submittedAt||!isConceptRegistrationReleased(process)
  ))return 'O conceito e a ata precisam estar registrados no fluxo normal da defesa.';
  if(event==='REPOSITORY_SUBMITTED'&&(
    !process.acervo?.submittedAt||!repositoryDataComplete(process)||!ataArchived(process,jobs)
  ))return 'A retomada exige a entrega final registrada e a ata atual assinada e arquivada.';
  if(event==='PUBLICATION_CLEARED'&&(
    !declarationReady(process,jobs)||(publicationRequested(process)&&process.acervo?.publicationState!=='PUBLIC')
  ))return 'A declaração aguarda a entrega final, a ata, o termo aplicável e a publicação autorizada.';
  if(['SIGNATURE_REQUESTED','SIGNATURE_COMPLETED'].includes(event)){
    const current=jobs.filter(job=>job.processId===process.id&&signatureJobMatchesCurrentRevision(process,job));
    const confirmed=event==='SIGNATURE_COMPLETED'
      ? current.some(job=>job.status==='ARCHIVED'&&job.driveSignedFileId)
      : current.some(job=>['SENT','PARTIALLY_SIGNED','SIGNED','ARCHIVED','DRIVE_SYNC_PENDING'].includes(job.status));
    if(!confirmed)return 'A retomada exige a evidência de assinatura da versão atual do documento.';
  }
}
