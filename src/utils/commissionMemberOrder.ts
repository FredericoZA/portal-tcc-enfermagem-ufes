/**
 * Ordenação de integrantes pelo nome, ignorando tratamentos acadêmicos.
 * Não modifica a grafia exibida nem a lista cadastrada nas Configurações.
 */
export function compareCommissionMemberNames(a: string, b: string): number {
  const nameForOrder = (name: string) => String(name || '')
    .replace(/^(?:(?:prof(?:essora|essor)?|profa?|dr(?:a)?|mestr(?:a|e))[\s.ªº]+)+/gi, '')
    .trim();
  return nameForOrder(a).localeCompare(nameForOrder(b), 'pt-BR', { sensitivity: 'base' });
}
