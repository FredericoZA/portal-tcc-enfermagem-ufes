import {registrationFirst} from './workflowStageOrder';
import type {IntegrationStudioSettings} from '../types/integrationStudio';
import type {ProcessData} from '../types';
import type {SignatureJob} from '../types/signatures';

export const REPOSITORY_DELIVERY_EMAIL_ID='email-entrega-repositorio';
export const REPOSITORY_DELIVERY_READY='ENTREGA_FINAL_LIBERADA';
export function repositoryDeliveryEmailKey(process:Pick<ProcessData,'id'|'dataRevision'>,recipient:string):string{return `repository-delivery:${process.id}:${process.dataRevision}:${recipient.trim().toLowerCase()}`;}
export function repositoryDeliveryReady(process:ProcessData,jobs:SignatureJob[]):boolean{
 return process.etapaAtual==='REPOSITORIO'&&!process.acervo?.submittedAt&&jobs.some(job=>job.processId===process.id&&job.documentType==='ATA'&&job.status==='ARCHIVED'&&job.sourceDataRevision===process.dataRevision);
}

/** Preserve editable templates and add the missing post-ata notification once. */
export function withRepositoryDeliveryEmail(source:IntegrationStudioSettings):IntegrationStudioSettings{
 const studio:IntegrationStudioSettings={...source,emailTemplates:[...(source.emailTemplates||[])],workflowStages:(source.workflowStages||[]).map(stage=>({...stage,actions:[...((stage.actions||[]) as Record<string,unknown>[])]}))};
 if(!studio.emailTemplates.some(template=>template.id===REPOSITORY_DELIVERY_EMAIL_ID))studio.emailTemplates.push({
  id:REPOSITORY_DELIVERY_EMAIL_ID,name:'Orientações para entrega no Repositório após assinatura da ata',
  recipient:'{{ALUNO_1_EMAIL}}, {{ALUNO_2_EMAIL}}, {{ORIENTADOR_EMAIL}}',
  subject:'[Portal TCC] Ata assinada — entrega final no Repositório · <<PROTOCOLO>>',
  body:'Prezado(a) <<DESTINATARIO_NOME>>,\n\nA ata da defesa do TCC <<PROTOCOLO>> foi assinada e arquivada. Após concluir os ajustes ou melhorias eventualmente solicitados pela orientação e pela banca, faça a entrega da versão final no Portal. Caso não tenham sido solicitadas alterações, utilize a versão final apresentada.\n\n<<ORIENTACOES_ACESSO>>\n\nO orientador recebe esta mensagem para ciência e acompanhamento.\n\nAtenciosamente,\nComissão de TCC',
  htmlBody:'<p>Prezado(a) <<DESTINATARIO_NOME>>,</p><p>A ata da defesa do TCC <<PROTOCOLO>> foi assinada e arquivada. Após concluir os ajustes ou melhorias eventualmente solicitados pela orientação e pela banca, faça a entrega da versão final no Portal. Caso não tenham sido solicitadas alterações, utilize a versão final apresentada.</p><p><<ORIENTACOES_ACESSO>></p><p><a href="<<LINK_PROCESSO>>" style="display:inline-block;padding:12px 20px;background:#005b3b;color:#ffffff;border-radius:8px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold">Acessar entrega no Repositório</a></p><p>O orientador recebe esta mensagem para ciência e acompanhamento.</p><p>Atenciosamente,<br>Comissão de TCC</p>',attachments:[],attachmentModes:{}
 });
 if(!studio.workflowStages.some(stage=>(stage.actions as Record<string,unknown>[]).some(action=>action.refId===REPOSITORY_DELIVERY_EMAIL_ID||action.referenceId===REPOSITORY_DELIVERY_EMAIL_ID))){
  const action={id:'action-repository-delivery-guidance',type:'email',refId:REPOSITORY_DELIVERY_EMAIL_ID,title:'Orientar autores e orientador sobre a entrega final',condition:{fieldKey:REPOSITORY_DELIVERY_READY,operator:'IS_TRUE'}};
  const stage=studio.workflowStages.find(stage=>stage.triggerEvent==='SIGNATURE_COMPLETED');
  if(stage)(stage.actions as Record<string,unknown>[]).push(action);
  else{const index=studio.workflowStages.findIndex(stage=>stage.triggerEvent==='REPOSITORY_SUBMITTED');studio.workflowStages.splice(index<0?studio.workflowStages.length:index,0,{id:'stage-repository-delivery-guidance',title:'Ata assinada e orientações para entrega final',triggerEvent:'SIGNATURE_COMPLETED',description:'Após arquivar a ata assinada, orientar os autores e dar ciência ao orientador.',actions:[action]});}
 }
 studio.workflowStages=registrationFirst(studio.workflowStages);
 return studio;
}
