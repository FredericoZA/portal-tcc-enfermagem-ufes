import type { RegistrationAnswers, RegistrationQuestion } from '../types/operationalConfig';
import { evaluateStudioCondition, validateStudioAnswer } from './courseStudioValidator';

// These forms update the process through their dedicated endpoints and gates.
export const NATIVE_PROCESS_FORM_IDS = new Set(['form-reserva-aluno', 'form-banca-orientador', 'form-parecer-banca', 'form-homologacao-coordenador']);
export const normalizeAnswerKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();

/** One validator for the screen and API; hidden and undeclared answers are discarded. */
export function validateFormAnswers(questions: RegistrationQuestion[], input: unknown) {
  const values: Record<string, unknown> = {};
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    for (const [key, value] of Object.entries(input)) values[normalizeAnswerKey(key)] = value;
  }
  const answers: RegistrationAnswers = {}, issues: Record<string, string> = {};
  for (const question of questions) {
    const field = normalizeAnswerKey(question.fieldKey);
    if (!field || !evaluateStudioCondition(question.visibleWhen, answers)) continue;
    const value = values[field];
    let problem: string | null = null;
    const empty = value === undefined || value === null || typeof value === 'string' && !value.trim();
    if (question.required && (empty || question.fieldType === 'checkbox' && value !== true)) problem = 'Campo obrigatório.';
    else if (empty) continue;
    else if (!['string', 'number', 'boolean'].includes(typeof value)) problem = 'Valor inválido.';
    else if (question.fieldType === 'checkbox' && typeof value !== 'boolean') problem = 'Marque ou desmarque a confirmação.';
    else if (question.fieldType === 'number' && (typeof value === 'boolean' || !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(String(value)) || !Number.isFinite(Number(value)))) problem = 'Informe um número válido.';
    else if (['select', 'radio'].includes(question.fieldType) && !question.options?.includes(String(value))) problem = 'Selecione uma opção publicada pelo Master.';
    else if (question.fieldType === 'email' && (String(value).length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))) problem = 'Informe um e-mail válido.';
    else if (question.fieldType === 'date') {
      const raw = String(value), date = new Date(`${raw}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== raw) problem = 'Informe uma data válida.';
    } else if (question.fieldType === 'file') {
      try { if (new URL(String(value)).protocol !== 'https:') problem = 'Informe um link HTTPS válido para o arquivo.'; }
      catch { problem = 'Informe um link HTTPS válido para o arquivo.'; }
    }
    if (!problem && String(value).length > 10000) problem = 'Use no máximo 10.000 caracteres.';
    if (!problem) problem = validateStudioAnswer(value, question.validation);
    if (problem) issues[field] = problem;
    else answers[field] = question.fieldType === 'number' ? Number(value) : value as string | boolean;
  }
  return { answers, issues };
}
