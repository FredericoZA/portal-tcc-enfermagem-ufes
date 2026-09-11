import type { IntegrationStudioSettings } from '../types/integrationStudio';
import { registrationQuestions, operationalConfig } from './operationalConfig';
/** Upgrade the editable draft only; the Master publishes the resulting revision. */
export function upgradeStudioDraft(source: Partial<IntegrationStudioSettings>): Partial<IntegrationStudioSettings> {
  const value = structuredClone(source);
  if (!value.workflowStages?.length) return value;
  const stages = value.workflowStages as any[];
  const declarationIds = new Set((value.docTemplates || []).filter(d => String(d.type||'').toUpperCase()==='DECLARACAO').map(d=>d.id));
  const moved: any[] = [];
  for (const stage of stages) if (stage.triggerEvent !== 'PUBLICATION_CLEARED') stage.actions=(stage.actions||[]).filter((action:any)=>{if(declarationIds.has(action.refId||action.referenceId)){moved.push(action);return false;}return true;});
  if (moved.length) {
    let cleared=stages.find(s=>s.triggerEvent==='PUBLICATION_CLEARED');
    if(!cleared){cleared={id:'stage-publication-cleared',title:'Declaração após as assinaturas anteriores',triggerEvent:'PUBLICATION_CLEARED',description:'A Ata e o Termo aplicável retornaram assinados e foram arquivados.',actions:[]};const finalIndex=stages.findIndex(s=>s.triggerEvent==='PROCESS_COMPLETED');stages.splice(finalIndex<0?stages.length:finalIndex,0,cleared);}
    cleared.actions.push(...moved);
  }
  value.emailTemplates ||= [];
  let reservation=value.emailTemplates.find(e=>String(e.recipient).includes('DEPARTAMENTO_EMAIL'));
  if(!reservation){reservation={id:'email-reserva',name:'Solicitação de reserva ao departamento',recipient:'{{DEPARTAMENTO_EMAIL}}',subject:'[TCC {{PROTOCOLO}}] Solicitação de reserva',body:'Prezados,\n\nSolicitamos a reserva de {{DEFESA_LOCAL}} para {{CAMPO_01}}, em {{DEFESA_DATA_HORA}}.\nTítulo: {{TITULO}}.\nSe o local não estiver disponível, solicitamos {{LOCAL_ALTERNATIVO}}.\nPor favor, confirmem ao aluno em {{ALUNO_1_EMAIL}}.\n\nAtenciosamente, Secretaria do curso',attachments:[]};value.emailTemplates.push(reservation);}
  let initial=stages.find(s=>s.triggerEvent==='TCC_CREATED');
  if(!initial){initial={id:'stage-registration',title:'Cadastro e pedido de reserva',triggerEvent:'TCC_CREATED',actions:[]};stages.unshift(initial);}
  initial.actions=(initial.actions||[]).filter((a:any)=>!(a.type==='email'&&a.refId==='email-confirmacao'));
  if(!initial.actions.some((a:any)=>a.refId===reservation!.id))initial.actions.unshift({id:'action-reservation-request',type:'email',refId:reservation.id,title:'Solicitar reserva ao departamento'});
  stages.forEach((s,i)=>s.stageNumber=i+1);
  value.operationalConfig=operationalConfig(value);
  value.formTemplates ||= [];
  const questions=registrationQuestions(value).map(q=>({...q,expectedAnswer:q.helpText||''}));
  const registration=value.formTemplates.find(f=>f.id==='form-reserva-aluno');
  if(registration)registration.questions=questions;
  else value.formTemplates.unshift({id:'form-reserva-aluno',title:'Cadastro inicial do TCC',targetRole:'Aluno',questions});
  return value;
}
