import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {registrationReviewValue} from '../src/components/ConfigurableRegistration';
import {RegistrationReview} from '../src/components/RegistrationReview';
import type {RegistrationQuestion} from '../src/types/operationalConfig';

const field=(fieldKey:string,label:string,fieldType:RegistrationQuestion['fieldType']='text')=>({fieldKey,label,fieldType,section:'Reserva do local',required:true}) as RegistrationQuestion;

test('orientador usa a instituição do Portal sem inferir vínculo pelo e-mail; demais membros mantêm sua instituição',()=>{
 const fields=['ORIENTADOR_NOME','ORIENTADOR_EMAIL','ORIENTADOR_INSTITUICAO','EXAMINADOR_2_NOME','EXAMINADOR_2_INSTITUICAO','COORIENTADOR_NOME','COORIENTADOR_INSTITUICAO'].map(key=>field(key,key));
 const answers:Record<string,string>={ORIENTADOR_NOME:'Orientador de Teste',ORIENTADOR_EMAIL:'advisor@example.invalid',ORIENTADOR_INSTITUICAO:'Valor antigo incorreto',EXAMINADOR_2_NOME:'Examinador de Teste',EXAMINADOR_2_INSTITUICAO:'Instituição Externa',COORIENTADOR_NOME:'Coorientador de Teste',COORIENTADOR_INSTITUICAO:'Outra Instituição'};
 const before=structuredClone(answers);
 const render=(institutionName?:string)=>renderToStaticMarkup(React.createElement(RegistrationReview,{fields,valueFor:item=>answers[item.fieldKey]||'',institutionName}));
 assert.match(render(),/Universidade Federal do Espírito Santo/);
 assert.doesNotMatch(render(),/Valor antigo incorreto/);
 assert.match(render(),/Instituição Externa/);assert.match(render(),/Outra Instituição/);
 assert.match(render('Instituição de Outra Instalação'),/Instituição de Outra Instalação/);
 assert.deepEqual(answers,before,'exibição não reescreve um rascunho salvo');
});

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

test('conferência usa três colunas e omite identificadores históricos',()=>{
 const fields=[field('ALUNO_1_NOME','Nome completo do autor'),field('ALUNO_1_EMAIL','E-mail do autor'),field('ORIENTADOR_NOME','Orientador')];
 const answers:Record<string,string>={ALUNO_1_NOME:'Ana Maria',ALUNO_1_EMAIL:'ana@example.invalid',ORIENTADOR_NOME:'Bruno Oliveira'};
 const render=(items:RegistrationQuestion[])=>renderToStaticMarkup(React.createElement(RegistrationReview,{fields:items,valueFor:item=>answers[item.fieldKey]||'',findings:[]}));
 const current=render(fields);
 assert.doesNotMatch(current,/Matrícula, SIAPE ou outro registro/);
 assert.match(current,/<th scope="col">Participante<\/th><th scope="col">E-mail<\/th><th scope="col">Dados institucionais<\/th>/);
 answers.ALUNO_1_MATRICULA='HISTORICO-001';
 answers.ORIENTADOR_CIAP='HISTORICO-002';
 const historical=render([...fields,field('ALUNO_1_MATRICULA','Matrícula'),field('ORIENTADOR_CIAP','CIAP')]);
 assert.doesNotMatch(historical,/Matrícula|SIAPE|CIAP|HISTORICO-00[12]/);
 assert.doesNotMatch(historical,/<input/);
});
