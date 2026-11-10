import test from 'node:test';import assert from 'node:assert/strict';
import {formRecipientRoles,formRecipientSummary,validateFormRecipientSelection,canUseFormRecipientSelection} from '../src/utils/formRecipientRoles';

test('legacy form targets preserve all four existing role mappings, including coadvisor',()=>{
 for(const[targetRole,expected]of [['Aluno',['AUTHORS']],['Orientador',['ADVISOR','COADVISOR']],['Banca',['ADVISOR','COADVISOR','EXAMINERS']],['Presidente da Comissão',['COMMISSION_PRESIDENT']]] as const)assert.deepEqual(formRecipientRoles({targetRole}),expected);
 assert.deepEqual(formRecipientRoles({targetRole:'Desconhecido'}),[]);
});
test('explicit roles replace legacy target rather than adding permissions',()=>{
 const form={targetRole:'Banca',recipientRoles:['AUTHORS','COADVISOR']};
 assert.deepEqual(formRecipientRoles(form),['AUTHORS','COADVISOR']);
 assert.equal(canUseFormRecipientSelection(form,['STUDENT'],[]),true);
 assert.equal(canUseFormRecipientSelection(form,['CO_ADVISOR'],[]),true);
 for(const roles of [[],['VIEWER'],['ADVISOR'],['EXAMINER']])assert.equal(canUseFormRecipientSelection(form,roles,[]),false);
 assert.equal(canUseFormRecipientSelection(form,[],['COMMISSION_PRESIDENT']),false);
 assert.equal(formRecipientSummary(form),'Autores, Coorientador');
});
test('invalid explicit selection is denied and cannot fall back to a permissive legacy role',()=>{
 for(const recipientRoles of [[],null,'AUTHORS',['CO_ADVISOR'],['RESERVATION_RESPONSIBLE'],['OUTSIDER']]){
  const form={targetRole:'Banca',recipientRoles};assert.throws(()=>validateFormRecipientSelection(form));
  assert.equal(canUseFormRecipientSelection(form,['ADVISOR','CO_ADVISOR','EXAMINER'],[]),false);
 }
});
test('native registration and reservation recipients are fixed and generic forms do not grant decision-link access',()=>{
 assert.deepEqual(formRecipientRoles({id:'form-reserva-aluno',targetRole:'Banca'}),['AUTHORS']);
 assert.deepEqual(formRecipientRoles({id:'form-reserva-departamento',targetRole:'Aluno'}),['RESERVATION_RESPONSIBLE']);
 assert.throws(()=>validateFormRecipientSelection({id:'form-reserva-aluno',recipientRoles:['EXAMINERS']}));
 assert.throws(()=>validateFormRecipientSelection({id:'form-reserva-departamento',recipientRoles:['ADVISOR']}));
 assert.doesNotThrow(()=>validateFormRecipientSelection({id:'form-reserva-departamento',recipientRoles:['RESERVATION_RESPONSIBLE']}));
 assert.equal(canUseFormRecipientSelection({id:'form-reserva-departamento'},['ADVISOR'],[]),false);
});
test('presidency and master retain explicit institutional scopes without granting observers access',()=>{
 const form={recipientRoles:['COMMISSION_PRESIDENT']};
 assert.equal(canUseFormRecipientSelection(form,[],['COMMISSION_PRESIDENT']),true);
 assert.equal(canUseFormRecipientSelection(form,['VIEWER'],[]),false);
 assert.equal(canUseFormRecipientSelection(form,[],['MASTER_ADMIN']),true);
 assert.equal(canUseFormRecipientSelection({targetRole:'Aluno'},[],['COMMISSION_PRESIDENT']),false);
});

test('published configuration rejects invalid custom roles and accepts participant roles',async()=>{
 const {validateCourseStudio}=await import('../src/utils/courseStudioValidator');
 const {courseStudioFixture}=await import('./fixtures/courseStudioFixture');
 const studio=courseStudioFixture();
 for(const recipientRoles of [[],['RESERVATION_RESPONSIBLE'],['OUTSIDER']]){
  studio.formTemplates[0].recipientRoles=recipientRoles;
  assert.ok(validateCourseStudio(studio).issues.some(issue=>issue.code==='INVALID_FORM_RECIPIENT_ROLES'));
 }
 studio.formTemplates[0].recipientRoles=['AUTHORS','COADVISOR'];
 assert.equal(validateCourseStudio(studio).issues.some(issue=>issue.code==='INVALID_FORM_RECIPIENT_ROLES'),false);
});

test('custom form variables cannot override canonical identity, protocol or concept fields',async()=>{
 const {buildProcessVariables}=await import('./workflow/runtime');const {DEMO_PROCESSES}=await import('../src/services/demoSeed');
 const process=structuredClone(DEMO_PROCESSES[0]);
 const variables=buildProcessVariables({process,eventCode:'FORM_CUSTOM_SUBMITTED',actorEmail:process.aluno1.email,actorRoles:['STUDENT'],extraVariables:{ALUNO_1_EMAIL:'outsider@example.invalid',ORIENTADOR_EMAIL:'outsider@example.invalid',PROTOCOLO:'FAKE',CAMPO_09:'Falso',AVALIACAO_RESULTADO:'Falso',AVALIACAO_PARECER:'Parecer falso'}});
 assert.equal(variables.ALUNO_1_EMAIL,process.aluno1.email);assert.equal(variables.ORIENTADOR_EMAIL,process.orientador.email);assert.equal(variables.PROTOCOLO,process.protocolo);assert.equal(variables.CAMPO_09,process.avaliacao.resultadoLabel||'');assert.equal(variables.AVALIACAO_RESULTADO,process.avaliacao.resultadoLabel||'');assert.equal(variables.AVALIACAO_PARECER,process.avaliacao.parecer||'');
});
