import {formatNameTitleCase,formatTccTitle,normalizeEmail} from './formatters';

/** Normalize harmless typing differences before validating or persisting a field. */
export function normalizeRegistrationValue(fieldKey:string,fieldType:string,raw:unknown):unknown {
  if(typeof raw!=='string')return raw;
  const value=raw.normalize('NFC').trim().replace(/\s+/g,' ');
  if(fieldType==='email')return normalizeEmail(value);
  if(fieldKey==='TITULO')return formatTccTitle(value);
  if(/_NOME$/.test(fieldKey))return formatNameTitleCase(value);
  if(/_INSTITUICAO$/.test(fieldKey))return formatNameTitleCase(value).replace(/\b(ufes|ufrj|usp|unesp|unicamp|if es|ifes|ccs|sus|cnpq|capes)\b/gi,word=>word.toUpperCase());
  if(/MATRICULA$|_SIAPE$/.test(fieldKey))return value.replace(/[.\s-]/g,'');
  return value;
}
