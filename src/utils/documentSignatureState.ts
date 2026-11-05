import type {ProcessData} from '../types';
import type {SignatureJob} from '../types/signatures';

export function signatureDocumentRevision(process: {dataRevision:number; avaliacao?: Pick<ProcessData['avaliacao'],'documentRevision'>}, type: string): number {
 return type === 'ATA' ? process.avaliacao?.documentRevision ?? process.dataRevision : process.dataRevision;
}

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

export function currentAtaArchived(process: Pick<ProcessData, 'id' | 'avaliacao'>, jobs: SignatureJob[]): boolean {
 const revision = process.avaliacao?.documentRevision;
 if (revision === undefined) return documentSignatureArchived(jobs, process.id, 'ATA');
 return process.avaliacao.status === 'CONCLUIDO' && jobs.some(job =>
   job.processId === process.id && job.documentType === 'ATA' && job.sourceDataRevision === revision
   && job.status === 'ARCHIVED' && Boolean(job.driveSignedFileId)
   && job.signers?.length === 3 && job.signers.every(signer => signer.status === 'SIGNED')
   && job.signers.filter(signer => signer.role === 'ADVISOR').length === 1
   && job.signers.filter(signer => signer.role === 'EXAMINER').length === 2
   && new Set(job.signers.map(signer => signer.email)).size === 3
 );
}

/** Repair the displayed legacy stage without treating PDF preparation as signing. */
export function processWithPendingAtaStage(process:ProcessData,jobs:SignatureJob[]):ProcessData{
 if(process.etapaAtual==='REPOSITORIO'&&process.avaliacao?.status==='CONCLUIDO'&&!process.acervo?.submittedAt&&!currentAtaArchived(process,jobs))return {...process,etapaAtual:'ASSINATURA',status:'AGUARDANDO_ASSINATURA'};
 return process;
}
