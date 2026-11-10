import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeInstitutionInput,renderInstitutionName,institutionSearchText} from '../src/utils/institutionName';
import {normalizeRegistrationValue} from '../src/utils/registrationNormalization';

test('instituições usam siglas automáticas e aceitam notação antiga sem emitir marcadores',()=>{
 for(const [input,expected] of [['*faesa*','FAESA'],['*univix*','UNIVIX'],['universidade *ufes* de vitória','Universidade UFES de Vitória'],['  *ucl*  / *faesa* ','UCL / FAESA']]){
  const normalized=normalizeInstitutionInput(input);
  assert.equal(normalizeInstitutionInput(normalized),normalized);
  assert.equal(renderInstitutionName(normalized),expected);
 }
 assert.equal(renderInstitutionName('UNIVERSIDADE FEDERAL DE SÃO PAULO'),'Universidade Federal de São Paulo');
 for(const prefix of ['ORIENTADOR','COORIENTADOR','EXAMINADOR_2','EXAMINADOR_3'])assert.equal(normalizeRegistrationValue(`${prefix}_INSTITUICAO`,'text','*faesa*'),'FAESA');
 assert.equal(normalizeRegistrationValue('ORIENTADOR_NOME','text','*maria*'),'*maria*');
 assert.equal(normalizeRegistrationValue('ORIENTADOR_EMAIL','email','TESTE@EXAMPLE.INVALID'),'teste@example.invalid');
});

import {formatTccTitle,renderTccTitle} from '../src/utils/formatters';
test('notação antiga é aceita sem exigir nem devolver marcadores',()=>{
 assert.equal(renderInstitutionName('universidade +faesa-'), 'Universidade FAESA');
 const title=formatTccTitle('ESTUDO SOBRE +FAESA- E +XYZ-');
 assert.equal(title,'Estudo Sobre FAESA e XYZ');
 assert.equal(formatTccTitle(title),title);
 assert.equal(renderTccTitle('esse é um teste - *faesa*'),'Esse é Um Teste - FAESA');
 assert.equal(renderTccTitle('esse é um teste - +faesa-'),'Esse é Um Teste - FAESA');
});


test('busca resolve sigla e nome extenso da UFES sem alterar dados ou inferir vínculos externos',()=>{
 const raw='Universidade Federal do Espírito Santo';
 const text=institutionSearchText(raw);
 assert.ok(text.includes('ufes'));assert.ok(text.includes('universidade federal do espirito santo'));
 assert.equal(institutionSearchText('*UFES*'),text);
 assert.equal(renderInstitutionName(raw),raw);
 for(const external of ['Universidade Federal de São Paulo','Universidade Estadual do Espírito Santo','UFES de outra instituição'])assert.notEqual(institutionSearchText(external),text);
});


test('instituições e títulos reconhecem siglas sem marcação e corrigem caixa alta comum',()=>{
 const cases=[['ufes','UFES'],['FAESA','FAESA'],['UNIVIX','UNIVIX'],['UCL','UCL'],['ufmg','UFMG'],['UFRGS','UFRGS'],['ifsp','IFSP'],['PUC-SP','PUC-SP'],['UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO','Universidade Federal do Espírito Santo'],['CENTRO UNIVERSITÁRIO DE VITÓRIA - UNIVIX','Centro Universitário de Vitória - UNIVIX'],['HOSPITAL UNIVERSITÁRIO HUCAM/UFES','Hospital Universitário HUCAM/UFES']];
 for(const [input,expected] of cases){
  assert.equal(normalizeInstitutionInput(input),expected);
  assert.equal(renderInstitutionName(input),expected);
  assert.equal(normalizeInstitutionInput(expected),expected);
  for(const key of ['COORIENTADOR_INSTITUICAO','EXAMINADOR_2_INSTITUICAO','EXAMINADOR_3_INSTITUICAO'])assert.equal(normalizeRegistrationValue(key,'text',input),expected);
 }
 for(const input of ['ESTUDO SOBRE HIV NO SUS E NA UFES','estudo sobre hiv no sus e na ufes','ESTUDO SOBRE *HIV* NO *SUS* E NA *UFES*']){
  assert.equal(formatTccTitle(input),'Estudo Sobre HIV no SUS e na UFES');
  assert.equal(renderTccTitle(input),'Estudo Sobre HIV no SUS e na UFES');
 }
 assert.equal(normalizeInstitutionInput('INSTITUIÇÃO NOVA E DESCONHECIDA'),'Instituição Nova e Desconhecida');
});


test('normalização não descarta um asterisco literal sem par em texto científico',()=>{
 assert.equal(formatTccTitle('cálculo a*b'),'Cálculo a*B');
});


test('marcação antiga combinada ou colada em Markdown desaparece em uma passagem de normalização',()=>{
 for(const raw of ['**UFES**','+*UFES*-','*+UFES-*','***faesa***']){
  const expected=raw.includes('faesa')?'FAESA':'UFES';
  for(const format of [normalizeInstitutionInput,formatTccTitle]){
   assert.equal(format(raw),expected);
   assert.equal(format(format(raw)),expected);
  }
 }
});
