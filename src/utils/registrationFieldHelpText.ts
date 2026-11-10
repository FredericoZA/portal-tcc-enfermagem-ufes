/** Presentation only: keep installed field definitions intact while retiring obsolete acronym instructions. */
export function registrationFieldHelpText(fieldKey: string, helpText?: string): string {
  const text = helpText || '';
  if (!/^(?:TITULO|(?:COORIENTADOR|EXAMINADOR_[23])_INSTITUICAO)$/.test(fieldKey)) return text;
  return text.replace(/[^.!?\n]*(?:asteriscos?|\*UFES\*)[^.!?\n]*[.!?]?/gi, sentence =>
    /siglas?|acr[oô]nimos?|mai[uú]sculas?|\*UFES\*|os asteriscos n[aã]o aparecem/i.test(sentence) ? '' : sentence
  ).trim();
}
