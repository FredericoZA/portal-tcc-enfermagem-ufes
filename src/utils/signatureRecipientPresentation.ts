import type {SignatureJob,SignatureSignerRole} from '../types/signatures';
const labels:Record<SignatureSignerRole,string>={ADVISOR:'Orientador',EXAMINER:'Examinadores',STUDENT:'Autores',CO_ADVISOR:'Coorientador',PRESIDENT:'Presidência'};
export function signatureSignerNote(job:SignatureJob|undefined,fallback:string):string{
 const snapshot=job?.signerPolicySnapshot;
 if(!snapshot||snapshot.version!==1||!Array.isArray(snapshot.signers)||!snapshot.signers.length)return fallback;
 return [...new Set(snapshot.signers.map(signer=>labels[signer.role]||signer.role))].join(', ');
}
export function currentDocumentSignatureJob(processId:string,type:string,revision:number,version:number|undefined,jobs:readonly SignatureJob[]):SignatureJob|undefined{
 return jobs.filter(job=>job.processId===processId&&job.documentType===type&&job.sourceDataRevision===revision&&!job.removedFromLogsAt&&job.status!=='CANCELED'&&(version===undefined||job.documentVersion===version)).slice().sort((a,b)=>b.documentVersion-a.documentVersion)[0];
}
export function frozenGovbrDownloadJob(processId:string,type:string,revision:number,version:number|undefined,jobs:readonly SignatureJob[],email:string):SignatureJob|undefined{
 const normalized=email.trim().toLowerCase();if(!normalized)return;
 return jobs.filter(job=>job.processId===processId&&job.documentType===type&&job.sourceDataRevision===revision&&job.provider==='GOV_BR'&&job.status==='READY_FOR_REVIEW'&&!job.removedFromLogsAt&&Boolean(job.driveUnsignedFileId)&&(version===undefined||job.documentVersion===version)&&job.signerPolicySnapshot?.version===1&&job.signerPolicySnapshot.documentType===type&&job.signerPolicySnapshot.signers.some(signer=>signer.email.trim().toLowerCase()===normalized)&&job.signers.some(signer=>signer.email.trim().toLowerCase()===normalized)).slice().sort((a,b)=>b.documentVersion-a.documentVersion)[0];
}
