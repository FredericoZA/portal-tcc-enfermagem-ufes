import {formatTccTitle} from './formatters';

export const INSTITUTION_ACRONYM_HELP =
  'Por padrão, não é permitido manter o texto inteiro em letras maiúsculas ou minúsculas: o Portal ajusta as iniciais automaticamente. Algumas siglas reconhecidas, como UFES, SUS e CNPQ, são mantidas em maiúsculas, sem precisar de asteriscos.';

/** Input and documents use the same deterministic, marker-free casing. */
export function normalizeInstitutionInput(raw: string): string {
  return formatTccTitle(String(raw || ''));
}
export function renderInstitutionName(raw: string): string {
  return normalizeInstitutionInput(raw);
}

/** Search alias only: never rewrites the stored or displayed institution. */
export function institutionSearchText(raw: string): string {
  const text=renderInstitutionName(raw).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  return /^(?:ufes|universidade federal do espirito santo)$/.test(text.trim())
    ? 'ufes universidade federal do espirito santo'
    : text;
}
