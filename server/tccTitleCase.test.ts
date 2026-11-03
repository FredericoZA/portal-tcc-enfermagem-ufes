import test from 'node:test';
import assert from 'node:assert/strict';
import {formatTccTitle} from '../src/utils/formatters';
import {normalizeRegistrationValue} from '../src/utils/registrationNormalization';
import {registrationPayload} from '../src/utils/operationalConfig';
test('TCC titles capitalize main words and retain acronyms and codes',()=>{
 for(const [input,expected] of [
  ['Eu Preciso de um Nome de Trabalho','Eu Preciso de Um Nome de Trabalho'],
  ['Eu preciso de um NOME de TRABALHO','Eu Preciso de Um Nome de Trabalho'],
  ['esse é um teste vamos ver como fica','Esse é Um Teste Vamos Ver Como Fica'],
  ['  SEGURANÇA   DO PACIENTE NO SUS E NA UTI  ','Segurança do Paciente no SUS e na UTI'],
  ['CUIDADOS NA COVID-19 E NA COVID19','Cuidados na COVID-19 e na COVID19'],
  ['Uso da SAE e do protocolo AB-123','Uso da SAE e do Protocolo AB-123'],
  ['Cuidados na covid-19','Cuidados na COVID-19'],
  ['HIV: ASSISTÊNCIA DE ENFERMAGEM','HIV: Assistência de Enfermagem'],
  ['SUS E OMS','SUS e OMS'],
 ]){assert.equal(formatTccTitle(input),expected);assert.equal(formatTccTitle(expected),expected);assert.equal(normalizeRegistrationValue('TITULO','text',input),expected);}
 assert.equal(registrationPayload({TITULO:'SEGURANÇA NO SUS',DEFESA_DATA_HORA:'2026-11-20T14:00'},'America/Sao_Paulo').titulo,'Segurança no SUS');
});
