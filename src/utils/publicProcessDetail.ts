import type { ProcessData, ProcessDocument, DocumentType } from '../types';
import {administrativeDocumentLabels} from './finalDeliveryPresentation';

/** Adapt only the server's public projection to the shared, read-only detail view. */
export function publicProcessDetail(data: any): { process: ProcessData; documents: ProcessDocument[] } {
  const person = (value: any) => value ? { ...value, email: '' } : null;
  const process = {
    ...data,
    aluno1: person(data.aluno1), aluno2: person(data.aluno2),
    orientador: person(data.orientador), coorientador: person(data.coorientador),
    banca: (data.banca || []).map(person),
    avaliacao: data.avaliacao || { status: 'PENDENTE' },
    dataRevision: 0,
  } as ProcessData;
  const entries = data.legacyRecord
    ? (data.documents || []).filter((doc:any) => Object.hasOwn(administrativeDocumentLabels,doc.type))
    : (Object.keys(administrativeDocumentLabels) as DocumentType[]).map(type => data.documents?.find((doc:any) => doc.type===type) || {type});
  const documents = entries.map((published:any) => {
    const type=published.type as DocumentType;
    return {
      id: published?.id || `public-${type}`, type, title: administrativeDocumentLabels[type].title,
      signatureProgress:data.documentProgress?.[type],
      status: published?.status || (data.documentProgress?.[type]?.generated?'AGUARDANDO_ASSINATURA':'NAO_DISPONIVEL'), currentVersion: published?.version || 1,
      visibleToRoles: [], requiresSignature: type !== 'CONVITE',
      createdAt: data.createdAt, updatedAt: data.updatedAt,
      signatureProvider: published?.signatureProvider,
      driveDownloadUrl: published?.url, driveWebViewLink: published?.url,
    } as ProcessDocument;
  });
  return { process, documents };
}
