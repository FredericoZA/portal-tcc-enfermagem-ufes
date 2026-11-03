import type {RegistrationAnswers} from '../types/operationalConfig';
export const AUTHOR_REFERENCE_OPTIONS=['o aluno','a aluna','os alunos','as alunas'] as const;
export function authorReferenceOptions(twoAuthors:boolean):string[]{return twoAuthors?['os alunos','as alunas']:['o aluno','a aluna'];}
export function withAuthorReference(answers:RegistrationAnswers):RegistrationAnswers{
 const plural=answers.TEM_ALUNO_2==='Sim',reference=String(answers.AUTORIA_REFERENCIA||'');
 if(!authorReferenceOptions(plural).includes(reference))return answers;
 const treatment=reference==='a aluna'||reference==='as alunas'?'Aluna':'Aluno';
 return {...answers,ALUNO_1_TRATAMENTO:treatment,...(plural?{ALUNO_2_TRATAMENTO:treatment}:{})};
}
export function registrationIdentityNames(answers:RegistrationAnswers):string{
 const names=[String(answers.ALUNO_1_NOME||'').trim(),...(answers.TEM_ALUNO_2==='Sim'?[String(answers.ALUNO_2_NOME||'').trim()]:[])].filter(Boolean);
 return names.join(' e ');
}
export function registrationIdentitySentence(answers:RegistrationAnswers):string{
 return `${answers.TEM_ALUNO_2==='Sim'?'Estavam presentes':'Estava presente'} ${String(answers.AUTORIA_REFERENCIA||'…')} ${registrationIdentityNames(answers)||'…'}.`;
}
