import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationQuestions,registrationPayload} from '../src/utils/operationalConfig';
import {CUSTOM_DEFENSE_LOCATION,isManagedDefenseLocation} from '../src/utils/reservationLocation';
import {evaluateStudioCondition} from '../src/utils/courseStudioValidator';
import {reservationScheduleChanged} from './workflow/reservationReschedule';
import {DEMO_PROCESSES} from '../src/services/demoSeed';

test('cadastro retira alternativa antiga, oferece local personalizado condicional e preserva o nome nos dados da defesa',()=>{
 const fields=registrationQuestions({formTemplates:[{id:'form-reserva-aluno',questions:[{fieldKey:'LOCAL_ALTERNATIVO',label:'Alternativa',fieldType:'select',required:true}]}]} as any);
 assert.equal(fields.some(field=>field.fieldKey==='LOCAL_ALTERNATIVO'),false);
 assert.ok(fields.find(field=>field.fieldKey==='DEFESA_LOCAL')!.options!.includes(CUSTOM_DEFENSE_LOCATION));
 const custom=fields.find(field=>field.fieldKey==='DEFESA_LOCAL_PERSONALIZADO')!;
 assert.equal(custom.required,true);
 assert.equal(evaluateStudioCondition(custom.visibleWhen,{DEFESA_LOCAL:CUSTOM_DEFENSE_LOCATION}),true);
 assert.equal(evaluateStudioCondition(custom.visibleWhen,{DEFESA_LOCAL:'Auditório'}),false);
 const location='Auditório do Hospital Universitário — prédio externo';
 const payload=registrationPayload({DEFESA_DATA_HORA:'2026-12-03T14:00',DEFESA_LOCAL:CUSTOM_DEFENSE_LOCATION,DEFESA_LOCAL_PERSONALIZADO:location,LOCAL_ALTERNATIVO:'Sala antiga'},'America/Sao_Paulo');
 assert.equal(payload.defesa.local,'Auditório do Hospital Universitário — Prédio Externo');
 assert.equal('alternateLocation' in payload.defesa,false);
 assert.equal(isManagedDefenseLocation(location),false);
 assert.equal(isManagedDefenseLocation('Auditório do Prédio do Departamento de Enfermagem - CCS/UFES'),true);
});

test('troca de orientador invalida a aprovação pendente de um local externo',()=>{
 const before=structuredClone(DEMO_PROCESSES[0]);before.defesa.local='Auditório do Hospital Universitário — prédio externo';
 const after=structuredClone(before);after.orientador.email='outro-orientador@ufes.br';
 assert.equal(reservationScheduleChanged(before,after),true);
 before.defesa.local='Auditório';after.defesa.local='Auditório';
 assert.equal(reservationScheduleChanged(before,after),false);
});
