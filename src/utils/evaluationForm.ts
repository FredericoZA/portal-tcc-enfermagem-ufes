import type { EvaluationOutcomeOption, ProcessData } from '../types';
import type { IntegrationStudioSettings } from '../types/integrationStudio';
import type { RegistrationAnswers, RegistrationQuestion } from '../types/operationalConfig';
import { canonicalKey, registrationQuestions } from './operationalConfig';
import { evaluateStudioCondition, validateStudioAnswer } from './courseStudioValidator';

export const EVALUATION_FORM_ID = 'form-parecer-banca';

export function evaluationOutcomeLabel(option:EvaluationOutcomeOption):string {
  const value=`${option.code} ${option.label}`.toLocaleLowerCase('pt-BR');
  if(value.includes('reprov'))return 'Reprovado';
  if(/ressalv|restri/.test(value))return 'Aprovado com ressalva';
  if(value.includes('aprov'))return 'Aprovado';
  return option.label.replace(/\s*\([^)]*\)/g,'').trim();
}
const previousOpinionVariant=new Map<string,number>();
function variedOpinion(body:string,result:string,endings:string[]):string {
  const previous=previousOpinionVariant.get(result);
  const choices=18;
  const variant=previous===undefined?Math.floor(Math.random()*choices):(previous+1+Math.floor(Math.random()*(choices-1)))%choices;
  previousOpinionVariant.set(result,variant);
  const start=['O trabalho','O estudo','O projeto acadêmico'][variant%3];
  const text=body.replace(/^O trabalho/,start).replace('Durante a exposição e a arguição',Math.floor(variant/3)%2?'Na apresentação e nas respostas à banca':'Durante a exposição e a arguição').replace('A banca identificou',Math.floor(variant/3)%2?'A comissão examinadora identificou':'A banca identificou');
  return `${text} ${endings[Math.floor(variant/6)]}`;
}
export function standardEvaluationOpinion(process:Pick<ProcessData,'titulo'|'protocolo'|'aluno1'|'aluno2'>,outcome?:EvaluationOutcomeOption):string {
  if(!outcome)return '';
  const result=evaluationOutcomeLabel(outcome).toLocaleLowerCase('pt-BR');
  const endings=['A deliberação considera o conjunto da apresentação, da arguição e dos elementos acadêmicos apreciados durante a sessão.', 'O resultado decorre da apreciação conjunta do estudo e das discussões realizadas pelos membros da banca nesta defesa.', 'A decisão sintetiza a análise colegiada do trabalho e os fundamentos acadêmicos discutidos ao longo da apresentação e arguição.'];
  if(result.includes('reprov'))return variedOpinion('O trabalho apresentado não atendeu satisfatoriamente aos critérios acadêmicos exigidos para a conclusão do curso. A banca identificou limitações na articulação entre os objetivos, o desenvolvimento e as conclusões, bem como aspectos da exposição e da arguição que demandam aprofundamento. Diante da análise realizada, a banca deliberou pela reprovação, conforme as normas do curso.',result,endings);
  if(result.includes('ressalva'))return variedOpinion('O trabalho demonstrou pertinência temática e contribuição para a formação acadêmica, com desenvolvimento compatível com os objetivos propostos. A apresentação e a discussão permitiram reconhecer os avanços alcançados e os aspectos que ainda exigem aperfeiçoamento. A banca deliberou pela aprovação com ressalvas, condicionada à incorporação das correções e recomendações apresentadas durante a arguição e à conferência da versão definitiva.',result,endings);
  return variedOpinion('O trabalho foi apresentado com clareza, organização e coerência, evidenciando dedicação na construção do estudo e adequada articulação entre os objetivos, o desenvolvimento e as conclusões. Durante a exposição e a arguição, observou-se domínio do tema e capacidade de reflexão sobre as questões abordadas. A banca reconhece a relevância da discussão para a formação em enfermagem e a qualidade do percurso acadêmico desenvolvido, deliberando pela aprovação do trabalho.',result,endings);
}
const aliases: Record<string, string> = { CAMPO_09: 'RESULTADO', CAMPO_11: 'PARECER' };
const LEGACY_GRADE_KEYS = new Set(['CAMPO_10', 'NOTA', 'NOTA_FINAL', 'AVALIACAO_NOTA', 'AVALIACAO_GRADE', 'EVALUATION_GRADE']);

export const EVALUATION_QUESTIONS: RegistrationQuestion[] = [
  { id: 'evaluation-result', fieldKey: 'RESULTADO', label: 'Resultado da defesa', fieldType: 'select', required: true },
  { id: 'evaluation-report', fieldKey: 'PARECER', label: 'Parecer da banca', fieldType: 'textarea', required: true, validation: { maxLength: 10000 } },
];

export function evaluationQuestions(studio?: Partial<IntegrationStudioSettings>): RegistrationQuestion[] {
  const configured = studio?.processFieldSchemas?.evaluation || studio?.formTemplates?.find(f => f.id === EVALUATION_FORM_ID)?.questions;
  const fields = new Map<string, RegistrationQuestion>();
  for (const custom of (Array.isArray(configured) ? configured : []) as RegistrationQuestion[]) {
    const rawKey = canonicalKey(custom.fieldKey);
    if (LEGACY_GRADE_KEYS.has(rawKey)) continue;
    const fieldKey = aliases[rawKey] || rawKey;
    if (!fieldKey || fieldKey === 'DADOS_CONFERIDOS' || LEGACY_GRADE_KEYS.has(fieldKey)) continue;
    const core = EVALUATION_QUESTIONS.find(q => q.fieldKey === fieldKey);
    fields.set(fieldKey, core
      ? { ...custom, ...core, label: custom.label || core.label, helpText: custom.helpText || core.helpText || '', visibleWhen: undefined }
      : { ...custom, fieldKey });
  }
  for (const core of EVALUATION_QUESTIONS) {
    if (!fields.has(core.fieldKey)) fields.set(core.fieldKey, { ...core, helpText: core.helpText || '', visibleWhen: undefined });
  }
  return [...fields.values()];
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

export function acceptEvaluationAnswers(
  input: { resultadoCode?: unknown; parecer?: unknown; answers?: unknown },
  outcomes: EvaluationOutcomeOption[],
  studio?: Partial<IntegrationStudioSettings>
): { resultadoCode: string; resultadoLabel: string; parecer: string; answers: RegistrationAnswers } {
  const outcome = outcomes.find(o => o.code === input.resultadoCode);
  if (!outcome) throw new Error('Selecione um resultado válido.');
  if (typeof input.parecer !== 'string' || !input.parecer.trim() || input.parecer.length > 10000) throw new Error('Preencha o parecer da banca com até 10.000 caracteres.');
  if(input.parecer.includes('[Completar com '))throw new Error('Complete a fundamentação e os encaminhamentos do texto-padrão antes de enviar o parecer.');
  const extra = input.answers && typeof input.answers === 'object' && !Array.isArray(input.answers) ? input.answers as Record<string, unknown> : {};
  const variables: Record<string, unknown> = { ...extra, RESULTADO: outcome.code, PARECER: input.parecer.trim() };
  for (const key of LEGACY_GRADE_KEYS) delete variables[key];
  const accepted: RegistrationAnswers = {};
  for (const q of evaluationQuestions(studio)) {
    if (LEGACY_GRADE_KEYS.has(canonicalKey(q.fieldKey))) continue;
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
  return { resultadoCode: outcome.code, resultadoLabel: evaluationOutcomeLabel(outcome), parecer: input.parecer.trim(), answers: accepted };
}
