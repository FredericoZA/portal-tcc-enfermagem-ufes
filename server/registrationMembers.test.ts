import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRegistrationMemberRows } from '../src/utils/registrationMembers';
import type { RegistrationAnswers } from '../src/types/operationalConfig';

const answers: RegistrationAnswers = {
  ALUNO_1_NOME: 'ana maria de souza',
  ALUNO_1_EMAIL: 'ana@edu.ufes.br',
  ALUNO_1_MATRICULA: '202612345',
  TEM_ALUNO_2: 'Sim',
  ALUNO_2_NOME: 'bruno da silva',
  ALUNO_2_EMAIL: 'bruno@edu.ufes.br',
  ALUNO_2_MATRICULA: '202612346',
  ORIENTADOR_NOME: 'maria de almeida',
  ORIENTADOR_EMAIL: 'maria@ufes.br',
  ORIENTADOR_TRATAMENTO: 'Professora',
  ORIENTADOR_TITULACAO: 'Doutora',
  ORIENTADOR_SIAPE: '1234567',
  EXAMINADOR_2_NOME: 'carlos pereira',
  EXAMINADOR_2_EMAIL: 'carlos@ufes.br',
  EXAMINADOR_2_TRATAMENTO: 'Professor',
  EXAMINADOR_2_TITULACAO: 'Doutor',
  EXAMINADOR_2_SIAPE: '2345678',
  EXAMINADOR_2_INSTITUICAO: 'Universidade Federal do *ESPÍRITO SANTO*',
  EXAMINADOR_3_NOME: 'joana oliveira',
  EXAMINADOR_3_EMAIL: 'joana@ufes.br',
  EXAMINADOR_3_TITULACAO: 'Doutora',
  EXAMINADOR_3_SIAPE: '3456789',
  TEM_COORIENTADOR: 'Sim',
  COORIENTADOR_NOME: 'roberto costa',
  COORIENTADOR_EMAIL: 'roberto@ufes.br',
  COORIENTADOR_TRATAMENTO: 'Professor',
  COORIENTADOR_TITULACAO: 'Doutor',
  COORIENTADOR_SIAPE: '4567890',
};

test('resumo apresenta os seis participantes na ordem usada em Dados dos membros', () => {
  const rows = buildRegistrationMemberRows(answers, 'UFES');
  assert.deepEqual(rows.map(({ role }) => role), [
    'Aluno autor', 'Aluno autor', 'Orientadora', 'Examinador', 'Examinadora', 'Coorientador',
  ]);
  assert.equal(rows[0].name, 'Ana Maria de Souza');
  assert.equal(rows[0].reference, 'Aluno');
  assert.equal(rows[0].qualification, '—');
  assert.equal(rows[1].registration, '202612346');
  assert.equal(rows[2].reference, 'Professora');
  assert.equal(rows[2].qualification, 'Doutora');
  assert.equal(rows[2].institution, 'Não informado');
  assert.equal(rows[3].institution, 'Universidade Federal do ESPÍRITO SANTO');
  assert.equal(rows[5].email, 'roberto@ufes.br');
});

test('resumo não mostra autores ou coorientadores desmarcados', () => {
  const rows = buildRegistrationMemberRows({
    ...answers,
    TEM_ALUNO_2: 'Não',
    TEM_COORIENTADOR: 'Não',
  }, 'UFES');
  assert.equal(rows.length, 4);
  assert.equal(rows.some((row) => row.role === 'Coorientador'), false);
});

test('resumo mantém a instituição da instalação sem presumir UFES em outro portal', () => {
  const rows = buildRegistrationMemberRows(answers, 'IFES');
  assert.equal(rows[0].institution, 'IFES');
  assert.equal(rows[1].institution, 'IFES');
});

test('rótulo e referência acompanham o tratamento feminino cadastrado', () => {
  const rows = buildRegistrationMemberRows({
    ...answers,
    ALUNO_1_TRATAMENTO: 'Aluna',
    ALUNO_2_TRATAMENTO: 'Aluno',
    EXAMINADOR_2_TRATAMENTO: 'Professora',
    COORIENTADOR_TRATAMENTO: 'Professora',
  });
  assert.deepEqual(rows.map(({role}) => role), [
    'Aluna autora', 'Aluno autor', 'Orientadora', 'Examinadora', 'Examinadora', 'Coorientadora',
  ]);
  assert.equal(rows[0].reference, 'Aluna');
  assert.equal(rows[1].reference, 'Aluno');
  assert.equal(rows.some(({role}) => /\(a\)|\d/.test(role)), false);
});
