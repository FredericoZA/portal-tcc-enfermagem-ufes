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

const UNIVERSITY_ACRONYMS: ReadonlyMap<string, string> = new Map([
  ['universidade federal do espirito santo', 'UFES'],
  ['universidade federal de minas gerais', 'UFMG'],
  ['universidade federal do rio de janeiro', 'UFRJ'],
  ['universidade federal do estado do rio de janeiro', 'UNIRIO'],
  ['universidade federal fluminense', 'UFF'],
  ['universidade de sao paulo', 'USP'],
  ['universidade estadual de campinas', 'UNICAMP'],
  ['universidade federal de sao paulo', 'UNIFESP'],
  ['universidade vila velha', 'UVV'],
]);

/** Abbreviate known universities in participant tables, without changing the saved name. */
export function displayParticipantInstitution(raw: string): string {
  const name = raw.trim();
  const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
  const explicitAcronym = /^universidade\b/u.test(key)
    ? name.match(/(?:\(([\p{Lu}][\p{Lu}\p{N}]{1,11})\)|\s[-–—]\s([\p{Lu}][\p{Lu}\p{N}]{1,11}))$/u)
    : null;
  return UNIVERSITY_ACRONYMS.get(key) ?? explicitAcronym?.[1] ?? explicitAcronym?.[2] ?? name;
}

/** Search alias only: never rewrites the stored or displayed institution. */
export function institutionSearchText(raw: string): string {
  const text=renderInstitutionName(raw).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  return /^(?:ufes|universidade federal do espirito santo)$/.test(text.trim())
    ? 'ufes universidade federal do espirito santo'
    : text;
}
