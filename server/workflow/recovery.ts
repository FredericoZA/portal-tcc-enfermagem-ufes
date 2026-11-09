import {operationalEmailRetryBlocker} from './emailRetryEligibility';
import type { ProcessData, SignatureJob } from '../../src/types';
import type { WorkflowRun, EmailDeliveryRecord } from '../../src/types/automation';
export interface RecoveryItem { id:string;kind:string;processId:string;protocol:string;title:string;state:string;reason:string;retryPath?:string;actionLabel?:string;completedActions:string[] }
export function buildRecoveryQueue(input:{processes:ProcessData[];runs:WorkflowRun[];jobs:SignatureJob[];emails:EmailDeliveryRecord[];forms:any[];customForms:any[]}) {
  const items:RecoveryItem[]=[];
  const add=(row:Omit<RecoveryItem,'protocol'|'completedActions'>&{completedActions?:string[]})=>{const p=input.processes.find(p=>p.id===row.processId);if(p&&(p.status!=='CONCLUIDO'||row.kind==='POST_SIGNATURE'))items.push({...row,protocol:p.protocolo,completedActions:row.completedActions||[]});};
  const latest=new Map<string,WorkflowRun>();for(const run of [...input.runs].sort((a,b)=>a.startedAt.localeCompare(b.startedAt)))latest.set(`${run.processId}:${run.eventCode}`,run);
  for(const run of latest.values())if(run.status!=='COMPLETED'&&!input.processes.some(process=>process.id===run.processId&&run.sourceDataRevision!==undefined&&run.sourceDataRevision!==process.dataRevision))add({id:run.id,kind:'WORKFLOW',processId:run.processId,title:run.eventCode,state:run.status,reason:run.actions.find(a=>a.status==='FAILED')?.error||'Revise a configuração da etapa.',retryPath:`/api/admin/workflow/runs/${encodeURIComponent(run.id)}/retry`,actionLabel:'Retomar etapa',completedActions:run.actions.filter(a=>a.status==='COMPLETED').map(a=>a.actionId)});
  for(const job of input.jobs){
    if(job.status==='ARCHIVED'&&job.postArchivePending)add({id:job.id,kind:'POST_SIGNATURE',processId:job.processId,title:job.documentTitle||job.documentType,state:'PENDING',reason:job.lastError||'PDF arquivado. As ações posteriores aguardam retomada.',retryPath:`/api/signatures/jobs/${encodeURIComponent(job.id)}/reconcile`,actionLabel:'Retomar ações posteriores',completedActions:['PDF assinado no Drive']});
    if(input.jobs.some(other=>other.processId===job.processId&&other.documentType===job.documentType&&other.provider===job.provider&&other.status!=='CANCELED'&&other.documentVersion>job.documentVersion))continue;
    if(!['PROVIDER_ERROR','WAITING_INTEGRATION','DRIVE_SYNC_PENDING','SIGNED','SENDING'].includes(job.status)
      &&!(job.documentType==='ATA'&&job.provider==='ASTEN'&&job.status==='QUEUED'))continue;
    const ambiguous=['UNCERTAIN','CREATING'].includes(job.providerCreationState||'');
    const reconcile=Boolean(job.providerEnvelopeId)&&(ambiguous||['SIGNED','DRIVE_SYNC_PENDING','SENDING'].includes(job.status));
    add({id:job.id,kind:'SIGNATURE',processId:job.processId,title:job.documentTitle||job.documentType,state:job.status,reason:job.lastError||(ambiguous?'Resultado Asten ambíguo: confira o envelope antes de reenviar.':'Documento aguarda integração.'),retryPath:ambiguous&&!job.providerEnvelopeId?undefined:`/api/signatures/jobs/${encodeURIComponent(job.id)}/${reconcile?'reconcile':'retry'}`,actionLabel:reconcile?'Consultar Asten e arquivar':job.documentType==='ATA'&&job.provider==='ASTEN'?'Retomar assinatura da ata pela ASTEN':'Retomar envio',completedActions:[job.providerEnvelopeId?'Envelope criado':'',job.driveUnsignedFileId?'PDF gerado no Drive':'',job.driveSignedFileId?'PDF assinado no Drive':''].filter(Boolean)});
  }
  for(const mail of input.emails)if(mail.status!=='ACCEPTED_BY_GMAIL'&&!input.processes.some(process=>process.id===mail.processId&&['STALE_EMAIL_PROCESS_REVISION','STALE_RESERVATION_REQUEST','RESERVATION_REQUEST_CLOSED','RESERVATION_DECISION_CHANGED'].includes(operationalEmailRetryBlocker(mail,process,input.jobs)?.code||'')))add({id:mail.id,kind:'EMAIL',processId:mail.processId||'',title:mail.subject,state:mail.status,reason:mail.attempts.at(-1)?.errorMessage||'Entrega aguardando tentativa.',retryPath:mail.dispatchState?undefined:`/api/admin/email-deliveries/${encodeURIComponent(mail.id)}/retry`,actionLabel:mail.templateId==='email-convite'?'Retomar envio do convite à banca':'Retomar e-mail'});
  for(const form of input.forms)if(form.status!=='ARCHIVED'){
    const process=input.processes.find(item=>item.id===form.processId);
    const reservation=form.formType==='CONFIRMACAO_LOCAL';
    const current=process&&form.version===process.dataRevision&&(form.reservationRevision||0)===(process.defesa.reservationRevision||0);
    const title=reservation?`Confirmação de local — agendamento ${current?'atual':'anterior'}`:`Formulário ${form.formType}`;
    const reason=form.lastError||'Arquivo ainda não confirmado no Drive.';
    const context=reservation?` Reserva ${form.reservationRevision||0}; versão dos dados ${form.version}.`:'';
    add({id:form.id,kind:'FORM_ARCHIVE',processId:form.processId,title,state:form.status,reason:reason+context,retryPath:`/api/admin/form-archives/${encodeURIComponent(form.id)}/retry`,actionLabel:'Arquivar e continuar'});
  }
  for(const form of input.customForms)if(form.archiveStatus!=='ARCHIVED')add({id:form.id,kind:'CUSTOM_FORM',processId:form.processId,title:`Formulário ${form.formId}`,state:form.archiveStatus,reason:form.archiveError||'Arquivo ainda não confirmado no Drive.',retryPath:`/api/admin/studio-form-submissions/${encodeURIComponent(form.id)}/retry`,actionLabel:'Arquivar e continuar'});
  return items;
}
