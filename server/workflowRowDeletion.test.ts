import test from 'node:test';
import assert from 'node:assert/strict';
import {upgradeStudioDraft} from '../src/utils/studioUpgrade';

test('explicitly deleted automatic rows stay deleted after reopening and keep shared templates',()=>{
 const source:any={revision:2,savedAt:new Date().toISOString(),docTemplates:[{id:'declaration',type:'DECLARACAO',label:'Declaração'}],emailTemplates:[{id:'email-reserva',name:'Reserva',recipient:'{{DEPARTAMENTO_EMAIL}}',body:'Texto',subject:'Reserva'}],formTemplates:[],workflowStages:[
  {id:'registration',triggerEvent:'TCC_CREATED',actions:[],hiddenCatalogItems:['email:email-reserva']},
  {id:'delivery',triggerEvent:'SIGNATURE_COMPLETED',actions:[],hiddenCatalogItems:['email:email-entrega-repositorio']},
  {id:'clear',triggerEvent:'PUBLICATION_CLEARED',actions:[],hiddenCatalogItems:['doc:declaration']}
 ]};
 const once=upgradeStudioDraft(source),twice=upgradeStudioDraft(once);
 for(const stage of twice.workflowStages||[]){assert.equal((stage.actions as any[]).length,0);assert.equal((stage.hiddenCatalogItems as string[]).length,1);}
 assert.ok(twice.docTemplates?.some(t=>t.id==='declaration'));assert.ok(twice.emailTemplates?.some(t=>t.id==='email-reserva'));assert.ok(twice.emailTemplates?.some(t=>t.id==='email-entrega-repositorio'));
});
