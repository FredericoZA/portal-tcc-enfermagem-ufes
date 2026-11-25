import {normalizeCapsLevel} from './academicTextCase';
import {formatTccTitle} from './formatters';

export const INSTITUTION_ACRONYM_HELP =
  'Confira a grafia. Você pode usar a sugestão de capitalização ou manter o texto como escreveu, inclusive siglas e acrônimos.';

/** Input and documents use the same deterministic, marker-free casing. */
export function normalizeInstitutionInput(raw: string): string {
  return formatTccTitle(String(raw || ''));
}
export function renderInstitutionName(raw: string): string {
  return /\*[^*]+\*|\+[^+]+-/u.test(raw) ? normalizeInstitutionInput(raw) : normalizeCapsLevel(String(raw || '').normalize('NFC').trim().replace(/\s+/gu,' '));
}

const INSTITUTION_ACRONYMS: ReadonlyMap<string, string> = new Map([
  ['ufes', 'UFES'],
  ['universidade federal do espirito santo', 'UFES'],
  ['unb', 'UnB'],
  ['universidade de brasilia', 'UnB'],
  ['faculdade de ciencias e tecnologias em saude da universidade de brasilia', 'UnB'],
  ['universidade federal de minas gerais', 'UFMG'],
  ['universidade federal do rio de janeiro', 'UFRJ'],
  ['universidade federal do estado do rio de janeiro', 'UNIRIO'],
  ['universidade federal fluminense', 'UFF'],
  ['universidade de sao paulo', 'USP'],
  ['universidade estadual de campinas', 'UNICAMP'],
  ['universidade federal de sao paulo', 'UNIFESP'],
  ['universidade vila velha', 'UVV'],
  ['universidade federal de pelotas', 'UFPel'],
  ['ufpel', 'UFPel'],
  ['hospital cassiano antonio moraes', 'HUCAM'],
  ['hospital cassiano antonio de moraes', 'HUCAM'],
  ['hospital universitario cassiano antonio moraes', 'HUCAM'],
  ['hospital universitario cassiano antonio de moraes', 'HUCAM'],
  ['hucam', 'HUCAM'],
  ['hucam/ufes', 'HUCAM'],
  ['hospital estadual infantil nossa senhora da gloria', 'HEINSG'],
  ['hospital infantil nossa senhora da gloria', 'HEINSG'],
  ['heinsg', 'HEINSG'],
  ['hinsg', 'HEINSG'],
  ['hospital regional dom moura', 'HRDM'],
  ['hrdm', 'HRDM'],
  ['secretaria municipal de saude sao mateus', 'SMS – São Mateus'],
  ['secretaria municipal de saude de sao mateus', 'SMS – São Mateus'],
  ['sms – sao mateus', 'SMS – São Mateus'],
  ['sms - sao mateus', 'SMS – São Mateus'],
]);

/** Abbreviate known institutions in participant tables, without changing the saved name. */
export function displayParticipantInstitution(raw: string): string {
  const name = renderInstitutionName(raw).replace(/^\(\s*(.*?)\s*\)$/u, '$1');
  const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
  const base = key.replace(/\s*(?:\((?:ufes|unb|ufpel|ucam|hucam|heinsg|hinsg|hrdm|sms|es)\)|[-–—]\s*(?:ufes|unb|ufpel|ucam|hucam|heinsg|hinsg|hrdm|sms|es))$/u, '').trim();
  const explicitAcronym = /^universidade\b/u.test(key)
    ? name.match(/(?:\(([\p{Lu}][\p{Lu}\p{N}]{1,11})\)|\s[-–—]\s([\p{Lu}][\p{Lu}\p{N}]{1,11}))$/u)
    : null;
  return INSTITUTION_ACRONYMS.get(base) ?? explicitAcronym?.[1] ?? explicitAcronym?.[2] ?? name;
}

/** Search alias only: never rewrites the stored or displayed institution. */
export function institutionSearchText(raw: string): string {
  const text=renderInstitutionName(raw).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  return /^(?:ufes|universidade federal do espirito santo)$/.test(text.trim())
    ? 'ufes universidade federal do espirito santo'
    : text;
}
