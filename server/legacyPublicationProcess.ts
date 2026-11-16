import type { ProcessData } from '../src/types';
import type { LegacyAcademicRecord } from '../src/types/legacyArchive';
import { legacyRepositoryProcess } from '../src/utils/legacyRepository';
import { legacyAdministrativeFiles, canonicalLegacyRecord, publicLegacyAcademicView } from './legacyArchive';

/** A consent-only context, kept inside the private historical provenance.
 * It never enters processesStore or fabricates an ATA/signature/completion. */
export function historicalPublicationProcess(record: LegacyAcademicRecord): ProcessData {
  const saved = record.provenance.publicationProcess as ProcessData | undefined;
  if (saved?.id === record.id && saved.legacyRecord === true) return saved;
  const p = legacyRepositoryProcess(publicLegacyAcademicView(record));
  const full = record.attachments.find((f) => f.kind === 'TRABALHO_COMPLETO');
  const abstract = record.attachments.find((f) => f.kind === 'RESUMO_EXPANDIDO');
  // Contacts must be explicitly verified by Master; never infer identity from a name.
  const contacts = record.provenance.verifiedPublicationParticipants as
    | {
        authors?: Array<{ nome: string; email: string }>;
        advisor?: { nome: string; email: string };
        verifiedBy?: string;
      }
    | undefined;
  return {
    ...p,
    legacyRecord: true,
    status: 'CONCLUIDO',
    etapaAtual: 'CONCLUIDO',
    dataRevision: 1,
    aluno1:
      contacts?.verifiedBy && contacts.authors?.[0] ? { ...p.aluno1, ...contacts.authors[0] } : p.aluno1,
    aluno2:
      contacts?.verifiedBy && contacts.authors?.[1]
        ? { matricula: '', ...p.aluno2, ...contacts.authors[1] }
        : p.aluno2,
    orientador: contacts?.verifiedBy && contacts.advisor ? contacts.advisor : p.orientador,
    driveFolderId: String(record.provenance.processFolderId || ''),
    acervo: {
      ...p.acervo,
      publicationAuthorizationFileIds: legacyAdministrativeFiles(record)
        .filter((f) => f.kind === 'TERMO')
        .map((f) => f.driveFileId),
      submittedAt: 'historical-import',
      publishFullWork: record.publishFullWork,
      publishExpandedAbstract: record.publishExpandedAbstract,
      trabalhoCompletoFileId: full?.driveFileId,
      trabalhoCompletoFileName: full?.fileName,
      trabalhoCompletoSha256: full?.sha256,
      resumoExpandidoFileId: abstract?.driveFileId,
      resumoExpandidoFileName: abstract?.fileName,
      resumoExpandidoSha256: abstract?.sha256,
    },
  };
}
export function storeHistoricalPublicationProcess(record: LegacyAcademicRecord, p: ProcessData): void {
  const changed = p.acervo.publicationChange;
  record.provenance.publicationProcess = p;
  record.provenance.publicationOverride = {
    status: changed?.status || 'PENDING',
    publishFullWork: p.acervo.publishFullWork === true,
    publishExpandedAbstract: p.acervo.publishExpandedAbstract === true,
    signedTermJobId: changed?.signatureJobId,
    currentTermFileId: changed?.signedTermFileId,
    syncedAt: p.acervo.publicationSyncedAt,
  };
  Object.assign(record, canonicalLegacyRecord(record));
  for (const [kind, id, name, sha] of [
    [
      'TRABALHO_COMPLETO',
      p.acervo.trabalhoCompletoFileId,
      p.acervo.trabalhoCompletoFileName,
      p.acervo.trabalhoCompletoSha256,
    ],
    [
      'RESUMO_EXPANDIDO',
      p.acervo.resumoExpandidoFileId,
      p.acervo.resumoExpandidoFileName,
      p.acervo.resumoExpandidoSha256,
    ],
  ]) {
    if (!id || !sha) continue;
    const old = record.attachments.find((f) => f.kind === kind);
    if (old?.driveFileId === id) continue;
    if (old) {
      const history = Array.isArray(record.provenance.supersededAttachments)
        ? record.provenance.supersededAttachments
        : [];
      record.provenance.supersededAttachments = [...history, { ...old, supersededAt: p.updatedAt }];
    }
    record.attachments = record.attachments.filter((f) => f.kind !== kind);
    record.attachments.push({
      kind: kind as 'TRABALHO_COMPLETO' | 'RESUMO_EXPANDIDO',
      driveFileId: id,
      fileName: name || 'Documento.pdf',
      sha256: sha,
      evidence: 'New version submitted by Master through the publication workflow.',
    });
  }
}
