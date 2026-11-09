export const RESERVATION_RECEIPT_TEMPLATE_FIELDS = [
  'PROTOCOLO', 'TITULO', 'ALUNOS', 'RESERVA_RESULTADO', 'DEFESA_LOCAL',
  'DEFESA_DATA', 'DEFESA_HORARIO', 'RESPOSTA_REGISTRADA_EM', 'RESPONSAVEL_RESERVA',
] as const;

export function hasReservationReceiptTemplateFields(variables: readonly string[]): boolean {
  if (!Array.isArray(variables)) return false;
  const fields = new Set(variables.map(variable => String(variable || '').trim()
    .replace(/^<<|>>$/g,'').replace(/^\{\{|\}\}$/g,'').replace(/^\[\[|\]\]$/g,'').replace(/^«|»$/g,'')
    .replace(/^-|-$/g,'').trim()));
  return fields.size === RESERVATION_RECEIPT_TEMPLATE_FIELDS.length
    && RESERVATION_RECEIPT_TEMPLATE_FIELDS.every(field => fields.has(field));
}
