import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeInstitutionInput,renderInstitutionName} from '../src/utils/institutionName';
import {normalizeRegistrationValue} from '../src/utils/registrationNormalization';

test('siglas explícitas de instituição sobrevivem à normalização repetida sem marcadores no texto final',()=>{
 for(const [input,expected] of [['*faesa*','FAESA'],['*univix*','UNIVIX'],['universidade *ufes* de vitória','Universidade UFES de Vitória'],['  *ucl*  / *faesa* ','UCL / FAESA']]){
  const normalized=normalizeInstitutionInput(input);
  assert.equal(normalizeInstitutionInput(normalized),normalized);
  assert.equal(renderInstitutionName(normalized),expected);
 }
 assert.equal(renderInstitutionName('UNIVERSIDADE FEDERAL DE SÃO PAULO'),'Universidade Federal de São Paulo');
 for(const prefix of ['ORIENTADOR','COORIENTADOR','EXAMINADOR_2','EXAMINADOR_3'])assert.equal(normalizeRegistrationValue(`${prefix}_INSTITUICAO`,'text','*faesa*'),'*FAESA*');
 assert.equal(normalizeRegistrationValue('ORIENTADOR_NOME','text','*maria*'),'*maria*');
 assert.equal(normalizeRegistrationValue('ORIENTADOR_EMAIL','email','TESTE@EXAMPLE.INVALID'),'teste@example.invalid');
});

import {formatTccTitle,renderTccTitle} from '../src/utils/formatters';
test('plus-minus acronym markers are stable in titles and institutions',()=>{
 assert.equal(renderInstitutionName('universidade +faesa-'), 'Universidade FAESA');
 const title=formatTccTitle('ESTUDO SOBRE +FAESA- E +XYZ-');
 assert.equal(title,'Estudo Sobre *FAESA* e *XYZ*');
 assert.equal(formatTccTitle(title),title);
 assert.equal(renderTccTitle('esse é um teste - *faesa*'),'Esse é Um Teste - FAESA');
 assert.equal(renderTccTitle('esse é um teste - +faesa-'),'Esse é Um Teste - FAESA');
});
