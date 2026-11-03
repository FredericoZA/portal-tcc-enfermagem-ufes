import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationQuestions,registrationPayload} from '../src/utils/operationalConfig';
import {registrationIdentitySentence,authorReferenceOptions} from '../src/utils/registrationIdentity';
import {acceptRegistration} from './workflow/registration';
import {authorGrammar,authorNames,AUTHOR_ORDER_OPTIONS} from '../src/utils/personPresentation';
const base=()=>({ALUNO_1_NOME:'Alex Mcdonald D’Ávila',ALUNO_1_EMAIL:'alex@edu.ufes.br',ALUNO_1_MATRICULA:'202600001',TEM_ALUNO_2:'Não',TEM_COORIENTADOR:'Não',ORIENTADOR_NOME:'Noa Silva',ORIENTADOR_EMAIL:'noa@example.invalid',ORIENTADOR_SIAPE:'1234567',ORIENTADOR_TRATAMENTO:'Professora',ORIENTADOR_TITULACAO:'Doutora',EXAMINADOR_2_NOME:'Ana Lima',EXAMINADOR_2_EMAIL:'ana@example.invalid',EXAMINADOR_2_INSTITUICAO:'UFES',EXAMINADOR_2_TRATAMENTO:'Professora',EXAMINADOR_2_TITULACAO:'Mestra',EXAMINADOR_3_NOME:'Rui Santos',EXAMINADOR_3_EMAIL:'rui@example.invalid',EXAMINADOR_3_INSTITUICAO:'UFES',EXAMINADOR_3_TRATAMENTO:'Professor',EXAMINADOR_3_TITULACAO:'Mestre',TITULO:'Práticas de cuidado em enfermagem',DEFESA_DATA_HORA:'2026-10-30T08:10',DEFESA_LOCAL:registrationQuestions().find(q=>q.fieldKey==='DEFESA_LOCAL')!.options![0]});
test('sentence choice controls canonical grammar for one/two authors and ordering',()=>{
 for(const reference of ['o aluno','a aluna','os alunos','as alunas']){
  const plural=reference.startsWith('os ')||reference.startsWith('as ');
  const a={...base(),AUTORIA_REFERENCIA:reference,TEM_ALUNO_2:plural?'Sim':'Não',ALUNO_2_NOME:'Beatriz Lima',ALUNO_2_EMAIL:'beatriz@edu.ufes.br',ALUNO_2_MATRICULA:'202600002',AUTORIA_ORDEM:AUTHOR_ORDER_OPTIONS[1]};
  const payload=registrationPayload(a,'America/Sao_Paulo');assert.equal(payload.personPresentationVersion,3);const accepted=acceptRegistration(payload);
  const p={aluno1:accepted.aluno1,aluno2:accepted.aluno2,authorOrder:accepted.authorOrder} as any;
  assert.equal(authorGrammar(p).plural,plural);assert.equal(authorGrammar(p).female,reference==='a aluna'||reference==='as alunas');
  assert.equal(authorNames(p),plural?'Alex Mcdonald D’Ávila e Beatriz Lima':'Alex Mcdonald D’Ávila');
  assert.equal(registrationIdentitySentence(a),`${plural?'Estavam presentes':'Estava presente'} ${reference} ${authorNames(p)}.`);
  assert.deepEqual(registrationQuestions(undefined,a).find(q=>q.fieldKey==='AUTORIA_REFERENCIA')?.options,authorReferenceOptions(plural));
 }
});
test('new registration rejects missing choice or singular/plural mismatch and keeps faculty selectors',()=>{
 const payload=registrationPayload({...base(),AUTORIA_REFERENCIA:'a aluna'},'America/Sao_Paulo');
 assert.throws(()=>acceptRegistration({...payload,registrationAnswers:{...payload.registrationAnswers,AUTORIA_REFERENCIA:''}}),/obrigatório/);
 assert.throws(()=>acceptRegistration({...payload,registrationAnswers:{...payload.registrationAnswers,TEM_ALUNO_2:'Sim',ALUNO_2_NOME:'Beatriz Lima',ALUNO_2_EMAIL:'beatriz@edu.ufes.br',ALUNO_2_MATRICULA:'202600002'}}),/opção publicada/);
 const fields=registrationQuestions();for(const key of ['ORIENTADOR_TRATAMENTO','ORIENTADOR_TITULACAO','EXAMINADOR_2_TRATAMENTO','EXAMINADOR_3_TITULACAO']){const field=fields.find(q=>q.fieldKey===key)!;assert.equal(field.fieldType,'select');assert.equal(field.required,true);}
});
