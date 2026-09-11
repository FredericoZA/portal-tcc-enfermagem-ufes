import type { IntegrationStudioSettings } from '../../src/types/integrationStudio';
import type { RegistrationAnswers } from '../../src/types/operationalConfig';
import { registrationPayload, registrationQuestions } from '../../src/utils/operationalConfig';
import { evaluateStudioCondition, validateStudioAnswer } from '../../src/utils/courseStudioValidator';
import { workflowPolicy } from '../../src/utils/workflowOperations';
import { normalizeRegistrationAnswers, validateRegistrationDataQuality } from '../../src/utils/registrationDataQuality';

export function acceptRegistration(input: any, studio?: Partial<IntegrationStudioSettings>) {
  const timezone = studio?.operationsPolicy?.timezone || 'America/Sao_Paulo';
  let answers: RegistrationAnswers = {};
  if (input?.registrationAnswers && typeof input.registrationAnswers === 'object' && !Array.isArray(input.registrationAnswers)) answers = input.registrationAnswers;
  else {
    const mapPerson = (prefix: string, person: any) => { for (const [key, value] of Object.entries(person || {})) answers[`${prefix}_${key.toUpperCase()}`] = String(value ?? ''); };
    mapPerson('ALUNO_1', input?.aluno1); mapPerson('ALUNO_2', input?.aluno2); mapPerson('ORIENTADOR', input?.orientador); mapPerson('COORIENTADOR', input?.coorientador);
    (input?.banca || []).slice(0, 2).forEach((b: any, i: number) => mapPerson(`EXAMINADOR_${i + 2}`, b));
    answers.TITULO = input?.titulo || ''; answers.TEM_ALUNO_2 = input?.aluno2 ? 'Sim' : 'Não'; answers.TEM_COORIENTADOR = input?.coorientador ? 'Sim' : 'Não';
    const date = new Date(input?.defesa?.startAt);
    if (Number.isFinite(date.getTime())) answers.DEFESA_DATA_HORA = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date).replace(' ', 'T');
    answers.DEFESA_LOCAL = input?.defesa?.local || ''; answers.LOCAL_ALTERNATIVO = input?.defesa?.alternateLocation || '';
  }

  answers = normalizeRegistrationAnswers(answers);
  const accepted: RegistrationAnswers = {};
  for (const question of registrationQuestions(studio)) {
    if (!evaluateStudioCondition(question.visibleWhen, answers)) continue;
    const value = answers[question.fieldKey];
    if (value !== undefined && !['string', 'number', 'boolean'].includes(typeof value)) throw new Error(`${question.label}: valor inválido.`);
    if (question.required && (!String(value ?? '').trim() || question.fieldType === 'checkbox' && value !== true)) throw new Error(`${question.label}: campo obrigatório.`);
    if (value && question.options?.length && !question.options.includes(String(value))) throw new Error(`${question.label}: escolha uma opção publicada pelo Master.`);
    if (value && question.fieldType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) throw new Error(`${question.label}: e-mail inválido.`);
    if (value !== undefined && value !== '' && question.fieldType === 'number' && !Number.isFinite(Number(value))) throw new Error(`${question.label}: número inválido.`);
    const issue = value !== undefined && value !== '' ? validateStudioAnswer(value, question.validation) : null;
    if (issue) throw new Error(`${question.label}: ${issue}`);
    if (String(value ?? '').length > 10000) throw new Error(`${question.label}: texto muito longo.`);
    if (value !== undefined) accepted[question.fieldKey] = value;
  }

  validateRegistrationDataQuality(accepted, workflowPolicy(studio));
  if (accepted.LOCAL_ALTERNATIVO && accepted.LOCAL_ALTERNATIVO === accepted.DEFESA_LOCAL) throw new Error('O local alternativo deve ser diferente do preferido.');
  return registrationPayload(accepted, timezone);
}
