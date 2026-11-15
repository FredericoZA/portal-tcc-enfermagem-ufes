/** Explicit vocabulary and institution patterns: no remote service or AI. */
const ACADEMIC_ACRONYMS = new Set([
  'UE','ONU','UNICEF','UNESCO','EUA','DCNT','HAS','DM','DPOC','IAM','AVE','AVC','SES','SESA','FAPEMIG','FAPERGS','HU','HUCAM','HC','HCPA','HFA','HAOC','HSL','SUS','TCC','UFES','UTI','UTIN','CCS','AIDS','HIV','SAMU','CAPS','UBS','EAD','EPI','EPIS','COVID','COVID19','ICU','OMS','OPAS','IST','DST','DNA','RNA','LGPD','CNS','ESF','APS','ABNT','CNPQ','CAPES','SAE','COFEN','COREN','ANVISA','IBGE','CEP','CONEP','TCLE','UBSF','UPA','PIB','PNAISC','PNSIPN',
  'USP','UNESP','UNICAMP','UNIFESP','UNIRIO','UNIVASF','UNIFAL','UNIFEI','UNILA','UNILAB','UNIR','UNB','UNEMAT','UNICENTRO','UNIOESTE','UNEB','UNITINS','UNIMONTES','UNIVILLE','UNIVALI','UNISUL','UNIVIX','FAESA','UCL','EMESCAM','MULTIVIX','FIOCRUZ','FAPERJ','FAPESP','FAPES','SENAC','SENAI','SESI','SENAR','SEBRAE','MEC','MS','CNPQ','PUC','PUCPR','PUCRS','PUCMG','PUCSP','PUCRJ',
]);

export function academicAcronym(token:string):string|null{
  const upper=token.toLocaleUpperCase('pt-BR');
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
