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
