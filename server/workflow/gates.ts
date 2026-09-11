import type { ProcessData, SignatureJob } from '../../src/types';
export function latestSignature(process: ProcessData, jobs: SignatureJob[], type: string) {
  return jobs.filter(j => j.processId === process.id && j.documentType === type && j.status !== 'CANCELED').sort((a,b) => b.documentVersion - a.documentVersion)[0];
}
export function ataArchived(process: ProcessData, jobs: SignatureJob[]): boolean {
  const job = latestSignature(process, jobs, 'ATA');
  return job?.status === 'ARCHIVED' && Boolean(job.driveSignedFileId);
}
export function declarationReady(process: ProcessData, jobs: SignatureJob[]): boolean {
  if (!process.acervo?.submittedAt || !ataArchived(process, jobs)) return false;
  if (!(process.acervo.publishFullWork || process.acervo.publishExpandedAbstract)) return true;
  const term = latestSignature(process, jobs, 'TERMO');
  return term?.sourceDataRevision === process.dataRevision && term.status === 'ARCHIVED' && Boolean(term.driveSignedFileId);
}
