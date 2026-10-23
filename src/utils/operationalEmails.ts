import {processEmailGuidance,emailProcessSection} from './processEmailGuidance';
import type {ProcessData} from '../types';
import {formatDateNumeric,formatTime24h} from './formatters';
import {processLink} from './processLink';

type EmailTemplate={id?:unknown;body?:unknown;htmlBody?:unknown;subject?:unknown;[key:string]:unknown};
/** Upgrade known legacy copy while retaining recipients, layout and custom paragraphs. */
export function upgradeOperationalEmailTemplate<T extends EmailTemplate>(template:T):T {
 let body=String(template.body||''),html=String(template.htmlBody||'');
 const salutation=/(Prezad[oa](?:\(a\))?)[^\n]*?,/i;
 body=body.replace(salutation,'Prezado(a) <<DESTINATARIO_NOME>>,');
 html=html.replace(/(Prezad[oa](?:\(a\))?)(?:(?!<\/p|<br)[\s\S])*?,/i,'Prezado(a) <<DESTINATARIO_NOME>>,');
 if(String(template.id)==='email-convite'){
  const formal=(value:string)=>value.replace(/Convidamos V\.\s*Sa\./gi,'Convidamos Vossas Senhorias').replace(/da defesa de TCC do discente/gi,'da defesa do Trabalho de Conclusão de Curso de autoria de').replace(/do\(s\) discente\(s\)/gi,'de autoria de').replace(/sob orientação de\s*(<<CAMPO_03>>|\{\{ORIENTADOR_NOME\}\}|<<ORIENTADOR_NOME>>)/gi,'sob a orientação de <<ORIENTADOR_TRATAMENTO>>');
  body=formal(body);html=formal(html);
 }
 if(String(template.id)==='email-reserva'&&!body.includes('Cabe ao departamento')){
  const guidance='Cabe ao departamento apenas confirmar, por resposta a este e-mail, a disponibilidade do local, da data e do horário solicitados. Não é necessário registrar informações no Portal.\n\nAos autores, que recebem esta mensagem em cópia: após a resposta do departamento, acessem <<LINK_PROCESSO>>, entrem com o e-mail cadastrado e o código recebido, abram Meus TCCs e Dados do processo. Selecionem o local autorizado, anexem a resposta em PDF de até 1 MB, marquem o recebimento da confirmação e cliquem em Confirmar local e enviar convite. Apenas um autor precisa realizar esta etapa pela dupla.';
  body+='\n\n'+guidance;if(html)html+='<p>'+guidance.replaceAll('\n\n','</p><p>')+'</p>';
 }
 if(html&&!html.includes('ORIENTACOES_ACESSO'))html+='<p><<ORIENTACOES_ACESSO>></p>';
 if(!body.includes('ORIENTACOES_ACESSO')){
  const closing=body.search(/\n\s*Atenciosamente/i);
  body=closing<0?`${body}\n\n<<ORIENTACOES_ACESSO>>`:`${body.slice(0,closing)}\n\n<<ORIENTACOES_ACESSO>>\n${body.slice(closing)}`;

 }
 return {...template,attachments:[],attachmentModes:{},subject:String(template.subject||'').replace('Convite para Banca Examinadora','Convite para Comissão Examinadora'),body,...(html?{htmlBody:html}:{})};
}

export function recipientEmailVariables(p:ProcessData,recipient:string,variables:Record<string,string>,baseUrl:string,eventCode='',templateId=''):Record<string,string>{
 const email=recipient.trim().toLowerCase();
 const students=[p.aluno1,p.aluno2].filter(Boolean);
 const student=students.find(person=>person!.email.toLowerCase()===email);
 const advisor=p.orientador.email.toLowerCase()===email;
 const person=student||(advisor?p.orientador:null)||p.coorientador&&p.coorientador.email.toLowerCase()===email&&p.coorientador||p.banca.find(member=>member.email.toLowerCase()===email);
 const link=baseUrl?processLink(baseUrl,p.id,emailProcessSection(eventCode,templateId,advisor)):'';
 const date=`${formatDateNumeric(p.defesa.startAt)} às ${formatTime24h(p.defesa.startAt)}`;
 return {...variables,DESTINATARIO_NOME:person?person.nome:'representante da instituição',DESTINATARIO_EMAIL:recipient,ORIENTADOR_TRATAMENTO:variables.ORIENTADOR_NOME===undefined?'':/^prof/i.test(p.orientador.nome)?p.orientador.nome:p.orientador.nome,DEFESA_DATA_HORA:date,CAMPO_04:date,DEFESA_LOCAL:p.defesa.local,CAMPO_07_LOCAL:p.defesa.local,LINK_PORTAL:link,LINK_PROCESSO:link,ORIENTACOES_ACESSO:processEmailGuidance(p,baseUrl,eventCode,templateId,recipient)};
}
