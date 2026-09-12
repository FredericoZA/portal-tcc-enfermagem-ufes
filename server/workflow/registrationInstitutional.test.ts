import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptRegistration } from './registration';

const validAnswers = () => ({
  ALUNO_1_NOME: '  MARIA   DAS DORES SILVA  ',
  ALUNO_1_MATRICULA: '2026-00123',
  ALUNO_1_CPF: '529.982.247-25',
  ALUNO_1_EMAIL: '  MARIA@EDU.UFES.BR ',
  TEM_ALUNO_2: 'Não',
  ORIENTADOR_NOME: 'JOÃO DE SOUZA',
  ORIENTADOR_EMAIL: 'JOAO@UFES.BR',
  ORIENTADOR_CPF: '111.444.777-35',
  ORIENTADOR_SIAPE: 'CIAP123',
  TEM_COORIENTADOR: 'Não',
  EXAMINADOR_2_NOME: 'ANA PAULA LIMA',
  EXAMINADOR_2_EMAIL: 'ANA@UFES.BR',
  EXAMINADOR_2_CPF: '935.411.347-80',
  EXAMINADOR_2_INSTITUICAO: 'UFES',
  EXAMINADOR_3_NOME: 'Beatriz Ferreira Mendes',
  EXAMINADOR_3_EMAIL: 'BEATRIZ@FIOCRUZ.BR',
  EXAMINADOR_3_CPF: '390.533.447-05',
  EXAMINADOR_3_INSTITUICAO: 'Fiocruz',
  TITULO: 'IMPACTO DO CUIDADO DE ENFERMAGEM NA UTI',
  DEFESA_DATA_HORA: '2026-09-21T14:00',
  DEFESA_LOCAL: 'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES',
  LOCAL_ALTERNATIVO: ''
});

test('cadastro institucional normaliza nome, e-mail, matrícula, CPF e título após validar', () => {
  const result = acceptRegistration({ registrationAnswers: validAnswers() });
  assert.equal(result.aluno1.nome, 'Maria das Dores Silva');
  assert.equal(result.aluno1.email, 'maria@edu.ufes.br');
  assert.equal(result.aluno1.matricula, '202600123');
  assert.equal(result.registrationAnswers.ALUNO_1_CPF, '52998224725');
  assert.equal(result.orientador.nome, 'João de Souza');
  assert.equal(result.orientador.email, 'joao@ufes.br');
  assert.equal(result.titulo, 'Impacto do Cuidado de Enfermagem na UTI');
  assert.equal(result.banca[1].email, 'beatriz@fiocruz.br');
});

test('cadastro rejeita nome incompleto ou com número', () => {
  const answers = validAnswers();
  answers.ALUNO_1_NOME = 'Maria2';
  assert.throws(() => acceptRegistration({ registrationAnswers: answers }), /nome completo/i);
});

test('cadastro rejeita matrícula com texto', () => {
  const answers = validAnswers();
  answers.ALUNO_1_MATRICULA = 'ABC123';
  assert.throws(() => acceptRegistration({ registrationAnswers: answers }), /matrícula completa/i);
});

test('cadastro rejeita CPF com dígito verificador inválido', () => {
  const answers = validAnswers();
  answers.ALUNO_1_CPF = '52998224724';
  assert.throws(() => acceptRegistration({ registrationAnswers: answers }), /CPF inválido/i);
});

test('banca externa continua permitida por e-mail válido', () => {
  const result = acceptRegistration({ registrationAnswers: validAnswers() });
  assert.equal(result.banca[1].instituicao, 'Fiocruz');
  assert.equal(result.banca[1].email, 'beatriz@fiocruz.br');
});
