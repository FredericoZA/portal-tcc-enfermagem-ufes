import type { RegistrationAnswers } from '../types/operationalConfig';
import type { WorkflowOperationsPolicy } from '../types/workflowOperations';
import { formatNameTitleCase, normalizeEmail } from './formatters';

const PERSON_NAME_KEY = /(?:^|_)(?:ALUNO_\d|ORIENTADOR|COORIENTADOR|EXAMINADOR_\d)_NOME$/;
const STUDENT_ID_KEY = /^ALUNO_\d_MATRICULA$/;
const EMAIL_KEY = /_EMAIL$/;
const NUMERIC_SIAPE_KEY = /^ORIENTADOR_SIAPE$/;

function normalizeSingleLine(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeIdentifier(value: string): string {
  const single = normalizeSingleLine(value);
  // Espaços, pontos e hífens são tratados apenas como formatação visual.
  // Letras e outros símbolos permanecem para a validação rejeitar o valor,
  // evitando transformar silenciosamente uma matrícula incorreta em outra.
  return /^[\d\s.-]+$/.test(single) ? single.replace(/\D/g, '') : single;
}

export function normalizeRegistrationAnswers(input: RegistrationAnswers): RegistrationAnswers {
  const output: RegistrationAnswers = {};
  for (const [fieldKey, raw] of Object.entries(input || {})) {
    if (typeof raw === 'boolean' || typeof raw === 'number') {
      output[fieldKey] = raw;
      continue;
    }
    const source = String(raw ?? '');
    if (EMAIL_KEY.test(fieldKey)) {
      output[fieldKey] = normalizeEmail(normalizeSingleLine(source));
    } else if (STUDENT_ID_KEY.test(fieldKey) || NUMERIC_SIAPE_KEY.test(fieldKey)) {
      output[fieldKey] = normalizeIdentifier(source);
    } else if (PERSON_NAME_KEY.test(fieldKey)) {
      output[fieldKey] = formatNameTitleCase(normalizeSingleLine(source));
    } else if (fieldKey === 'TITULO') {
      output[fieldKey] = normalizeSingleLine(source);
    } else {
      output[fieldKey] = source.normalize('NFKC').trim();
    }
  }
  return output;
}

function assertFullPersonName(fieldKey: string, value: string): void {
  if (!PERSON_NAME_KEY.test(fieldKey) || !value) return;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 2) throw new Error(`${fieldKey}: informe o nome completo, com pelo menos nome e sobrenome.`);
  if (/\d/.test(value)) throw new Error(`${fieldKey}: o nome não pode conter números.`);
  if (!/^[\p{L}][\p{L}\p{M}'’.-]*(?:\s+[\p{L}][\p{L}\p{M}'’.-]*)+$/u.test(value)) {
    throw new Error(`${fieldKey}: use somente letras e sinais usuais de nomes próprios.`);
  }
}

export function validateRegistrationDataQuality(
  answers: RegistrationAnswers,
  policy: WorkflowOperationsPolicy
): void {
  const participantEmails = new Map<string, string>();

  for (const [fieldKey, raw] of Object.entries(answers || {})) {
    const value = String(raw ?? '').trim();
    if (!value) continue;

    assertFullPersonName(fieldKey, value);

    if (STUDENT_ID_KEY.test(fieldKey)) {
      if (!/^\d+$/.test(value)) throw new Error(`${fieldKey}: a matrícula deve conter somente algarismos.`);
      if (value.length < policy.identity.minimumStudentIdLength || value.length > 20) {
        throw new Error(`${fieldKey}: confira a matrícula completa (${policy.identity.minimumStudentIdLength} a 20 algarismos).`);
      }
    }

    if (NUMERIC_SIAPE_KEY.test(fieldKey)) {
      if (!/^\d+$/.test(value) || value.length !== policy.identity.siapeLength) {
        throw new Error(`${fieldKey}: o SIAPE deve conter exatamente ${policy.identity.siapeLength} algarismos.`);
      }
    }

    if (EMAIL_KEY.test(fieldKey)) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error(`${fieldKey}: e-mail inválido.`);
      const prior = participantEmails.get(value);
      if (prior && prior !== fieldKey) throw new Error(`${fieldKey}: este e-mail já foi informado em ${prior}. Cada participante deve ter seu próprio e-mail.`);
      participantEmails.set(value, fieldKey);
    }
  }

  const title = String(answers.TITULO ?? '').trim();
  if (title && title.length < 8) throw new Error('TITULO: informe o título completo do TCC.');
}
