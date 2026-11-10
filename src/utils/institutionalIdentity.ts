/** Issuing unit; this identity never replaces the individual document signatories. */
export const COMMISSION_NAME='Comissão de Trabalho de Conclusão de Curso';
export const DOCUMENT_UNIT_LINES=[
 'Universidade Federal do Espírito Santo',
 'Centro de Ciências da Saúde',
 'Curso de Graduação em Enfermagem e Obstetrícia',
] as const;
export const DOCUMENT_ISSUER_LINES=[COMMISSION_NAME,'Departamento de Enfermagem','Curso de Enfermagem e Obstetrícia — CCS/UFES'] as const;

export function documentHeaderLines(profile:{institution?:string;course?:string}={}):string[]{
 return [profile.institution?.trim()||DOCUMENT_UNIT_LINES[0],DOCUMENT_UNIT_LINES[1],profile.course?.trim()||DOCUMENT_UNIT_LINES[2]]
  .map(value=>value.toLocaleUpperCase('pt-BR'));
}

/** Email signature; document/PDF issuer formatting remains independent. */
export const EMAIL_ISSUER_LINES=[COMMISSION_NAME,'Departamento de Enfermagem','Curso de Graduação em Enfermagem e Obstetrícia - CCS/UFES'] as const;
