import type {ProcessData,SignatureJob} from '../../src/types';
import {workflowRetryBlocker} from './retryEligibility';

export const AUTOMATIC_REPOSITORY_SIGNATURE_RETRY_MS=2*60_000;
export function repositorySignatureEvent(type:string):'REPOSITORY_SUBMITTED'|'PUBLICATION_CLEARED'{
 return type==='TERMO'?'REPOSITORY_SUBMITTED':'PUBLICATION_CLEARED';
}

/** Eligibility only: refresh, recheck access and durably claim attemptedAt with
 * the normal runtime CAS before invoking any workflow or provider. */
export function canRecoverRepositorySignature(process:ProcessData,jobs:SignatureJob[],enabled:boolean,now=Date.now()):boolean{
 const intent=process.astenSignatureIntent;
 if(!enabled||process.legacyRecord||!intent||!['TERMO','DECLARACAO'].includes(intent.documentType)
   ||intent.revision!==process.dataRevision||process.signatureProviderPreferences?.[intent.documentType]==='GOV_BR')return false;
 // Also leave the original deferred invocation its normal preparation window.
 const at=Date.parse(intent.attemptedAt||intent.queuedAt);
 if(!Number.isFinite(at)||now-at<AUTOMATIC_REPOSITORY_SIGNATURE_RETRY_MS)return false;
 const current=jobs.filter(job=>job.processId===process.id&&job.documentType===intent.documentType&&job.sourceDataRevision===intent.revision);
 if(current.some(job=>job.provider!=='ASTEN'||job.removedFromLogsAt||job.providerCreationState==='UNCERTAIN'
   ||['SENDING','UNCERTAIN'].includes(job.providerDispatchState||'')
   ||['SENDING','SENT','PARTIALLY_SIGNED','SIGNED','ARCHIVED','DRIVE_SYNC_PENDING','CANCELED','DECLINED','EXPIRED'].includes(job.status)))return false;
 return !workflowRetryBlocker(process,repositorySignatureEvent(intent.documentType),jobs,intent.revision);
}

export function safeRepositorySignatureError(error:unknown,workflow=false):{lastError:string;lastErrorCode:string}{
 const code=typeof(error as {code?:unknown})?.code==='string'?(error as {code:string}).code:'';
 const messages:Record<string,string>={DOCUMENT_MODEL_REQUIRED:'O modelo do documento precisa ser cadastrado em Configurações.',DOCUMENT_MODEL_UNPUBLISHED:'O modelo do documento precisa ser revisado e publicado em Configurações.',DOCUMENT_MODEL_CONTENT_CHANGED:'O modelo mudou desde a publicação. O Master precisa revisar e publicar o modelo em Configurações.'};
 if(messages[code])return {lastError:messages[code],lastErrorCode:code};
 return workflow?{lastError:'A entrega está salva. Uma ação do fluxo publicado está pendente; confira o andamento antes da assinatura.',lastErrorCode:'WORKFLOW_PENDING'}
  :{lastError:'A entrega está salva. A preparação ou o envio pelo ASTEN permanece pendente; o Portal tentará retomar com segurança.',lastErrorCode:'ASTEN_DELIVERY_PENDING'};
}
