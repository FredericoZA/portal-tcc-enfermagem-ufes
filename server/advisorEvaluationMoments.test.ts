import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdvisorEvaluationPanel} from '../src/components/AdvisorEvaluationPanel';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
const ready=()=>{const p=structuredClone(DEMO_PROCESSES[0]);p.avaliacao={status:'PENDENTE'};p.acervo=undefined;p.defesa={...p.defesa,startAt:'2020-11-05T14:00:00Z',endAt:'2020-11-05T15:30:00Z',localStatus:'CONFIRMADO',departmentResponse:undefined,invitationSentAt:'2020-11-01T12:00:00Z'};return p;};
const render=(process:ReturnType<typeof ready>,canEvaluate=true)=>renderToStaticMarkup(React.createElement(AdvisorEvaluationPanel,{process,canEvaluate,canReviewData:true,canReopen:false,onReopen:()=>{},onUpdated:()=>{}}));
test('before release only the compact waiting notice appears',()=>{
 for(const state of ['location','invitation','time']){
  const p=ready();if(state==='location')p.defesa.localStatus='PENDENTE';if(state==='invitation')p.defesa.invitationSentAt=undefined;if(state==='time')p.defesa.startAt='2099-11-05T14:00:00Z';
  const html=render(p);assert.doesNotMatch(html,/Última oportunidade|Verificar dados do processo|professor.ufes.br/);assert.match(html,/mx-auto w-fit max-w-full/);
 }
});
test('at release the advisor sees correction and a separate linked professor-portal notice',()=>{
 const html=render(ready());assert.match(html,/Verificar dados do processo/);assert.match(html,/border-red-300/);assert.match(html,/href="https:\/\/professor.ufes.br\/"/);assert.doesNotMatch(render(ready(),false),/Verificar dados do processo|professor.ufes.br/);
});
