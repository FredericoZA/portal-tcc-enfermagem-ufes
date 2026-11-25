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
  provenance: Record<string, unknown> & {legacySpreadsheetEvidence?: LegacySpreadsheetEvidence};
}

/** Private source assertions retained when the old administrative sheets are retired. */
export interface LegacySpreadsheetSource {
  fileId: string;
  sheet: string;
  sheetId: number;
  row: number;
  rowSha256: string;
}
export interface LegacySpreadsheetCell {
  header: string;
  value: string;
  column: number;
  cell: string;
}
export interface LegacySpreadsheetMatch {
  canonicalId: string;
  sourceFingerprint: string;
  title: string;
  authors: string[];
  defenseDate: string;
  comparison: string;
  canonicalAuthorOrderPreserved: boolean;
}
export interface LegacySpreadsheetEvaluation {
  id: string;
  source: LegacySpreadsheetSource;
  match: LegacySpreadsheetMatch;
  groups: Array<{
    group: 'A' | 'B' | 'C';
    evaluator: {roleHeader: string; name: string; column: number; cell: string};
    grades: LegacySpreadsheetCell[];
    reportedTotal: LegacySpreadsheetCell;
  }>;
  reportedSummary: LegacySpreadsheetCell[];
  interpretation: 'SOURCE_REPORTED_ONLY_NO_RECALCULATION_OR_CURRENT_WORKFLOW_DECISION';
}
interface LegacySpreadsheetConflictAssertionSource {
  sourceColumns: Array<Pick<LegacySpreadsheetCell, 'column' | 'cell' | 'header'>>;
  reason: string;
}
export type LegacySpreadsheetConflictAssertion = LegacySpreadsheetConflictAssertionSource & (
  {fieldPath: ['orientador']; canonicalValueAtReview: string; reportedValue: string} |
  {fieldPath: ['examinadores']; canonicalValueAtReview: LegacyAcademicRecord['examinadores']; reportedValue: Array<{nome: string; instituicao?: string}>}
);
export interface LegacySpreadsheetConflict {
  id: string;
  source: LegacySpreadsheetSource;
  match: LegacySpreadsheetMatch;
  assertions: LegacySpreadsheetConflictAssertion[];
  status: 'PRESERVE_SOURCE_ASSERTION_DO_NOT_OVERWRITE_CANONICAL';
}
export interface LegacySpreadsheetEvidence {
  schemaVersion: 1;
  operationId: string;
  importedAt: string | null;
  evaluations: LegacySpreadsheetEvaluation[];
  conflicts: LegacySpreadsheetConflict[];
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
/** Administrative view only; never include these email bindings in a public projection. */
export interface LegacyEvaluationParticipantsView {
  revision: string;
  authors: Array<{nome: string; email: string}>;
  advisor: {nome: string; email: string};
  confirmed: boolean;
  hasStoredBinding: boolean;
  verifiedAt?: string;
}
export type LegacyEvaluationParticipantsUpdate = {
  expectedRevision: string;
  reason: string;
  source: string;
} & ({clear: true} | {clear?: false; authorEmails: string[]; advisorEmail: string});
/** Master-only academic view; publication consent is unchanged by private access. */
export interface PrivateLegacyAcademicView {
  publicationWithdrawal?: {withdrawnAt:string;drivePending:boolean};
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
  'horaDefesa' | 'localDefesa'> & { advisorAcademic?: { tratamento?: string; titulacao?: string }; filesRestricted: boolean; authorizationDecision: LegacyAcademicRecord['authorizationDecision']; publicFiles: { index: number; kind: LegacyAttachment['kind']; downloadUrl: string }[] };
