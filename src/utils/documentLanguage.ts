import {removeAtaLocationTime} from './legacyTextProcessing';
import {publicationAuthorizationVariables} from './publicationAuthorization';
import type {ProcessData} from '../types';
import {academicName,plainPersonName,facultyRole,authorGrammar,personPresentationVariables} from './personPresentation';
import {ataClosingTime} from './ataClosingTime';
import {formatTimeExtenso,formatDateNumericWithWeekday,formatTime24h} from './formatters';
const matchCase=(sample:string,value:string)=>sample.split('(')[0].trim()===sample.split('(')[0].trim().toLocaleUpperCase('pt-BR')?value.toLocaleUpperCase('pt-BR'):/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(sample)?value[0].toLocaleUpperCase('pt-BR')+value.slice(1):value;
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
/** Compatibility with old academic wording; never infer a person's gender from a name. */
export function adaptDocumentLanguage(text:string,p:ProcessData,type:string):string{
 const g=authorGrammar(p),variables=personPresentationVariables(p);let out=text;
 const faculty=[p.orientador,p.coorientador,...p.banca].filter(Boolean) as Array<ProcessData['orientador']>;
 const genericTitle=String.raw`(?:Prof(?:essor)?\s*\((?:a|ª|º)\)\.?\s*)(?:Dr\s*\((?:a|ª|º)\)\.?\s*)?`;
 for(const person of faculty.sort((a,b)=>plainPersonName(b).length-plainPersonName(a).length)){
  const full=academicName(person,'abbreviated'),article=person.tratamento==='Professora'?'a':person.tratamento==='Professor'?'o':'';
  const aliases=[...new Set([full,academicName(person,'full'),person.nome,plainPersonName(person)])].filter(Boolean).sort((a,b)=>b.length-a.length).map(escape).join('|');
  const names=`(?:${aliases})(?![\\p{L}\\p{N}])`;
  out=out.replace(new RegExp(String.raw`(o\(a\)\s+)?${genericTitle}((?:co)?orientador\(a\)\s+)?${names}`,'giu'),(_,originalArticle:string,role:string)=>{
   const resolved=role?facultyRole(person,role.toLowerCase().startsWith('co')?'coorientador':'orientador'):'';
   return [originalArticle?article:'',resolved,full].filter(Boolean).join(' ');
  });
  // Resolve the role with the participant beside it, including each examiner.
  out=out.replace(new RegExp(String.raw`((?:[1-9][ºªo]\s*)?(?:Examinador(?:a|\(a\))?|Integrante da banca|Orientador(?:a|\(a\))?(?: e Presidente)?|Coorientador(?:a|\(a\))?))\s+(?:${genericTitle})?${names}`,'giu'),(_,role:string)=>{
   const kind=/coorientador/i.test(role)?'coorientador':/examinador|integrante/i.test(role)?'examinador':'orientador';
   let resolved=facultyRole(person,kind);resolved=matchCase(role,resolved);
   return `${resolved}${kind==='orientador'?' e Presidente':''} ${full}`;
  });
  const longName=academicName(person,'full');
  if(longName!==full)out=out.replace(new RegExp(`${escape(longName)}(?![\\p{L}\\p{N}])`,'gu'),()=>full);
  // Explicit plain/abbreviated markers keep their requested representation.
  // Full names are supplied by the shared projection; only legacy formulas need repair.
 }
 out=out.replace(/pelo\(a\)\(s\)\s+graduando\(a\)\(s\)/gi,g.by)
  .replace(/do\(a\)\(s\)\s+graduando\(a\)\(s\)/gi,g.of)
  .replace(/ao\(à?\)\(s\)\s+autor\(a\)\(es\)/gi,g.to)
  .replace(/ao\(a\)\(s\)\s+autor\(a\)\(es\)/gi,g.to)
  .replace(/do\(s\)\s+aluno\(s\)/gi,g.of)
  .replace(/do\(a\)(?:\(s\))?\s+aluno\(a\)(?:\(s\)|s)?/gi,g.of)
  .replace(/pelo\(a\)(?:\(s\))?\s+aluno\(a\)(?:\(s\)|s)?/gi,g.by)
  .replace(/o\(a\)(?:\(s\))?\s+aluno\(a\)(?:\(s\)|s)?/gi,g.reference)
  .replace(/o\(a\)\s+Orientador\(a\)/gi,p.orientador.tratamento==='Professora'?'a Orientadora':p.orientador.tratamento==='Professor'?'o Orientador':'o Orientador')
  .replace(/expôs\(expuseram\)/gi,g.plural?'expuseram':'expôs')
  .replace(/os\(as\):/gi,':')
  .replace(/1[ºo]\s*Examinador\(a\)\s*-\s*Orientador\(a\) e Presidente/gi,`${matchCase('Orientador',facultyRole(p.orientador,'orientador'))} e Presidente`)
  .replace(/Coorientador\(a\)/gi,p.coorientador?.tratamento==='Professora'?'Coorientadora':p.coorientador?.tratamento==='Professor'?'Coorientador':'Coorientador')
  .replace(/Orientador\(a\)/gi,p.orientador.tratamento==='Professora'?'Orientadora':p.orientador.tratamento==='Professor'?'Orientador':'Orientador')
  .replace(/([23])[ºªo]\s+(?:Examinador\(a\)|Integrante da banca)/gi,(_,number:string)=>matchCase('Examinador',facultyRole(p.banca.find(member=>member.funcao===`EXAMINER_${number}`)||p.banca[Number(number)-2],'examinador')))
  .replace(/aluno(?:\(a\))?(?:\(s\)|s\(as\))/gi,match=>matchCase(match,variables.AUTORIA_ALUNOS))
  .replace(/Aluno\(a\)(?:\(s\)|s)?/gi,match=>matchCase(match,variables.AUTORIA_ALUNOS))
  .replace(/matriculad[oa](?:\(a\))?\(s\)/gi,match=>matchCase(match,variables.AUTORIA_MATRICULADOS))
  .replace(/graduando\(a\)\(s\)/gi,g.noun)
  .replace(/autor\(a\)\(es\)/gi,g.plural?'pessoas autoras':'pessoa autora');
 if(type==='TERMO'){
  // Compatibility correction requested for the UFES 2020 curriculum. Match only
  // this legacy discipline; other installations and discipline names stay intact.
  out=out.replace(/\bENF\s*05041\s*(?:[-–—:]\s*)?Orienta[çc][ãa]o\s+[aà]\s+Monografia\s+II\b/giu,'ENF16130 Trabalho de Conclusão de Curso II');

  // This term is jointly declared by the authors AND advisor. Even one author
  // plus an advisor takes the first-person plural in the authorization clause.
  out=out.replace(/Eu\s*\(nós\)/gi,match=>matchCase(match,variables.AUTORIA_PRONOME))
   .replace(/autorizo\s*\(amos\)|autorizo\s*\(autorizamos\)/gi,match=>matchCase(match,variables.DECLARANTES_VERBO_AUTORIZAR))
   .replace(/após cumprir\b/gi,match=>matchCase(match,`após ${variables.AUTORIA_VERBO_CUMPRIR}`));
  const choices=publicationAuthorizationVariables(p).AUTORIZACAO_PUBLICACAO_ITENS;
  out=out.replace(/\bAUTORIZAMOS\s+a\s+(?:postagem|publicação)\s+da\s+Monografia\s+ou\s+Resumo\s+Expandido\s+do\s+Artigo\s+produzido,?\s+em\s+site\s+(do\s+[^.]+)\./gi,(_,destination:string)=>`AUTORIZAMOS:\n\n${choices}\n\nA autorização se limita aos itens assinalados, para publicação no repositório público ${destination.trim()}.`);
  out=out.replace(/(\bAUTORIZAMOS:)[ \t]*(?:\r?\n[ \t]*)*(?=[☒☐])/gi,'$1\n\n');
  out=out.replace(/\bem site do\s+/gi,'no repositório público do ');
 }
 const advisorLabel=`${matchCase('Orientador',facultyRole(p.orientador,'orientador'))} e Presidente`;
 out=out.replace(/(^|\n)([ \t]*)(?:Orientação(?: e presidência(?: da (?:banca|sessão))?)?|Orientador(?:a)?(?: e Presidente)?)(?=\s*(?::|\n|$))/gi,(_,line:string,indent:string)=>line+indent+advisorLabel);
 if(type==='CONVITE'){
  out=out.replace(/(^|\n)([ \t]*)À\s+(?:Comissão|Banca)\s+Examinadora\b/giu,'$1$2Aos docentes convidados')
   .replace(/Demais integrantes da comissão/gi,'Membros convidados para a banca')
   .replace(/Comissão\s+Examinadora\s+da defesa/gi,'banca de defesa')
   .replace(/Comissão\s+Examinadora/gi,'banca')
   .replace(/convida Vossas Senhorias para integrar a banca/gi,'convida os docentes abaixo relacionados a participar da banca')
   .replace(/Agradecemos a participação e a contribuição para/gi,'Agradecemos a atenção ao convite e esperamos contar com sua contribuição para');
  const guests=p.banca.filter(person=>person.funcao!=='ORIENTADOR'&&person.email!==p.orientador.email).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  out=out.replace(/^Membros convidados para a banca:[^\n]+/gmi,guests.map(person=>`Membro convidado para a banca: ${academicName(person,'abbreviated')}`).join('\n'));
  out=out.replace(/^Data:[^\n]+/gmi,`Data: ${formatDateNumericWithWeekday(p.defesa.startAt)}`).replace(/^Horário:[^\n]+/gmi,`Horário: ${formatTime24h(p.defesa.startAt)}`);
 }
 out=out.replace(/,\s*:/g,':');
 const result=p.avaliacao?.resultadoLabel||p.avaliacao?.resultadoCode||'',agreed=personPresentationVariables(p).RESULTADO_CONCORDANTE;
 if(result&&agreed!==result)out=out.replace(new RegExp(`\\b${escape(result)}\\b`,'g'),()=>agreed);
 if(type==='ATA'){
  if(p.coorientador?.nome?.trim()){
   const coName=academicName(p.coorientador,'abbreviated');
   const coRole=matchCase('Coorientador',facultyRole(p.coorientador,'coorientador'));
   if(!out.includes(coName)&&/apresentando os demais examinadores/iu.test(out))out=out.replace(/(?=Foi dada a palavra)/iu,`Participou também ${p.coorientador.tratamento==='Professora'?'a':'o'} ${coRole.toLocaleLowerCase('pt-BR')} ${coName}. `);
  }
  out=removeAtaLocationTime(out);
  const time=formatTimeExtenso(ataClosingTime(p.defesa.startAt).iso);
  const closing=`Nada mais havendo a tratar, às ${time} foi encerrada a sessão e lavrada a presente ata que segue para ser assinada.`;
  out=out.replace(/Nada mais havendo a tratar,\s*(?:às [^,]+?\s)?foi encerrada a sessão e lavrada a presente ata,?\s*que (?:será assinada(?: por quem de direito)?|segue para ser assinada)\.?/gi,closing);
 }
 return out;
}
