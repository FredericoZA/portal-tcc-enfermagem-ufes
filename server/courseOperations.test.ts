import {courseStudioFixture as studio} from './fixtures/courseStudioFixture';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { IntegrationStudioSettings } from '../src/types/integrationStudio';
import { DEFAULT_COURSE_OPERATIONS_POLICY, evaluateStudioCondition, normalizePublishedWorkflowTrigger, validateCourseStudio, validateStudioAnswer } from '../src/utils/courseStudioValidator';


test('pacote completo do curso fica apto para publicação', () => {
  const report = validateCourseStudio(studio());
  assert.equal(report.ready, true, JSON.stringify(report.issues));
  assert.equal(report.errors, 0);
});

test('modelo embutido e condição que aponta para campo futuro bloqueiam publicação', () => {
  const value = studio();
  (value.docTemplates[0] as any).templateContentText = 'conteúdo indevido';
  (value.formTemplates[0] as any).questions[0].visibleWhen = { fieldKey: 'RESUMO', operator: 'EQUALS', value: 'x' };
  const report = validateCourseStudio(value);
  assert.equal(report.ready, false);
  assert.ok(report.issues.some((issue) => issue.code === 'EMBEDDED_TEMPLATE'));
  assert.ok(report.issues.some((issue) => issue.code === 'INVALID_FORM_RULE'));
});

test('condições e validações são determinísticas', () => {
  assert.equal(evaluateStudioCondition({ fieldKey: 'PUBLICAR', operator: 'EQUALS', value: 'Sim' }, { PUBLICAR: 'Sim' }), true);
  assert.equal(evaluateStudioCondition({ fieldKey: 'PUBLICAR', operator: 'NOT_EQUALS', value: 'Sim' }, { PUBLICAR: 'Sim' }), false);
  assert.match(validateStudioAnswer('curto', { minLength: 20 }) || '', /20/);
  assert.equal(validateStudioAnswer('um resumo suficientemente detalhado', { minLength: 20 }), null);
});

test('bloqueia ação sem executor e envio prematuro de documento assinável', () => {
  const value = studio();
  value.emailTemplates[0].attachments = ['termo'];
  ((value.workflowStages[0] as any).actions as any[]).push({ id: 'legacy', type: 'action', title: 'Ação genérica sem executor' });
  const report = validateCourseStudio(value);
  assert.equal(report.ready, false);
  assert.ok(report.issues.some((issue) => issue.code === 'SYSTEM_ACTION_WITHOUT_EXECUTOR'));
  assert.ok(report.issues.some((issue) => issue.code === 'SIGNED_ATTACHMENT_TOO_EARLY'));
});

test('restringe cada documento ao evento seguro do fluxo institucional', () => {
  const valid = studio();
  assert.equal(validateCourseStudio(valid).issues.some((issue) => issue.code === 'INVALID_DOCUMENT_EVENT'), false);
  const cases = [
    ['CONVITE', 0, 0, 'EVALUATION_SUBMITTED'],
    ['ATA', 1, 0, 'LOCATION_CONFIRMED'],
    ['TERMO', 2, 0, 'LOCATION_CONFIRMED'],
    ['DECLARACAO', 3, 0, 'LOCATION_CONFIRMED']
  ] as const;

  for (const [documentType, stageIndex, actionIndex, invalidEvent] of cases) {
    const invalid = structuredClone(valid);
    invalid.workflowStages[stageIndex].triggerEvent = invalidEvent;
    const report = validateCourseStudio(invalid);
    assert.equal(report.ready, false);
    assert.ok(
      report.issues.some((issue) => issue.code === 'INVALID_DOCUMENT_EVENT' && issue.path === `workflowStages.${stageIndex}.actions.${actionIndex}`),
      `${documentType} não bloqueou o evento arbitrário`
    );
  }
});

test('mantém obrigatória a condição de publicação do Termo no evento correto', () => {
  const value = studio();
  delete (value.workflowStages[2].actions[0] as any).condition;
  const report = validateCourseStudio(value);
  assert.ok(report.issues.some((issue) => issue.code === 'TERM_WITHOUT_PUBLICATION_CONDITION'));
  assert.equal(report.issues.some((issue) => issue.code === 'INVALID_DOCUMENT_EVENT'), false);
});

test('documentos obrigatórios não podem desaparecer por condição opcional', () => {
  for (const [stageIndex, actionIndex] of [[0, 0], [1, 0], [3, 0]] as const) {
    const value = studio();
    value.workflowStages[stageIndex].actions[actionIndex].condition = { fieldKey: 'PUBLICAR_TRABALHO', operator: 'IS_TRUE' };
    const report = validateCourseStudio(value);
    assert.equal(report.ready, false);
    assert.ok(report.issues.some((issue) => issue.code === 'REQUIRED_DOCUMENT_CANNOT_BE_CONDITIONAL'));
  }
});

test('bloqueia convite anexado antes da confirmação do local', () => {
  const value = studio();
  value.emailTemplates[0].attachments = ['convite'];
  value.workflowStages[0].triggerEvent = 'TCC_CREATED';
  value.workflowStages[0].actions = [{ id: 'email-cedo', type: 'email', refId: 'confirmacao', title: 'Enviar convite cedo' }];
  const report = validateCourseStudio(value);
  assert.equal(report.ready, false);
  assert.ok(report.issues.some((issue) => issue.code === 'INVITATION_ATTACHMENT_TOO_EARLY'));

  value.workflowStages[0].triggerEvent = 'LOCATION_CONFIRMED';
  const afterLocation = validateCourseStudio(value);
  assert.equal(afterLocation.issues.some((issue) => issue.code === 'INVITATION_ATTACHMENT_TOO_EARLY'), false);
});

test('bloqueia variável inexistente em destinatário, assunto ou corpo de e-mail', () => {
  const value = studio();
  value.emailTemplates[0].body = 'Olá {{VARIAVEL_DIGITADA_ERRADO}}';
  const report = validateCourseStudio(value);
  assert.equal(report.ready, false);
  assert.ok(report.issues.some((issue) => issue.code === 'UNKNOWN_EMAIL_VARIABLE'));
});

test('bloqueia resposta de formulário como destinatário de e-mail', () => {
  const value = studio();
  value.emailTemplates[0].recipient = '{{RESUMO}}';
  const report = validateCourseStudio(value);
  assert.equal(report.ready, false);
  assert.ok(report.issues.some((issue) => issue.code === 'UNSAFE_EMAIL_RECIPIENT_VARIABLE'));
});

test('preserva evento publicado por um formulário personalizado ao recarregar o Estúdio', () => {
  assert.equal(normalizePublishedWorkflowTrigger('FORM_parecer-final_SUBMITTED'), 'FORM_PARECER_FINAL_SUBMITTED');
  assert.equal(normalizePublishedWorkflowTrigger('texto livre inválido', 'LOCATION_CONFIRMED'), 'LOCATION_CONFIRMED');
});
