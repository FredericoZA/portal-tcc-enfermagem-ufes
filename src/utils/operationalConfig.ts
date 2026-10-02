import { formatTimeExtenso, formatDateExtensoTotal, formatNameTitleCase, formatTccTitle, normalizeEmail } from './formatters';
import type { IntegrationStudioSettings, StudioValidationRule } from '../types/integrationStudio';
import type { CatalogEntry, OperationalConfig, RegistrationAnswers, RegistrationQuestion, VariablePresentation } from '../types/operationalConfig';

const defaultCatalog = (kind: CatalogEntry['kind'], values: string[]): CatalogEntry[] => values.map((label, index) => ({
  id: `default-${kind.toLowerCase()}-${index + 1}`,
  kind,
  label,
  aliases: [],
  active: true,
}));

export const DEFAULT_CLASSIFICATION_CATALOGS: CatalogEntry[] = [
  ...defaultCatalog('AREA_TEMATICA', [
    'Saúde coletiva e atenção primária',
    'Saúde da mulher',
    'Saúde da criança e do adolescente',
    'Saúde do adulto e do idoso',
    'Saúde mental',
    'Enfermagem hospitalar e urgência/emergência',
    'Gestão, educação e formação em enfermagem',
    'Segurança do paciente e qualidade do cuidado',
    'Tecnologia e inovação em saúde',
    'Outra área temática',
  ]),
  ...defaultCatalog('TEMA_PRINCIPAL', [
    'Assistência e cuidado de enfermagem',
    'Promoção da saúde e prevenção de agravos',
    'Educação em saúde',
    'Gestão do cuidado e dos serviços',
    'Qualidade e segurança do paciente',
    'Formação e trabalho em enfermagem',
    'Tecnologias aplicadas à saúde',
    'Epidemiologia e vigilância em saúde',
    'Outro tema principal',
  ]),
  ...defaultCatalog('TIPO_DE_ESTUDO', [
    'Estudo qualitativo',
    'Estudo quantitativo',
    'Estudo de métodos mistos',
    'Estudo transversal',
    'Estudo de caso',
    'Pesquisa documental',
    'Revisão integrativa da literatura',
    'Revisão sistemática da literatura',
    'Relato de experiência',
    'Outro tipo de estudo',
  ]),
  ...defaultCatalog('FINALIDADE_DO_TRABALHO', [
    'Analisar ou descrever uma situação de saúde',
    'Avaliar práticas, serviços ou intervenções',
    'Identificar fatores associados ou necessidades',
    'Sistematizar evidências da literatura',
    'Propor ou avaliar tecnologia, instrumento ou protocolo',
    'Relatar e refletir sobre experiência de cuidado, ensino ou gestão',
    'Outra finalidade',
  ]),
];

export const DEFAULT_OPERATIONAL_CONFIG: OperationalConfig = {
  reservation: {
    departmentEmail: '',
    recipientName: 'Departamento de Enfermagem',
    emailSubject: 'Solicitação de reserva de local para defesa de TCC — {{TITULO}}',
    emailBody: 'Prezados(as),\n\nSolicitamos a reserva de local para a defesa do TCC “{{TITULO}}”, prevista para {{DEFESA_DATA_HORA}}.\n\nLocal preferencial: {{DEFESA_LOCAL}}.\nLocal alternativo: {{LOCAL_ALTERNATIVO}}.\n\nAlunos(as): {{ALUNOS_NOMES}}.\nOrientador(a): {{ORIENTADOR_NOME}}.\n\nAtenciosamente,\nSecretaria do Curso de Graduação em Enfermagem e Obstetrícia.',
    locations: [
      'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES',
      'Sala de reuniões do Departamento de Enfermagem - CCS/UFES'
    ]
  },
  catalogs: DEFAULT_CLASSIFICATION_CATALOGS,
  diagnostics: { staleDays: 30, minimumCoverage: 70, priority: 'P2' },
  presentations: {}
};

export const canonicalKey = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .toUpperCase();

export function operationalConfig(studio?: Partial<IntegrationStudioSettings>): OperationalConfig {
  const config = studio?.operationalConfig;
  const configuredCatalogs = Array.isArray(config?.catalogs) ? config.catalogs : [];
  const configuredKinds = new Set(configuredCatalogs.map((entry) => entry.kind));
  const catalogs = [
    ...configuredCatalogs,
    ...DEFAULT_CLASSIFICATION_CATALOGS.filter((entry) => !configuredKinds.has(entry.kind)),
  ];
  return {
    ...DEFAULT_OPERATIONAL_CONFIG,
    ...config,
    reservation: { ...DEFAULT_OPERATIONAL_CONFIG.reservation, ...config?.reservation },
    diagnostics: { ...DEFAULT_OPERATIONAL_CONFIG.diagnostics, ...config?.diagnostics },
    catalogs,
    presentations: config?.presentations || {}
  };
}

const FULL_NAME_VALIDATION: StudioValidationRule = {
  minLength: 5,
  maxLength: 160,
  pattern: "^[A-Za-zÀ-ÖØ-öø-ÿ'’.-]+(?:\\s+[A-Za-zÀ-ÖØ-öø-ÿ'’.-]+)+$",
  errorMessage: 'Informe o nome completo, com pelo menos nome e sobrenome, sem números.'
};

const STUDENT_ID_VALIDATION: StudioValidationRule = {
  minLength: 5,
  maxLength: 20,
  pattern: '^\\d{5,20}$',
  errorMessage: 'Informe a matrícula completa usando somente números.'
};

const SIAPE_VALIDATION: StudioValidationRule = {
  minLength: 7,
  maxLength: 7,
  pattern: '^\\d{7}$',
  errorMessage: 'Informe o SIAPE com 7 algarismos.'
};

const q = (
  fieldKey: string,
  label: string,
  section: string,
  fieldType = 'text',
  visibleWhen?: RegistrationQuestion['visibleWhen'],
  validation?: StudioValidationRule
): RegistrationQuestion => ({
  id: `registration-${fieldKey}`,
  fieldKey,
  label,
  section,
  fieldType,
  required: true,
  visibleWhen,
  validation
});

const when = (fieldKey: string) => ({ fieldKey, operator: 'EQUALS' as const, value: 'Sim' });

export const REGISTRATION_QUESTIONS: RegistrationQuestion[] = [
  q('ALUNO_1_NOME', 'Nome completo', 'Aluno', 'text', undefined, FULL_NAME_VALIDATION),
  q('ALUNO_1_MATRICULA', 'Matrícula do curso', 'Aluno', 'text', undefined, STUDENT_ID_VALIDATION),
  q('ALUNO_1_EMAIL', 'E-mail do aluno', 'Aluno', 'email'),

  { ...q('TEM_ALUNO_2', 'O trabalho tem segundo autor?', 'Segundo autor', 'select'), options: ['Não', 'Sim'] },
  q('ALUNO_2_NOME', 'Nome completo do segundo autor', 'Segundo autor', 'text', when('TEM_ALUNO_2'), FULL_NAME_VALIDATION),
  q('ALUNO_2_MATRICULA', 'Matrícula do segundo autor', 'Segundo autor', 'text', when('TEM_ALUNO_2'), STUDENT_ID_VALIDATION),
  q('ALUNO_2_EMAIL', 'E-mail do segundo autor', 'Segundo autor', 'email', when('TEM_ALUNO_2')),

  q('ORIENTADOR_NOME', 'Nome completo do orientador', 'Orientação', 'text', undefined, FULL_NAME_VALIDATION),
  q('ORIENTADOR_EMAIL', 'E-mail do orientador', 'Orientação', 'email'),
  q('ORIENTADOR_SIAPE', 'SIAPE do orientador', 'Orientação', 'text', undefined, SIAPE_VALIDATION),

  { ...q('TEM_COORIENTADOR', 'Há coorientador?', 'Coorientação', 'select'), options: ['Não', 'Sim'] },
  q('COORIENTADOR_NOME', 'Nome completo do coorientador', 'Coorientação', 'text', when('TEM_COORIENTADOR'), FULL_NAME_VALIDATION),
  q('COORIENTADOR_EMAIL', 'E-mail do coorientador', 'Coorientação', 'email', when('TEM_COORIENTADOR')),
  { ...q('COORIENTADOR_SIAPE', 'SIAPE do coorientador, se aplicável', 'Coorientação', 'text', when('TEM_COORIENTADOR'), SIAPE_VALIDATION), required: false },
  { ...q('COORIENTADOR_INSTITUICAO', 'Instituição do coorientador', 'Coorientação', 'text', when('TEM_COORIENTADOR')), required: false },

  ...[2, 3].flatMap(n => [
    q(`EXAMINADOR_${n}_NOME`, `Nome completo do avaliador ${n - 1}`, 'Banca', 'text', undefined, FULL_NAME_VALIDATION),
    q(`EXAMINADOR_${n}_EMAIL`, `E-mail do avaliador ${n - 1}`, 'Banca', 'email'),
    q(`EXAMINADOR_${n}_INSTITUICAO`, `Instituição do avaliador ${n - 1}`, 'Banca'),
    { ...q(`EXAMINADOR_${n}_SIAPE`, `SIAPE do avaliador ${n - 1}, se aplicável`, 'Banca', 'text', undefined, SIAPE_VALIDATION), required: false }
  ]),

  q('TITULO', 'Título completo do TCC', 'Trabalho'),
  { ...q('AREA_TEMATICA', 'Área temática', 'Trabalho', 'select'), required: false, helpText: 'Escolha a área que melhor representa o trabalho. Ex.: saúde da mulher, saúde mental, segurança do paciente.' },
  { ...q('TEMA_PRINCIPAL', 'Tema principal', 'Trabalho', 'select'), required: false, helpText: 'Escolha o foco principal. Ex.: assistência de enfermagem, educação em saúde, gestão do cuidado.' },
  { ...q('TIPO_DE_ESTUDO', 'Tipo de estudo', 'Trabalho', 'select'), required: false, helpText: 'Ex.: estudo qualitativo, revisão integrativa, estudo transversal ou relato de experiência.' },
  { ...q('FINALIDADE_DO_TRABALHO', 'Finalidade do trabalho', 'Trabalho', 'select'), required: false, helpText: 'Escolha o objetivo geral mais próximo do estudo. Ex.: analisar uma situação, avaliar uma intervenção ou sistematizar evidências.' },

  q('DEFESA_DATA_HORA', 'Data e hora pretendidas para a defesa', 'Reserva do local', 'datetime-local'),
  q('DEFESA_LOCAL', 'Local que pretende reservar', 'Reserva do local', 'select'),
  { ...q('LOCAL_ALTERNATIVO', 'Local alternativo se o preferido estiver ocupado', 'Reserva do local', 'select'), required: false }
];

const aliases: Record<string, string> = {
  CAMPO_01: 'ALUNO_1_NOME',
  ALUNO_NOME: 'ALUNO_1_NOME',
  ALUNO_MATRICULA: 'ALUNO_1_MATRICULA',
  CAMPO_02: 'TITULO',
  CAMPO_03: 'ORIENTADOR_NOME',
  CAMPO_COORIENTADOR: 'COORIENTADOR_NOME',
  CAMPO_04: 'DEFESA_DATA_HORA',
  CAMPO_07_LOCAL: 'DEFESA_LOCAL',
  ORIENTADOR_CIAP: 'ORIENTADOR_SIAPE',
  COORIENTADOR_CIAP: 'COORIENTADOR_SIAPE',
  EXAMINADOR_2_CIAP: 'EXAMINADOR_2_SIAPE',
  EXAMINADOR_3_CIAP: 'EXAMINADOR_3_SIAPE'
};

export function catalogIsValid(entry: CatalogEntry, at = new Date().toISOString()): boolean {
  const day = at.slice(0, 10);
  return entry.active && (!entry.validFrom || day >= entry.validFrom) && (!entry.validUntil || day <= entry.validUntil);
}

export function resolveCatalogValue(entries: CatalogEntry[], kind: string, value: unknown, at: string): string {
  const needle = canonicalKey(value);
  if (!needle) return '';
  return entries.find(e => e.kind === kind && catalogIsValid(e, at) && [e.label, ...e.aliases].some(v => canonicalKey(v) === needle))?.label || '';
}

export function registrationQuestions(studio?: Partial<IntegrationStudioSettings>): RegistrationQuestion[] {
  const published = studio?.formTemplates?.find(f => f.id === 'form-reserva-aluno');
  const configured = (Array.isArray(published?.questions) ? published.questions : []) as RegistrationQuestion[];
  const result: RegistrationQuestion[] = [];
  const seen = new Set<string>();

  for (const custom of configured) {
    const fieldKey = aliases[canonicalKey(custom.fieldKey)] || canonicalKey(custom.fieldKey);
    if (!fieldKey || seen.has(fieldKey) || ['CAMPO_06', 'BANCA_EMAILS'].includes(fieldKey)) continue;
    seen.add(fieldKey);
    const core = REGISTRATION_QUESTIONS.find(f => f.fieldKey === fieldKey);
    result.push(core
      ? { ...core, ...custom, fieldKey, fieldType: core.fieldType, required: core.required || custom.required, visibleWhen: core.visibleWhen, validation: core.validation || custom.validation, helpText: custom.helpText || core.helpText }
      : { ...custom, fieldKey, section: custom.section || 'Trabalho' });
  }

  for (const core of REGISTRATION_QUESTIONS) if (!seen.has(core.fieldKey)) result.push({ ...core });

  const config = operationalConfig(studio);
  const ordered: RegistrationQuestion[] = [];
  const visited = new Set<string>();
  const visit = (field: RegistrationQuestion) => {
    if (visited.has(field.fieldKey)) return;
    visited.add(field.fieldKey);
    const dependency = result.find(f => f.fieldKey === field.visibleWhen?.fieldKey);
    if (dependency) visit(dependency);
    ordered.push(field);
  };
  result.forEach(visit);

  return ordered.map(field => {
    if (['DEFESA_LOCAL', 'LOCAL_ALTERNATIVO'].includes(field.fieldKey)) return { ...field, fieldType: 'select', options: config.reservation.locations.filter(Boolean) };
    const options = config.catalogs.filter(e => e.kind === field.fieldKey && catalogIsValid(e)).map(e => e.label);
    return options.length ? { ...field, fieldType: 'select', options } : field;
  });
}

/** Convert a wall-clock value in the installation timezone, independent of the browser timezone. */
export function localDateTimeToIso(value: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Informe data e hora válidas.');
  const target = Date.parse(`${value}:00Z`);
  let instant = target;
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  for (let n = 0; n < 3; n++) instant += target - Date.parse(formatter.format(new Date(instant)).replace(' ', 'T') + ':00Z');
  if (formatter.format(new Date(instant)).replace(' ', 'T') !== value) throw new Error('Este horário não existe no fuso configurado.');
  return new Date(instant).toISOString();
}

function cleanText(value: unknown): string {
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
}

function normalizeStudentId(value: unknown): string {
  return String(value ?? '').trim().replace(/[.\s-]+/g, '');
}

function canonicalPerson(prefix: string, answers: RegistrationAnswers) {
  const name = cleanText(answers[`${prefix}_NOME`]);
  return {
    nome: name ? formatNameTitleCase(name) : '',
    email: normalizeEmail(cleanText(answers[`${prefix}_EMAIL`])),
    matricula: normalizeStudentId(answers[`${prefix}_MATRICULA`]),
    siape: normalizeStudentId(answers[`${prefix}_SIAPE`]),
    instituicao: cleanText(answers[`${prefix}_INSTITUICAO`])
  };
}

export function registrationPayload(a: RegistrationAnswers, timezone: string) {
  const s = (k: string) => cleanText(a[k]);
  return {
    aluno1: canonicalPerson('ALUNO_1', a),
    aluno2: s('TEM_ALUNO_2') === 'Sim' ? canonicalPerson('ALUNO_2', a) : null,
    orientador: canonicalPerson('ORIENTADOR', a),
    coorientador: s('TEM_COORIENTADOR') === 'Sim' ? canonicalPerson('COORIENTADOR', a) : null,
    titulo: formatTccTitle(s('TITULO')),
    banca: [2, 3].map(n => ({ ...canonicalPerson(`EXAMINADOR_${n}`, a), funcao: `EXAMINER_${n}` })),
    defesa: {
      startAt: localDateTimeToIso(s('DEFESA_DATA_HORA'), timezone),
      local: s('DEFESA_LOCAL'),
      alternateLocation: s('LOCAL_ALTERNATIVO')
    },
    registrationAnswers: a
  };
}

export function formatVariable(value: unknown, presentation: VariablePresentation, timezone = 'America/Sao_Paulo'): string {
  let output = String(value ?? '');
  if (output && presentation.format !== 'original') {
    const date = new Date(output);
    if (!Number.isFinite(date.getTime())) throw new Error(`A variável ${presentation.source} não contém uma data válida.`);
    const long = presentation.format.endsWith('_long');
    const hasDate = presentation.format.startsWith('date');
    const hasTime = presentation.format.startsWith('time') || presentation.format.startsWith('datetime');
    output = new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      ...(hasDate ? { dateStyle: long ? 'long' : 'short' } as const : {}),
      ...(hasTime ? { timeStyle: 'short' } as const : {})
    }).format(date);
    if (long && hasDate) {
      const day = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
      const time = new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
      output = formatDateExtensoTotal(day + 'T12:00:00') + (hasTime ? ' às ' + time : '');
    }
    if (long && hasTime) {
      const time = new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
      output = output.replace(time, formatTimeExtenso(time));
    }
  }
  return presentation.letterCase === 'upper'
    ? output.toLocaleUpperCase('pt-BR')
    : presentation.letterCase === 'lower'
      ? output.toLocaleLowerCase('pt-BR')
      : output;
}

export function presentVariables(
  variables: Record<string, string>,
  artifactId: string,
  studio?: Partial<IntegrationStudioSettings>
): Record<string, string> {
  const output = { ...variables };
  for (const rule of operationalConfig(studio).presentations[artifactId] || []) {
    if (!(canonicalKey(rule.source) in variables)) throw new Error(`Variável de origem não encontrada: ${rule.source}.`);
    output[rule.marker.replace(/^<<|>>$|^\{\{|\}\}$|^\[\[|\]\]$/g, '').trim()] = formatVariable(
      variables[canonicalKey(rule.source)],
      rule,
      studio?.operationsPolicy?.timezone
    );
  }
  return output;
}
