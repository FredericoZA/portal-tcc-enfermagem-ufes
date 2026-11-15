import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProcessReviewMetadataField} from '../src/components/ProcessDataReviewModal';
import type {RegistrationAnswers,RegistrationQuestion} from '../src/types/operationalConfig';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {processDataReviewValues,processDataReviewPatch} from '../src/utils/processDataReview';
import {mergeProcessReviewAnswers} from './workflow/processDataReview';

const field:RegistrationQuestion={id:'review-confirmation',fieldKey:'CONFERENCIA_ADICIONAL',label:'Conferência adicional',fieldType:'checkbox',required:true};

test('review checkbox emits boolean values that the published metadata validator accepts, including optional unchecking',()=>{
  const process=structuredClone(DEMO_PROCESSES[0]);
  const base=processDataReviewValues(process);
  const next=structuredClone(base);
  const render=(question=field)=>ProcessReviewMetadataField({field:question,value:next.registrationAnswers[field.fieldKey],onChange:value=>{next.registrationAnswers[field.fieldKey]=value;}});
  const control=(element:ReturnType<typeof render>)=>(element.props.children as React.ReactElement[])[1] as React.ReactElement<{onChange:(event:{target:{checked:boolean;value:string}})=>void}>;
  assert.match(renderToStaticMarkup(render()),/type="checkbox"[^>]*required=""/);
  assert.doesNotMatch(renderToStaticMarkup(render()),/checked=""/);
  control(render()).props.onChange({target:{checked:true,value:'on'}});
  const patch=processDataReviewPatch(base,next,process.dataRevision,[field.fieldKey]);
  assert.equal(patch.registrationAnswers?.[field.fieldKey],true);
  assert.match(renderToStaticMarkup(render()),/checked=""/);
  const studio={formTemplates:[{id:'form-reserva-aluno',questions:[field]}]} as any;
  assert.equal(mergeProcessReviewAnswers(process,patch.registrationAnswers,studio)[field.fieldKey],true);
  assert.throws(()=>mergeProcessReviewAnswers(process,{[field.fieldKey]:false},studio),/campo obrigatório/);
  const optional={...field,required:false};
  const checkedBase=structuredClone(next);
  control(render(optional)).props.onChange({target:{checked:false,value:'on'}});
  const unchecked=processDataReviewPatch(checkedBase,next,process.dataRevision,[field.fieldKey]);
  assert.equal(unchecked.registrationAnswers?.[field.fieldKey],false);
  assert.doesNotMatch(renderToStaticMarkup(render(optional)),/required=""|checked=""/);
  assert.equal(mergeProcessReviewAnswers(process,unchecked.registrationAnswers,{formTemplates:[{id:'form-reserva-aluno',questions:[optional]}]} as any)[field.fieldKey],false);
});

test('required published text and select metadata retain native form constraints',()=>{
  const props={value:'' as RegistrationAnswers[string],onChange:()=>{}};
  for(const question of [{...field,fieldType:'text'},{...field,fieldType:'select',options:['Sim','Não']}]){
    const html=renderToStaticMarkup(ProcessReviewMetadataField({...props,field:question}));
    assert.match(html,/<(?:input|select)[^>]*required=""/);
  }
});
