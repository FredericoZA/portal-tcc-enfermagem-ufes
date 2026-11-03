import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirst} from '../src/utils/workflowStageOrder';
import {consolidateProcessForms} from '../src/utils/processFormConsolidation';
import {upgradeStudioDraft} from '../src/utils/studioUpgrade';

test('cadastro que estava na etapa 7 volta ao início sem perder ações ou reordenar as demais etapas',()=>{
 const stages=[...Array.from({length:6},(_,index)=>({id:`s${index}`,triggerEvent:`EVENT_${index}`,stageNumber:index+1,actions:[{id:`a${index}`,type:'email',refId:`email${index}`}]})),{id:'registration',triggerEvent:'TCC_CREATED',stageNumber:7,actions:[{id:'reservation',type:'email',refId:'reserve'}]}];
 const snapshot=structuredClone(stages);const ordered=registrationFirst(stages);
 assert.deepEqual(ordered.map(s=>s.id),['registration','s0','s1','s2','s3','s4','s5']);
 assert.deepEqual(ordered.map(s=>s.stageNumber),[1,2,3,4,5,6,7]);
 assert.deepEqual(ordered[0].actions,stages[6].actions);assert.deepEqual(ordered.slice(1).map(s=>s.actions),stages.slice(0,6).map(s=>s.actions));assert.deepEqual(stages,snapshot);
 assert.deepEqual(registrationFirst(ordered),ordered);
 const consolidated=consolidateProcessForms({workflowStages:stages});assert.equal(consolidated.workflowStages[0].id,'registration');
 const upgraded=upgradeStudioDraft({workflowStages:stages,emailTemplates:[{id:'reserve',recipient:'{{DEPARTAMENTO_EMAIL}}',subject:'Reserva',body:'Solicitação'}]});assert.equal(upgraded.workflowStages![0].id,'registration');
});
test('fluxo personalizado sem cadastro não recebe uma etapa inventada pela ordenação',()=>{
 const stages=[{id:'custom',triggerEvent:'CUSTOM',stageNumber:9}];assert.deepEqual(registrationFirst(stages),[{...stages[0],stageNumber:1}]);
});
