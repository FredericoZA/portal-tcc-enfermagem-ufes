import {normalizeInstitutionInput} from './institutionName';
import {normalizeCustomLocationInput,getCustomLocationFieldValue} from './customDefenseLocation';
import {normalizePersonName} from './personNameCase';
import {formatTccTitle,normalizeEmail} from './formatters';

/** Normalize harmless typing differences before validating or persisting a field. */
export function normalizeRegistrationValue(fieldKey:string,fieldType:string,raw:unknown):unknown {
  if(typeof raw!=='string')return raw;
  const value=raw.normalize('NFC').trim().replace(/\s+/g,' ');
  if(fieldType==='email')return normalizeEmail(value);
  if(fieldKey==='TITULO')return formatTccTitle(value);
  if(/^(DEFESA_LOCAL_PERSONALIZADO|DEFESA_OUTRO_LOCAL_NOME|DEFESA_LOCAL_OUTRO_NOME|OUTRO_LOCAL_NOME|NOME_COMPLETO_LOCAL)$/.test(fieldKey))return normalizeCustomLocationInput(value);
  if(/_NOME$/.test(fieldKey))return normalizePersonName(value);
  if(/_INSTITUICAO$/.test(fieldKey))return normalizeInstitutionInput(value);
  if(/MATRICULA$|_SIAPE$/.test(fieldKey))return value.replace(/[.\s-]/g,'');
  return value;
}
