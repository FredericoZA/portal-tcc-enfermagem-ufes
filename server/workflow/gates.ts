import {assertSignaturePolicySnapshot} from './signaturePolicySnapshot';
import {currentAtaArchived} from '../../src/utils/documentSignatureState';
import type { ProcessData, SignatureJob } from '../../src/types';
function validPolicy(job:SignatureJob):boolean{if(!job.signerPolicySnapshot)return true;if(!['ATA','TERMO','DECLARACAO'].includes(job.documentType))return false;try{assertSignaturePolicySnapshot(job.documentType as 'ATA'|'TERMO'|'DECLARACAO',job);return true;}catch{return false;}}
export function latestSignature(process: ProcessData, jobs: SignatureJob[], type: string) {
  const ataRevision=type==='ATA'?process.avaliacao?.documentRevision:undefined;
  const ordered=jobs.filter(validPolicy).filter(j => j.processId === process.id && j.documentType === type && j.status !== 'CANCELED' && (ataRevision===undefined||j.sourceDataRevision===ataRevision)).sort((a,b) => b.documentVersion - a.documentVersion);
  const latest=ordered[0];
  // A second provider for the same data does not invalidate an archived signature.
  return ordered.find(job=>job.sourceDataRevision===latest?.sourceDataRevision&&job.status==='ARCHIVED'&&job.driveSignedFileId)||latest;
}
export function ataArchived(process: ProcessData, jobs: SignatureJob[]): boolean {
  return currentAtaArchived(process, jobs.filter(validPolicy));
}
export function declarationReady(process: ProcessData, jobs: SignatureJob[]): boolean {
  if (!process.acervo?.submittedAt || !ataArchived(process, jobs)) return false;
  if (!(process.acervo.publishFullWork || process.acervo.publishExpandedAbstract)) return true;
  const term = latestSignature(process, jobs, 'TERMO');
  return term?.sourceDataRevision === process.dataRevision && term.status === 'ARCHIVED' && Boolean(term.driveSignedFileId);
}
