import type { ProcessData, SignatureJob } from '../../src/types';
import type { PublicationChoice, PublicationChoiceView } from '../../src/types/publicationChoice';
import { signatureDocumentRevision } from '../../src/utils/documentSignatureState';

export function publicationChoiceView(process: ProcessData, viewerEmail?: string): PublicationChoiceView {
  const a = process.acervo,
    request = a?.publicationChange;
  return {
    revision: process.dataRevision,
    availableFullWork: Boolean(a?.trabalhoCompletoFileId),
    availableExpandedAbstract: Boolean(a?.resumoExpandidoFileId),
    publishFullWork: request?.publishFullWork ?? a?.publishFullWork ?? false,
    publishExpandedAbstract: request?.publishExpandedAbstract ?? a?.publishExpandedAbstract ?? false,
    ...(request
      ? {
          request: {
            id: request.id,
            status: request.status,
            requestedAt: request.requestedAt,
            completedAt: request.completedAt,
            lastError: request.lastError,
            canRetry: request.requestedBy === viewerEmail && request.status !== 'COMPLETED',
          },
        }
      : {}),
  };
}
export function authorMayChangePublication(
  p: ProcessData,
  email: string,
  hasAccess: boolean,
  master = false,
): boolean {
  const same = (other?: string) =>
    Boolean(other && other.trim().toLowerCase() === email.trim().toLowerCase());
  return (
    hasAccess &&
    p.status === 'CONCLUIDO' &&
    Boolean(p.acervo?.submittedAt) &&
    (master || (!p.legacyRecord && (same(p.aluno1.email) || same(p.aluno2?.email))))
  );
}
export function beginPublicationChoice(
  p: ProcessData,
  choice: PublicationChoice,
  jobs: SignatureJob[],
  actor: string,
  id: string,
  now: string,
  editing = false,
): ProcessData {
  if (!p.acervo?.submittedAt || p.status !== 'CONCLUIDO')
    throw Error('A alteração da publicação é disponibilizada após a conclusão do processo.');
  if (typeof choice.publishFullWork !== 'boolean' || typeof choice.publishExpandedAbstract !== 'boolean')
    throw Error('Informe a escolha de publicação de cada arquivo.');
  if (
    (choice.publishFullWork && !p.acervo.trabalhoCompletoFileId) ||
    (choice.publishExpandedAbstract && !p.acervo.resumoExpandidoFileId)
  )
    throw Error('O arquivo solicitado não está arquivado no processo.');
  const previous = p.acervo.publicationChange;
  const pending = previous && previous.status !== 'COMPLETED' ? previous : undefined;
  // Any author may narrow an outstanding choice, including another author's
  // request. A pending signature must never prevent withdrawal of consent.
  if (
    pending &&
    pending.status !== 'EDITING' &&
    !editing &&
    ((choice.publishFullWork && !pending.publishFullWork) ||
      (choice.publishExpandedAbstract && !pending.publishExpandedAbstract))
  )
    throw Error(
      'Aguarde a solicitação em andamento para ampliar a publicação. Você pode restringi-la agora.',
    );
  if (
    !editing &&
    pending?.status !== 'EDITING' &&
    Boolean(pending?.publishFullWork ?? p.acervo.publishFullWork) === choice.publishFullWork &&
    Boolean(pending?.publishExpandedAbstract ?? p.acervo.publishExpandedAbstract) ===
      choice.publishExpandedAbstract
  )
    throw Error('A escolha informada já corresponde à publicação atual.');
  const terms = jobs.filter((j) => j.processId === p.id && j.documentType === 'TERMO');
  const previousTermFileIds = [...new Set([
    ...terms.flatMap((j) => [j.driveSignedFileId, j.driveUnsignedFileId]),
    ...(p.acervo.publicationAuthorizationFileIds || []),
    ...(!pending?.previousTermsDestroyedAt ? pending?.previousTermFileIds || [] : []),
  ].filter((v): v is string => Boolean(v)))];
  if (previousTermFileIds.some(id => [p.acervo.trabalhoCompletoFileId, p.acervo.resumoExpandidoFileId].includes(id)))
    throw Error('O termo está vinculado a um PDF acadêmico. Confira o arquivo antes de continuar.');
  const revokeFileIds = [
    ...(pending?.revokeFileIds || []),
    p.acervo.trabalhoCompletoFileId,
    p.acervo.resumoExpandidoFileId,
    p.acervo.publicFullWorkFileId,
    p.acervo.publicExpandedAbstractFileId,
    ...terms.flatMap((j) => [j.driveSignedFileId, j.driveUnsignedFileId]),
    ...(p.acervo.publicationAuthorizationFileIds || []),
  ].filter((v): v is string => Boolean(v));
  return {
    ...p,
    dataRevision: p.dataRevision + 1,
    updatedAt: now,
    acervo: {
      ...p.acervo,
      declarationDataRevision: p.acervo.declarationDataRevision ?? signatureDocumentRevision(p, 'DECLARACAO'),
      publishFullWork: false,
      publishExpandedAbstract: false,
      isPublic: false,
      authorizationConfirmedAt: undefined,
      publicationState: 'WITHDRAWN',
      publicationWithdrawnAt: now,
      publicationWithdrawnBy: actor,
      publicationWithdrawalReason: 'Alteração solicitada pelo autor autenticado.',
      publicationSyncedAt: undefined,
      publicFullWorkFileId: undefined,
      publicFullWorkFileUrl: undefined,
      publicExpandedAbstractFileId: undefined,
      publicExpandedAbstractFileUrl: undefined,
      publicationChange: {
        id,
        ...choice,
        requestedBy: actor,
        requestedAt: now,
        revision: p.dataRevision + 1,
        status: 'REVOKING_DRIVE',
        previousTermJobIds: terms.map((j) => j.id),
        previousTermFileIds,
        revokeFileIds: [...new Set(revokeFileIds)],
      },
    },
  };
}
export function assertRenewedPublicationSigners(p: ProcessData, job: Pick<SignatureJob, 'signers'>): void {
  const required = [p.aluno1.email, p.aluno2?.email, p.orientador.email]
    .filter((v): v is string => Boolean(v))
    .map((v) => v.trim().toLowerCase());
  if (required.some((email) => !job.signers.some((s) => s.email.trim().toLowerCase() === email)))
    throw Error('O novo termo exige a assinatura de todos os autores e do orientador.');
}
export function finishPublicationRevocation(p: ProcessData, now: string): void {
  const a = p.acervo,
    request = a?.publicationChange;
  if (!a || !request || request.revision !== p.dataRevision || request.status !== 'REVOKING_DRIVE')
    throw Error('Solicitação de publicação desatualizada.');
  const publish = request.publishFullWork || request.publishExpandedAbstract;
  a.publishFullWork = request.publishFullWork;
  a.publishExpandedAbstract = request.publishExpandedAbstract;
  a.authorizationConfirmedAt = publish ? request.requestedAt : undefined;
  a.publicationRequestedAt = publish ? request.requestedAt : undefined;
  a.publicationWithdrawnAt = publish ? undefined : request.requestedAt;
  a.publicationState = publish ? 'PENDING_SYNC' : 'WITHDRAWN';
  request.status = publish ? 'AWAITING_SIGNATURE' : 'COMPLETED';
  request.lastError = undefined;
  if (!publish) request.completedAt = now;
}
