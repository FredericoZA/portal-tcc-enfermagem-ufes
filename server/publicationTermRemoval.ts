import type { ProcessData, SignatureJob } from '../src/types';

/** Remove only authorization PDFs pinned by the server-side consent request.
 * Keep job metadata for auditing and rejecting callbacks from obsolete envelopes. */
export async function destroyPreviousPublicationTerms(
  p: ProcessData,
  jobs: SignatureJob[],
  remove: (ids: string[]) => Promise<void>,
): Promise<void> {
  const request = p.acervo?.publicationChange;
  if (!request || request.status !== 'REVOKING_DRIVE')
    throw Error('A exclusão do termo exige uma alteração confirmada de publicação.');
  const terms = jobs.filter(j => j.processId === p.id && j.documentType === 'TERMO'
    && request.previousTermJobIds.includes(j.id));
  const allowed = new Set([
    ...terms.flatMap(j => [j.driveSignedFileId, j.driveUnsignedFileId]),
    ...(p.acervo.publicationAuthorizationFileIds || []),
  ].filter((id): id is string => Boolean(id)));
  const ids = [...new Set(request.previousTermFileIds || [...allowed])];
  const protectedIds = new Set([
    p.acervo.trabalhoCompletoFileId, p.acervo.resumoExpandidoFileId,
    ...jobs.filter(j => j.processId !== p.id || j.documentType !== 'TERMO')
      .flatMap(j => [j.driveSignedFileId, j.driveUnsignedFileId]),
  ].filter(Boolean));
  if (ids.some(id => !allowed.has(id) || protectedIds.has(id)))
    throw Error('Há referências conflitantes no termo anterior. Nenhum arquivo foi excluído.');
  await remove(ids);
  for (const job of terms) {
    job.status = 'CANCELED';
    job.driveSignedFileId = undefined;
    job.driveUnsignedFileId = undefined;
    job.driveSignedWebViewLink = undefined;
    job.artifactBase64 = undefined;
    job.updatedAt = new Date().toISOString();
    job.lastError = 'Termo excluído após alteração da autorização de publicação.';
  }
  p.acervo.publicationAuthorizationFileIds = [];
  request.previousTermsDestroyedAt = new Date().toISOString();
}
