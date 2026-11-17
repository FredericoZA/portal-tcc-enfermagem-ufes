import type { ProcessData, ProcessDocument, ProcessRole, SignatureJob } from '../src/types';
import type { LegacyAcademicRecord } from '../src/types/legacyArchive';
import type { RepositoryDocumentAvailability } from '../src/utils/repositoryDocuments';
import { canonicalDriveOriginalLinks } from './driveOriginalLinks';
import { legacyAdministrativeFiles, legacyFileIsPublic, publicLegacyAdministrativeDocuments } from './legacyArchive';
import { publicAcademicDocuments } from './publicAcademicDocuments';
import { reservationReceipts } from './reservationReceipts';
import { publicFileAuthorized } from './workflow/publicationAccess';

const signedKinds = {ATA:'docAta', TERMO:'docTermo', DECLARACAO:'docDeclaracao'} as const;
const legacyKinds = {...signedKinds, CONVITE:'docConvite', AVALIACAO:'docAvaliacao'} as const;
const hasFile = (id?:string, hash?:string) => Boolean(id && canonicalDriveOriginalLinks(id, hash));
const hasHashedFile = (id?:string, hash?:string) => Boolean(hash && hasFile(id, hash));
const segment = encodeURIComponent;

type ReceiptArchive = {
  formType: string;
  status: string;
  reservationRevision?:number;
  driveFileId?:string;
  sha256:string;
};

export function currentRepositoryDocuments(input:{
  process:ProcessData;
  jobs:SignatureJob[];
  forms:ReceiptArchive[];
  documents:ProcessDocument[];
  publicDocuments:ProcessDocument[];
  master:boolean;
  participant:boolean;
  roles:ProcessRole[];
  presidencyDeclaration:boolean;
}):RepositoryDocumentAvailability{
  const {process, jobs, forms, documents, publicDocuments, master, participant, roles, presidencyDeclaration} = input;
  const access = master || participant;
  const currentBase = `/api/processes/${segment(process.id)}`;
  const publicBase = `/api/public/processes/${segment(process.protocolo)}`;
  const result:RepositoryDocumentAvailability = {};
  const published = publicAcademicDocuments(process,publicDocuments);

  for (const kind of ['trabalho-completo','resumo-expandido'] as const) {
    const isWork = kind === 'trabalho-completo';
    const key = isWork ? 'docTccCompleto' : 'docResumoExpandido';
    const file = isWork ? process.acervo?.trabalhoCompletoFileId : process.acervo?.resumoExpandidoFileId;
    const hash = isWork ? process.acervo?.trabalhoCompletoSha256 : process.acervo?.resumoExpandidoSha256;
    if (hasHashedFile(file,hash) && publicFileAuthorized(process,jobs,kind)) {
      result[key] = `${publicBase}/files/${kind}/download`;
    } else if (access) {
      result[key] = hasHashedFile(file,hash) ? `${currentBase}/files/${kind}/download` : false;
    }
  }

  const currentReceipts = reservationReceipts(process);
  const archived = forms.filter(form => form.formType === 'CONFIRMACAO_LOCAL' && form.status === 'ARCHIVED');
  const linkedArchive = (revision?:number) =>
    archived.find(form => form.reservationRevision === revision && form.driveFileId && form.sha256);
  for (const {summary,process:snapshot} of currentReceipts) {
    const archive = linkedArchive(summary.revision);
    const proof = snapshot.defesa.locationProof;
    const archiveLinked = hasHashedFile(archive?.driveFileId,archive?.sha256);
    const proofLinked = proof && (proof.reservationRevision ?? 0) === (snapshot.defesa.reservationRevision ?? 0) &&
      hasHashedFile(proof.driveFileId,proof.sha256);
    const suffix = `?receipt=${segment(summary.id)}`;
    if (archiveLinked || (access && !archive && proofLinked)) {
      result.docReserva = access ? `${currentBase}/location-proof/download${suffix}` : `${publicBase}/reservation-receipt${suffix}`;
      break;
    }
  }
  if (access && result.docReserva === undefined) {
    const proof = process.defesa.locationProof;
    const currentProof = proof && (proof.reservationRevision ?? 0) === (process.defesa.reservationRevision ?? 0) &&
      hasHashedFile(proof.driveFileId,proof.sha256);
    result.docReserva = currentProof && !currentReceipts.some(receipt => receipt.summary.current)
      ? `${currentBase}/location-proof/download`
      : archived.some(form => hasHashedFile(form.driveFileId,form.sha256)) ||
        [proof,...(process.defesa.reservationHistory || []).map(entry => entry.locationProof)]
          .some(item => hasHashedFile(item?.driveFileId,item?.sha256));
  }

  const invitation = documents.find(document => document.type === 'CONVITE');
  const canReadInvitation = master || participant && Boolean(invitation?.visibleToRoles.some(role => roles.includes(role)));
  const publicInvitation = published.find(document => document.type === 'CONVITE');
  if (publicInvitation && hasFile(process.defesa.invitationDriveFileId)) {
    result.docConvite = publicInvitation.url;
  } else if (canReadInvitation) {
    result.docConvite = invitation?.status === 'DISPONIVEL' && hasFile(process.defesa.invitationDriveFileId)
      ? `${currentBase}/documents/${invitation.id}/download`
      : hasFile(process.defesa.invitationDriveFileId) ||
        (process.defesa.reservationHistory || []).some(entry => hasFile(entry.invitationDriveFileId));
  }

  for (const type of ['ATA','TERMO','DECLARACAO'] as const) {
    const key = signedKinds[type];
    const document = documents.find(candidate => candidate.type === type);
    const publicDocument = published.find(candidate => candidate.type === type);
    const archivedJobs = jobs.filter(job => job.documentType === type && job.status === 'ARCHIVED');
    const canonicalArchive = (version:number) => archivedJobs.find(job => job.documentVersion === version && job.driveSignedFileId);
    const publicArchive = publicDocument && canonicalArchive(publicDocument.version);
    if (publicDocument && hasHashedFile(publicArchive?.driveSignedFileId,publicArchive?.signedSha256)) {
      result[key] = publicDocument.url;
      continue;
    }
    const canRead = master || (type === 'DECLARACAO' && presidencyDeclaration) ||
      (participant && Boolean(document?.visibleToRoles.some(role => roles.includes(role))));
    if (!canRead) continue;
    const activeArchive = document?.status === 'ASSINADO' ? canonicalArchive(document.currentVersion) : undefined;
    result[key] = document && hasHashedFile(activeArchive?.driveSignedFileId,activeArchive?.signedSha256)
      ? `${currentBase}/documents/${document.id}/download`
      : archivedJobs.some(job => hasHashedFile(job.driveSignedFileId,job.signedSha256));
  }
  result.docAvaliacao = false;
  return result;
}

export function legacyRepositoryDocuments(record:LegacyAcademicRecord,master:boolean,verifiedEvaluationReader:boolean):RepositoryDocumentAvailability {
  const result:RepositoryDocumentAvailability = {};
  const legacyBase = `/api/legacy-academic-records/${segment(record.id)}`;
  const adminBase = `/api/admin/legacy-academic-records/${segment(record.id)}`;
  for (const kind of ['TRABALHO_COMPLETO','RESUMO_EXPANDIDO'] as const) {
    const key = kind === 'TRABALHO_COMPLETO' ? 'docTccCompleto' : 'docResumoExpandido';
    const belongs = (file:LegacyAcademicRecord['attachments'][number]) => file.kind === kind && hasHashedFile(file.driveFileId,file.sha256);
    const publicIndex = record.attachments.findIndex(file => belongs(file) && legacyFileIsPublic(record,file));
    if (publicIndex >= 0) result[key] = `${legacyBase}/files/${publicIndex}/download`;
    else if (master) {
      const privateIndex = record.attachments.findIndex(belongs);
      result[key] = privateIndex >= 0 ? `${adminBase}/files/${privateIndex}/download` : false;
    }
  }
  result.docReserva = false;
  try {
    const administrativeFiles = legacyAdministrativeFiles(record);
    const publicFiles = publicLegacyAdministrativeDocuments(record);
    for (const kind of ['ATA','TERMO','DECLARACAO','CONVITE','AVALIACAO'] as const) {
      const key = legacyKinds[kind];
      const published = publicFiles.find(file => file.type === kind);
      if (published) {
        result[key] = published.url;
      } else if (master || (kind === 'AVALIACAO' && verifiedEvaluationReader)) {
        const index = administrativeFiles.findIndex(file => file.kind === kind);
        result[key] = index < 0 ? false : kind === 'AVALIACAO'
          ? `${legacyBase}/evaluation-documents/${index}/download`
          : `${adminBase}/documents/${index}/download`;
      }
    }
  } catch {
    // Invalid references do not become available or masquerade as absence.
  }
  return result;
}
