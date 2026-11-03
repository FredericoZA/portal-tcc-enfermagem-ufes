import test from 'node:test';
import assert from 'node:assert/strict';
import {apiClient} from '../src/services/apiClient';
import {saveStudioAutomatically} from '../src/services/studioAutosave';
import {courseStudioFixture} from './fixtures/courseStudioFixture';

test('autosave queue preserves independent changes from two popups and recovers after failure',async()=>{
 const get=apiClient.getSettings,update=apiClient.updateSettings;
 const base=courseStudioFixture();let current=structuredClone(base),inFlight=0,maximum=0,offline=false;
 apiClient.getSettings=async()=>({integrationStudioDraft:structuredClone(current)} as any);
 apiClient.updateSettings=async input=>{
  assert.equal(input.studioSaveMode,'autosave');assert.equal(input.studioExpectedRevision,current.revision);
  if(offline)throw new Error('Servidor indisponível');
  inFlight++;maximum=Math.max(maximum,inFlight);await new Promise(resolve=>setTimeout(resolve,25));
  current=structuredClone(input.integrationStudio!);inFlight--;return {integrationStudioDraft:structuredClone(current)} as any;
 };
 try{
  const email=structuredClone(base),form=structuredClone(base);email.emailTemplates[0].name='Edição do e-mail';form.formTemplates[0].title='Edição do formulário';
  await Promise.all([saveStudioAutomatically(base,email),saveStudioAutomatically(base,form)]);
  assert.equal(maximum,1);assert.equal(current.emailTemplates[0].name,'Edição do e-mail');assert.equal(current.formTemplates[0].title,'Edição do formulário');assert.equal(current.revision,3);
  offline=true;await assert.rejects(()=>saveStudioAutomatically(current,structuredClone(current)),/Servidor indisponível/);
  offline=false;const next=structuredClone(current);next.workflowStages[0].title='Fluxo editado';await saveStudioAutomatically(current,next);assert.equal(current.workflowStages[0].title,'Fluxo editado');
 }finally{apiClient.getSettings=get;apiClient.updateSettings=update;}
});
