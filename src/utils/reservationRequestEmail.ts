import {isManagedDefenseLocation} from './reservationLocation';
import {emailInstructionBox} from './operationalEmailLayout';
import type {ProcessData} from '../types';
import {academicName} from './personPresentation';
import {formatDateNumeric,formatTime24h} from './formatters';
import {defenseEndAt} from './defenseSchedule';
import {processLink} from './processLink';

const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function spaceDescription(local:string){
 const normalized=local.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(normalized.includes('auditorio'))return {request:'do auditório',subject:'o auditório'};
 if(normalized.includes('sala'))return {request:normalized.includes('reunio')?'da sala de reuniões':'da sala',subject:normalized.includes('reunio')?'a sala de reuniões':'a sala'};
 return {request:'do espaço indicado abaixo',subject:'o espaço solicitado'};
}
export function reservationEmailInstructions():string[]{
 return [
  'Responsável pelo local: aceite ou recuse o agendamento apresentado. O comprovante e a comunicação aos participantes serão gerados automaticamente.',
  'Autores e orientador: aguardem a confirmação automática, que será encaminhada por e-mail.'
 ];
}
/** One room request, one explicit reply instruction and one Portal link. */
export function reservationRequestEmail(input:{process:Pick<ProcessData,'id'|'protocolo'|'titulo'|'aluno1'|'orientador'|'defesa'>&Partial<Pick<ProcessData,'aluno2'>>;baseUrl:string;courseName:string;color?:string;confirmationUrl?:string;audience?:'department'|'participant';advisorApproval?:boolean}):{text:string;html:string}{
 const p=input.process,place=spaceDescription(p.defesa.local),participant=input.audience==='participant';
 const advisor=input.advisorApproval??!isManagedDefenseLocation(p.defesa.local);
 const authority=advisor?'orientador':'departamento';
 const greeting=participant?'Prezados autores e orientador,':advisor?'Prezado orientador,':'Prezado Departamento,';
 const authors=[p.aluno1.nome,p.aluno2?.nome].filter(Boolean).join(' e ');
 const intro=participant?`O cadastro do trabalho foi recebido. O agendamento abaixo aguarda confirmação do ${authority}.`:`Solicitamos a reserva ${place.request} para a realização da defesa do Trabalho de Conclusão de Curso de autoria de ${authors}.`;
 const details=[`Título: ${p.titulo}`,...(participant?[`Autoria: ${authors}`]:[]),`Data: ${formatDateNumeric(p.defesa.startAt)}`,`Horário: ${formatTime24h(p.defesa.startAt)} às ${formatTime24h(defenseEndAt(p.defesa.startAt))} (1 hora e 30 minutos)`,`Local: ${p.defesa.local}`,`Orientador: ${academicName(p.orientador,'abbreviated')}`];
 const observation='';
 const reply=participant?`O ${authority} registrará o aceite ou a recusa. Acompanhem o resultado pelo processo e pelos avisos por e-mail.`:'';
 const steps=participant?[]:[`${advisor?'Orientador':'Departamento'}: confira o local, a data e o horário e aceite ou recuse o agendamento pelos botões acima. O Portal registrará o comprovante e avisará os envolvidos.`];
 const href=input.confirmationUrl||processLink(input.baseUrl,p.id,'cadastral');
 const closing=`Atenciosamente,\nComissão de TCC\n${input.courseName}`;
 const text=[greeting,intro,details.join('\n'),observation,reply,`${p.protocolo}: ${href}`,...(steps.length?['ORIENTAÇÕES DO PROCESSO',...steps]:[]),closing].filter(Boolean).join('\n\n');
 const para=(value:string)=>`<p style="margin:0 0 18px">${escape(value).replaceAll('\n\n','</p><p style="margin:0 0 18px">')}</p>`;
 const color=/^#[a-f0-9]{6}$/i.test(input.color||'')?input.color:'#005b3b';
 const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f2f5f4;color:#243c34;font-family:Arial,sans-serif"><div style="max-width:640px;margin:24px auto;padding:28px;background:#ffffff;border:1px solid #dbe4df;border-radius:10px;font-size:15px;line-height:1.65">${para(greeting)}${para(intro)}<p style="margin:0 0 18px">${details.map(escape).join('<br>')}</p>${observation?emailInstructionBox(para(observation)):''}${para(reply)}<p style="margin:24px 0;text-align:center"><a href="${escape(href)}" style="display:inline-block;padding:12px 20px;border-radius:7px;background:${color};color:#ffffff;font-weight:bold;text-decoration:none">${escape(p.protocolo)}</a></p>${steps.length?'<h2 style="font-size:15px;margin:24px 0 16px">ORIENTAÇÕES DO PROCESSO</h2>'+steps.map(para).join(''):''}<p style="margin:24px 0 0">${escape(closing).replaceAll('\n','<br>')}</p></div></body></html>`;
 return {text,html};
}
