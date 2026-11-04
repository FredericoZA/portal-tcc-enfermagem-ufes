import {operationalEmailVariant,OPERATIONAL_EMAIL_CATALOG} from './studioOperationalCatalog';
import {academicName} from './personPresentation';
import {formatDateNumericWithWeekday,formatTime24h} from './formatters';
import {defenseEndAt} from './defenseSchedule';
import {applyProcessEmailGreeting} from './processEmailGreeting';
import {invitationEmail} from './invitationEmail';
import {reviewOperationalEmailCopy} from './operationalEmailCopy';
import type {ProcessData} from '../types';
import type {IntegrationStudioSettings} from '../types/integrationStudio';
import {processLink} from './processLink';
import {processEmailGuidance,emailProcessSection} from './processEmailGuidance';
import {reservationRequestEmail} from './reservationRequestEmail';
import {finalDocumentsEmail,isFinalDocumentsEmail} from './finalDocumentsEmail';
import {operationalEmailLayout} from './operationalEmailLayout';

export function withoutGenericProcessFooter(text:string){return text.replace(/^Acompanhe as etapas e os documentos no processo do TCC, pelo Portal\.[ \t]*$/gm,'').replace(/\n{3,}/g,'\n\n').trim();}

/** Shared by tracked delivery and the review gallery, using sample or real process data. */
export function processEmailMessage(input:{process:ProcessData;recipient:string;subject:string;text:string;templateId?:string;eventCode?:string;baseUrl:string;courseName:string;studio?:Partial<IntegrationStudioSettings>;templateVariables?:Record<string,string>;departmentUrl?:string;advisorApproval?:boolean}){
 const p=input.process;
 let text=reviewOperationalEmailCopy(input.text,input.templateId),subject=input.subject;
 let href=processLink(input.baseUrl,p.id,emailProcessSection(input.eventCode||'',input.templateId||'')),label=p.protocolo;
 if(input.templateId==='email-reserva'){
  href=input.departmentUrl||href;label=input.departmentUrl?`Confirmar reserva · ${p.protocolo}`:p.protocolo;
  text=reservationRequestEmail({process:p,baseUrl:input.baseUrl,courseName:input.courseName,confirmationUrl:href,audience:input.departmentUrl?'department':'participant',advisorApproval:input.advisorApproval}).text;
 }else if(input.templateId==='email-convite'){
  const invitation=invitationEmail(p);subject=invitation.subject;text=invitation.text+'\n\n'+processEmailGuidance(p,input.baseUrl,input.eventCode||'INVITATION_SENT','email-convite',input.recipient);
 }else if(isFinalDocumentsEmail(input.eventCode,input.templateId)){
  const final=finalDocumentsEmail({process:p,recipient:input.recipient,baseUrl:input.baseUrl,courseName:input.courseName});text=final.text;subject=final.subject;
 }else if(input.templateId==='email-comprovante-reserva'){
  href=`${input.baseUrl.replace(/\/$/,'')}/api/public/processes/${encodeURIComponent(p.protocolo)}/reservation-receipt`;
  const response=p.defesa.departmentResponse,confirmed=response?.decision==='CONFIRMED';
  label=confirmed?`Comprovante de reserva · ${p.protocolo}`:`Comprovante de indisponibilidade · ${p.protocolo}`;
  if(response){
   subject=`[${p.protocolo}] ${confirmed?'Reserva confirmada':'Agendamento recusado'}`;
   const registered=`${formatDateNumericWithWeekday(response.respondedAt)}, ${formatTime24h(response.respondedAt)}`;
   text=['Prezados departamento, autores e orientador,',confirmed?'O departamento confirmou a reserva para a defesa do TCC.':'O responsável recusou o agendamento solicitado.',[confirmed?`Resultado: reserva confirmada.\nLocal: ${response.local||p.defesa.local}`:`Resultado: reserva recusada.\nLocal solicitado: ${p.defesa.local}`,`Data: ${formatDateNumericWithWeekday(response.startAt)}\nHorário: ${formatTime24h(response.startAt)} às ${formatTime24h(response.endAt||defenseEndAt(response.startAt))}`,`Resposta registrada em ${registered}.`].join('\n'),...(confirmed?[processEmailGuidance(p,input.baseUrl,'LOCATION_CONFIRMED','email-confirmacao',input.recipient)]:['ORIENTAÇÕES DO PROCESSO','Autores: abram Dados do processo e cliquem em Refazer reserva. Combinem a disponibilidade do local com o responsável antes de reenviar, para evitar retrabalho.'])].join('\n\n');
  }
 }else{
  text=text.split('ORIENTAÇÕES DO PROCESSO')[0].replace(/\n[ \t]*(Local alternativo:)/gi,'\n\n$1').trim()+'\n\n'+processEmailGuidance(p,input.baseUrl,input.eventCode||'',input.templateId||'',input.recipient);
 }
 const variant=operationalEmailVariant(input.templateId,Boolean(input.departmentUrl),p.defesa.departmentResponse?.decision==='UNAVAILABLE');
 const configured=input.studio?.emailTemplates?.find(item=>item.id===variant);
 const stock=OPERATIONAL_EMAIL_CATALOG.find(item=>item[0]===variant);
 // Existing operational messages stay intact; explicit edits to a catalog variant take effect.
 const values:Record<string,string>={...input.templateVariables,PROTOCOLO:p.protocolo,TITULO:p.titulo,ALUNO_1_NOME:p.aluno1.nome,ALUNO_2_NOME:p.aluno2?.nome||'',COORIENTADOR_NOME_COMPLETO:p.coorientador?academicName(p.coorientador,'abbreviated'):'',BANCA_NOMES:p.banca.map(person=>academicName(person,'abbreviated')).join('\n'),DEFESA_HORA:formatTime24h(p.defesa.startAt),DEFESA_DATA:formatDateNumericWithWeekday(p.defesa.startAt),DEFESA_HORARIO:formatTime24h(p.defesa.startAt)+' às '+formatTime24h(defenseEndAt(p.defesa.startAt)),RESPOSTA_REGISTRADA_EM:p.defesa.departmentResponse?formatDateNumericWithWeekday(p.defesa.departmentResponse.respondedAt)+', '+formatTime24h(p.defesa.departmentResponse.respondedAt):'',ALUNOS:[p.aluno1.nome,p.aluno2?.nome].filter(Boolean).join(' e '),ORIENTADOR_NOME_COMPLETO:academicName(p.orientador,'abbreviated'),DEFESA_LOCAL:p.defesa.local,LOCAL_ALTERNATIVO:p.defesa.alternateLocation||'',DEFESA_DATA_HORA:formatDateNumericWithWeekday(p.defesa.startAt)+' às '+formatTime24h(p.defesa.startAt),LINK_PROCESSO:href,ORIENTACOES_ACESSO:processEmailGuidance(p,input.baseUrl,input.eventCode||'',input.templateId||'',input.recipient)};
 const expand=(source:string)=>source.replace(/<<([A-Z0-9_]+)>>|\{\{([A-Z0-9_]+)\}\}/g,(all,a,b)=>values[a||b]??all);
 if(configured&&configured.operationalCatalogEditable===true){
  if((!stock||configured.body!==stock[4])&&!(input.templateId==='email-reserva'&&/LOCAL_ALTERNATIVO|local alternativo/i.test(String(configured.body)))){text=expand(String(configured.body||''));if(!text.includes('ORIENTAÇÕES DO PROCESSO'))text+='\n\n'+values.ORIENTACOES_ACESSO;}
  if(!stock||configured.subject!==stock[3])subject=expand(String(configured.subject||''));
 }
 text=expand(text);subject=expand(subject);
 text=text.replace(/^Local alternativo:.*$/gmi,'').replace(/^Coorientador:[ \t]*$/gmi,'');

 text=withoutGenericProcessFooter(input.templateId==='email-comprovante-reserva'?text:applyProcessEmailGreeting(text,input.templateId,input.eventCode,Boolean(input.departmentUrl)));
 if(input.advisorApproval&&['email-reserva','email-comprovante-reserva'].includes(input.templateId||''))text=text.replace('Prezado Departamento,','Prezado orientador,').replace(/departamento/gi,'orientador');
 const actions=input.templateId==='email-reserva'&&input.departmentUrl?[{href:href+'?decision=accept',label:'Aceitar reserva'},{href:href+'?decision=decline',label:'Recusar reserva'}]:input.templateId==='email-comprovante-reserva'&&p.defesa.departmentResponse?.decision==='UNAVAILABLE'?[{href,label},{href:processLink(input.baseUrl,p.id,'cadastral'),label:'Refazer reserva'}]:undefined;
 const message=operationalEmailLayout({text,subject,href,label,studio:input.studio,templateId:variant,actions});
 if(actions&&input.templateId==='email-reserva')message.text=message.text.replace(`${label}: ${href}`,actions.map(action=>`${action.label}: ${action.href}`).join('\n'));
 if(actions&&input.templateId==='email-comprovante-reserva')message.text+='\n\nRefazer reserva: '+processLink(input.baseUrl,p.id,'cadastral');
 return {subject,...message,bodyText:text};
}
