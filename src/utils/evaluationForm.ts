import {formatDateNumericWithWeekday,formatTime24h} from './formatters';
import {isEmailAddress} from './emailAddress';
import type { EvaluationOutcomeOption, ProcessData } from '../types';
import type { IntegrationStudioSettings } from '../types/integrationStudio';
import type { RegistrationAnswers, RegistrationQuestion } from '../types/operationalConfig';
import { canonicalKey, isRegistrationIdentifierField, registrationQuestions } from './operationalConfig';
import { evaluateStudioCondition, validateStudioAnswer } from './courseStudioValidator';
import {formQuestionsWithoutIdentifiers} from './studioFormAnswers';
import {effectiveDefenseReservationStatus} from './defenseReservationState';

export function conceptRegistrationBlocker(process: Pick<ProcessData, 'defesa'>, now = Date.now()): string | undefined {
  if (effectiveDefenseReservationStatus(process) !== 'CONFIRMADO') {
    return 'O registro de conceito e ata aguarda a confirmação do local da defesa.';
  }
  if (!process.defesa.invitationSentAt) {
    return 'O local está confirmado. O registro de conceito e ata aguarda o envio do convite à banca para este agendamento.';
  }
  const defenseAt = Date.parse(process.defesa.startAt);
  if (!Number.isFinite(defenseAt)) return 'Confira a data e o horário da defesa com a secretaria.';
  if (defenseAt > now) return 'O registro de conceito e ata será liberado no horário agendado para a defesa.';
}

export function isConceptRegistrationReleased(process: Pick<ProcessData, 'defesa'>, now = Date.now()): boolean {
  return conceptRegistrationBlocker(process, now) === undefined;
}

export const EVALUATION_OUTCOMES:EvaluationOutcomeOption[] = [
 {code:'APROVADO',label:'Aprovado'},
 {code:'APROVADO_COM_RESSALVA',label:'Aprovado com ressalva'},
 {code:'REPROVADO',label:'Reprovado'}
];

export const EVALUATION_FORM_ID = 'form-parecer-banca';

export function evaluationOutcomeLabel(option:EvaluationOutcomeOption):string {
  const value=`${option.code} ${option.label}`.toLocaleLowerCase('pt-BR');
  if(value.includes('reprov'))return 'Reprovado';
  if(/ressalv|restri/.test(value))return 'Aprovado com ressalva';
  if(value.includes('aprov'))return 'Aprovado';
  return option.label.replace(/\s*\([^)]*\)/g,'').trim();
}
// Each pool has the same grammatical function and stays within its concept.
// The code combines reviewed language; it does not infer research findings.
const opinionByConcept: Record<string, readonly (readonly string[])[]> = {
  "Aprovado": [
    [
      "O trabalho distingue-se pela clareza com que delimita o tema e pela coerência com que articula a proposta, a discussão e as considerações finais.",
      "No trabalho, destacam-se a unidade da exposição escrita e a consistência do encadeamento entre a questão examinada, o desenvolvimento e as conclusões.",
      "Quanto ao trabalho, merecem destaque a pertinência do tema e a ordenação dos argumentos, que conferem unidade à exposição e clareza às considerações finais."
    ],
    [
      "O tratamento conferido ao tema revela discernimento na seleção dos aspectos relevantes e contribui para o exercício da reflexão acadêmica em Enfermagem.",
      "A discussão evidencia cuidado na exposição das ideias e capacidade de examinar o tema com a atenção que sua relevância acadêmica requer.",
      "A abordagem adotada favorece a compreensão do tema e expressa uma contribuição pertinente ao diálogo acadêmico no âmbito da formação em Enfermagem."
    ],
    [
      "A clareza da apresentação e a pertinência dos esclarecimentos prestados na arguição sustentam o conceito Aprovado e confirmam a solidez da exposição acadêmica.",
      "A consistência do texto, aliada à propriedade das respostas oferecidas durante a defesa, fundamenta o conceito Aprovado e evidencia domínio das questões discutidas.",
      "A exposição oral e os esclarecimentos oferecidos à banca corroboram os méritos do texto escrito e sustentam o conceito Aprovado pela consistência do conjunto apresentado."
    ],
    [
      "Para a versão definitiva, recomenda-se incorporar as observações de redação e apresentação pertinentes, preservando a coerência do conjunto.",
      "Na versão final, recomenda-se acolher as contribuições da banca que possam conferir maior precisão e fluidez à redação.",
      "A versão definitiva poderá beneficiar-se dos ajustes de redação indicados na sessão, com atenção à unidade do texto."
    ]
  ],
  "Aprovado com ressalva": [
    [
      "O trabalho apresenta uma proposta pertinente à formação em Enfermagem, cujo mérito acadêmico pode ser mais bem evidenciado pelo aprimoramento da organização textual e da discussão.",
      "No trabalho, reconhece-se a pertinência da proposta para a formação em Enfermagem, acompanhada da necessidade de aprimorar a organização e os argumentos.",
      "Quanto ao trabalho, identifica-se uma base pertinente à formação em Enfermagem, cuja organização e desenvolvimento precisam de maior clareza e consistência."
    ],
    [
      "Cabe conferir as conexões entre a proposta, os argumentos e as considerações finais, respeitando os limites do estudo.",
      "As conclusões devem permanecer compatíveis com o desenvolvimento apresentado, com maior clareza nas relações entre as partes do estudo.",
      "Os ajustes devem explicitar a articulação da proposta com a discussão, mantendo as conclusões dentro do alcance do estudo."
    ],
    [
      "As apreciações da sessão fundamentam o conceito Aprovado com ressalva e orientam os pontos a retomar na versão definitiva.",
      "O conceito Aprovado com ressalva acompanha as contribuições da defesa e a necessidade de aperfeiçoar os pontos discutidos pela banca.",
      "Os esclarecimentos da defesa subsidiam o conceito Aprovado com ressalva e os encaminhamentos necessários à preparação da versão final."
    ],
    [
      "Recomenda-se revisar linguagem, citações e referências com a orientação, incorporando os encaminhamentos da banca para aprimorar a comunicação acadêmica e preservar a autoria.",
      "A revisão deve contemplar linguagem, citações e referências, em diálogo com a orientação, incorporando as recomendações da banca e preservando a autoria do trabalho.",
      "Cabe conduzir a revisão com a orientação, conferindo linguagem e referências e incorporando as recomendações da banca, com respeito à autoria e ao percurso desenvolvido."
    ]
  ],
  "Reprovado": [
    [
      "O trabalho, considerado com a defesa, ainda não reúne condições suficientes para aprovação e requer revisão da estrutura e dos argumentos.",
      "No trabalho, o texto e a defesa ainda não reúnem condições suficientes para aprovação, sendo necessário retomar a organização e a discussão.",
      "Quanto ao trabalho, o conjunto apresentado ainda não reúne condições suficientes para aprovação, exigindo revisão da articulação e da fundamentação dos argumentos."
    ],
    [
      "É necessário esclarecer as relações entre a proposta de pesquisa, a discussão e as considerações finais, respeitando os limites do estudo.",
      "A proposta, a discussão e as considerações finais precisam de conexões mais claras, com fundamentação que permita compreender o percurso desenvolvido.",
      "Cabe fortalecer a articulação entre a proposta e a discussão, esclarecendo a fundamentação dos argumentos e o alcance das considerações finais."
    ],
    [
      "As apreciações da sessão fundamentam o conceito Reprovado e indicam a necessidade de aprofundamento dos pontos discutidos com os examinadores.",
      "O conceito Reprovado expressa a necessidade de reformulação do conjunto apresentado, considerando as apreciações e os encaminhamentos discutidos na defesa.",
      "A necessidade de revisão do conjunto apresentado fundamenta o conceito Reprovado, conforme os pontos e as recomendações registrados pela banca."
    ],
    [
      "Recomenda-se planejar a revisão com a orientação, conferindo linguagem e referências, preservando a autoria e observando as regras acadêmicas aplicáveis à continuidade do trabalho.",
      "Os encaminhamentos devem ser retomados com a orientação, incluindo linguagem e referências, para fortalecer a argumentação, preservar a autoria e observar as regras acadêmicas aplicáveis.",
      "A reformulação deve ser acompanhada pela orientação, com atenção à linguagem e às referências, respeitando a autoria e as regras acadêmicas para continuidade do trabalho."
    ]
  ]
};

// Local text composition only. Adjacent clicks cannot return the same paragraph,
// even when the random source returns the same numbers on every call.
export function standardEvaluationOpinion(
  outcome?: EvaluationOutcomeOption,
  random = Math.random,
  previousOpinion = ''
): string {
  if (!outcome) return '';
  const label=evaluationOutcomeLabel(outcome);
  const pools = Object.hasOwn(opinionByConcept,label)?opinionByConcept[label]:undefined;
  if (!pools) return '';
  const indexes=pools.map(pool=>{const value=random();return Number.isFinite(value)?Math.max(0,Math.min(pool.length-1,Math.floor(value*pool.length))):0;});
  const compose=()=>pools.map((pool,index)=>pool[indexes[index]]).join(' ');
  let text=compose();
  if(text===previousOpinion.trim()){
    indexes[indexes.length-1]=(indexes.at(-1)!+1)%pools[pools.length-1].length;
    text=compose();
  }
  return text;
}
const aliases: Record<string, string> = { CAMPO_09: 'RESULTADO', CAMPO_11: 'PARECER' };
const LEGACY_GRADE_KEYS = new Set(['CAMPO_10', 'NOTA', 'NOTA_FINAL', 'AVALIACAO_NOTA', 'AVALIACAO_GRADE', 'EVALUATION_GRADE']);

export const EVALUATION_QUESTIONS: RegistrationQuestion[] = [
  { id: 'evaluation-result', fieldKey: 'RESULTADO', label: 'Conceito da defesa', fieldType: 'select', required: true },
  { id: 'evaluation-report', fieldKey: 'PARECER', label: 'Parecer da banca', fieldType: 'textarea', required: true, validation: { maxLength: 10000 } },
];

export function evaluationQuestions(studio?: Partial<IntegrationStudioSettings>): RegistrationQuestion[] {
  const configured = studio?.processFieldSchemas?.evaluation || studio?.formTemplates?.find(f => f.id === EVALUATION_FORM_ID)?.questions;
  const fields = new Map<string, RegistrationQuestion>();
  for (const custom of formQuestionsWithoutIdentifiers((Array.isArray(configured) ? configured : []) as RegistrationQuestion[])) {
    const rawKey = canonicalKey(custom.fieldKey);
    if (LEGACY_GRADE_KEYS.has(rawKey)) continue;
    const fieldKey = aliases[rawKey] || rawKey;
    if (!fieldKey || fieldKey === 'DADOS_CONFERIDOS' || LEGACY_GRADE_KEYS.has(fieldKey)) continue;
    const core = EVALUATION_QUESTIONS.find(q => q.fieldKey === fieldKey);
    fields.set(fieldKey, core
      ? { ...custom, ...core, label: fieldKey === 'RESULTADO' ? core.label : custom.label || core.label, helpText: custom.helpText || core.helpText || '', visibleWhen: undefined }
      : { ...custom, fieldKey });
  }
  for (const core of EVALUATION_QUESTIONS) {
    if (!fields.has(core.fieldKey)) fields.set(core.fieldKey, { ...core, helpText: core.helpText || '', visibleWhen: undefined });
  }
  return [...fields.values()];
}

export function evaluationReviewRows(process: ProcessData, studio?: Partial<IntegrationStudioSettings>): Array<[string, string]> {
  const person = (p: { nome: string; email: string; instituicao?: string }) => [p.nome, p.email, p.instituicao].filter(Boolean).join(' · ');
  const timezone = studio?.operationsPolicy?.timezone || 'America/Sao_Paulo';
  const date = new Date(process.defesa.startAt);
  const rows: Array<[string, string]> = [
    ['Trabalho', process.titulo], ['Aluno autor', person(process.aluno1)],
    ...(process.aluno2 ? [['Aluno autor', person(process.aluno2)] as [string,string]] : []),
    ['Orientador', person(process.orientador)],
    ['Coorientador', process.coorientador ? person(process.coorientador) : 'Não possui'],
    ...process.banca.filter(p=>p.funcao!=='ORIENTADOR').map((p): [string, string] => ['Examinador', person(p)]),
    ['Data e horário', Number.isFinite(date.getTime()) ? `${`${formatDateNumericWithWeekday(process.defesa.startAt)} às ${formatTime24h(process.defesa.startAt)}`} (${timezone})` : 'Data inválida'],
    ['Local confirmado da defesa', process.defesa.local],
  ];
  const native = /^(ALUNO_|TEM_ALUNO_|ORIENTADOR_|COORIENTADOR_|TEM_COORIENTADOR|EXAMINADOR_|TITULO$|DEFESA_|LOCAL_ALTERNATIVO$)/;
  const questions = registrationQuestions(studio);
  const configuredQuestions = studio?.formTemplates?.find(form => form.id === 'form-reserva-aluno')?.questions;
  const originalQuestions = (Array.isArray(configuredQuestions) ? configuredQuestions : []) as RegistrationQuestion[];
  const identifierKeys = new Set(originalQuestions.filter(question => isRegistrationIdentifierField(question.fieldKey, question.label)).map(question => canonicalKey(question.fieldKey)));
  for (const [key, value] of Object.entries(process.registrationAnswers || {})) {
    const label = questions.find(q => q.fieldKey === key)?.label || key;
    if (!native.test(key) && !identifierKeys.has(canonicalKey(key)) && !isRegistrationIdentifierField(key, label) && String(value ?? '').trim()) rows.push([label, String(value)]);
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
  if(/\[\s*(?:completar|preencher|inserir)\b[^\]]{0,300}\]/i.test(input.parecer))throw new Error('Complete a fundamentação e os encaminhamentos do texto-padrão antes de enviar o parecer.');
  const extra = input.answers && typeof input.answers === 'object' && !Array.isArray(input.answers) ? input.answers as Record<string, unknown> : {};
  const variables: Record<string, unknown> = { ...extra, RESULTADO: outcome.code, PARECER: input.parecer.trim() };
  for (const key of LEGACY_GRADE_KEYS) delete variables[key];
  const accepted: RegistrationAnswers = {};
  // Presence is a core session fact, independent of optional custom questions.
  if (extra.COORIENTADOR_PRESENTE !== undefined && extra.COORIENTADOR_PRESENTE !== '') {
    if (!['Sim','Não'].includes(String(extra.COORIENTADOR_PRESENTE)) || typeof extra.COORIENTADOR_PRESENTE !== 'string') throw new Error('Informe se o coorientador participou da sessão.');
    accepted.COORIENTADOR_PRESENTE=extra.COORIENTADOR_PRESENTE;
  }
  for (const q of evaluationQuestions(studio)) {
    if (q.fieldKey === 'COORIENTADOR_PRESENTE') continue;
    if (LEGACY_GRADE_KEYS.has(canonicalKey(q.fieldKey))) continue;
    if (!evaluateStudioCondition(q.visibleWhen, variables)) continue;
    const value = variables[q.fieldKey];
    if (value !== undefined && !['string', 'number', 'boolean'].includes(typeof value)) throw new Error(`${q.label}: valor inválido.`);
    if (q.required && (!String(value ?? '').trim() || q.fieldType === 'checkbox' && value !== true)) throw new Error(`${q.label}: campo obrigatório.`);
    if (value === undefined || value === '') continue;
    if (q.fieldType === 'file') throw new Error('Anexos do parecer devem ser configurados como campos de texto; o PDF da ata é gerado pelo DOCX.');
    if (q.fieldKey !== 'RESULTADO' && q.options?.length && !q.options.includes(String(value))) throw new Error(`${q.label}: selecione uma opção válida.`);
    if (q.fieldType === 'email' && !isEmailAddress(String(value))) throw new Error(`${q.label}: e-mail inválido.`);
    if (q.fieldType === 'number' && !Number.isFinite(Number(value))) throw new Error(`${q.label}: número inválido.`);
    const problem = validateStudioAnswer(value, q.validation);
    if (problem) throw new Error(`${q.label}: ${problem}`);
    if (String(value).length > 10000) throw new Error(`${q.label}: texto muito longo.`);
    accepted[q.fieldKey] = value as string | number | boolean;
  }
  return { resultadoCode: outcome.code, resultadoLabel: evaluationOutcomeLabel(outcome), parecer: input.parecer.trim(), answers: accepted };
}
