import type {ProcessData} from '../types';
export const AUTHOR_ORDER_OPTIONS=['Primeiro autor, depois segundo autor','Segundo autor, depois primeiro autor'] as const;
export function orderedAuthors(p:Pick<ProcessData,'aluno1'|'aluno2'|'authorOrder'>){
 const authors=[p.aluno1,...(p.aluno2?[p.aluno2]:[])];return p.authorOrder==='ALUNO_2_FIRST'&&p.aluno2?authors.reverse():authors;
}
export const authorNames=(p:Pick<ProcessData,'aluno1'|'aluno2'|'authorOrder'>)=>orderedAuthors(p).map(person=>person.nome).join(' e ');
export const STUDENT_TREATMENTS=['Aluno','Aluna'] as const;
export const FACULTY_TREATMENTS=['Professor','Professora'] as const;
export const ACADEMIC_DEGREES=['Doutor','Doutora','Mestre','Mestra','Especialista','Sem titulação'] as const;
export type PersonTreatment='Aluno'|'Aluna'|'Professor'|'Professora';
export type AcademicDegree=typeof ACADEMIC_DEGREES[number];
export const isPresentationField=(key:string)=>/_(TRATAMENTO|TITULACAO)$/.test(key);
export type AcademicPerson={nome:string;tratamento?:string;titulacao?:string};
export function plainPersonName(person?:AcademicPerson|null):string{
 if(!person)return '';
 return person.nome.replace(/^(?:(?:prof(?:essor(?:a)?|a|[.．]?[ªº])?|dr(?:a|[.．]?[ªº])?|doutor(?:a)?|me|ma|mestre|mestra|esp(?:ecialista)?)\.?\s+)+/i,'').trim();
}
/** Canonical participant data stays separate; document representations are derived. */
export function academicName(person?:AcademicPerson|null,style:'full'|'abbreviated'='full'):string{
 if(!person)return '';if(!person.tratamento)return person.nome.trim();
 const name=plainPersonName(person),short=style==='abbreviated';
 const treatment=person.tratamento==='Professora'?(short?'Prof.ª':'Professora'):person.tratamento==='Professor'?(short?'Prof.':'Professor'):'';
 const degrees:Record<string,string>=short?{Doutor:'Dr.',Doutora:'Dr.ª',Mestre:'Me.',Mestra:'Ma.',Especialista:'Esp.'}:{Doutor:'Doutor',Doutora:'Doutora',Mestre:'Mestre',Mestra:'Mestra',Especialista:'Especialista'};
 return [treatment,degrees[person.titulacao||'']||'',name].filter(Boolean).join(' ');
}
export function facultyRole(person:AcademicPerson|undefined|null,role:'orientador'|'coorientador'|'examinador'):string{
 if(!person?.tratamento)return role==='examinador'?'Integrante da banca':role==='coorientador'?'Coorientador':'Orientador';
 return role+(person.tratamento==='Professora'?'a':'');
}
export function authorGrammar(p:Pick<ProcessData,'aluno1'|'aluno2'>){
 const people=[p.aluno1,p.aluno2].filter(Boolean) as ProcessData['aluno1'][];
 const known=people.every(person=>STUDENT_TREATMENTS.includes(person.tratamento as any));
 const female=known&&people.every(person=>person.tratamento==='Aluna'),plural=people.length>1;
 const noun=known?(female?(plural?'graduandas':'graduanda'):(plural?'graduandos':'graduando')):(plural?'pessoas autoras':'pessoa autora');
 const feminine=female||!known;const article=plural?(feminine?'as':'os'):(feminine?'a':'o');
 return {plural,female,known,noun,article,reference:`${article} ${noun}`,of:`${plural?(feminine?'das':'dos'):(feminine?'da':'do')} ${noun}`,by:`${plural?(feminine?'pelas':'pelos'):(feminine?'pela':'pelo')} ${noun}`,to:`${plural?(feminine?'às':'aos'):(feminine?'à':'ao')} ${known?(female?(plural?'autoras':'autora'):(plural?'autores':'autor')):noun}`,studentLabel:known?(female?(plural?'Alunas':'Aluna'):(plural?'Alunos':'Aluno')):'Autoria'};
}
export function authorIntroduction(p:Pick<ProcessData,'aluno1'|'aluno2'|'authorOrder'>){const g=authorGrammar(p);return `${g.known?g.article+' ':''}${g.known?g.studentLabel.toLocaleLowerCase('pt-BR'):(g.plural?'discentes':'discente')} ${authorNames(p)}`;}
export function personPresentationVariables(p:ProcessData):Record<string,string>{
 const g=authorGrammar(p);const examiner=(n:number)=>p.banca.find(m=>m.funcao===`EXAMINER_${n}`)||p.banca.filter(m=>m.funcao!=='ORIENTADOR')[n-2];
 const result=p.avaliacao?.resultadoLabel||p.avaliacao?.resultadoCode||'';
 const agreed=g.known?result.replace(/^(aprovad|reprovad)[oa]s?/i,(_,stem:string)=>`${stem}${g.female?'a':'o'}${g.plural?'s':''}`):result;
 const studentNoun=g.known?g.studentLabel.toLocaleLowerCase('pt-BR'):(g.plural?'discentes':'discente');
 const enrolled=g.known?`matriculad${g.female?'a':'o'}${g.plural?'s':''}`:'com matrícula';
 const vars:Record<string,string>={AUTORIA_NOMES:authorNames(p),AUTORIA_PRIMEIRO_NOME:orderedAuthors(p)[0]?.nome||'',AUTORIA_SEGUNDO_NOME:orderedAuthors(p)[1]?.nome||'',AUTORIA_VERBO_CUMPRIR:g.plural?'cumprirmos':'cumprir',AUTORIA_PRONOME:g.plural?'Nós':'Eu',AUTORIA_ALUNOS:studentNoun,AUTORIA_MATRICULADOS:enrolled,AUTORIA_VERBO_AUTORIZAR:g.plural?'autorizamos':'autorizo',DECLARANTES_VERBO_AUTORIZAR:'autorizamos',AUTORIA_APRESENTACAO:authorIntroduction(p),AUTORIA_VARIANTE:g.known?(g.plural?(g.female?'DUPLA_FEMININA':p.aluno1.tratamento===p.aluno2?.tratamento?'DUPLA_MASCULINA':'DUPLA_MISTA'):(g.female?'INDIVIDUAL_FEMININO':'INDIVIDUAL_MASCULINO')):'LEGADO_NEUTRO',ALUNOS_REFERENCIA:g.reference,ALUNOS_REFERENCIA_DE:g.of,ALUNOS_REFERENCIA_POR:g.by,ALUNOS_REFERENCIA_A:g.to,ALUNOS_ROTULO:g.studentLabel,ALUNOS_VERBO_APRESENTAR:g.plural?'expuseram':'expôs',RESULTADO_CONCORDANTE:agreed};
 for(const [prefix,person] of [['ALUNO_1',p.aluno1],['ALUNO_2',p.aluno2],['ORIENTADOR',p.orientador],['COORIENTADOR',p.coorientador],['EXAMINADOR_2',examiner(2)],['EXAMINADOR_3',examiner(3)]] as const){
  vars[`${prefix}_TRATAMENTO`]=person?.tratamento||'';vars[`${prefix}_TITULACAO`]=person&&'titulacao' in person?person.titulacao||'':'';
  const student=prefix.startsWith('ALUNO');
  vars[`${prefix}_NOME_SIMPLES`]=student?person?.nome||'':plainPersonName(person);
  vars[`${prefix}_NOME_COMPLETO`]=student?person?.nome||'':academicName(person);
  vars[`${prefix}_NOME_ABREVIADO`]=student?person?.nome||'':academicName(person,'abbreviated');
  vars[`${prefix}_FUNCAO`]=student?(person?.tratamento||'Autoria'):facultyRole(person,prefix==='ORIENTADOR'?'orientador':prefix==='COORIENTADOR'?'coorientador':'examinador')+(prefix==='ORIENTADOR'?' e presidente':'');
 }
 return vars;
}
export const PERSON_PRESENTATION_VARIABLE_KEYS=[
 ...['ALUNO_1','ALUNO_2','ORIENTADOR','COORIENTADOR','EXAMINADOR_2','EXAMINADOR_3'].flatMap(prefix=>[`${prefix}_TRATAMENTO`,`${prefix}_TITULACAO`,`${prefix}_NOME_COMPLETO`,`${prefix}_NOME_SIMPLES`,`${prefix}_NOME_ABREVIADO`,`${prefix}_FUNCAO`]),
 'AUTORIA_NOMES','AUTORIA_PRIMEIRO_NOME','AUTORIA_SEGUNDO_NOME','AUTORIA_VERBO_CUMPRIR','AUTORIA_PRONOME','AUTORIA_ALUNOS','AUTORIA_MATRICULADOS','AUTORIA_VERBO_AUTORIZAR','DECLARANTES_VERBO_AUTORIZAR','AUTORIA_APRESENTACAO','AUTORIA_VARIANTE',
 'ALUNOS_REFERENCIA','ALUNOS_REFERENCIA_DE','ALUNOS_REFERENCIA_POR','ALUNOS_REFERENCIA_A','ALUNOS_ROTULO','ALUNOS_VERBO_APRESENTAR','RESULTADO_CONCORDANTE'
];
