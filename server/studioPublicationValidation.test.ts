import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCourseStudio} from '../src/utils/courseStudioValidator';
import {normalizeStudioSettings} from '../src/services/integrationStudioService';
test('cores padrão e e-mail literal válido não bloqueiam salvamento do Estúdio',()=>{
  const studio=normalizeStudioSettings({emailTemplates:[{id:'email-reserva',name:'Reserva',subject:'Reserva',body:'Solicitação',recipient:'secretaria@ufes.br'}]});
  const codes=()=>validateCourseStudio(studio).issues.map(issue=>issue.code);
  assert.ok(!codes().includes('LOW_CONTRAST'));assert.ok(!codes().includes('RESERVATION_EMAIL_RECIPIENT_MUST_BE_CONFIGURED'));
  studio.brandKit!.textColor='#ffffff';assert.ok(codes().includes('LOW_CONTRAST'));
  studio.emailTemplates![0].recipient='secretaria ufes.br';assert.ok(codes().includes('RESERVATION_EMAIL_RECIPIENT_MUST_BE_CONFIGURED'));
});


test('activity event selection cannot move native signatures or reservation to an unsafe trigger',async()=>{
 const {courseStudioFixture}=await import('./fixtures/courseStudioFixture');
 const value=courseStudioFixture();
 for(const stage of value.workflowStages){for(const action of (stage.actions||[]) as any[]){if(action.type==='doc'){action.executionEvent='TCC_CREATED';}}}
 assert.ok(validateCourseStudio(value).issues.some(issue=>issue.code==='INVALID_DOCUMENT_EVENT'));
 const invalid=courseStudioFixture();
 invalid.emailTemplates.push({id:'email-reserva',name:'Reserva',recipient:'secretaria@ufes.br',subject:'Reserva',body:'Pedido'});
 invalid.workflowStages.push({id:'cadastro-reserva',triggerEvent:'TCC_CREATED',actions:[{id:'pedido-reserva',type:'email',refId:'email-reserva',title:'Solicitar reserva',executionEvent:'SIGNATURE_COMPLETED'}]});
 assert.ok(validateCourseStudio(invalid).issues.some(issue=>issue.code==='INVALID_RESERVATION_TRIGGER'));
});
