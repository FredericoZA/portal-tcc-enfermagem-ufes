import {replaceLegacySalutation} from './legacyTextProcessing';
import {reviewOperationalEmailCopy} from './operationalEmailCopy';
import {academicName} from './personPresentation';
import {processEmailGuidance,emailProcessSection} from './processEmailGuidance';
import type {ProcessData} from '../types';
import {formatDateNumericWithWeekday,formatTime24h} from './formatters';
import {processLink} from './processLink';

type EmailTemplate={id?:unknown;body?:unknown;htmlBody?:unknown;subject?:unknown;[key:string]:unknown};
/** Upgrade known legacy copy while retaining recipients, layout and custom paragraphs. */
export function upgradeOperationalEmailTemplate<T extends EmailTemplate>(template:T):T {
 if(template.operationalCatalogEditable===true)return template;
 let body=String(template.body||''),html=String(template.htmlBody||'');
 const greeting=String(template.id)==='email-reserva'?'Prezado Departamento,':'Prezado(a) <<DESTINATARIO_NOME>>,';
 body=replaceLegacySalutation(body,greeting,false);
 html=replaceLegacySalutation(html,greeting,true);
 if(String(template.id)==='email-convite'){
  const formal=(value:string)=>value.replace(/Convidamos V\.\s*Sa\./gi,'Convidamos Vossas Senhorias').replace(/da defesa de TCC do discente/gi,'da defesa do Trabalho de Conclusão de Curso de autoria de').replace(/do\(s\) discente\(s\)/gi,'de autoria de').replace(/sob orientação de\s*(<<CAMPO_03>>|\{\{ORIENTADOR_NOME\}\}|<<ORIENTADOR_NOME>>)/gi,'sob a orientação de <<ORIENTADOR_NOME_COMPLETO>>');
  body=formal(body).replaceAll('<<ORIENTADOR_TRATAMENTO>>','<<ORIENTADOR_NOME_COMPLETO>>');html=formal(html).replaceAll('<<ORIENTADOR_TRATAMENTO>>','<<ORIENTADOR_NOME_COMPLETO>>');
 }
 if(String(template.id)==='email-reserva'){
  const clarifySpace=(text:string)=>text.replace(/Solicitamos (?:a )?reserva (?:de local )?para a defesa/gi,'Solicitamos a reserva de sala ou auditório para a defesa');
  body=clarifySpace(body);html=clarifySpace(html);
  // Remove only the two exact paragraphs injected by the old automatic upgrade.
  const legacy='Cabe ao departamento apenas confirmar, por resposta a este e-mail, a disponibilidade do local, da data e do horário solicitados. Não é necessário registrar informações no Portal.\n\nAos autores, que recebem esta mensagem em cópia: após a resposta do departamento, acessem <<LINK_PROCESSO>>, entrem com o e-mail cadastrado e o código recebido, abram Meus TCCs e Dados do processo. Selecionem o local autorizado, anexem a resposta em PDF de até 1 MB, marquem o recebimento da confirmação e cliquem em Confirmar local e enviar convite. Apenas um autor precisa realizar esta etapa pela dupla.';
  body=body.replace(legacy,'').trim();html=html.replace('<p>'+legacy.replaceAll('\n\n','</p><p>')+'</p>','').trim();
  const replyRequest='Por favor, respondam a este e-mail indicando expressamente qual dos locais foi reservado e confirmando a data e o horário solicitados. Caso nenhum dos locais esteja disponível, informem a indisponibilidade.';
  const update=(text:string)=>text.replace(/Por favor, confirmem o agendamento ao aluno: (?:<<ALUNO_1_EMAIL>>|\{\{ALUNO_1_EMAIL\}\})\./g,replyRequest).replace('Por favor, respondam a este e-mail informando se o local, a data e o horário estão disponíveis. Os autores recebem esta solicitação em cópia.',replyRequest);
  body=update(body);html=update(html);
  body=body.replace(/\n*Observação: os autores recebem esta solicitação em cópia\./g,'');
  html=html.replace(/<p[^>]*>Observação: os autores recebem esta solicitação em cópia\.<\/p>/g,'');
 }
 body=body.replace(/PDF de até 1 MB/g,'PDF');html=html.replace(/PDF de até 1 MB/g,'PDF');
 body=body.replace(/Local prefer(?:ido|encial):/gi,'Local:');html=html.replace(/Local prefer(?:ido|encial):/gi,'Local:');
 if(html&&!html.includes('ORIENTACOES_ACESSO'))html+='<p><<ORIENTACOES_ACESSO>></p>';
 if(!body.includes('ORIENTACOES_ACESSO')){
  const closing=body.search(/\n\s*Atenciosamente/i);
  body=closing<0?`${body}\n\n<<ORIENTACOES_ACESSO>>`:`${body.slice(0,closing)}\n\n<<ORIENTACOES_ACESSO>>\n${body.slice(closing)}`;

 }
 body=reviewOperationalEmailCopy(body,String(template.id||''));html=reviewOperationalEmailCopy(html,String(template.id||''));
 return {...template,attachments:[],attachmentModes:{},subject:String(template.subject||'').replace(/Convite para (?:Banca|Comissão) Examinadora/gi,'Convite para a banca de TCC'),body,...(html?{htmlBody:html}:{})};
}

export function recipientEmailVariables(p:ProcessData,recipient:string,variables:Record<string,string>,baseUrl:string,eventCode='',templateId=''):Record<string,string>{
 const email=recipient.trim().toLowerCase();
 const students=[p.aluno1,p.aluno2].filter(Boolean);
 const student=students.find(person=>person!.email.toLowerCase()===email);
 const advisor=p.orientador.email.toLowerCase()===email;
 const person=student||(advisor?p.orientador:null)||p.coorientador&&p.coorientador.email.toLowerCase()===email&&p.coorientador||p.banca.find(member=>member.email.toLowerCase()===email);
 const link=baseUrl?processLink(baseUrl,p.id,emailProcessSection(eventCode,templateId,advisor)):'';
 const date=`${formatDateNumericWithWeekday(p.defesa.startAt)} às ${formatTime24h(p.defesa.startAt)}`;
 return {...variables,DESTINATARIO_NOME:person?person.nome:'representante da instituição',DESTINATARIO_EMAIL:recipient,ORIENTADOR_TRATAMENTO:p.orientador.tratamento||'',ORIENTADOR_NOME_COMPLETO:academicName(p.orientador,'abbreviated'),DEFESA_DATA_HORA:date,CAMPO_04:date,DEFESA_LOCAL:p.defesa.local,CAMPO_07_LOCAL:p.defesa.local,LINK_PORTAL:link,LINK_PROCESSO:link,ORIENTACOES_ACESSO:processEmailGuidance(p,baseUrl,eventCode,templateId,recipient)};
}
