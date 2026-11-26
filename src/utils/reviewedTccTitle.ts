import {academicAcronym} from './academicTextCase';

export const UPPERCASE_TCC_TITLE_MESSAGE = 'Escreva o título em caixa normal. Use maiúsculas nas siglas, como SUS, UFES e HIV.';

/** Preserve the spelling explicitly reviewed by the advisor. */
export const normalizeReviewedTccTitle = (title: string): string =>
  title.normalize('NFC').trim().replace(/\s+/gu, ' ');

const titleWords = /\bCAPS(?: AD(?: I{1,3})?| I{1,3})\b|[\p{L}\p{M}]+(?:\p{N}+[\p{L}\p{M}]*)*/gu;
const titleConnectives = new Set(['a', 'as', 'ao', 'aos', 'o', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'com', 'sem', 'para', 'por']);

function titleAcronym(title: string, word: RegExpMatchArray, previous?: RegExpMatchArray): string | null {
  if (word[0].startsWith('CAPS ')) return word[0];
  const acronym = academicAcronym(word[0]);
  if (acronym) return acronym;
  // A recognized instrument may have a short, uppercase variant suffix, such as WHOQOL-BREF.
  if (previous && /^[A-Z]{2,5}$/u.test(word[0]) && academicAcronym(previous[0]) &&
      /^[-‐‑]$/u.test(title.slice(previous.index! + previous[0].length, word.index))) return word[0];
  return null;
}


/** Identify uppercase prose while leaving acronyms and codes in their original case. */
export function correctUppercaseTitlePassages(title: string): string {
  const clean = normalizeReviewedTccTitle(title);
  const words = [...clean.matchAll(titleWords)];
  const entirelyUppercase = clean === clean.toLocaleUpperCase('pt-BR');
  const corrections = new Set<number>();
  let run: RegExpMatchArray[] = [];
  const finishRun = () => {
    // A pair of short, unfamiliar acronyms can legitimately occur together.
    const hasContentWord = run.some(([word]) => word.length > 1 && !titleConnectives.has(word.toLocaleLowerCase('pt-BR')));
    const hasProse = run.some(([word]) => titleConnectives.has(word.toLocaleLowerCase('pt-BR')) ||
      word.length >= 6 || /[^A-Z]/u.test(word));
    const singleWordTitle = words.length === 1 && run.length === 1 && hasProse &&
      !titleConnectives.has(run[0][0].toLocaleLowerCase('pt-BR'));
    if ((run.length >= 2 && hasContentWord && (hasProse || entirelyUppercase)) || singleWordTitle) {
      for (const word of run) corrections.add(word.index!);
    }
    run = [];
  };

  for (const [index, word] of words.entries()) {
    const token = word[0];
    if (!/\p{Lu}/u.test(token) || /[\p{Ll}\p{Lt}]/u.test(token)) {
      if (!titleConnectives.has(token)) finishRun();
    } else if (!titleAcronym(clean, word, words[index - 1]) && !/\p{N}/u.test(token)) {
      run.push(word);
    }
  }
  finishRun();
  if (!corrections.size) return clean;
  const corrected = clean.replace(titleWords,
    (word, offset: number) => corrections.has(offset) ? word.toLocaleLowerCase('pt-BR') : word);
  return corrections.has(words[0].index!)
    ? corrected.replace(/\p{L}/u, letter => letter.toLocaleUpperCase('pt-BR'))
    : corrected;
}

export function hasUppercaseTitlePassage(title: string): boolean {
  return correctUppercaseTitlePassages(title) !== normalizeReviewedTccTitle(title);
}

/** A reversible suggestion; proper names must be checked before saving. */
export function suggestSentenceTitle(title: string): string {
  const clean = normalizeReviewedTccTitle(title);
  if (!clean) return '';
  const corrected = correctUppercaseTitlePassages(clean);
  if (corrected !== clean) return corrected;
  const letters = clean.replace(/[^\p{L}]/gu, '');
  if (letters !== letters.toLocaleUpperCase('pt-BR') && letters !== letters.toLocaleLowerCase('pt-BR')) return clean;
  const words = [...clean.matchAll(titleWords)];
  let index = 0;
  const suggestion = clean.replace(titleWords, token => {
    const acronym = titleAcronym(clean, words[index], words[index - 1]);
    index += 1;
    return acronym || token.toLocaleLowerCase('pt-BR');
  });
  return suggestion.replace(/\p{L}/u, letter => letter.toLocaleUpperCase('pt-BR'));
}
