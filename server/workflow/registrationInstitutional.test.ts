import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptRegistration } from './registration';

const validAnswers = () => ({
  ALUNO_1_NOME: '  MARIA   DAS DORES SILVA  ',
  ALUNO_1_MATRICULA: '2026-00123',
  ALUNO_1_EMAIL: '  MARIA@EDU.UFES.BR ',
  TEM_ALUNO_2: 'Não',
  ORIENTADOR_NOME: 'JOÃO DE SOUZA',
  ORIENTADOR_EMAIL: 'JOAO@UFES.BR',
  ORIENTADOR_SIAPE: '1234567',
  TEM_COORIENTADOR: 'Não',
  EXAMINADOR_2_NOME: 'ANA PAULA LIMA',
  EXAMINADOR_2_EMAIL: 'ANA@UFES.BR',
  EXAMINADOR_2_INSTITUICAO: 'UFES',
  EXAMINADOR_3_NOME: 'Beatriz Ferreira Mendes',
  EXAMINADOR_3_EMAIL: 'BEATRIZ@FIOCRUZ.BR',
  EXAMINADOR_3_INSTITUICAO: 'Fiocruz',
  TITULO: 'IMPACTO DO CUIDADO DE ENFERMAGEM NA UTI',
  DEFESA_DATA_HORA: '2026-09-21T14:00',
  DEFESA_LOCAL: 'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES',
  LOCAL_ALTERNATIVO: ''
});

test('cadastro institucional corrige caixa alta e normaliza os campos operacionais', () => {
  const result = acceptRegistration({ registrationAnswers: validAnswers() });
  assert.equal(result.aluno1.nome, 'Maria das Dores Silva');
  assert.equal(result.aluno1.email, 'maria@edu.ufes.br');
  assert.equal(result.aluno1.matricula, '');
  assert.equal(result.orientador.nome, 'João de Souza');
  assert.equal(result.orientador.email, 'joao@ufes.br');
  assert.equal(result.orientador.siape, '');
  assert.equal(result.titulo, 'Impacto do Cuidado de Enfermagem na UTI');
  assert.equal(result.banca[1].email, 'beatriz@fiocruz.br');
});

test('cadastro aceita nomes internacionais sem exigir sobrenome ou alfabeto latino', () => {
  for(const nome of ['李','محمد','Nguyễn','Jean-Luc O’Neill','D’ÁVILA','Nana 2']){
    const answers = validAnswers(); answers.ALUNO_1_NOME=nome;
    const result=acceptRegistration({registrationAnswers:answers});
    assert.equal(result.aluno1.nome,nome==='D’ÁVILA'?'D’Ávila':nome);
  }
});

test('cadastros novos descartam registros recebidos de formulários antigos', () => {
  for(const registro of ['1','00001','123456','0'.repeat(600)+'123','ABC123']){
    const answers=validAnswers();answers.ALUNO_1_MATRICULA=registro;answers.ORIENTADOR_SIAPE=registro;
    const legacyStudio={formTemplates:[{id:'form-reserva-aluno',questions:[{fieldKey:'ALUNO_1_MATRICULA',validation:{maxLength:20,minLength:5,pattern:'^\\d{5,20}$'}},{fieldKey:'ORIENTADOR_SIAPE',validation:{maxLength:7,minLength:7,pattern:'^\\d{7}$'}}]}]};
    const result=acceptRegistration({registrationAnswers:answers},legacyStudio as any);
    assert.equal(result.aluno1.matricula,'');assert.equal(result.orientador.siape,'');
    assert.equal(result.registrationAnswers.ALUNO_1_MATRICULA,undefined);
    assert.equal(result.registrationAnswers.ORIENTADOR_SIAPE,undefined);
  }
});

test('banca externa continua permitida sem SIAPE quando e-mail e instituição são válidos', () => {
  const result = acceptRegistration({ registrationAnswers: validAnswers() });
  assert.equal(result.banca[1].instituicao, 'Fiocruz');
  assert.equal(result.banca[1].email, 'beatriz@fiocruz.br');
  assert.equal(result.banca[1].siape, '');
});

test('cadastro rejeita defesa no sábado', () => {
  const answers = validAnswers();
  answers.DEFESA_DATA_HORA = '2026-09-26T09:00';
  assert.throws(() => acceptRegistration({ registrationAnswers: answers }), /segunda a sexta-feira/i);
});

test('cadastro rejeita defesa no domingo', () => {
  const answers = validAnswers();
  answers.DEFESA_DATA_HORA = '2026-09-27T09:00';
  assert.throws(() => acceptRegistration({ registrationAnswers: answers }), /segunda a sexta-feira/i);
});
test('instituição interpreta siglas marcadas no servidor e remove asteriscos dos dados persistidos',()=>{
 const result=acceptRegistration({registrationAnswers:{...validAnswers(),EXAMINADOR_2_INSTITUICAO:'*faesa*',EXAMINADOR_3_INSTITUICAO:'Centro de Pesquisa *ucl*'}});
 assert.equal(result.banca[0].instituicao,'FAESA');
 assert.equal(result.banca[1].instituicao,'Centro de Pesquisa UCL');
 assert.equal(result.registrationAnswers.EXAMINADOR_2_INSTITUICAO,'FAESA');
 assert.equal(result.registrationAnswers.EXAMINADOR_3_INSTITUICAO,'Centro de Pesquisa UCL');
});
