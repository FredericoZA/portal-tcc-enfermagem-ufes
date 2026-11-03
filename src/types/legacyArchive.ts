/** Imported historical works never enter the live defense/signature workflow. */
export interface LegacyAcademicRecord {
  id: string;
  protocolo: string;
  sourceFingerprint: string;
  titulo: string;
  autores: string[];
  orientador: string;
  coorientador: string;
  coorientadorInstituicao: string;
  examinadores: { nome: string; instituicao: string }[];
  resumo: string;
  palavrasChave: string[];
  dataDefesa: string;
  horaDefesa: string;
  localDefesa: string;
  isPublic: boolean;
  publishFullWork: boolean;
  publishExpandedAbstract: boolean;
  publicationState: 'NOT_REQUESTED' | 'AUTHORIZED' | 'PUBLIC';
  authorizationDecision: 'AUTHORIZED' | 'DENIED' | 'CONFLICT' | 'UNSPECIFIED';
  attachments: LegacyAttachment[];
  provenance: Record<string, unknown>;
}
export interface LegacyAttachment {
  driveFileId: string;
  fileName: string;
  /** Original private basename retained for local integrity checks and provenance. */
  sourceFileName?: string;
  kind: 'TRABALHO_COMPLETO' | 'RESUMO_EXPANDIDO' | 'DOCUMENTO_ACADEMICO';
  evidence: string;
  sha256: string;
}
export interface LegacyAdministrativeFile {
  driveFileId: string;
  fileName: string;
  sourceFileName?: string;
  kind: 'CONVITE' | 'AVALIACAO' | 'ATA' | 'TERMO' | 'DECLARACAO';
  folderId: string;
  sha256: string;
  visibility: 'PRIVATE_ADMINISTRATIVE_DOCUMENT';
}
export type LegacyAdministrativeFileView = Pick<LegacyAdministrativeFile, 'fileName' | 'kind'> & {
  index: number;
  downloadUrl: string;
};
/** Master-only academic view; publication consent is unchanged by private access. */
export interface PrivateLegacyAcademicView {
  resumo: string;
  palavrasChave: string[];
  files: {
    index: number;
    kind: LegacyAttachment['kind'];
    fileName: string;
    downloadUrl: string;
    isPublic: boolean;
  }[];
}
export type PublicLegacyAcademicRecord = Pick<LegacyAcademicRecord,
  'id' | 'protocolo' | 'titulo' | 'autores' | 'orientador' | 'coorientador' |
  'coorientadorInstituicao' | 'examinadores' | 'resumo' | 'palavrasChave' | 'dataDefesa' |
  'horaDefesa' | 'localDefesa'> & { filesRestricted: boolean; authorizationDecision: LegacyAcademicRecord['authorizationDecision']; publicFiles: { index: number; kind: LegacyAttachment['kind']; downloadUrl: string }[] };
