import type { EvaluationOutcomeOption, ProcessData } from '../types';
import type { IntegrationStudioSettings } from '../types/integrationStudio';
import type { RegistrationAnswers, RegistrationQuestion } from '../types/operationalConfig';
import { canonicalKey, registrationQuestions } from './operationalConfig';
import { evaluateStudioCondition, validateStudioAnswer } from './courseStudioValidator';

export const EVALUATION_FORM_ID = 'form-parecer-banca';
const aliases: Record<string, string> = { CAMPO_09: 'RESULTADO', CAMPO_10: 'NOTA_FINAL', NOTA: 'NOTA_FINAL', AVALIACAO_NOTA: 'NOTA_FINAL', CAMPO_11: 'PARECER' };
export const EVALUATION_QUESTIONS: RegistrationQuestion[] = [
  { id: 'evaluation-result', fieldKey: 'RESULTADO', label: 'Resultado da defesa', fieldType: 'select', required: true },
  { id: 'evaluation-grade', fieldKey: 'NOTA_FINAL', label: 'Nota final', fieldType: 'number', required: true, validation: { min: 0, max: 10 }, helpText: 'Informe uma nota de 0 a 10. Use vírgula ou ponto para os decimais.' },
  { id: 'evaluation-report', fieldKey: 'PARECER', label: 'Parecer da banca', fieldType: 'textarea', required: true, validation: { maxLength: 10000 } },
];
export function evaluationQuestions(studio?: Partial<IntegrationStudioSettings>): RegistrationQuestion[] {
  const configured = studio?.formTemplates?.find(f => f.id === EVALUATION_FORM_ID)?.questions;
  const fields = new Map<string, RegistrationQuestion>();
  for (const custom of (Array.isArray(configured) ? configured : []) as RegistrationQuestion[]) {
    const fieldKey = aliases[canonicalKey(custom.fieldKey)] || canonicalKey(custom.fieldKey);
    if (!fieldKey || fieldKey === 'DADOS_CONFERIDOS') continue;
    const core = EVALUATION_QUESTIONS.find(q => q.fieldKey === fieldKey);
    fields.set(fieldKey, core ? { ...custom, ...core, label: custom.label || core.label, helpText: custom.helpText || core.helpText || '', visibleWhen: undefined } : { ...custom, fieldKey });
  }
  for (const core of EVALUATION_QUESTIONS) if (!fields.has(core.fieldKey)) fields.set(core.fieldKey, { ...core, helpText: core.helpText || '', visibleWhen: undefined });
  return [...fields.values()];
}
export function parseEvaluationGrade(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  const raw = String(value).trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw)) return undefined;
  const grade = Number(raw.replace(',', '.'));
  return Number.isFinite(grade) && grade >= 0 && grade <= 10 ? grade : undefined;
}
export function evaluationReviewRows(process: ProcessData, studio?: Partial<IntegrationStudioSettings>): Array<[string, string]> {
  const person = (p: { nome: string; email: string; matricula?: string; siape?: string; instituicao?: string }) => [p.nome, p.matricula && `Matrícula ${p.matricula}`, p.siape && `SIAPE ${p.siape}`, p.email, p.instituicao].filter(Boolean).join(' · ');
  const timezone = studio?.operationsPolicy?.timezone || 'America/Sao_Paulo';
  const date = new Date(process.defesa.startAt);
  const rows: Array<[string, string]> = [
    ['Trabalho', process.titulo], ['Aluno 1', person(process.aluno1)],
    ['Aluno 2', process.aluno2 ? person(process.aluno2) : 'Não possui'],
    ['Orientador', person(process.orientador)],
    ['Coorientador', process.coorientador ? person(process.coorientador) : 'Não possui'],
    ...process.banca.map((p, i): [string, string] => [`Banca ${i + 1}`, person(p)]),
    ['Data e horário', Number.isFinite(date.getTime()) ? `${new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' }).format(date)} (${timezone})` : 'Data inválida'],
    ['Local confirmado pelo aluno', process.defesa.local],
  ];
  const native = /^(ALUNO_|TEM_ALUNO_|ORIENTADOR_|COORIENTADOR_|TEM_COORIENTADOR|EXAMINADOR_|TITULO$|DEFESA_|LOCAL_ALTERNATIVO$)/;
  const questions = registrationQuestions(studio);
  for (const [key, value] of Object.entries(process.registrationAnswers || {})) {
    if (!native.test(key) && String(value ?? '').trim()) rows.push([questions.find(q => q.fieldKey === key)?.label || key, String(value)]);
  }
  return rows;
}

export function acceptEvaluationAnswers(input: { resultadoCode?: unknown; notaFinal?: unknown; parecer?: unknown; answers?: unknown }, outcomes: EvaluationOutcomeOption[], studio?: Partial<IntegrationStudioSettings>): { resultadoCode: string; resultadoLabel: string; notaFinal: number; parecer: string; answers: RegistrationAnswers } {
  const outcome = outcomes.find(o => o.code === input.resultadoCode);
  if (!outcome) throw new Error('Selecione um resultado publicado nas configurações do curso.');
  const grade = parseEvaluationGrade(input.notaFinal);
  if (grade === undefined) throw new Error('Informe uma nota final de 0 a 10, com até duas casas decimais.');
  if (typeof input.parecer !== 'string' || !input.parecer.trim() || input.parecer.length > 10000) throw new Error('Preencha o parecer da banca com até 10.000 caracteres.');
  const extra = input.answers && typeof input.answers === 'object' && !Array.isArray(input.answers) ? input.answers : {};
  const variables: Record<string, unknown> = { ...extra, RESULTADO: outcome.code, NOTA_FINAL: grade, PARECER: input.parecer.trim() };
  const accepted: RegistrationAnswers = {};
  for (const q of evaluationQuestions(studio)) {
    if (!evaluateStudioCondition(q.visibleWhen, variables)) continue;
    const value = variables[q.fieldKey];
    if (value !== undefined && !['string', 'number', 'boolean'].includes(typeof value)) throw new Error(`${q.label}: valor inválido.`);
    if (q.required && (!String(value ?? '').trim() || q.fieldType === 'checkbox' && value !== true)) throw new Error(`${q.label}: campo obrigatório.`);
    if (value === undefined || value === '') continue;
    if (q.fieldType === 'file') throw new Error('Anexos da avaliação devem ser configurados como campos de texto; o PDF da ata é gerado pelo DOCX.');
    if (q.fieldKey !== 'RESULTADO' && q.options?.length && !q.options.includes(String(value))) throw new Error(`${q.label}: selecione uma opção válida.`);
    if (q.fieldType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) throw new Error(`${q.label}: e-mail inválido.`);
    if (q.fieldType === 'number' && !Number.isFinite(Number(value))) throw new Error(`${q.label}: número inválido.`);
    const problem = validateStudioAnswer(value, q.validation);
    if (problem) throw new Error(`${q.label}: ${problem}`);
    if (String(value).length > 10000) throw new Error(`${q.label}: texto muito longo.`);
    accepted[q.fieldKey] = value as string | number | boolean;
  }
  return { resultadoCode: outcome.code, resultadoLabel: outcome.label, notaFinal: grade, parecer: input.parecer.trim(), answers: accepted };
}
