import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DynamicStudioForms} from '../src/components/DynamicStudioForms';
import type {FormTemplateItem} from '../src/pages/ConfiguracoesPage';

test('runtime preview omits identifier inputs from an old custom form while keeping academic fields and the original model',()=>{
  const form:FormTemplateItem={
    id:'form-custom',title:'Formulário acadêmico',stage:'Dados finais',targetRole:'Aluno',description:'Conferência do processo',isActive:true,
    questions:[
      {id:'old-cpf',fieldKey:'CPF',label:'CPF',fieldType:'text',required:true,expectedAnswer:''},
      {id:'old-registration',fieldKey:'CAMPO_ANTIGO',label:'Matrícula do participante',fieldType:'text',required:true,expectedAnswer:''},
      {id:'old-siape',fieldKey:'ORIENTADOR_SIAPE',label:'SIAPE',fieldType:'text',required:true,expectedAnswer:''},
      {id:'name',fieldKey:'NOME',label:'Nome completo',fieldType:'text',required:true,expectedAnswer:''},
      {id:'count',fieldKey:'QUANTIDADE',label:'Quantidade de atividades',fieldType:'number',required:false,expectedAnswer:''},
      {id:'dependent',fieldKey:'DEPENDENTE',label:'Campo dependente de identificador',fieldType:'text',required:true,expectedAnswer:'',visibleWhen:{fieldKey:'CPF',operator:'EQUALS',value:'valor-antigo'}},
    ],
  };
  const before=structuredClone(form);
  const markup=renderToStaticMarkup(React.createElement(DynamicStudioForms,{processId:'preview',previewForm:form}));
  assert.match(markup,/<input[^>]*name="NOME"/);
  assert.match(markup,/<input(?=[^>]*name="QUANTIDADE")(?=[^>]*type="number")[^>]*>/);
  assert.doesNotMatch(markup,/<input[^>]*name="(?:CPF|CAMPO_ANTIGO|ORIENTADOR_SIAPE|DEPENDENTE)"/);
  assert.doesNotMatch(markup,/Matrícula do participante|Campo dependente de identificador/);
  assert.deepEqual(form,before);
});

test('form header mirrors selected participant roles instead of the old single target',()=>{
 const form:FormTemplateItem={id:'custom-multi',title:'Conferência',stage:'Entrega',targetRole:'Orientador',recipientRoles:['AUTHORS','EXAMINERS'],description:'Confira os dados.',isActive:true,questions:[{id:'observation',fieldKey:'OBSERVACAO',label:'Observação',fieldType:'text',required:false,expectedAnswer:''}]};
 const markup=renderToStaticMarkup(React.createElement(DynamicStudioForms,{processId:'preview',previewForm:form}));
 assert.match(markup,/Autores, Examinadores/);
 assert.doesNotMatch(markup,/Entrega · Orientador/);
});
