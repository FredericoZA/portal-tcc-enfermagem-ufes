import type {IntegrationStudioSettings} from '../types/integrationStudio';

export const NATIONAL_DOCUMENT_ARMS = '/national-arms.png';

/** UFES communications and forms use the national coat of arms, including migrated course-logo settings. */
export function institutionalDocumentLogo(studio?:Partial<IntegrationStudioSettings>, templateId?:string):string {
  const institution=studio?.brandKit?.institutionName?.trim()||'';
  if(!institution||/\bUFES\b|Universidade Federal do Esp[íi]rito Santo/iu.test(institution))return studio?.brandKit?.universityLogoUrl?.endsWith(NATIONAL_DOCUMENT_ARMS)?studio.brandKit.universityLogoUrl:NATIONAL_DOCUMENT_ARMS;
  return studio?.brandKit?.universityLogoUrl||studio?.emailDesigns?.[templateId||'']?.logoUrl||studio?.brandKit?.courseLogoUrl||'';
}
