import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {workflowStageRows} from '../src/utils/workflowStageRows';
import {WorkflowRecipientEditor} from '../src/components/WorkflowRecipientEditor';
import {WorkflowRecipientCell} from '../src/components/WorkflowRecipientCell';
const catalog=[{value:'email:reserve',type:'email',label:'Reserva',detail:'E-mail'},{value:'doc:ata',type:'doc',label:'Ata',detail:'ASTEN / Gov.br'},{value:'form:form',type:'form',label:'Formulário',detail:'Formulário'}];
test('stage sheet shows only linked actions, preserves actual execution order and missing/internal bindings',()=>{
 const actions=[{id:'b',type:'form',refId:'form',title:'Responder'},{id:'a',type:'email',refId:'reserve',title:'Pedir reserva'},{id:'internal',type:'action',title:'Rotina'},{id:'missing',type:'doc',refId:'removed',title:'Modelo ausente'}];
 const before=JSON.stringify(actions);const rows=workflowStageRows(actions,catalog);
 assert.deepEqual(rows.map(row=>row.action.id),['b','a','internal','missing']);assert.equal(rows.length,4);assert.equal(rows[0].value,'form:form');assert.equal(rows[1].value,'email:reserve');assert.ok(!rows.some(row=>row.action.refId==='ata'));assert.equal(rows[2].detail,'Rotina interna');assert.equal(rows[3].label,'Modelo ausente');assert.equal(JSON.stringify(actions),before);assert.deepEqual(workflowStageRows([],catalog),[]);
});
test('inline recipient selectors edit the model groups and retain native signature constraints',()=>{
 const noop=()=>{};const props={onEmailChange:noop,onFormChange:noop,onSignatureChange:noop};
 const email=renderToStaticMarkup(React.createElement(WorkflowRecipientEditor,{...props,kind:'email',template:{id:'custom',recipientRoles:['AUTHORS']}}));assert.match(email,/type="checkbox"[^>]*checked/);assert.match(email,/>Para</);assert.match(email,/>Cópia</);
 const doc=renderToStaticMarkup(React.createElement(WorkflowRecipientEditor,{...props,kind:'doc',template:{id:'tmpl-ata',type:'ATA'}}));assert.match(doc,/Signatários ASTEN/);assert.match(doc,/Obrigatório/);assert.doesNotMatch(doc,/Remover Autores/);
 const form=renderToStaticMarkup(React.createElement(WorkflowRecipientEditor,{...props,kind:'form',template:{id:'custom',targetRole:'Aluno'}}));assert.match(form,/Quem pode preencher/);assert.match(form,/<select/);
 const cell=renderToStaticMarkup(React.createElement(WorkflowRecipientCell,{kind:'form',template:{id:'custom',targetRole:'Aluno'},onOpen:noop,editor:React.createElement('select',{'aria-label':'Selecionar'})}));assert.match(cell,/<details/);assert.match(cell,/Selecionar destinatários.*Autores/);assert.match(cell,/Abrir configuração completa/);
});
