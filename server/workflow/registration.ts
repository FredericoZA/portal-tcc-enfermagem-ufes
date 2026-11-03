import {isEmailAddress} from '../../src/utils/emailAddress';
import {renderInstitutionName} from '../../src/utils/institutionName';
import {CUSTOM_DEFENSE_LOCATION} from '../../src/utils/reservationLocation';
import {withAuthorReference} from '../../src/utils/registrationIdentity';
import {STUDENT_TREATMENTS} from '../../src/utils/personPresentation';
import {AUTHOR_ORDER_OPTIONS,isPresentationField} from '../../src/utils/personPresentation';
import {normalizeRegistrationValue as normalizeTypedValue} from '../../src/utils/registrationNormalization';
import type { IntegrationStudioSettings } from '../../src/types/integrationStudio';
import type { RegistrationAnswers } from '../../src/types/operationalConfig';
import { registrationPayload, registrationQuestions } from '../../src/utils/operationalConfig';
import { evaluateStudioCondition, validateStudioAnswer } from '../../src/utils/courseStudioValidator';
import { formatNameTitleCase, formatTccTitle, normalizeEmail } from '../../src/utils/formatters';
import { CUSTOM_LOCATION_FIELD, OTHER_DEFENSE_LOCATION, getCustomLocationFieldValue, isCustomLocationRegistration, isOtherDefenseLocation, normalizeCustomLocationInput } from '../../src/utils/customDefenseLocation';

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
    answers.AUTORIA_ORDEM=input?.authorOrder==='ALUNO_2_FIRST'?AUTHOR_ORDER_OPTIONS[1]:AUTHOR_ORDER_OPTIONS[0];
    answers.TEM_COORIENTADOR = input?.coorientador ? 'Sim' : 'Não';
    const date = new Date(input?.defesa?.startAt);
    if (Number.isFinite(date.getTime())) {
      answers.DEFESA_DATA_HORA = new Intl.DateTimeFormat('sv-SE', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).format(date).replace(' ', 'T');
    }
    answers.DEFESA_LOCAL = input?.defesa?.local || '';
    if(input?.defesa?.locationKind==='CUSTOM'){answers.DEFESA_LOCAL=CUSTOM_DEFENSE_LOCATION;answers.DEFESA_LOCAL_PERSONALIZADO=input.defesa.local||'';}
  }

  if(isOtherDefenseLocation(answers.DEFESA_LOCAL)){answers.DEFESA_LOCAL=CUSTOM_DEFENSE_LOCATION;answers.DEFESA_LOCAL_PERSONALIZADO=getCustomLocationFieldValue(answers);}
  answers=withAuthorReference(answers);
  const accepted: RegistrationAnswers = {};
  for(const key of ['ALUNO_1_TRATAMENTO','ALUNO_2_TRATAMENTO'])if(answers[key]){if(!STUDENT_TREATMENTS.includes(answers[key] as any))throw new Error('Referência da autoria inválida.');accepted[key]=answers[key];}
  for (const question of registrationQuestions(studio,answers)) {
    if (!evaluateStudioCondition(question.visibleWhen, { ...answers, ...accepted })) continue;
    const rawValue = answers[question.fieldKey];
    if(question.fieldKey==='AUTORIA_REFERENCIA'&&!String(rawValue??'').trim()&&input?.personPresentationVersion!==3)continue;
    if(isPresentationField(question.fieldKey)&&!String(rawValue??'').trim()&&![2,3].includes(input?.personPresentationVersion))continue;
    let value = normalizeTypedValue(question.fieldKey, question.fieldType, rawValue);
    if(typeof value==='string'&&['DEFESA_LOCAL','LOCAL_ALTERNATIVO'].includes(question.fieldKey))value=LEGACY_LOCATION_ALIASES.get(value.toLocaleLowerCase('pt-BR'))||value;
    const missing = !String(value ?? '').trim() || (question.fieldType === 'checkbox' && value !== true);

    if (value !== undefined && !['string', 'number', 'boolean'].includes(typeof value)) throw new Error(`${question.label}: valor inválido.`);
    if (question.required && missing) throw new Error(`${question.label}: campo obrigatório.`);
    if (value && question.options?.length && !question.options.includes(String(value))) throw new Error(`${question.label}: escolha uma opção publicada pelo Master.`);
    if (value && question.fieldType === 'email' && !isEmailAddress(String(value))) throw new Error(`${question.label}: e-mail inválido.`);
    if (value !== undefined && value !== '' && question.fieldType === 'number' && !Number.isFinite(Number(value))) throw new Error(`${question.label}: número inválido.`);
    const issue = value !== undefined && value !== '' ? validateStudioAnswer(value, question.validation) : null;
    if (issue) throw new Error(`${question.label}: ${issue}`);
    if (String(value ?? '').length > 10000) throw new Error(`${question.label}: texto muito longo.`);
    if (value !== undefined) accepted[question.fieldKey] = value as string | number | boolean;
  }

  if (isCustomLocationRegistration(accepted)) {
    const location = getCustomLocationFieldValue({ ...answers, ...accepted });
    if (!location) throw new Error('Nome completo do local: campo obrigatório quando a opção Outro local for escolhida.');
    if (location.length > 200) throw new Error('Nome completo do local: informe até 200 caracteres.');
    if ((location.match(/\*/g) || []).length % 2 !== 0) throw new Error('Nome completo do local: confira os asteriscos usados para as siglas.');
    const canonical = normalizeCustomLocationInput(location);
    if (!/[\p{L}]{2}/u.test(canonical)) throw new Error('Nome completo do local: informe um nome válido.');
    accepted[CUSTOM_LOCATION_FIELD] = canonical;
  }

  validateDefenseBusinessDay(accepted.DEFESA_DATA_HORA);

  if(accepted.DEFESA_LOCAL===CUSTOM_DEFENSE_LOCATION&&!String(accepted.DEFESA_LOCAL_PERSONALIZADO||'').trim())throw new Error('Informe o nome completo do local da defesa.');

  const payload=registrationPayload(accepted, timezone);
  payload.registrationAnswers=Object.fromEntries(Object.entries(payload.registrationAnswers).map(([key,value])=>[key,typeof value==='string'?/_INSTITUICAO$/.test(key)?renderInstitutionName(value):key==='TITULO'?value.replace(/\+([^+]+?)-|\*([^*]+)\*/g,(_match,old,current)=>old||current):value:value]));
  return payload;
}
