import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePersonName} from '../src/utils/personNameCase';
import {normalizeRegistrationValue} from '../src/utils/registrationNormalization';
import {registrationQuestions} from '../src/utils/operationalConfig';

test('nomes não persistem palavras em caixa alta e preservam grafias internacionais',()=>{
 for(const [input,expected] of [
  ['  MARIA   DAS DORES SILVA  ','Maria das Dores Silva'],
  ['Camila Zacché de AGUIAR','Camila Zacché de Aguiar'],
  ["JEAN-LUC O'NEILL","Jean-Luc O'Neill"],
  ['Alex McDonald d’Ávila','Alex Mcdonald D’Ávila'],
  ['Rodolfo ZAcché de Aguiar','Rodolfo Zacché de Aguiar'],
  ['cAmIlA zAcChÉ DE aGuIaR','Camila Zacché de Aguiar'],
  ['李 明','李 明'],['محمد','محمد'],['NGUYỄN THỊ HỒNG','Nguyễn Thị Hồng'],
  ['ana-maria','Ana-Maria'],['DʼÁVILA','DʼÁvila']
 ]){assert.equal(normalizePersonName(input),expected);assert.equal(normalizePersonName(expected),expected);}
 for(const prefix of ['ALUNO_1','ALUNO_2','ORIENTADOR','COORIENTADOR','EXAMINADOR_2','EXAMINADOR_3']){
  assert.equal(normalizeRegistrationValue(`${prefix}_NOME`,'text','MARIA SILVA'),'Maria Silva');
  assert.equal(normalizeRegistrationValue(`${prefix}_NOME`,'text','Rodolfo ZAcché de Aguiar'),'Rodolfo Zacché de Aguiar');
 }
 assert.equal(normalizeRegistrationValue('CAMPO_LIVRE','text','TEXTO'),'TEXTO');
});

test('validação publicada antiga não volta a restringir os nomes internacionais',()=>{
 const q=registrationQuestions({formTemplates:[{id:'form-reserva-aluno',questions:[{fieldKey:'ALUNO_1_NOME',validation:{pattern:'^[A-Z]+$',minLength:5}}]}] as any}).find(q=>q.fieldKey==='ALUNO_1_NOME')!;
 assert.equal(q.validation?.pattern,undefined);assert.equal(q.validation?.minLength,1);
});
