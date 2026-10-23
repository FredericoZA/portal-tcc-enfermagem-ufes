import type { ProcessData, SignatureJob } from '../../src/types';
import { declarationReady } from './gates';

export function finalDocumentFilesLocked(process: ProcessData, jobs: SignatureJob[]): boolean {
  return process.status === 'CONCLUIDO' || jobs.some(job =>
    job.processId === process.id && job.documentType !== 'ATA' && job.status !== 'CANCELED');
}

export function publicFileAuthorized(process: ProcessData | undefined, jobs: SignatureJob[], kind: string): boolean {
  if (!process || process.status !== 'CONCLUIDO' || !declarationReady(process, jobs)) return false;
  const acervo = process.acervo;
  if (!acervo?.submittedAt || !acervo.authorizationConfirmedAt || acervo.publicationWithdrawnAt ||
      acervo.publicationState !== 'PUBLIC' || !acervo.publicationSyncedAt) return false;
  if (kind === 'trabalho-completo') {
    return acervo.publishFullWork === true && Boolean(acervo.trabalhoCompletoFileId && acervo.publicFullWorkFileId) &&
      /^[a-f0-9]{64}$/i.test(acervo.trabalhoCompletoSha256 || '');
  }
  if (kind === 'resumo-expandido') {
    return acervo.publishExpandedAbstract === true && Boolean(acervo.resumoExpandidoFileId && acervo.publicExpandedAbstractFileId) &&
      /^[a-f0-9]{64}$/i.test(acervo.resumoExpandidoSha256 || '');
  }
  return false;
}
