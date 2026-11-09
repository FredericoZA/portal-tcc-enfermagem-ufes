import type {ProcessData,SignatureJob} from '../types';
import {signatureDocumentRevision} from './documentSignatureState';

/** Observe the existing durable request, including the period before a job exists. */
export function hasPendingAutomaticSignature(process:ProcessData,jobs:readonly SignatureJob[]):boolean{
 const intent=process.astenSignatureIntent;
 if(!intent||process.status==='CONCLUIDO'
   ||process.signatureProviderPreferences?.[intent.documentType]==='GOV_BR'
   ||intent.revision!==signatureDocumentRevision(process,intent.documentType))return false;
 return !jobs.some(job=>job.processId===process.id&&job.documentType===intent.documentType
   &&job.sourceDataRevision===intent.revision&&!job.removedFromLogsAt);
}
