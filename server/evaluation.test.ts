import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_PROCESSES, INITIAL_SETTINGS } from '../src/services/demoSeed';
import { acceptEvaluation, EvaluationError } from './workflow/evaluation';
import { evaluationQuestions, parseEvaluationGrade } from '../src/utils/evaluationForm';
import { buildProcessVariables } from './workflow/runtime';
import { normalizeUnifiedAppearance } from '../src/utils/unifiedAppearance';
import { portalFontFamily } from '../src/utils/portalFonts';

const process = structuredClone(DEMO_PROCESSES[0]);
const settings = structuredClone(INITIAL_SETTINGS);
const now = new Date('2026-09-09T16:00:00Z');
const valid = { resultadoCode: 'APROVADO', notaFinal: '9,25', parecer: 'Parecer registrado pelo orientador.', dataConfirmed: true,
  expectedDataRevision: process.dataRevision, expectedSchemaRevision: settings.integrationStudio?.revision || 0 };
const accept = (patch: Record<string, unknown> = {}) => acceptEvaluation(process, { ...valid, ...patch }, settings, process.orientador.email, now);

test('avaliação aceita nota decimal e preserva a conferência vinculada à revisão do aluno', () => {
  const result = accept();
  assert.equal(result.notaFinal, 9.25);
  assert.equal(result.dataReview.confirmedBy, process.orientador.email);
  assert.equal(result.dataReview.sourceDataRevision, process.dataRevision);
  assert.ok(result.dataReview.fields.some(([, value]) => value.includes(process.aluno1.matricula)));
  assert.equal(result.resultadoLabel, settings.evaluationOutcomeOptions[0].label);
});

test('avaliação recusa ausência de nota, conferência, resultado inválido e texto incorreto', () => {
  for (const patch of [{ dataConfirmed: false }, { notaFinal: undefined }, { notaFinal: '' }, { notaFinal: '10abc' }, { notaFinal: -1 }, { notaFinal: 11 }, { parecer: 123 }, { resultadoCode: 'INVENTADO' }]) {
    assert.throws(() => accept(patch), EvaluationError, JSON.stringify(patch));
  }
  assert.equal(parseEvaluationGrade(0), 0);
  assert.equal(parseEvaluationGrade('10,00'), 10);
  assert.equal(parseEvaluationGrade('9,999'), undefined);
});

test('avaliação recusa revisões desatualizadas e apresentação ainda não iniciada', () => {
  assert.throws(() => accept({ expectedDataRevision: process.dataRevision - 1 }), (e: EvaluationError) => e.code === 'STALE_DATA_REVIEW');
  assert.throws(() => accept({ expectedSchemaRevision: 999 }), (e: EvaluationError) => e.code === 'STALE_EVALUATION_FORM');
  assert.throws(() => acceptEvaluation(process, valid, settings, process.orientador.email, new Date('2026-01-01')), (e: EvaluationError) => e.code === 'DEFENSE_NOT_STARTED');
});

test('campos obrigatórios da avaliação não podem ser escondidos ou transformados em opcionais', () => {
  const fields = evaluationQuestions({ formTemplates: [{ id: 'form-parecer-banca', questions: [
    { fieldKey: 'NOTA', label: 'Minha nota', fieldType: 'text', required: false, visibleWhen: { fieldKey: 'X', operator: 'IS_TRUE' }, validation: { max: 100 } },
  ] }] as any });
  const grade = fields.find(q => q.fieldKey === 'NOTA_FINAL')!;
  assert.equal(grade.required, true);
  assert.equal(grade.validation?.max, 10);
  assert.equal(grade.visibleWhen, undefined);
});

test('respostas do orientador alimentam DOCX sem substituir nota ou identidade canônica', () => {
  const p = { ...process, avaliacao: { ...process.avaliacao, ...accept(), answers: { OBSERVACAO: 'Texto adicional', NOTA_FINAL: 2, ORIENTADOR_EMAIL: 'intruso@example.invalid' } } };
  const vars = buildProcessVariables({ process: p, actorEmail: process.orientador.email, actorRoles: ['ADVISOR'], eventCode: 'EVALUATION_SUBMITTED' });
  assert.equal(vars.NOTA_FINAL, '9.25');
  assert.equal(vars.CAMPO_10, '9.25');
  assert.equal(vars.AVALIACAO_NOTA, '9.25');
  assert.equal(vars.ORIENTADOR_EMAIL, process.orientador.email);
  assert.equal(vars.OBSERVACAO, 'Texto adicional');
});

test('aparência publicada elimina exceções antigas e mantém estrutura de colunas e conteúdo', () => {
  const input = { ...settings, tableLayouts: { defenses: { inheritGlobalAppearance: false, textFormat: { fontSize: 'xs' }, columnOrder: ['titulo'], customLabels: { titulo: 'Trabalho' } } },
    portalAppearance: { schemaVersion: 3, linkedItems: { sheet_calendar: false, popup_login: false }, generalPopups: { uploadAtaHeaderBg: '#005830' }, loginPopup: { title: 'Meu portal', primaryBtnBg: '#ff0000' } } };
  const result = normalizeUnifiedAppearance(input);
  assert.equal(result.tableLayouts!.defenses.textFormat, undefined);
  assert.deepEqual(result.tableLayouts!.defenses.columnOrder, ['titulo']);
  assert.equal(result.portalAppearance!.linkedItems!.popup_login, true);
  assert.equal(result.portalAppearance!.loginPopup!.title, 'Meu portal');
  assert.equal(result.portalAppearance!.loginPopup!.primaryBtnBg, result.portalAppearance!.globalPopupStyle!.actionBgColor);
  assert.deepEqual(normalizeUnifiedAppearance(result), result);
  assert.equal(input.portalAppearance.linkedItems.popup_login, false);
});

test('a fonte e as cores publicadas são iguais nas tabelas e nos pop-ups', () => {
  for (const font of ['georgia', 'Roboto, sans-serif', 'Nunito, sans-serif', 'mono']) {
    const result = normalizeUnifiedAppearance({ ...settings, tableAppearance: { fontFamily: 'inter', customHeaderColor: '#ff0000' }, portalAppearance: { schemaVersion: 4, globalPopupStyle: { fontFamily: font, headerBgColor: '#005830' } as any } });
    assert.equal(portalFontFamily(result.tableAppearance?.fontFamily), result.portalAppearance?.globalPopupStyle?.fontFamily);
    assert.equal(result.tableAppearance?.customHeaderColor, '#005830');
    assert.deepEqual(normalizeUnifiedAppearance(result), result);
  }
});
