import {registrationFirst} from './workflowStageOrder';
import type { IntegrationStudioSettings } from '../types/integrationStudio';
import type { RegistrationQuestion } from '../types/operationalConfig';

/** These steps are edited directly in the process, not submitted as separate forms. */
export const RETIRED_PROCESS_FORM_IDS = new Set(['form-banca-orientador', 'form-parecer-banca', 'form-homologacao-coordenador']);
const sections:Record<string,string>={'form-banca-orientador':'location','form-parecer-banca':'evaluation','form-homologacao-coordenador':'repository'};
export function consolidateProcessForms<T extends Partial<IntegrationStudioSettings>>(source:T):T {
 const value=structuredClone(source);
 const schemas={...(value.processFieldSchemas||{})};
 for(const form of value.formTemplates||[]){
  const section=sections[String(form.id)];
  if(section&&Array.isArray(form.questions)&&!schemas[section])schemas[section]=form.questions as RegistrationQuestion[];
 }
 if(Object.keys(schemas).length)value.processFieldSchemas=schemas;
 if(value.formTemplates)value.formTemplates=value.formTemplates.filter(form=>!RETIRED_PROCESS_FORM_IDS.has(String(form.id))).map(form=>form.id==='form-reserva-aluno'?{...form,title:String(form.title||'Cadastro inicial do TCC').replace(/^Formulário\s+1\s*:\s*/i,'')}:form);
 if(value.workflowStages)value.workflowStages=value.workflowStages.map(stage=>({...stage,actions:Array.isArray(stage.actions)?stage.actions.filter((action:any)=>!(['FORM','FORMULARIO'].includes(String(action.type||'').toUpperCase())&&RETIRED_PROCESS_FORM_IDS.has(String(action.refId||action.referenceId)))):stage.actions}));
 if(value.workflowStages)value.workflowStages=registrationFirst(value.workflowStages);
 if(value.formDesigns)value.formDesigns=Object.fromEntries(Object.entries(value.formDesigns).filter(([id])=>!RETIRED_PROCESS_FORM_IDS.has(id)).map(([id,design])=>[id,{...design,universityLogoUrl:'',bannerImageUrl:''}]));
 return value;
}
