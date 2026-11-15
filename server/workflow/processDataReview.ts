import type { ProcessData } from '../../src/types';
import type { IntegrationStudioSettings } from '../../src/types/integrationStudio';
import type { RegistrationAnswers } from '../../src/types/operationalConfig';
import {
  registrationAnswersWithoutIdentifiers,
  registrationQuestions,
  operationalConfig,
} from '../../src/utils/operationalConfig';
import { normalizeRegistrationValue } from '../../src/utils/registrationNormalization';
import { validateStudioAnswer } from '../../src/utils/courseStudioValidator';
import { AUTHOR_ORDER_OPTIONS } from '../../src/utils/personPresentation';
import { isEmailAddress } from '../../src/utils/emailAddress';
import { CUSTOM_DEFENSE_LOCATION } from '../../src/utils/reservationLocation';

import { isProcessReviewMetadataField } from '../../src/utils/processDataReview';
export { isProcessReviewMetadataField } from '../../src/utils/processDataReview';

export function mergeProcessReviewAnswers(
  process: ProcessData,
  patch: unknown,
  studio?: Partial<IntegrationStudioSettings>,
  customLocation?: boolean,
): RegistrationAnswers {
  if (
    patch !== undefined &&
    (!patch || typeof patch !== 'object' || Array.isArray(patch))
  )
    throw new Error('Respostas cadastrais inválidas.');
  const entries = Object.entries(patch || {});
  if (entries.length > 80 || JSON.stringify(patch || {}).length > 50000)
    throw new Error('As respostas excedem o tamanho permitido.');
  const merged = registrationAnswersWithoutIdentifiers({
    ...process.registrationAnswers,
  });
  const questions = new Map(
    registrationQuestions(studio, {
      ...merged,
      ...(patch as RegistrationAnswers),
    }).map((question) => [question.fieldKey, question]),
  );
  for (const [key, raw] of entries) {
    const question = questions.get(key);
    if (!question || !isProcessReviewMetadataField(key))
      throw new Error(
        'Use os campos próprios do processo para corrigir nomes, participantes ou agendamento. Somente questões cadastrais publicadas podem ser alteradas.',
      );
    if (
      !['string', 'number', 'boolean'].includes(typeof raw) ||
      String(raw).length > 10000
    )
      throw new Error(`${question.label}: valor inválido.`);
    const value = normalizeRegistrationValue(key, question.fieldType, raw) as
      | string
      | number
      | boolean;
    const missing =
      !String(value ?? '').trim() ||
      (question.fieldType === 'checkbox' && value !== true);
    if (question.required && missing)
      throw new Error(`${question.label}: campo obrigatório.`);
    if (
      value &&
      question.options?.length &&
      !question.options.includes(String(value))
    )
      throw new Error(
        `${question.label}: escolha uma opção publicada pelo Master.`,
      );
    if (
      value !== '' &&
      question.fieldType === 'email' &&
      !isEmailAddress(String(value))
    )
      throw new Error(`${question.label}: e-mail inválido.`);
    if (
      value !== '' &&
      question.fieldType === 'number' &&
      !Number.isFinite(Number(value))
    )
      throw new Error(`${question.label}: número inválido.`);
    const issue =
      value !== '' ? validateStudioAnswer(value, question.validation) : null;
    if (issue) throw new Error(`${question.label}: ${issue}`);
    merged[key] = value;
  }
  return synchronizeProcessRegistrationAnswers(
    { ...process, registrationAnswers: merged },
    studio?.operationsPolicy?.timezone || 'America/Sao_Paulo',
    customLocation ??
      !operationalConfig(studio).reservation.locations.includes(
        process.defesa.local,
      ),
  );
}

export function synchronizeProcessRegistrationAnswers(
  process: ProcessData,
  timezone = 'America/Sao_Paulo',
  customLocation = false,
): RegistrationAnswers {
  const answers = registrationAnswersWithoutIdentifiers({
    ...process.registrationAnswers,
  });
  for (const prefix of [
    'ALUNO_1',
    'ALUNO_2',
    'ORIENTADOR',
    'COORIENTADOR',
    'EXAMINADOR_2',
    'EXAMINADOR_3',
  ]) {
    for (const key of Object.keys(answers))
      if (key.startsWith(prefix + '_')) delete answers[key];
  }
  const setPerson = (prefix: string, person: any) => {
    if (!person) return;
    for (const [field, suffix] of [
      ['nome', 'NOME'],
      ['email', 'EMAIL'],
      ['tratamento', 'TRATAMENTO'],
      ['titulacao', 'TITULACAO'],
      ['instituicao', 'INSTITUICAO'],
    ]) {
      if (typeof person[field] === 'string')
        answers[`${prefix}_${suffix}`] = person[field];
    }
  };
  setPerson('ALUNO_1', process.aluno1);
  setPerson('ALUNO_2', process.aluno2);
  setPerson('ORIENTADOR', process.orientador);
  setPerson('COORIENTADOR', process.coorientador);
  for (const member of process.banca) {
    if (member.funcao === 'EXAMINER_2') setPerson('EXAMINADOR_2', member);
    if (member.funcao === 'EXAMINER_3') setPerson('EXAMINADOR_3', member);
  }
  answers.AUTORIA_ORDEM =
    AUTHOR_ORDER_OPTIONS[
      process.authorOrder === 'ALUNO_2_FIRST' && process.aluno2 ? 1 : 0
    ];
  answers.TITULO = process.titulo;
  answers.TEM_ALUNO_2 = process.aluno2 ? 'Sim' : 'Não';
  answers.TEM_COORIENTADOR = process.coorientador ? 'Sim' : 'Não';
  answers.AUTORIA_REFERENCIA = process.aluno2
    ? process.aluno1.tratamento === 'Aluna' &&
      process.aluno2.tratamento === 'Aluna'
      ? 'as alunas'
      : 'os alunos'
    : process.aluno1.tratamento === 'Aluna'
      ? 'a aluna'
      : 'o aluno';
  const date = new Date(process.defesa.startAt);
  if (Number.isFinite(date.getTime()))
    answers.DEFESA_DATA_HORA = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .format(date)
      .replace(' ', 'T');
  answers.DEFESA_LOCAL = process.defesa.local;
  delete answers.DEFESA_LOCAL_PERSONALIZADO;
  if (customLocation) {
    answers.DEFESA_LOCAL = CUSTOM_DEFENSE_LOCATION;
    answers.DEFESA_LOCAL_PERSONALIZADO = process.defesa.local;
  }
  return answers;
}

/** Audit only edited values; do not copy receipt contexts or document payloads. */
export function processReviewAuditDelta(
  before: ProcessData,
  after: ProcessData,
  keys: string[],
) {
  const previous: Record<string, unknown> = {},
    changes: Record<string, unknown> = {};
  for (const key of keys) {
    const left = (before as any)[key],
      right = (after as any)[key];
    if (JSON.stringify(left) === JSON.stringify(right)) continue;
    if (
      left &&
      right &&
      typeof left === 'object' &&
      typeof right === 'object' &&
      !Array.isArray(left) &&
      !Array.isArray(right)
    ) {
      const fields = [
        ...new Set([...Object.keys(left), ...Object.keys(right)]),
      ].filter(
        (field) => JSON.stringify(left[field]) !== JSON.stringify(right[field]),
      );
      previous[key] = Object.fromEntries(
        fields.map((field) => [field, left[field] ?? null]),
      );
      changes[key] = Object.fromEntries(
        fields.map((field) => [field, right[field] ?? null]),
      );
    } else {
      previous[key] = left ?? null;
      changes[key] = right ?? null;
    }
  }
  return { previous, changes, fields: Object.keys(changes) };
}
