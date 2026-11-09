import type {IntegrationStudioSettings} from '../types/integrationStudio';
/** Public runtime projection: never ship configuration of another form to its participants. */
export function formPresentation(studio:Partial<IntegrationStudioSettings>|undefined,id:string){
 const design=studio?.formDesigns?.[id];
 return design?{templateId:id,introText:design.introText,confirmationMessage:design.confirmationMessage,submitLabel:design.submitLabel,showProgress:design.showProgress}:undefined;
}
