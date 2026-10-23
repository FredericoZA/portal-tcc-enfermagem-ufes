import type {IntegrationStudioSettings} from '../types/integrationStudio';
import {registrationFirst} from './workflowStageOrder';

/** The declaration is required even when publication was declined. */
export function withDeclarationAfterTerm(source:IntegrationStudioSettings):IntegrationStudioSettings{
 const declaration=(source.docTemplates||[]).find(template=>String(template.type||'').toUpperCase()==='DECLARACAO');
 if(!declaration)return source;
 const stages:Array<Record<string,unknown>&{actions:Record<string,unknown>[];triggerEvent?:unknown;stageNumber?:number}>=source.workflowStages.map(stage=>({...stage,actions:[...((stage.actions||[]) as Record<string,unknown>[])]}));
 let selected:Record<string,unknown>|undefined;
 for(const stage of stages)stage.actions=stage.actions.filter(action=>{
  if((action.refId||action.referenceId)!==declaration.id)return true;
  selected ||= action;return false;
 });
 let cleared=stages.find(stage=>stage.triggerEvent==='PUBLICATION_CLEARED');
 if(!cleared){cleared={id:'stage-publication-cleared',title:'Declaração após as assinaturas anteriores',triggerEvent:'PUBLICATION_CLEARED',actions:[]};const last=stages.findIndex(stage=>stage.triggerEvent==='PROCESS_COMPLETED');stages.splice(last<0?stages.length:last,0,cleared);}
 // Readiness is checked by the server against the signed ATA and applicable TERMO.
 // It cannot depend on whether either file was selected for public disclosure.
 const action={...(selected||{}),id:String(selected?.id||'action-final-declaration'),type:'doc',refId:declaration.id,title:String(selected?.title||'Gerar declaração e solicitar assinatura da presidência')};
 delete (action as Record<string,unknown>).condition;
 cleared.actions.push(action);
 return {...source,workflowStages:registrationFirst(stages)};
}
