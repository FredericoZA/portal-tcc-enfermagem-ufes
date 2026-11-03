import type {ProcessData} from '../types';
import {academicName,authorNames} from './personPresentation';
import {formatDateNumeric,formatTime24h} from './formatters';
import {defenseEndAt} from './defenseSchedule';

type InvitationProcess=Pick<ProcessData,'titulo'|'protocolo'|'aluno1'|'aluno2'|'orientador'|'defesa'|'authorOrder'>&{banca?:ProcessData['banca'];coorientador?:ProcessData['coorientador']};
export function invitedExaminers(process:{orientador:{email:string};banca?:ProcessData['banca']}){
 const advisor=process.orientador.email.trim().toLowerCase(),seen=new Set<string>();
 return (process.banca||[]).filter(person=>{
  const email=person.email.trim().toLowerCase();
  if(person.funcao==='ORIENTADOR'||email===advisor||!email||seen.has(email))return false;
  seen.add(email);return true;
 }).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
}
/** The collective invitation lists the complete panel. */
export function invitationEmail(process:InvitationProcess){
 const guests=invitedExaminers(process);
 if(guests.length!==2)throw new Error('Confira o cadastro dos dois convidados da banca antes de enviar o convite.');
 const subject=`[Portal TCC] Convite para a banca de TCC — ${authorNames(process)}`;
 const text=[
  'Prezados,',
  'Convidamos Vossas Senhorias para participarem da banca de defesa do Trabalho de Conclusão de Curso identificado abaixo.',
  [`Título: ${process.titulo}`,`Autoria: ${authorNames(process)}`,`Data: ${formatDateNumeric(process.defesa.startAt)}`,`Horário: ${formatTime24h(process.defesa.startAt)} às ${formatTime24h(defenseEndAt(process.defesa.startAt))}`,`Local: ${process.defesa.local}`,`Orientador: ${academicName(process.orientador,'abbreviated')}`,...(process.coorientador?[`Coorientador: ${academicName(process.coorientador,'abbreviated')}`]:[])].join('\n'),
  'Avaliadores da banca:\n'+guests.map(person=>academicName(person,'abbreviated')).join('\n')
 ].join('\n\n');
 return {subject,text};
}
