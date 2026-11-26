import React from 'react';
import {capitalizationSuggestion} from '../utils/capitalizationReview';
import {hasUppercaseTitlePassage, normalizeReviewedTccTitle, UPPERCASE_TCC_TITLE_MESSAGE} from '../utils/reviewedTccTitle';

/** Suggestions never overwrite a field without an explicit user choice. */
export function CapitalizationReview({value,kind,confirmed,onApply,onKeep}:{value:string;kind:'title'|'institution';confirmed?:string;onApply:(value:string)=>void;onKeep?:(value:string)=>void}) {
  const text=normalizeReviewedTccTitle(value);
  const suggestion=capitalizationSuggestion(text,kind);
  if(!text||suggestion===text)return null;
  const blocked = kind === 'title' && hasUppercaseTitlePassage(text);
  if (!blocked && !onKeep) return null;
  if(!blocked&&confirmed===text)return <span className="mt-2 block text-xs text-slate-600">Grafia confirmada. O texto será mantido como você escreveu.</span>;
  return <span className="portal-instruction mt-2 block space-y-2 p-3 text-sm" role="group" aria-label="Conferência da capitalização">
    <span className="block">{blocked ? UPPERCASE_TCC_TITLE_MESSAGE : 'Confira a capitalização. Se houver siglas, acrônimos ou uma grafia intencional, você pode manter o texto como escreveu.'}</span>
    <span className="block">Sugestão: <span className="break-words">{suggestion}</span></span>
    <span className="flex flex-wrap gap-2">
      <button type="button" className="portal-action" onClick={()=>onApply(suggestion)}>Usar sugestão</button>
      {!blocked && onKeep && <button type="button" className="portal-action" onClick={()=>onKeep(text)}>Manter como escrevi</button>}
    </span>
  </span>;
}
