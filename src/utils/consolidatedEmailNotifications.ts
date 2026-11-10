import type {IntegrationStudioSettings} from '../types/integrationStudio';
import type {ProcessData} from '../types';
import {REPOSITORY_DELIVERY_EMAIL_ID} from './repositoryDeliveryEmail';
export const FINAL_PROCESS_EMAIL_ID='email-conclusao';
const email=(action:Record<string,unknown>)=>String(action.type||action.kind||'').toLowerCase()==='email';
const reference=(action:Record<string,unknown>)=>String(action.refId||action.referenceId||'');
const event=(stage:Record<string,unknown>)=>String(stage.triggerEvent||stage.eventCode||'').toUpperCase();
/** Keep actionable milestones; replace redundant signature receipts with one final notice. */
export function withConsolidatedEmailNotifications(source:IntegrationStudioSettings,options:{ensureFinalStage?:boolean}={}):IntegrationStudioSettings{
 const stages:Array<Record<string,unknown>&{actions:Record<string,unknown>[]}>= (source.workflowStages||[]).map(stage=>({...stage,actions:(Array.isArray(stage.actions)?stage.actions:[]).filter(action=>{
  if(!email(action))return true;
  if(['email-instrucoes-cadastro','email-confirmacao','email-assinatura-declaracao','email-assinatura-ata'].includes(reference(action)))return false;
  if(event(stage)==='SIGNATURE_COMPLETED')return reference(action)===REPOSITORY_DELIVERY_EMAIL_ID;
  if(event(stage)==='PROCESS_COMPLETED')return false;
  return ![FINAL_PROCESS_EMAIL_ID,'email-assinatura-registrada'].includes(reference(action));
 })}));
 let final=stages.find(stage=>event(stage)==='PROCESS_COMPLETED');
 if(!final&&options.ensureFinalStage!==false){final={id:'stage-completed-notice',title:'Documentos finais disponíveis',stageNumber:stages.length+1,triggerEvent:'PROCESS_COMPLETED',actions:[]};stages.push(final);}
 const notifyFinal=Boolean(final&&!(Array.isArray(final.hiddenCatalogItems)&&final.hiddenCatalogItems.includes('email:email-conclusao')));
 if(notifyFinal)final!.actions.push({id:'action-completed-notice',type:'email',refId:FINAL_PROCESS_EMAIL_ID,title:'Avisar os participantes sobre as assinaturas e documentos finais'});
 const templates=[...(source.emailTemplates||[])];
 if(notifyFinal&&!templates.some(template=>template.id===FINAL_PROCESS_EMAIL_ID))templates.push({id:FINAL_PROCESS_EMAIL_ID,name:'Assinaturas concluídas e documentos disponíveis',recipient:'{{PARTICIPANTES_EMAILS}}',subject:'[Portal TCC] Assinaturas concluídas e documentos disponíveis · <<PROTOCOLO>>',body:'Olá, <<DESTINATARIO_NOME>>.\n\nAs assinaturas foram concluídas. Consulte os documentos no processo do TCC.\n\n<<ORIENTACOES_ACESSO>>',attachments:[],attachmentModes:{}});
 return {...source,emailTemplates:templates,workflowStages:stages};
}
export function finalProcessEmailKey(process:Pick<ProcessData,'id'|'dataRevision'>){return `process-completed:${process.id}:${process.dataRevision}`;}
export function isConsolidatedEmailNotice(eventCode='',templateId=''){
 return ['email-assinatura-registrada','email-instrucoes-cadastro','email-confirmacao','email-assinatura-declaracao','email-assinatura-ata'].includes(templateId)||eventCode.toUpperCase()==='SIGNATURE_COMPLETED'&&templateId!==REPOSITORY_DELIVERY_EMAIL_ID;
}

/** No publication choice means no authorization-term notification. */
export function processEmailApplicable(process:Pick<ProcessData,'acervo'>,templateId=''):boolean{
 return templateId!=='email-assinatura-termo'||Boolean(process.acervo?.publishFullWork||process.acervo?.publishExpandedAbstract);
}
export function withApplicableProcessEmails(studio:IntegrationStudioSettings,process:Pick<ProcessData,'acervo'>):IntegrationStudioSettings{
 return {...studio,workflowStages:studio.workflowStages.map(stage=>({...stage,actions:(stage.actions as Record<string,unknown>[]).filter(action=>!email(action)||processEmailApplicable(process,reference(action)))}))};
}
