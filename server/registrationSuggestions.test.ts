import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFieldHistory,matchingRegistrationSuggestions} from '../src/utils/registrationHistory';

test('autocomplete shares personal history across roles, keeps types separate and matches accents',()=>{
 const recent={ALUNO_1_EMAIL:['tcc+autor@example.invalid'],ORIENTADOR_EMAIL:['tcc+orientador@example.invalid'],EXAMINADOR_2_EMAIL:['tcc+banca@example.invalid'],ALUNO_1_NOME:['João D’Ávila'],ORIENTADOR_SIAPE:['000123'],ALUNO_2_MATRICULA:['00456']};
 assert.equal(registrationFieldHistory(recent,'EXAMINADOR_3_EMAIL').length,3);
 assert.deepEqual(registrationFieldHistory(recent,'ALUNO_2_NOME'),['João D’Ávila']);
 assert.deepEqual(registrationFieldHistory(recent,'COORIENTADOR_SIAPE'),['000123','00456']);
 assert.deepEqual(matchingRegistrationSuggestions(['João D’Ávila','João D’Ávila','José'],'joa'),['João D’Ávila']);
 assert.equal(matchingRegistrationSuggestions(Array.from({length:75},(_,i)=>`tcc+${i}@example.invalid`),'tcc').length,75);
 assert.deepEqual(matchingRegistrationSuggestions(registrationFieldHistory(recent,'ALUNO_1_EMAIL'),'tcc+b'),['tcc+banca@example.invalid']);
});
