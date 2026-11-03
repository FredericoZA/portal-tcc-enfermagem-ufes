import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationQuestions,registrationPayload} from '../src/utils/operationalConfig';
import {registrationIdentitySentence} from '../src/utils/registrationIdentity';
import {personPresentationVariables} from '../src/utils/personPresentation';
test('legacy published order field is removed and stale draft cannot reverse new registration',()=>{
 const fields=registrationQuestions({formTemplates:[{id:'form-reserva-aluno',questions:[{fieldKey:'AUTORIA_ORDEM',label:'Ordem antiga',fieldType:'select',required:true}]}]} as any);
 assert.equal(fields.some(field=>field.fieldKey==='AUTORIA_ORDEM'),false);
 assert.equal(fields.find(field=>field.fieldKey==='ALUNO_1_NOME')!.helpText,fields.find(field=>field.fieldKey==='ALUNO_2_NOME')!.helpText);
 assert.match(fields.find(field=>field.fieldKey==='ALUNO_1_NOME')!.helpText!,/ordem dos autores/);
 for(const field of fields.filter(field=>/_NOME$/.test(field.fieldKey))){assert.ok(field.helpText!.length<110);assert.doesNotMatch(field.helpText!,/CAIXA ALTA|capitalização|Apóstrofos/);}
 const answers={ALUNO_1_NOME:'Frederico Zacché de Aguiar',ALUNO_2_NOME:'Larissa Pandolfi Soares',TEM_ALUNO_2:'Sim',AUTORIA_REFERENCIA:'os alunos',AUTORIA_ORDEM:'Segundo autor, depois primeiro autor',DEFESA_DATA_HORA:'2026-10-30T08:10'};
 const payload=registrationPayload(answers,'America/Sao_Paulo');
 assert.equal(payload.authorOrder,'ALUNO_1_FIRST');
 assert.equal(payload.registrationAnswers.AUTORIA_ORDEM,undefined);
 assert.equal(registrationIdentitySentence(answers),'Estavam presentes os alunos Frederico Zacché de Aguiar e Larissa Pandolfi Soares.');
 const vars=personPresentationVariables({...payload,banca:[],avaliacao:{}} as any);
 assert.equal(vars.AUTORIA_PRIMEIRO_NOME,answers.ALUNO_1_NOME);assert.equal(vars.AUTORIA_SEGUNDO_NOME,answers.ALUNO_2_NOME);
});
