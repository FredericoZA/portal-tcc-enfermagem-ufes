import { formatNameTitleCase } from './formatters';

export const INSTITUTION_ACRONYM_HELP =
  'Para manter siglas e/ou acrônimos em maiúsculas, escreva *UFES*. Os asteriscos não aparecem nos documentos.';

/** Preserva siglas marcadas enquanto o campo está sendo editado. */
export function normalizeInstitutionInput(raw: string): string {
  const acronyms: string[] = [];
  const source = String(raw || '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\+([^+\n]+?)-|\*([^*]+)\*/g, (_match, explicit: string, legacy: string) => {
      const part = explicit || legacy;
      acronyms.push(part.trim().toLocaleUpperCase('pt-BR'));
      return `institutionacronym${acronyms.length - 1}`;
    });

  return formatNameTitleCase(source)
    .replace(/\b(ufes|ufrj|usp|unesp|unicamp|ifes|ccs|sus|cnpq|capes)\b/gi, (word) => word.toUpperCase())
    .replace(/institutionacronym(\d+)/gi, (_match, index) => `*${acronyms[Number(index)]}*`);
}

/** Usa a mesma grafia das instituições nos documentos, sem mostrar os delimitadores. */
export function renderInstitutionName(raw: string): string {
  return normalizeInstitutionInput(raw).replace(/\*([^*]+)\*/g, '$1');
}
