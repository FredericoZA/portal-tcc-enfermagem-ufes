import {apiClient} from './apiClient';
import {normalizeStudioSettings} from './integrationStudioService';
import {mergeStudioDraft} from '../utils/studioDraftMerge';
import {retryAfterPortalReauthentication} from './reauthentication';
import type {IntegrationStudioSettings} from '../types/integrationStudio';

// The queue also drains after a settings popup unmounts.
let queue:Promise<unknown>=Promise.resolve();
export function queueStudioOperation<T>(operation:()=>Promise<T>):Promise<T>{const pending=queue.then(operation,operation);queue=pending.catch(()=>{});return pending;}
export function saveStudioAutomatically(base:Partial<IntegrationStudioSettings>,draft:IntegrationStudioSettings):Promise<IntegrationStudioSettings>{
 const save=async()=>{
  const settings=await apiClient.getSettings();
  const remote=normalizeStudioSettings(settings.integrationStudioDraft||settings.integrationStudio);
  const snapshot=mergeStudioDraft(base as IntegrationStudioSettings,draft,remote as IntegrationStudioSettings);
  snapshot.revision=Number(remote.revision||0)+1;snapshot.savedAt=new Date().toISOString();
  const result=await retryAfterPortalReauthentication(()=>apiClient.updateSettings({integrationStudio:snapshot,studioExpectedRevision:Number(remote.revision||0),studioSaveMode:'autosave'}),'Confirme seu acesso para concluir o salvamento automático. Suas alterações serão mantidas.');
  return (result.integrationStudioDraft||result.integrationStudio||snapshot) as IntegrationStudioSettings;
 };
 return queueStudioOperation(save);
}

export function saveStudioImageAutomatically(base:Partial<IntegrationStudioSettings>,input:Parameters<typeof apiClient.saveStudioImage>[0]){
 return queueStudioOperation(async()=>{
  const settings=await apiClient.getSettings(),remote=normalizeStudioSettings(settings.integrationStudioDraft||settings.integrationStudio);
  const collection=input.kind==='email'?'emailDesigns':'formDesigns';
  const current=remote[collection]?.[input.templateId]?.[input.field as 'logoUrl']||'';
  const expected=base[collection]?.[input.templateId]?.[input.field as 'logoUrl']||'';
  if(current!==expected)throw new Error('Esta imagem foi alterada em outra sessão. Confira a versão atual antes de substituí-la.');
  return retryAfterPortalReauthentication(()=>apiClient.saveStudioImage({...input,expectedRevision:Number(remote.revision||0),expectedImageValue:current}),'Confirme seu acesso para salvar a imagem selecionada.');
 });
}
