import {formatTccTitle} from './formatters';
import {hasUppercaseTitlePassage,suggestSentenceTitle,normalizeReviewedTccTitle} from './reviewedTccTitle';

export const allowsCapitalizationChoice=(key:string)=>key==='TITULO'||/_INSTITUICAO$/.test(key);
export function capitalizationSuggestion(value:string,kind:'title'|'institution'):string {
  return kind==='title'?suggestSentenceTitle(value):formatTccTitle(value);
}
export function needsCapitalizationReview(value:unknown,kind:'title'|'institution',confirmed?:string):boolean {
  const text=normalizeReviewedTccTitle(String(value??''));
  if (kind === 'title' && hasUppercaseTitlePassage(text)) return true;
  return Boolean(text&&capitalizationSuggestion(text,kind)!==text&&confirmed!==text);
}
