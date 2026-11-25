import test from 'node:test';
import assert from 'node:assert/strict';
import {capitalizationSuggestion,needsCapitalizationReview} from '../src/utils/capitalizationReview';
import {normalizeRegistrationValue} from '../src/utils/registrationNormalization';
import {registrationPayload} from '../src/utils/operationalConfig';
import {renderInstitutionName} from '../src/utils/institutionName';

test('uppercase title cannot be explicitly kept, while an institutional spelling still can',()=>{
  for(const [kind,value] of [['title','ESTUDO NO XYZQ'],['institution','XYZQ / CENTRO DE ESTUDOS']] as const){
    assert.equal(needsCapitalizationReview(value,kind),true);
    assert.notEqual(capitalizationSuggestion(value,kind),value);
    assert.equal(needsCapitalizationReview(value,kind,value),kind === 'title');
    assert.equal(needsCapitalizationReview(value+' II',kind,value),true);
  }
  assert.equal(needsCapitalizationReview('UFES','institution'),false);
});
test('initial normalization, payload and institutional rendering preserve the chosen spelling without changing person name and email policy',()=>{
  const values={TITULO:'ESTUDO NO XYZQ',EXAMINADOR_2_INSTITUICAO:'XYZQ',EXAMINADOR_3_INSTITUICAO:'Instituto iNOVA',COORIENTADOR_INSTITUICAO:'CENTRO ABCX'};
  for(const [key,value] of Object.entries(values))assert.equal(normalizeRegistrationValue(key,'text',value),value);
  const payload=registrationPayload({...values,DEFESA_DATA_HORA:'2026-11-16T22:00',TEM_COORIENTADOR:'Sim'},'America/Sao_Paulo');
  assert.equal(payload.titulo,values.TITULO);
  assert.equal(payload.banca[0].instituicao,values.EXAMINADOR_2_INSTITUICAO);
  assert.equal(payload.banca[1].instituicao,values.EXAMINADOR_3_INSTITUICAO);
  assert.equal(payload.coorientador?.instituicao,values.COORIENTADOR_INSTITUICAO);
  assert.equal(renderInstitutionName('XYZQ'), 'XYZQ');
  assert.equal(normalizeRegistrationValue('ALUNO_1_EMAIL','email','ANA@EXAMPLE.INVALID'),'ana@example.invalid');
});

test('server admission blocks title prose and preserves acronyms, names and institution spellings',async()=>{
  const {acceptRegistration}=await import('./workflow/registration');
  const registrationAnswers = {
    ALUNO_1_NOME:'ALUNO DE REVISÃO LOCAL',ALUNO_1_EMAIL:'author@example.invalid',TEM_ALUNO_2:'Não',TEM_COORIENTADOR:'Sim',
    ORIENTADOR_NOME:'ANA PAULA SANTOS',ORIENTADOR_EMAIL:'advisor@example.invalid',
    COORIENTADOR_NOME:'Roberto Lima',COORIENTADOR_EMAIL:'coadvisor@example.invalid',COORIENTADOR_INSTITUICAO:'CENTRO XYZQ',
    EXAMINADOR_2_NOME:'CARLOS ROCHA',EXAMINADOR_2_EMAIL:'examiner-one@example.invalid',EXAMINADOR_2_INSTITUICAO:'XYZQ',
    EXAMINADOR_3_NOME:'Beatriz Mendes',EXAMINADOR_3_EMAIL:'examiner-two@example.invalid',EXAMINADOR_3_INSTITUICAO:'Instituto iNOVA',
    TITULO:'Estudo do projeto XYZQ no SUS',DEFESA_DATA_HORA:'2026-11-16T22:00',DEFESA_LOCAL:'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES',
  };
  assert.throws(() => acceptRegistration({registrationAnswers:{...registrationAnswers,
    TITULO:'ETARISMO NA UNIVERSIDADE: Uma revisão integrativa',
  }}), /Escreva o título em caixa normal/);
  const payload = acceptRegistration({registrationAnswers});
  assert.equal(payload.titulo,registrationAnswers.TITULO);
  assert.equal(payload.aluno1.nome,'Aluno de Revisão Local');
  assert.equal(payload.orientador.nome,'Ana Paula Santos');
  assert.equal(payload.banca[0].nome,'Carlos Rocha');
  assert.equal(payload.registrationAnswers.TITULO,payload.titulo);
  assert.equal(payload.banca[0].instituicao,'XYZQ');
  assert.equal(payload.banca[1].instituicao,'Instituto iNOVA');
  assert.equal(payload.coorientador?.instituicao,'CENTRO XYZQ');
});
