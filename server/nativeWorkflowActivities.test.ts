import test from 'node:test';import assert from 'node:assert/strict';
import {withNativeWorkflowActivities,nativeWorkflowActivity,NATIVE_WORKFLOW_ACTIVITIES} from '../src/utils/nativeWorkflowActivities';
import {compileWorkflow,planWorkflowEvent} from './workflow/runtime';
import {courseStudioFixture} from './fixtures/courseStudioFixture';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {validateCourseStudio} from '../src/utils/courseStudioValidator';

test('cadastro e resposta da reserva vêm antes das ações automáticas; preparação não fica vazia',()=>{
 const original={workflowStages:[{id:'created',triggerEvent:'TCC_CREATED',actions:[{id:'mail',type:'email',refId:'email-reserva',title:'Reserva'}]},{id:'defense',triggerEvent:'INVITATION_SENT',actions:[]},{id:'minutes',triggerEvent:'EVALUATION_SUBMITTED',actions:[]},{id:'location',triggerEvent:'LOCATION_CONFIRMED',actions:[{id:'invite',type:'doc',refId:'invite',title:'Convite'}]}]};
 const before=structuredClone(original);const result=withNativeWorkflowActivities(original);
 assert.deepEqual(result.workflowStages.map(s=>s.triggerEvent),['TCC_CREATED','LOCATION_CONFIRMED','INVITATION_SENT','EVALUATION_SUBMITTED','REPOSITORY_SUBMITTED']);
 assert.equal(nativeWorkflowActivity((result.workflowStages[0].actions as any[])[0])?.id,'registration');
 assert.equal(nativeWorkflowActivity((result.workflowStages[1].actions as any[])[0])?.id,'reservation-response');
 assert.equal((result.workflowStages[0].actions as any[])[1].id,'mail');assert.ok((result.workflowStages[1].actions as any[]).some(a=>a.id==='invite'));assert.ok(result.workflowStages.every(s=>(s.actions as any[]).length));
 assert.deepEqual(original,before);assert.deepEqual(withNativeWorkflowActivities(result),result);
 assert.deepEqual(NATIVE_WORKFLOW_ACTIVITIES.find(a=>a.id==='registration')?.roles,['AUTHORS']);assert.deepEqual(NATIVE_WORKFLOW_ACTIVITIES.find(a=>a.id==='reservation-response')?.roles,['RESERVATION_RESPONSIBLE']);
});
test('atividades humanas não disparam formulários extras, e-mails, documentos ou executores automáticos',()=>{
 const original=courseStudioFixture();const upgraded=withNativeWorkflowActivities(original);
 assert.equal(compileWorkflow(upgraded).issues.length,0);
 for(const eventCode of ['TCC_CREATED','LOCATION_CONFIRMED','INVITATION_SENT','EVALUATION_SUBMITTED','REPOSITORY_SUBMITTED','PUBLICATION_CLEARED','PROCESS_COMPLETED']){
  const context={process:DEMO_PROCESSES[0],eventCode,actorEmail:'user@example.invalid',actorRoles:[]};
  assert.deepEqual(planWorkflowEvent(upgraded,context).actions,planWorkflowEvent(original,context).actions);
 }
});
test('referência nativa falsa ou fora da etapa falha na compilação e na publicação',()=>{
 const value=withNativeWorkflowActivities(courseStudioFixture());const initial=value.workflowStages.find(s=>s.triggerEvent==='TCC_CREATED')!;
 const action=(initial.actions as any[])[0];action.refId='reservation-response';
 assert.ok(compileWorkflow(value).issues.some(i=>i.severity==='ERROR'));assert.ok(validateCourseStudio(value).issues.some(i=>i.code==='INVALID_NATIVE_ACTIVITY'));
 action.refId='unknown';assert.ok(compileWorkflow(value).issues.some(i=>i.severity==='ERROR'));
});
test('publicação aponta etapa vazia em vez de fingir uma atividade executada',()=>{
 const value=courseStudioFixture();value.workflowStages.push({id:'empty',title:'Vazia',triggerEvent:'INVITATION_SENT',actions:[]});assert.ok(validateCourseStudio(value).issues.some(i=>i.code==='EMPTY_STAGE'));
});
