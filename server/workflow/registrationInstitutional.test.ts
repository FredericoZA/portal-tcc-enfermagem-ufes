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

test('cadastro institucional normaliza nome, e-mail, matrícula, SIAPE e título', () => {
  const result = acceptRegistration({ registrationAnswers: validAnswers() });
  assert.equal(result.aluno1.nome, 'Maria das Dores Silva');
  assert.equal(result.aluno1.email, 'maria@edu.ufes.br');
  assert.equal(result.aluno1.matricula, '202600123');
  assert.equal(result.orientador.nome, 'João de Souza');
  assert.equal(result.orientador.email, 'joao@ufes.br');
  assert.equal(result.orientador.siape, '1234567');
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

test('cadastro rejeita SIAPE com quantidade incorreta de algarismos', () => {
  const answers = validAnswers();
  answers.ORIENTADOR_SIAPE = '123456';
  assert.throws(() => acceptRegistration({ registrationAnswers: answers }), /SIAPE/i);
});

test('banca externa continua permitida sem SIAPE quando e-mail e instituição são válidos', () => {
  const result = acceptRegistration({ registrationAnswers: validAnswers() });
  assert.equal(result.banca[1].instituicao, 'Fiocruz');
  assert.equal(result.banca[1].email, 'beatriz@fiocruz.br');
  assert.equal(result.banca[1].siape, '');
});
