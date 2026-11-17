import type { ProcessData } from '../types';

export const REPOSITORY_DOCUMENT_COLUMNS = [
  {key:'docReserva', label:'Comprovante de reserva'},
  {key:'docConvite', label:'Carta-convite'},
  {key:'docAta', label:'Ata de defesa'},
  {key:'docTermo', label:'Termo de autorização'},
  {key:'docDeclaracao', label:'Declaração de participação'},
  {key:'docTccCompleto', label:'TCC completo'},
  {key:'docResumoExpandido', label:'Resumo expandido'},
  {key:'docAvaliacao', label:'Instrumento de avaliação'},
] as const;

export type RepositoryDocumentKey = typeof REPOSITORY_DOCUMENT_COLUMNS[number]['key'];
export type RepositoryDocumentAvailability = Partial<Record<RepositoryDocumentKey, boolean | string>>;
export type RepositoryDocumentIndex = Record<string, RepositoryDocumentAvailability>;
export type RepositoryDocumentStatus = 'Presente' | 'Ausente' | 'Não exibido';
export const REPOSITORY_DOCUMENT_STATUSES: readonly RepositoryDocumentStatus[] = ['Presente','Ausente','Não exibido'];

export function isRepositoryDocumentKey(key:string):key is RepositoryDocumentKey {
  return REPOSITORY_DOCUMENT_COLUMNS.some(column => column.key === key);
}

/** A string is an authorized Portal route. No browser list receives private Drive IDs. */
export function repositoryDocumentStatus(value: boolean | string | undefined): RepositoryDocumentStatus {
  if (value === undefined) return 'Não exibido';
  return value ? 'Presente' : 'Ausente';
}

/** Anonymous rows may only use information already released in the public catalog. */
export function publishedRepositoryDocuments(process:ProcessData):RepositoryDocumentAvailability {
  const work = process.acervo?.publishFullWork && process.acervo.trabalhoCompletoFileUrl;
  const abstract = process.acervo?.publishExpandedAbstract && process.acervo.resumoExpandidoFileUrl;
  const publicAcademicPath = (kind:'trabalho-completo'|'resumo-expandido', url:string) =>
    process.legacyRecord ? url : `/api/public/processes/${encodeURIComponent(process.protocolo)}/files/${kind}/download`;
  return {
    ...(work ? {docTccCompleto: publicAcademicPath('trabalho-completo', work)} : {}),
    ...(abstract ? {docResumoExpandido: publicAcademicPath('resumo-expandido', abstract)} : {}),
  };
}
