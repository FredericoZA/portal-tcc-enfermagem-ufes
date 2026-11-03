import {apiClient} from './apiClient';
import {normalizeStudioSettings} from './integrationStudioService';
import {mergeStudioDraft} from '../utils/studioDraftMerge';
import {retryAfterPortalReauthentication} from './reauthentication';
import type {IntegrationStudioSettings} from '../types/integrationStudio';

// The queue also drains after a settings popup unmounts.
let queue:Promise<unknown>=Promise.resolve();
export function saveStudioAutomatically(base:Partial<IntegrationStudioSettings>,draft:IntegrationStudioSettings):Promise<IntegrationStudioSettings>{
 const save=async()=>{
  const settings=await apiClient.getSettings();
  const remote=normalizeStudioSettings(settings.integrationStudioDraft||settings.integrationStudio);
  const snapshot=mergeStudioDraft(base as IntegrationStudioSettings,draft,remote as IntegrationStudioSettings);
  snapshot.revision=Number(remote.revision||0)+1;snapshot.savedAt=new Date().toISOString();
  const result=await retryAfterPortalReauthentication(()=>apiClient.updateSettings({integrationStudio:snapshot,studioExpectedRevision:Number(remote.revision||0),studioSaveMode:'autosave'}),'Confirme seu acesso para concluir o salvamento automático. Suas alterações serão mantidas.');
  return (result.integrationStudioDraft||result.integrationStudio||snapshot) as IntegrationStudioSettings;
 };
 const pending=queue.then(save,save);queue=pending.catch(()=>{});return pending;
}
