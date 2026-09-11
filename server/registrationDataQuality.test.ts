import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeRegistrationAnswers, validateRegistrationDataQuality } from '../src/utils/registrationDataQuality';
import { DEFAULT_WORKFLOW_OPERATIONS } from '../src/utils/workflowOperations';

test('normaliza nomes, e-mails e matrícula sem inventar informação', () => {
  const normalized = normalizeRegistrationAnswers({
    ALUNO_1_NOME: '  mÁria   da silva  ',
    ALUNO_1_EMAIL: ' ALUNO@EDU.UFES.BR ',
    ALUNO_1_MATRICULA: '2026.101-234',
    TITULO: '  Segurança   do paciente  '
  });
  assert.equal(normalized.ALUNO_1_NOME, 'Mária da Silva');
  assert.equal(normalized.ALUNO_1_EMAIL, 'aluno@edu.ufes.br');
  assert.equal(normalized.ALUNO_1_MATRICULA, '2026101234');
  assert.equal(normalized.TITULO, 'Segurança do paciente');
});

test('não apaga letras de matrícula incorreta durante normalização', () => {
  const normalized = normalizeRegistrationAnswers({ ALUNO_1_MATRICULA: '2026A101' });
  assert.equal(normalized.ALUNO_1_MATRICULA, '2026A101');
  assert.throws(
    () => validateRegistrationDataQuality(normalized, DEFAULT_WORKFLOW_OPERATIONS),
    /somente algarismos/
  );
});

test('rejeita nome incompleto e nome com números', () => {
  assert.throws(
    () => validateRegistrationDataQuality({ ALUNO_1_NOME: 'Maria' }, DEFAULT_WORKFLOW_OPERATIONS),
    /nome completo/
  );
  assert.throws(
    () => validateRegistrationDataQuality({ ALUNO_1_NOME: 'Maria Silva 2' }, DEFAULT_WORKFLOW_OPERATIONS),
    /não pode conter números/
  );
});

test('aceita matrícula numérica compatível com a política', () => {
  assert.doesNotThrow(() => validateRegistrationDataQuality({
    ALUNO_1_NOME: 'Maria da Silva',
    ALUNO_1_MATRICULA: '2026101234',
    ALUNO_1_EMAIL: 'maria@edu.ufes.br',
    TITULO: 'Segurança do paciente em enfermagem'
  }, DEFAULT_WORKFLOW_OPERATIONS));
});

test('rejeita e-mail repetido entre participantes mesmo com caixa diferente', () => {
  const normalized = normalizeRegistrationAnswers({
    ALUNO_1_EMAIL: 'Pessoa@UFES.BR',
    ORIENTADOR_EMAIL: ' pessoa@ufes.br '
  });
  assert.throws(
    () => validateRegistrationDataQuality(normalized, DEFAULT_WORKFLOW_OPERATIONS),
    /já foi informado/
  );
});

test('valida SIAPE do orientador pela política institucional', () => {
  assert.throws(
    () => validateRegistrationDataQuality({ ORIENTADOR_SIAPE: '123456' }, DEFAULT_WORKFLOW_OPERATIONS),
    /exatamente 7 algarismos/
  );
  assert.doesNotThrow(
    () => validateRegistrationDataQuality({ ORIENTADOR_SIAPE: '1234567' }, DEFAULT_WORKFLOW_OPERATIONS)
  );
});

test('rejeita título claramente incompleto', () => {
  assert.throws(
    () => validateRegistrationDataQuality({ TITULO: 'TCC' }, DEFAULT_WORKFLOW_OPERATIONS),
    /título completo/
  );
});
