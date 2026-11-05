import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFieldHistory,matchingRegistrationSuggestions,readRegistrationMemory,saveRegistrationMemory} from '../src/utils/registrationHistory';

test('autocomplete shares personal history across roles, keeps types separate and matches accents',()=>{
 const recent={ALUNO_1_EMAIL:['tcc+autor@example.invalid'],ORIENTADOR_EMAIL:['tcc+orientador@example.invalid'],EXAMINADOR_2_EMAIL:['tcc+banca@example.invalid'],ALUNO_1_NOME:['João D’Ávila'],ORIENTADOR_SIAPE:['000123'],ALUNO_2_MATRICULA:['00456']};
 assert.equal(registrationFieldHistory(recent,'EXAMINADOR_3_EMAIL').length,3);
 assert.deepEqual(registrationFieldHistory(recent,'ALUNO_2_NOME'),['João D’Ávila']);
 assert.deepEqual(registrationFieldHistory(recent,'COORIENTADOR_SIAPE'),[]);
 assert.deepEqual(registrationFieldHistory(recent,'ALUNO_1_MATRICULA'),[]);
 assert.deepEqual(matchingRegistrationSuggestions(['João D’Ávila','João D’Ávila','José'],'joa'),['João D’Ávila']);
 assert.equal(matchingRegistrationSuggestions(Array.from({length:75},(_,i)=>`tcc+${i}@example.invalid`),'tcc').length,75);
 assert.deepEqual(matchingRegistrationSuggestions(registrationFieldHistory(recent,'ALUNO_1_EMAIL'),'tcc+b'),['tcc+banca@example.invalid']);
});

test('registration memory omits identifiers from new drafts and removes them from the old local cache without losing names or section',()=>{
 const values=new Map<string,string>();
 const storage={getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
 const user='person@example.invalid',key='portal-registration-v2:'+user;
 const answers={ALUNO_1_NOME:'Ana Silva',ALUNO_1_EMAIL:user,ALUNO_1_MATRICULA:'STUDENT-PRIVATE',ORIENTADOR_SIAPE:'FACULTY-PRIVATE',COORIENTADOR_CIAP:'CIAP-PRIVATE',EXAMINADOR_2_CPF:'CPF-PRIVATE',TITULO:'Cuidado em Enfermagem'};
 const before=structuredClone(answers);
 saveRegistrationMemory(storage,user,answers,4,1000);
 assert.doesNotMatch(values.get(key)||'',/STUDENT-PRIVATE|FACULTY-PRIVATE|CIAP-PRIVATE|CPF-PRIVATE|MATRICULA|SIAPE|CIAP|CPF/);
 assert.deepEqual(answers,before);
 values.set(key,JSON.stringify({savedAt:1000,section:4,answers,recent:{ORIENTADOR_NOME:['Docente Exemplo'],ORIENTADOR_SIAPE:['FACULTY-PRIVATE'],EXAMINADOR_2_CPF:['CPF-PRIVATE']}}));
 const restored=readRegistrationMemory(storage,user,1001);
 assert.equal(restored?.section,4);
 assert.equal(restored?.answers.ALUNO_1_NOME,'Ana Silva');
 assert.equal(restored?.answers.ALUNO_1_EMAIL,user);
 assert.deepEqual(restored?.recent,{ORIENTADOR_NOME:['Docente Exemplo']});
 assert.doesNotMatch(values.get(key)||'',/STUDENT-PRIVATE|FACULTY-PRIVATE|CIAP-PRIVATE|CPF-PRIVATE|MATRICULA|SIAPE|CIAP|CPF/);
});
