import type { IntegrationStudioSettings } from '../../src/types/integrationStudio';
import type { ProcessData } from '../../src/types';
import { buildProcessVariables, mergeWorkflowHtmlVariables, mergeWorkflowVariables, parseRecipients } from './runtime';
import { operationalConfig, presentVariables } from '../../src/utils/operationalConfig';

export function renderReminder(studio:IntegrationStudioSettings,process:ProcessData,templateId:string,stage:string,dueDate:string,answers:Record<string,unknown>={}) {
  const template=studio.emailTemplates.find(item=>item.id===templateId);
  if(!template)throw new Error('O modelo do lembrete não está publicado.');
  if(Array.isArray(template.attachments)&&template.attachments.length)throw new Error('Lembretes não podem anexar documentos privados.');
  const variables=buildProcessVariables({process,eventCode:'DEADLINE_REMINDER',actorEmail:'system@portal.local',actorRoles:[],extraVariables:{...process.registrationAnswers,...answers,DEPARTAMENTO_EMAIL:operationalConfig(studio).reservation.departmentEmail,PRAZO_ETAPA:stage,DATA_LIMITE:dueDate}});
  const to=parseRecipients(String(template.recipient||''),variables);
  if(!to.length||to.length>20)throw new Error('O lembrete precisa ter entre um e vinte destinatários válidos.');
  const rendered=presentVariables(variables,String(template.id),studio);
  const subject=mergeWorkflowVariables(String(template.subject||''),rendered).trim();
  const text=mergeWorkflowVariables(String(template.body||''),rendered).trim();
  if(!subject||!text)throw new Error('Preencha o assunto e o texto do lembrete.');
  return {to,subject,text,html:template.htmlBody?mergeWorkflowHtmlVariables(String(template.htmlBody),rendered):undefined};
}
