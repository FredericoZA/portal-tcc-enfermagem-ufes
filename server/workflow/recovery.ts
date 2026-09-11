import type { ProcessData, SignatureJob } from '../../src/types';
import type { WorkflowRun, EmailDeliveryRecord } from '../../src/types/automation';
export interface RecoveryItem { id:string;kind:string;processId:string;protocol:string;title:string;state:string;reason:string;retryPath?:string;actionLabel?:string;completedActions:string[] }
export function buildRecoveryQueue(input:{processes:ProcessData[];runs:WorkflowRun[];jobs:SignatureJob[];emails:EmailDeliveryRecord[];forms:any[];customForms:any[]}) {
  const items:RecoveryItem[]=[];
  const add=(row:Omit<RecoveryItem,'protocol'|'completedActions'>&{completedActions?:string[]})=>{const p=input.processes.find(p=>p.id===row.processId);if(p&&p.status!=='CONCLUIDO')items.push({...row,protocol:p.protocolo,completedActions:row.completedActions||[]});};
  const latest=new Map<string,WorkflowRun>();for(const run of [...input.runs].sort((a,b)=>a.startedAt.localeCompare(b.startedAt)))latest.set(`${run.processId}:${run.eventCode}`,run);
  for(const run of latest.values())if(run.status!=='COMPLETED')add({id:run.id,kind:'WORKFLOW',processId:run.processId,title:run.eventCode,state:run.status,reason:run.actions.find(a=>a.status==='FAILED')?.error||'Revise a configuração da etapa.',retryPath:`/api/admin/workflow/runs/${encodeURIComponent(run.id)}/retry`,actionLabel:'Retomar etapa',completedActions:run.actions.filter(a=>a.status==='COMPLETED').map(a=>a.actionId)});
  for(const job of input.jobs){
    if(input.jobs.some(other=>other.processId===job.processId&&other.documentType===job.documentType&&other.status!=='CANCELED'&&other.documentVersion>job.documentVersion))continue;
    if(!['PROVIDER_ERROR','WAITING_INTEGRATION','DRIVE_SYNC_PENDING','SIGNED','SENDING'].includes(job.status))continue;
    const ambiguous=['UNCERTAIN','CREATING'].includes(job.providerCreationState||'');
    const reconcile=Boolean(job.providerEnvelopeId)&&(ambiguous||['SIGNED','DRIVE_SYNC_PENDING','SENDING'].includes(job.status));
    add({id:job.id,kind:'SIGNATURE',processId:job.processId,title:job.documentTitle||job.documentType,state:job.status,reason:job.lastError||(ambiguous?'Resultado Asten ambíguo: confira o envelope antes de reenviar.':'Documento aguarda integração.'),retryPath:ambiguous&&!job.providerEnvelopeId?undefined:`/api/signatures/jobs/${encodeURIComponent(job.id)}/${reconcile?'reconcile':'retry'}`,actionLabel:reconcile?'Consultar Asten e arquivar':'Retomar envio',completedActions:[job.providerEnvelopeId?'Envelope criado':'',job.driveUnsignedFileId?'PDF gerado no Drive':'',job.driveSignedFileId?'PDF assinado no Drive':''].filter(Boolean)});
  }
  for(const mail of input.emails)if(mail.status!=='ACCEPTED_BY_GMAIL')add({id:mail.id,kind:'EMAIL',processId:mail.processId||'',title:mail.subject,state:mail.status,reason:mail.attempts.at(-1)?.errorMessage||'Entrega aguardando tentativa.',retryPath:`/api/admin/email-deliveries/${encodeURIComponent(mail.id)}/retry`,actionLabel:'Retomar e-mail'});
  for(const form of input.forms)if(form.status!=='ARCHIVED')add({id:form.id,kind:'FORM_ARCHIVE',processId:form.processId,title:`Formulário ${form.formType}`,state:form.status,reason:form.lastError||'Arquivo ainda não confirmado no Drive.',retryPath:`/api/admin/form-archives/${encodeURIComponent(form.id)}/retry`,actionLabel:'Arquivar e continuar'});
  for(const form of input.customForms)if(form.archiveStatus!=='ARCHIVED')add({id:form.id,kind:'CUSTOM_FORM',processId:form.processId,title:`Formulário ${form.formId}`,state:form.archiveStatus,reason:form.archiveError||'Arquivo ainda não confirmado no Drive.',retryPath:`/api/admin/studio-form-submissions/${encodeURIComponent(form.id)}/retry`,actionLabel:'Arquivar e continuar'});
  return items;
}
