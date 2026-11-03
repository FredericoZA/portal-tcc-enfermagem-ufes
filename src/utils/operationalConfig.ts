import {isEmailAddress} from './emailAddress';
import {renderInstitutionName} from './institutionName';
import {CUSTOM_DEFENSE_LOCATION} from './reservationLocation';
import {normalizePersonName} from './personNameCase';
import {AUTHOR_REFERENCE_OPTIONS,authorReferenceOptions,withAuthorReference} from './registrationIdentity';
import {STUDENT_TREATMENTS,FACULTY_TREATMENTS,ACADEMIC_DEGREES,isPresentationField} from './personPresentation';
import { formatTimeExtenso, formatDateExtensoTotal, renderTccTitle, normalizeEmail } from './formatters';
import type { IntegrationStudioSettings, StudioValidationRule } from '../types/integrationStudio';
import { CUSTOM_LOCATION_FIELD, OTHER_DEFENSE_LOCATION, getCustomLocationFieldValue, isOtherDefenseLocation, renderCustomLocationName } from './customDefenseLocation';
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
    emailBody: 'Prezados(as),\n\nSolicitamos a reserva de sala ou auditório para a defesa do TCC “{{TITULO}}”, prevista para {{DEFESA_DATA_HORA}}.\n\nLocal: {{DEFESA_LOCAL}}.\nLocal alternativo: {{LOCAL_ALTERNATIVO}}.\n\nAlunos(as): {{ALUNOS_NOMES}}.\nOrientador(a): {{ORIENTADOR_NOME}}.\n\nAtenciosamente,\nSecretaria do Curso de Graduação em Enfermagem e Obstetrícia.',
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
  const reservationRecipient=String(studio?.emailTemplates?.find(item=>item.id==='email-reserva')?.recipient||'').trim();
  const departmentFallback=isEmailAddress(reservationRecipient)?reservationRecipient.toLowerCase():'';
  const configuredCatalogs = Array.isArray(config?.catalogs) ? config.catalogs : [];
  const configuredKinds = new Set(configuredCatalogs.map((entry) => entry.kind));
  const catalogs = [
    ...configuredCatalogs,
    ...DEFAULT_CLASSIFICATION_CATALOGS.filter((entry) => !configuredKinds.has(entry.kind)),
  ];
  return {
    ...DEFAULT_OPERATIONAL_CONFIG,
    ...config,
    reservation: { ...DEFAULT_OPERATIONAL_CONFIG.reservation, ...config?.reservation,departmentEmail:config?.reservation?.departmentEmail||departmentFallback },
    diagnostics: { ...DEFAULT_OPERATIONAL_CONFIG.diagnostics, ...config?.diagnostics },
    catalogs,
    presentations: config?.presentations || {}
  };
}

const FULL_NAME_VALIDATION: StudioValidationRule = {
  minLength: 1,
  maxLength: 160,
  errorMessage: 'Informe o nome que deve aparecer nos documentos (até 160 caracteres).'
};

// Institutional registries vary; retain them as text without digit-count rules.
const STUDENT_ID_VALIDATION: StudioValidationRule = {};
const SIAPE_VALIDATION: StudioValidationRule = {};

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
  ...(/_NOME$/.test(fieldKey)?{helpText:'Informe o nome que deve aparecer nos documentos, incluindo o nome social quando utilizado. Confira a grafia com a pessoa.'}:{}),
  visibleWhen,
  validation
});

const when = (fieldKey: string) => ({ fieldKey, operator: 'EQUALS' as const, value: 'Sim' });

const personPresentationQuestions=(prefix:string,section:string,student=false,visibleWhen?:RegistrationQuestion['visibleWhen']):RegistrationQuestion[]=>[
 {...q(`${prefix}_TRATAMENTO`,student?'Forma de referência':'Tratamento docente',section,'select',visibleWhen),options:[...(student?STUDENT_TREATMENTS:FACULTY_TREATMENTS)],helpText:student?'Escolha como a pessoa deve ser referida nos documentos.':'Escolha o tratamento que deve acompanhar o nome nos documentos.'},
 ...(!student?[{...q(`${prefix}_TITULACAO`,'Titulação',section,'select',visibleWhen),options:[...ACADEMIC_DEGREES]}]:[])
];

export const REGISTRATION_QUESTIONS: RegistrationQuestion[] = [
  {...q('ALUNO_1_NOME', 'Nome completo do Aluno 1', 'Aluno', 'text', undefined, FULL_NAME_VALIDATION),helpText:'Informe o nome que deve aparecer nos documentos, incluindo o nome social quando utilizado. Este nome aparecerá primeiro. Cadastre os autores na ordem em que devem ser apresentados.'},
  q('ALUNO_1_MATRICULA', 'Matrícula, SIAPE ou outro registro do aluno', 'Aluno', 'text', undefined, STUDENT_ID_VALIDATION),
  {...q('ALUNO_1_EMAIL', 'E-mail do aluno', 'Aluno', 'email'),helpText:'Use o e-mail cadastrado na lista de acesso.'},

  { ...q('TEM_ALUNO_2', 'O trabalho tem segundo autor?', 'Segundo autor', 'select'), options: ['Não', 'Sim'] },
  {...q('ALUNO_2_NOME', 'Nome completo do Aluno 2', 'Segundo autor', 'text', when('TEM_ALUNO_2'), FULL_NAME_VALIDATION),helpText:'Informe o nome que deve aparecer nos documentos, incluindo o nome social quando utilizado. Este nome aparecerá depois do Aluno 1.'},
  q('ALUNO_2_MATRICULA', 'Matrícula, SIAPE ou outro registro do segundo autor', 'Segundo autor', 'text', when('TEM_ALUNO_2'), STUDENT_ID_VALIDATION),
  q('ALUNO_2_EMAIL', 'E-mail do segundo autor', 'Segundo autor', 'email', when('TEM_ALUNO_2')),
  {...q('AUTORIA_REFERENCIA','Complete a frase para os documentos','Segundo autor','select'),options:[...AUTHOR_REFERENCE_OPTIONS],helpText:'Escolha como a autoria deste trabalho deve ser mencionada. A frase será usada nos quatro documentos.'},

  ...personPresentationQuestions('ORIENTADOR','Orientador',false),
  q('ORIENTADOR_NOME', 'Nome completo do orientador', 'Orientador', 'text', undefined, FULL_NAME_VALIDATION),
  q('ORIENTADOR_EMAIL', 'E-mail do orientador', 'Orientador', 'email'),
  q('ORIENTADOR_SIAPE', 'Matrícula, SIAPE ou outro registro do orientador', 'Orientador', 'text', undefined, SIAPE_VALIDATION),

  { ...q('TEM_COORIENTADOR', 'Há coorientador?', 'Coorientador', 'select'), options: ['Não', 'Sim'] },
  ...personPresentationQuestions('COORIENTADOR','Coorientador',false,when('TEM_COORIENTADOR')),
  q('COORIENTADOR_NOME', 'Nome completo do coorientador', 'Coorientador', 'text', when('TEM_COORIENTADOR'), FULL_NAME_VALIDATION),
  q('COORIENTADOR_EMAIL', 'E-mail do coorientador', 'Coorientador', 'email', when('TEM_COORIENTADOR')),
  { ...q('COORIENTADOR_SIAPE', 'Matrícula, SIAPE ou outro registro do coorientador, se aplicável', 'Coorientador', 'text', when('TEM_COORIENTADOR'), SIAPE_VALIDATION), required: false },
  { ...q('COORIENTADOR_INSTITUICAO', 'Instituição do coorientador', 'Coorientador', 'text', when('TEM_COORIENTADOR')), required: false },

  ...[2, 3].flatMap(n => [
    ...personPresentationQuestions(`EXAMINADOR_${n}`,'Banca'),
    q(`EXAMINADOR_${n}_NOME`, `Nome completo do avaliador ${n - 1}`, 'Banca', 'text', undefined, FULL_NAME_VALIDATION),
    q(`EXAMINADOR_${n}_EMAIL`, `E-mail do avaliador ${n - 1}`, 'Banca', 'email'),
    q(`EXAMINADOR_${n}_INSTITUICAO`, `Instituição do avaliador ${n - 1}`, 'Banca'),
    { ...q(`EXAMINADOR_${n}_SIAPE`, `Matrícula, SIAPE ou outro registro do avaliador ${n - 1}, se aplicável`, 'Banca', 'text', undefined, SIAPE_VALIDATION), required: false }
  ]),

  q('TITULO', 'Título completo do TCC', 'Trabalho'),
  { ...q('AREA_TEMATICA', 'Área temática', 'Trabalho', 'select'), required: false, helpText: 'Escolha a área que melhor representa o trabalho. Ex.: saúde da mulher, saúde mental, segurança do paciente.' },
  { ...q('TEMA_PRINCIPAL', 'Tema principal', 'Trabalho', 'select'), required: false, helpText: 'Escolha o foco principal. Ex.: assistência de enfermagem, educação em saúde, gestão do cuidado.' },
  { ...q('TIPO_DE_ESTUDO', 'Tipo de estudo', 'Trabalho', 'select'), required: false, helpText: 'Ex.: estudo qualitativo, revisão integrativa, estudo transversal ou relato de experiência.' },
  { ...q('FINALIDADE_DO_TRABALHO', 'Finalidade do trabalho', 'Trabalho', 'select'), required: false, helpText: 'Escolha o objetivo geral mais próximo do estudo. Ex.: analisar uma situação, avaliar uma intervenção ou sistematizar evidências.' },

  q('DEFESA_DATA_HORA', 'Data e hora pretendidas para a defesa', 'Reserva do local', 'datetime-local'),
  q('DEFESA_LOCAL', 'Local que pretende reservar', 'Reserva do local', 'select'),
  { ...q('DEFESA_LOCAL_PERSONALIZADO', 'Nome completo do local', 'Reserva do local', 'text'), visibleWhen:{fieldKey:'DEFESA_LOCAL',operator:'EQUALS',value:CUSTOM_DEFENSE_LOCATION}, helpText:'Escreva o nome correto do local: ele será usado na ata e nos documentos. O orientador receberá o pedido para aceitar ou recusar o agendamento.' }
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

export function registrationQuestions(studio?: Partial<IntegrationStudioSettings>,answers?:RegistrationAnswers): RegistrationQuestion[] {
  const published = studio?.formTemplates?.find(f => f.id === 'form-reserva-aluno');
  const configured = (Array.isArray(published?.questions) ? published.questions : []) as RegistrationQuestion[];
  const result: RegistrationQuestion[] = [];
  const seen = new Set<string>();

  for (const custom of configured) {
    const fieldKey = aliases[canonicalKey(custom.fieldKey)] || canonicalKey(custom.fieldKey);
    if (['ALUNO_1_TRATAMENTO','ALUNO_2_TRATAMENTO','AUTORIA_ORDEM','LOCAL_ALTERNATIVO'].includes(fieldKey))continue;
    if (!fieldKey || seen.has(fieldKey) || ['CAMPO_06', 'BANCA_EMAILS'].includes(fieldKey)) continue;
    seen.add(fieldKey);
    const core = REGISTRATION_QUESTIONS.find(f => f.fieldKey === fieldKey);
    result.push(core
      ? { ...core, ...custom, fieldKey, label:/_MATRICULA$|_SIAPE$/.test(fieldKey)?core.label:custom.label||core.label, fieldType: core.fieldType, options:isPresentationField(fieldKey)?core.options:custom.options, required: core.required || custom.required, visibleWhen: core.visibleWhen, validation: core.validation || custom.validation, helpText: fieldKey==='ALUNO_1_EMAIL'?core.helpText:/_NOME$/.test(fieldKey)?(core.helpText&&custom.helpText?.includes(core.helpText)?custom.helpText:[core.helpText,custom.helpText].filter(Boolean).filter((text,index,list)=>list.indexOf(text)===index).join(' ')):custom.helpText || core.helpText }
      : { ...custom, fieldKey, section: custom.section || 'Trabalho' });
  }

  for (const core of REGISTRATION_QUESTIONS) {
    if (seen.has(core.fieldKey)) continue;
    if (core.fieldKey === CUSTOM_LOCATION_FIELD && configured.some(field => /nome completo do local/i.test(String(field.label || '')))) continue;
    result.push({ ...core });
  }

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

  for(const name of ordered.filter(field=>/_NOME$/.test(field.fieldKey))){const prefix=name.fieldKey.slice(0,-5);for(const suffix of ['TRATAMENTO','TITULACAO']){const index=ordered.findIndex(field=>field.fieldKey===`${prefix}_${suffix}`);if(index<0)continue;const [field]=ordered.splice(index,1);field.section=name.section;ordered.splice(ordered.indexOf(name),0,field);}}
  return ordered.map(sourceField => {
    const field={...sourceField,section:sourceField.section==='Orientação'?'Orientador':sourceField.section==='Coorientação'?'Coorientador':sourceField.section};
    if(/_NOME$/.test(field.fieldKey)){
      return {...field,helpText: /^ALUNO_[12]_NOME$/.test(field.fieldKey) ? 'Informe o nome completo ou nome social. A ordem dos autores será a mesma nos documentos.' : 'Informe o nome completo ou nome social para os documentos.'};
    }
    if(field.fieldKey==='AUTORIA_REFERENCIA')return {...field,fieldType:'select',options:answers?authorReferenceOptions(answers.TEM_ALUNO_2==='Sim'):[...AUTHOR_REFERENCE_OPTIONS]};
    if (field.fieldKey==='DEFESA_LOCAL') return { ...field, fieldType:'select', options:[...config.reservation.locations.filter(Boolean),CUSTOM_DEFENSE_LOCATION] };
    if(field.fieldKey==='DEFESA_LOCAL_PERSONALIZADO')return {...field,validation:{maxLength:250},helpText:REGISTRATION_QUESTIONS.find(q=>q.fieldKey===field.fieldKey)?.helpText};
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
    nome: normalizePersonName(name),
    email: normalizeEmail(cleanText(answers[`${prefix}_EMAIL`])),
    matricula: normalizeStudentId(answers[`${prefix}_MATRICULA`]),
    siape: normalizeStudentId(answers[`${prefix}_SIAPE`]),
    instituicao: renderInstitutionName(cleanText(answers[`${prefix}_INSTITUICAO`])),
    tratamento: cleanText(answers[`${prefix}_TRATAMENTO`]),
    titulacao: cleanText(answers[`${prefix}_TITULACAO`])
  };
}

export function registrationPayload(a: RegistrationAnswers, timezone: string) {
  const {AUTORIA_ORDEM:_legacyOrder,...currentAnswers}=a;
  a=withAuthorReference(currentAnswers);
  const s = (k: string) => cleanText(a[k]);
  return {
    personPresentationVersion:s('AUTORIA_REFERENCIA')?3:2,
    authorOrder:'ALUNO_1_FIRST' as const,
    aluno1: canonicalPerson('ALUNO_1', a),
    aluno2: s('TEM_ALUNO_2') === 'Sim' ? canonicalPerson('ALUNO_2', a) : null,
    orientador: canonicalPerson('ORIENTADOR', a),
    coorientador: s('TEM_COORIENTADOR') === 'Sim' ? canonicalPerson('COORIENTADOR', a) : null,
    titulo: renderTccTitle(s('TITULO')),
    banca: [2, 3].map(n => ({ ...canonicalPerson(`EXAMINADOR_${n}`, a), funcao: `EXAMINER_${n}` })),
    defesa: {
      startAt: localDateTimeToIso(s('DEFESA_DATA_HORA'), timezone),
      local: isOtherDefenseLocation(s('DEFESA_LOCAL'))?renderCustomLocationName(getCustomLocationFieldValue(a)):s('DEFESA_LOCAL')
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
