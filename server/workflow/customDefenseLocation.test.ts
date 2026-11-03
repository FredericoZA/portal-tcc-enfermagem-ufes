import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOM_LOCATION_FIELD,
  OTHER_DEFENSE_LOCATION,
  getCustomLocationFieldValue,
  isCustomLocationRegistration,
  isOtherDefenseLocation,
  normalizeCustomLocationInput,
  renderCustomLocationName,
  reservationConfirmationRecipient,
} from '../../src/utils/customDefenseLocation';
import { registrationQuestions } from '../../src/utils/operationalConfig';
import { acceptRegistration } from './registration';

const makeRegistration = () => ({
  registrationAnswers: {
    ALUNO_1_NOME: 'Ana Oliveira',
    ALUNO_1_MATRICULA: '202610001',
    ALUNO_1_EMAIL: 'ana@edu.ufes.br',
    TEM_ALUNO_2: 'Não',
    ORIENTADOR_NOME: 'Maria Silva',
    ORIENTADOR_EMAIL: 'orientador@ufes.br',
    ORIENTADOR_SIAPE: '1234567',
    TEM_COORIENTADOR: 'Não',
    EXAMINADOR_2_NOME: 'Carlos Pereira',
    EXAMINADOR_2_EMAIL: 'carlos@ufes.br',
    EXAMINADOR_2_INSTITUICAO: 'UFES',
    EXAMINADOR_3_NOME: 'Joana Ferreira',
    EXAMINADOR_3_EMAIL: 'joana@ufes.br',
    EXAMINADOR_3_INSTITUICAO: 'UFES',
    TITULO: 'Estudo sobre o cuidado em enfermagem',
    DEFESA_DATA_HORA: '2026-11-06T13:00',
    DEFESA_LOCAL: OTHER_DEFENSE_LOCATION,
    [CUSTOM_LOCATION_FIELD]: 'AUDITÓRIO CENTRAL DA *UFES*',
  } as Record<string, string>,
});

test('formata iniciais, mantém sigla marcada e remove asteriscos da exibição', () => {
  assert.equal(normalizeCustomLocationInput('AUDITÓRIO CENTRAL DA *UFES*'), 'Auditório Central da *UFES*');
  assert.equal(renderCustomLocationName('AUDITÓRIO CENTRAL DA *UFES*'), 'Auditório Central da UFES');
  assert.equal(renderCustomLocationName('SALA DE REUNIÕES'), 'Sala de Reuniões');
  assert.equal(renderCustomLocationName('AUDITÓRIO DA UFES'), 'Auditório da Ufes');
});

test('reconhece Outro local sem confundir locais fixos', () => {
  assert.equal(isOtherDefenseLocation(OTHER_DEFENSE_LOCATION), true);
  assert.equal(isOtherDefenseLocation('Outro local - informar endereco/nome'), true);
  assert.equal(isOtherDefenseLocation('Sala de reuniões do Departamento de Enfermagem - CCS/UFES'), false);
  assert.equal(isCustomLocationRegistration({DEFESA_LOCAL:OTHER_DEFENSE_LOCATION}), true);
});

test('formulário inclui Outro local e nome condicional obrigatório', () => {
  const questions = registrationQuestions();
  const select = questions.find(q => q.fieldKey === 'DEFESA_LOCAL');
  const field = questions.find(q => q.fieldKey === CUSTOM_LOCATION_FIELD);
  assert.ok(select?.options?.includes(OTHER_DEFENSE_LOCATION));
  assert.equal(field?.required, true);
  assert.equal(field?.visibleWhen?.fieldKey, 'DEFESA_LOCAL');
  assert.equal(field?.visibleWhen?.value, OTHER_DEFENSE_LOCATION);
});

test('nome preenchido em alias anterior pode ser recuperado', () => {
  assert.equal(getCustomLocationFieldValue({ LOCAL_NOME_COMPLETO:'Sala de Reuniões' }), 'Sala de Reuniões');
});

test('cadastro de outro local persiste nome formatado e escolha original para roteamento', () => {
  const process = acceptRegistration(makeRegistration());
  assert.equal(process.defesa.local, 'Auditório Central da UFES');
  assert.equal(process.registrationAnswers.DEFESA_LOCAL, OTHER_DEFENSE_LOCATION);
  assert.equal(process.registrationAnswers[CUSTOM_LOCATION_FIELD], 'Auditório Central da *UFES*');
});

test('cadastro de outro local sem nome é bloqueado', () => {
  const input = makeRegistration();
  input.registrationAnswers[CUSTOM_LOCATION_FIELD] = '';
  assert.throws(() => acceptRegistration(input), /Nome completo do local/);
});

test('asteriscos desequilibrados são bloqueados', () => {
  const input = makeRegistration();
  input.registrationAnswers[CUSTOM_LOCATION_FIELD] = 'Auditório da *UFES';
  assert.throws(() => acceptRegistration(input), /asteriscos/);
});

test('outro local endereça somente o orientador; locais fixos continuam no departamento', () => {
  assert.equal(
    reservationConfirmationRecipient({ DEFESA_LOCAL: OTHER_DEFENSE_LOCATION }, 'ORIENTADOR@UFES.BR', 'departamento@ufes.br'),
    'orientador@ufes.br',
  );
  assert.equal(
    reservationConfirmationRecipient({ DEFESA_LOCAL: 'Auditório do Departamento' }, 'orientador@ufes.br', 'DEPARTAMENTO@UFES.BR'),
    'departamento@ufes.br',
  );
  assert.equal(
    reservationConfirmationRecipient({ DEFESA_LOCAL: OTHER_DEFENSE_LOCATION }, '', 'departamento@ufes.br'),
    '',
    'Não deve retornar ao departamento caso o orientador não tenha e-mail válido.',
  );
});
