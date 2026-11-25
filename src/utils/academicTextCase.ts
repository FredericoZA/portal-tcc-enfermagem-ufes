/** Explicit vocabulary and institution patterns: no remote service or AI. */
const ACADEMIC_ACRONYMS = new Set([
  'UE','ONU','UNICEF','UNESCO','EUA','DCNT','HAS','DM','DPOC','IAM','AVE','AVC','SES','SESA','FAPEMIG','FAPERGS','HU','HUCAM','HEINSG','HRDM','SMS','HC','HCPA','HFA','HAOC','HSL','SUS','TCC','UFES','UTI','UTIN','CCS','AIDS','HIV','SAMU','CAPS','UBS','EAD','EPI','EPIS','COVID','COVID19','ICU','OMS','OPAS','IST','DST','DNA','RNA','LGPD','CNS','NANDA','NIC','NOC','ESF','APS','ABNT','CNPQ','CAPES','SAE','COFEN','COREN','ANVISA','IBGE','CEP','CONEP','TCLE','UBSF','UPA','PIB','PNAISC','PNSIPN',
  'USP','UNESP','UNICAMP','UNIFESP','UNIRIO','UNIVASF','UNIFAL','UNIFEI','UNILA','UNILAB','UNIR','UNB','UNEMAT','UNICENTRO','UNIOESTE','UNEB','UNITINS','UNIMONTES','UNIVILLE','UNIVALI','UNISUL','UNIVIX','FAESA','UCL','EMESCAM','MULTIVIX','FIOCRUZ','FAPERJ','FAPESP','FAPES','SENAC','SENAI','SESI','SENAR','SEBRAE','MEC','MS','CNPQ','PUC','PUCPR','PUCRS','PUCMG','PUCSP','PUCRJ',
]);

export function academicAcronym(token:string):string|null{
  const upper=token.toLocaleUpperCase('pt-BR');
  if(upper==='UFPEL')return 'UFPel';
  if(ACADEMIC_ACRONYMS.has(upper))return upper;
  // Preserve explicit Roman numerals without turning ordinary words such as 'mix' into numbers.
  if(/^[IVXLCDM]+$/.test(token)&&/^(?=[IVXLCDM]+$)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(token))return token;
  // Federal/state universities and federal institutes use established prefixes.
  if(/^(?:UF|UE|IF)[A-Z]{1,5}$/.test(upper))return upper;
  if(/^[B-DF-HJ-NP-TV-Z]{2,6}$/.test(token))return token;
  return null;
}

/** Accept old saved notation for compatibility; never emit editing delimiters. */
export function stripAcademicCaseMarkers(value:string):string{
  let current=value;
  while(true){
    const next=current.replace(/\+([^+\n]+?)-|\*+([^*\n]+)\*+/g,(_match,old:string,marked:string)=>(old||marked).trim());
    if(next===current)return next;
    current=next;
  }
}

/** Restore the service level even when older title casing saved Iii. */
export function normalizeCapsLevel(value: string): string {
  return value.replace(/\bCAPS\s+(?:AD\s+)?I{1,3}\b/gi, service =>
    service.replace(/\s+/g, ' ').toUpperCase());
}

const keywordConnectives = /^(?:A|AS|AO|AOS|O|OS|DE|DA|DO|DAS|DOS|E|É|EM|NA|NO|NAS|NOS|À|ÀS|POR|PARA|COM|SEM|SOBRE)$/u;

/** Capitalize the start of each keyword while preserving acronyms and mixed-case spelling. */
export function normalizeAcademicKeyword(value: string): string {
  const keyword = normalizeCapsLevel(value.normalize('NFC').trim())
    .replace(/\bcovid\s*[-‐‑–]\s*19\b/gi, 'COVID-19');
  const firstToken = keyword.search(/[\p{L}\p{N}]/u);
  return keyword.replace(/\bCAPS(?: AD)? I{1,3}\b|[\p{L}\p{N}]+(?:[-/][\p{L}\p{N}]+)*/gu, (token, offset: number) => {
    const normalized = token.startsWith('CAPS ') || /[\p{N}\p{Ll}\p{Lt}]/u.test(token)
      ? token
      : token.split(/([-/])/u).map(part => {
          if (keywordConnectives.test(part)) return part.toLocaleLowerCase('pt-BR');
          return academicAcronym(part) ?? part.toLocaleLowerCase('pt-BR');
        }).join('');
    if (offset !== firstToken || /[\p{N}\p{Lu}\p{Lt}]/u.test(normalized)) return normalized;
    return normalized.replace(/^\p{Ll}/u, initial => initial.toLocaleUpperCase('pt-BR'));
  });
}
