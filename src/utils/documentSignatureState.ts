import type {ProcessData} from '../types';
import type {SignatureJob} from '../types/signatures';
/** A pending provider remains independent; a completed signature closes the document. */
export function documentSignatureCompleted(jobs:SignatureJob[],processId:string,documentType:string,dataRevision?:number):boolean{
 const matching=jobs.filter(job=>job.processId===processId&&job.documentType===documentType&&job.status!=='CANCELED');
 const revision=dataRevision??Math.max(-1,...matching.map(job=>job.sourceDataRevision));
 return matching.some(job=>job.sourceDataRevision===revision&&['SIGNED','DRIVE_SYNC_PENDING','ARCHIVED'].includes(job.status));
}

/** A second pending provider must not hide an already archived document of the same revision. */
export function documentSignatureArchived(jobs:SignatureJob[],processId:string,documentType:string):boolean{
 const matching=jobs.filter(job=>job.processId===processId&&job.documentType===documentType&&job.status!=='CANCELED').sort((a,b)=>b.documentVersion-a.documentVersion);
 const revision=matching[0]?.sourceDataRevision;
 return matching.some(job=>job.sourceDataRevision===revision&&job.status==='ARCHIVED'&&Boolean(job.driveSignedFileId));
}

/** Repair the displayed legacy stage without treating PDF preparation as signing. */
export function processWithPendingAtaStage(process:ProcessData,jobs:SignatureJob[]):ProcessData{
 if(process.etapaAtual==='REPOSITORIO'&&process.avaliacao?.status==='CONCLUIDO'&&!process.acervo?.submittedAt&&!documentSignatureArchived(jobs,process.id,'ATA'))return {...process,etapaAtual:'ASSINATURA',status:'AGUARDANDO_ASSINATURA'};
 return process;
}
