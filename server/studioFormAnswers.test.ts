import test from 'node:test';
import assert from 'node:assert/strict';
import type { RegistrationQuestion } from '../src/types/operationalConfig';
import { validateFormAnswers } from '../src/utils/studioFormAnswers';

const field = (fieldKey: string, fieldType: string, extra: Partial<RegistrationQuestion> = {}): RegistrationQuestion => ({ id: fieldKey, fieldKey, fieldType, label: fieldKey, required: true, ...extra });

test('formulários rejeitam opções inventadas, falso em confirmação, datas e números inválidos', () => {
  const cases: Array<[RegistrationQuestion, unknown]> = [
    [field('A', 'select', { options: ['Sim', 'Não'] }), 'Talvez'], [field('A', 'checkbox'), false],
    [field('A', 'checkbox', { required: false }), 'false'], [field('A', 'number'), true],
    [field('A', 'number'), '12abc'], [field('A', 'number'), Infinity], [field('A', 'date'), '2026-02-30'],
    [field('A', 'email'), 'nome@'], [field('A', 'file'), 'javascript:alert(1)'], [field('A', 'text'), {}],
    [field('A', 'number', { validation: { min: 1 } }), 0],
  ];
  for (const [question, value] of cases) assert.ok(validateFormAnswers([question], { A: value }).issues.A, `${question.fieldType}: ${String(value)}`);
});

test('validação preserva zero, descarta campos ocultos e não permite que eles ativem outros campos', () => {
  const questions = [field('OPCAO', 'select', { options: ['Sim', 'Não'] }),
    field('OCULTO', 'text', { visibleWhen: { fieldKey: 'OPCAO', operator: 'EQUALS', value: 'Sim' } }),
    field('DEPENDENTE', 'text', { visibleWhen: { fieldKey: 'OCULTO', operator: 'EQUALS', value: 'injetado' } }),
    field('NUMERO', 'number', { validation: { min: 0, max: 10 } }), field('ACEITO', 'checkbox'), field('DATA', 'date')];
  const result = validateFormAnswers(questions, { OPCAO: 'Não', OCULTO: 'injetado', DEPENDENTE: 'não incluir', NUMERO: '0', ACEITO: true, DATA: '2028-02-29', EXTRA: 'não incluir' });
  assert.deepEqual(result.issues, {});
  assert.deepEqual(result.answers, { OPCAO: 'Não', NUMERO: 0, ACEITO: true, DATA: '2028-02-29' });
});
