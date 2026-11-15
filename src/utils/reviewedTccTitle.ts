import {academicAcronym} from './academicTextCase';

/** Preserve the spelling explicitly reviewed by the advisor. */
export const normalizeReviewedTccTitle = (title: string): string =>
  title.normalize('NFC').trim().replace(/\s+/gu, ' ');

/** A reversible suggestion; proper names must be checked before saving. */
export function suggestSentenceTitle(title: string): string {
  const clean = normalizeReviewedTccTitle(title);
  if (!clean) return '';
  const letters = clean.replace(/[^\p{L}]/gu, '');
  if (letters !== letters.toLocaleUpperCase('pt-BR') && letters !== letters.toLocaleLowerCase('pt-BR')) return clean;
  const suggestion = clean.replace(/[\p{L}\p{M}\p{N}]+/gu, token =>
    academicAcronym(token) || token.toLocaleLowerCase('pt-BR'));
  return suggestion.replace(/\p{L}/u, letter => letter.toLocaleUpperCase('pt-BR'));
}
