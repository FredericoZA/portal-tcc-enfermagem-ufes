import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {registrationReviewValue} from '../src/components/ConfigurableRegistration';
import {RegistrationReview} from '../src/components/RegistrationReview';
import type {RegistrationQuestion} from '../src/types/operationalConfig';

const field=(fieldKey:string,label:string,fieldType:RegistrationQuestion['fieldType']='text')=>({fieldKey,label,fieldType,section:'Reserva do local',required:true}) as RegistrationQuestion;

test('a conferência do cadastro mostra o local como nos documentos, preservando a edição original',()=>{
  const answers={DEFESA_LOCAL:'__OUTRO_LOCAL__',DEFESA_LOCAL_PERSONALIZADO:'laboratório fictício da *ufes*',LOCAL_CONFIGURADO:'auditório da *ufes*'};
  const fields=[field('DEFESA_LOCAL','Local da defesa','select'),field('DEFESA_LOCAL_PERSONALIZADO','Nome completo do local'),field('LOCAL_CONFIGURADO','Nome completo do local da defesa')];
  const before=structuredClone(answers);
  const html=renderToStaticMarkup(React.createElement(RegistrationReview,{fields,valueFor:item=>registrationReviewValue(item,answers[item.fieldKey]),findings:[]}));
  assert.match(html,/<td>Outro local<\/td>/);
  assert.match(html,/<td>Laboratório Fictício da UFES<\/td>/);
  assert.match(html,/<td>Auditório da UFES<\/td>/);
  assert.doesNotMatch(html,/\*ufes\*|\*UFES\*/);
  assert.deepEqual(answers,before,'a conferência não modifica o rascunho nem os marcadores do campo editável');
});

test('a apresentação do local não muda o tratamento de outros campos da conferência',()=>{
  assert.equal(registrationReviewValue(field('ALUNO_1_NOME','Nome completo do autor'),'Ana Maria'),'Ana Maria');
  assert.equal(registrationReviewValue(field('ALUNO_1_EMAIL','E-mail do autor','email'),'ana+ufes@example.invalid'),'ana+ufes@example.invalid');
  assert.equal(registrationReviewValue(field('EXAMINADOR_2_INSTITUICAO','Instituição'),'*ufes*'),'UFES');
  assert.equal(registrationReviewValue(field('TITULO','Título completo do TCC'),'estudo na *ufes*'),'Estudo na UFES');
  assert.equal(registrationReviewValue(field('DEFESA_DATA_HORA','Data e horário','datetime-local'),'2026-11-17T14:00'),'terça-feira, 17/11/2026 às 14:00');
});

test('conferência nova usa três colunas e só inclui registro quando há um valor histórico',()=>{
 const fields=[field('ALUNO_1_NOME','Nome completo do autor'),field('ALUNO_1_EMAIL','E-mail do autor'),field('ORIENTADOR_NOME','Orientador')];
 const answers:Record<string,string>={ALUNO_1_NOME:'Ana Maria',ALUNO_1_EMAIL:'ana@example.invalid',ORIENTADOR_NOME:'Bruno Oliveira'};
 const render=(items:RegistrationQuestion[])=>renderToStaticMarkup(React.createElement(RegistrationReview,{fields:items,valueFor:item=>answers[item.fieldKey]||'',findings:[]}));
 const current=render(fields);
 assert.doesNotMatch(current,/Matrícula, SIAPE ou outro registro/);
 assert.match(current,/<th scope="col">Participante<\/th><th scope="col">E-mail<\/th><th scope="col">Dados institucionais<\/th>/);
 answers.ALUNO_1_MATRICULA='HISTORICO-001';
 const historical=render([...fields,field('ALUNO_1_MATRICULA','Matrícula')]);
 assert.match(historical,/Matrícula, SIAPE ou outro registro/);
 assert.match(historical,/<td>HISTORICO-001<\/td>/);
 assert.doesNotMatch(historical,/<input/);
});
