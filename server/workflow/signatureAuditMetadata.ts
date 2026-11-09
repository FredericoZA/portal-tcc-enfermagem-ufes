import type {AuditLog, ProcessData} from '../../src/types';
import type {SignatureJob} from '../../src/types/signatures';

export type SignatureAuditStage = 'DOCUMENT_PREPARED' | 'PROVIDER_SIGNERS_VERIFIED' | 'SIGNED_DOCUMENT_ARCHIVED' | 'PROVIDER_CALLBACK_RECONCILED' | 'HISTORICAL_CALLBACK_IGNORED';
const short = (value:string,limit=250) => String(value || '').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,limit);
/** Evidence is captured when observed; historical rows are never rebuilt from a current job. */
export function signatureAuditMetadata(job:SignatureJob,eventStage:SignatureAuditStage,evidenceSource?:'ASTEN_SIGNERS_READBACK'|'GOV_BR_MANUAL_REVIEW') {
  const verified = evidenceSource ? job.signers.filter(signer=>signer.status==='SIGNED') : undefined;
  return {
    documentType:job.documentType,documentTitle:short(job.documentTitle),documentVersion:job.documentVersion,
    sourceDataRevision:job.sourceDataRevision,provider:job.provider,eventStage,signatureJobId:job.id,
    status:job.status,expectedSignerCount:job.signers.length,
    ...(verified ? {verifiedSignerCount:verified.length,verifiedSigners:verified.slice(0,12).map(signer=>({
      role:signer.role,name:short(signer.name),email:short(signer.email),
      ...(signer.signedAt&&Number.isFinite(Date.parse(signer.signedAt))?{signedAt:signer.signedAt}:{}),
    })),evidenceSource} : {}),
  };
}
export function recordSignatureAudit(logs:AuditLog[],process:ProcessData,job:SignatureJob,actorEmail:string,eventStage:SignatureAuditStage,evidenceSource?:'ASTEN_SIGNERS_READBACK'|'GOV_BR_MANUAL_REVIEW',beforeStatus?:SignatureJob['status']):void {
  const id=`signature:${job.id}:${eventStage}`;
  if(logs.some(log=>log.id===id))return;
  const action=eventStage==='DOCUMENT_PREPARED'?'DOCUMENTO_PREPARADO_PARA_ASSINATURA':eventStage==='PROVIDER_SIGNERS_VERIFIED'?'SIGNATARIOS_CONFIRMADOS_PELO_PROVEDOR':'DOCUMENTO_ASSINADO_ARQUIVADO';
  logs.push({id,processId:process.id,processProtocol:process.protocolo,processTitle:process.titulo,actorEmail,actorRoles:[],action,
    entityType:'signature_job',entityId:job.id,...(beforeStatus?{before:{status:beforeStatus}}:{}),
    after:signatureAuditMetadata(job,eventStage,evidenceSource),timestamp:new Date().toISOString()});
}
