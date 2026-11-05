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
  const documents = (data.legacyRecord?[]:Object.keys(administrativeDocumentLabels) as DocumentType[]).map(type => {
    const published = data.documents?.find((doc: any) => doc.type === type);
    return {
      id: published?.id || `public-${type}`, type, title: administrativeDocumentLabels[type].title,
      status: published?.status || 'NAO_DISPONIVEL', currentVersion: published?.version || 1,
      visibleToRoles: [], requiresSignature: type !== 'CONVITE',
      createdAt: data.createdAt, updatedAt: data.updatedAt,
      driveDownloadUrl: published?.url, driveWebViewLink: published?.url,
    } as ProcessDocument;
  });
  return { process, documents };
}
