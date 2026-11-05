export const REFERENCE_DOCUMENT_MODEL_LABELS = {
  COMPROVANTES_RESERVA: 'Comprovantes de reserva',
  DECLARACAO_COMPARECIMENTO: 'Declaração de comparecimento'
} as const;

export type ReferenceDocumentModelType = keyof typeof REFERENCE_DOCUMENT_MODEL_LABELS;

export function isReferenceDocumentModel(type: string): type is ReferenceDocumentModelType {
  return Object.hasOwn(REFERENCE_DOCUMENT_MODEL_LABELS, type);
}
