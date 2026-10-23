import {normalizeRegistrationValue as normalizeTypedValue} from '../../src/utils/registrationNormalization';
import type { IntegrationStudioSettings } from '../../src/types/integrationStudio';
import type { RegistrationAnswers } from '../../src/types/operationalConfig';
import { registrationPayload, registrationQuestions } from '../../src/utils/operationalConfig';
import { evaluateStudioCondition, validateStudioAnswer } from '../../src/utils/courseStudioValidator';
import { formatNameTitleCase, formatTccTitle, normalizeEmail } from '../../src/utils/formatters';

const LEGACY_LOCATION_ALIASES = new Map<string, string>([
  ['auditório do departamento de enfermagem', 'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES'],
  ['auditorio do departamento de enfermagem', 'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES'],
  ['auditório do prédio do departamento de enfermagem', 'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES'],
  ['auditorio do predio do departamento de enfermagem', 'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES']
]);


function validateDefenseBusinessDay(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return;
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s)/);
  if (!match) return;
  const [, year, month, day] = match;
  const weekday = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay();
  if (weekday === 0 || weekday === 6) {
    throw new Error('Data e horário da defesa: defesas de TCC só podem ser agendadas de segunda a sexta-feira.');
  }
}

export function acceptRegistration(input: any, studio?: Partial<IntegrationStudioSettings>) {
  const timezone = studio?.operationsPolicy?.timezone || 'America/Sao_Paulo';
  let answers: RegistrationAnswers = {};

  if (input?.registrationAnswers && typeof input.registrationAnswers === 'object' && !Array.isArray(input.registrationAnswers)) {
    answers = { ...input.registrationAnswers };
  } else {
    const mapPerson = (prefix: string, person: any) => {
      for (const [key, value] of Object.entries(person || {})) answers[`${prefix}_${key.toUpperCase()}`] = String(value ?? '');
    };
    mapPerson('ALUNO_1', input?.aluno1);
    mapPerson('ALUNO_2', input?.aluno2);
    mapPerson('ORIENTADOR', input?.orientador);
    mapPerson('COORIENTADOR', input?.coorientador);
    (input?.banca || []).slice(0, 2).forEach((b: any, i: number) => mapPerson(`EXAMINADOR_${i + 2}`, b));
    answers.TITULO = input?.titulo || '';
    answers.TEM_ALUNO_2 = input?.aluno2 ? 'Sim' : 'Não';
    answers.TEM_COORIENTADOR = input?.coorientador ? 'Sim' : 'Não';
    const date = new Date(input?.defesa?.startAt);
    if (Number.isFinite(date.getTime())) {
      answers.DEFESA_DATA_HORA = new Intl.DateTimeFormat('sv-SE', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).format(date).replace(' ', 'T');
    }
    answers.DEFESA_LOCAL = input?.defesa?.local || '';
    answers.LOCAL_ALTERNATIVO = input?.defesa?.alternateLocation || '';
  }

  const accepted: RegistrationAnswers = {};
  for (const question of registrationQuestions(studio)) {
    if (!evaluateStudioCondition(question.visibleWhen, { ...answers, ...accepted })) continue;
    const rawValue = answers[question.fieldKey];
    let value = normalizeTypedValue(question.fieldKey, question.fieldType, rawValue);
    if(typeof value==='string'&&['DEFESA_LOCAL','LOCAL_ALTERNATIVO'].includes(question.fieldKey))value=LEGACY_LOCATION_ALIASES.get(value.toLocaleLowerCase('pt-BR'))||value;
    const missing = !String(value ?? '').trim() || (question.fieldType === 'checkbox' && value !== true);

    if (value !== undefined && !['string', 'number', 'boolean'].includes(typeof value)) throw new Error(`${question.label}: valor inválido.`);
    if (question.required && missing) throw new Error(`${question.label}: campo obrigatório.`);
    if (value && question.options?.length && !question.options.includes(String(value))) throw new Error(`${question.label}: escolha uma opção publicada pelo Master.`);
    if (value && question.fieldType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) throw new Error(`${question.label}: e-mail inválido.`);
    if (value !== undefined && value !== '' && question.fieldType === 'number' && !Number.isFinite(Number(value))) throw new Error(`${question.label}: número inválido.`);
    const issue = value !== undefined && value !== '' ? validateStudioAnswer(value, question.validation) : null;
    if (issue) throw new Error(`${question.label}: ${issue}`);
    if (String(value ?? '').length > 10000) throw new Error(`${question.label}: texto muito longo.`);
    if (value !== undefined) accepted[question.fieldKey] = value as string | number | boolean;
  }

  validateDefenseBusinessDay(accepted.DEFESA_DATA_HORA);

  if (accepted.LOCAL_ALTERNATIVO && accepted.LOCAL_ALTERNATIVO === accepted.DEFESA_LOCAL) {
    throw new Error('O local alternativo deve ser diferente do preferido.');
  }

  return registrationPayload(accepted, timezone);
}
