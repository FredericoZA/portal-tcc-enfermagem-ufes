import type {IntegrationStudioSettings} from '../types/integrationStudio';

export const UFES_DOCUMENT_CREST = '/ufes-crest.png';

/** Documents use the university's identity; the course emblem remains in app navigation. */
export function institutionalDocumentLogo(studio?:Partial<IntegrationStudioSettings>, templateId?:string):string {
  const institution=studio?.brandKit?.institutionName?.trim()||'';
  if(!institution||/\bUFES\b|Universidade Federal do Esp[íi]rito Santo/iu.test(institution))return studio?.brandKit?.universityLogoUrl?.endsWith(UFES_DOCUMENT_CREST)?studio.brandKit.universityLogoUrl:UFES_DOCUMENT_CREST;
  return studio?.brandKit?.universityLogoUrl||studio?.emailDesigns?.[templateId||'']?.logoUrl||studio?.brandKit?.courseLogoUrl||'';
}
