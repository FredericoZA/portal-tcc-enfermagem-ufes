import { workflowPolicy } from './workflowOperations';
import { operationalConfig, REGISTRATION_QUESTIONS, canonicalKey } from './operationalConfig';
import type {
  CourseOperationsPolicy,
  IntegrationStudioSettings,
  StudioCondition,
  StudioValidationRule
} from '../types/integrationStudio';

export interface CourseStudioValidationIssue {
  code: string;
  path: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
  area: 'APPEARANCE' | 'FORM' | 'DOCUMENT' | 'EMAIL' | 'WORKFLOW' | 'OPERATIONS';
}

export interface CourseStudioValidationReport {
  ready: boolean;
  score: number;
  errors: number;
  warnings: number;
  issues: CourseStudioValidationIssue[];
  summary: Record<CourseStudioValidationIssue['area'], { errors: number; warnings: number }>;
}

export const DEFAULT_COURSE_OPERATIONS_POLICY: CourseOperationsPolicy = {
  defaultLocale: 'pt-BR',
  supportedLocales: ['pt-BR'],
  timezone: 'America/Sao_Paulo',
  accessibility: {
    minimumContrast: 'AA',
    minimumTargetSize: 44,
    reducedMotionByDefault: false,
    requireVisibleFocus: true
  },
  notifications: {
    emailEnabled: true,
    inPortalEnabled: true,
    dailyDigestEnabled: false,
    failureAlertRecipients: []
  },
  retention: {
    processYears: 10,
    auditYears: 10,
    emailDeliveryDays: 365,
    allowLegalHold: true
  }
};

const record = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const rows = (value: unknown): Array<Record<string, any>> => Array.isArray(value) ? value.map(record) : [];
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const key = (value: unknown) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();

const CORE_WORKFLOW_EVENTS = new Set([
  'TCC_CREATED', 'LOCATION_CONFIRMED', 'INVITATION_SENT', 'EVALUATION_SUBMITTED',
  'REPOSITORY_SUBMITTED', 'PUBLICATION_CLEARED', 'SIGNATURE_REQUESTED', 'SIGNATURE_COMPLETED', 'PROCESS_COMPLETED'
]);

/** Preserves published custom-form events while still rejecting arbitrary or
 * malformed trigger labels loaded from an older browser snapshot. */
export function normalizePublishedWorkflowTrigger(value: unknown, fallback = 'TCC_CREATED'): string {
  const normalized = key(value);
  if (CORE_WORKFLOW_EVENTS.has(normalized) || /^FORM_[A-Z0-9_]+_SUBMITTED$/.test(normalized)) return normalized;
  return key(fallback) || 'TCC_CREATED';
}

const SAFE_DOCUMENT_TRIGGER_BY_TYPE = {
  CONVITE: 'LOCATION_CONFIRMED',
  ATA: 'EVALUATION_SUBMITTED',
  TERMO: 'REPOSITORY_SUBMITTED',
  DECLARACAO: 'PUBLICATION_CLEARED'
} as const;

const BUILT_IN_WORKFLOW_VARIABLES = new Set([
  'PRAZO_ETAPA', 'DATA_LIMITE',
  'DEPARTAMENTO_EMAIL', 'LOCAL_ALTERNATIVO', 'ORIENTADOR_SIAPE', 'ORIENTADOR_INSTITUICAO',
  'PROCESS_ID', 'TCC_ID', 'TCC_CODIGO', 'PROTOCOLO', 'TITULO',
  'ALUNO_1_NOME', 'ALUNO_1_EMAIL', 'ALUNO_1_MATRICULA', 'ALUNO_NOME', 'ALUNO_EMAIL',
  'ALUNO_2_NOME', 'ALUNO_2_EMAIL', 'ALUNO_2_MATRICULA',
  'ORIENTADOR_NOME', 'ORIENTADOR_EMAIL', 'COORIENTADOR_NOME', 'COORIENTADOR_EMAIL',
  'COORIENTADOR_SIAPE', 'COORIENTADOR_INSTITUICAO',
  'EXAMINADOR_2_NOME', 'EXAMINADOR_2_EMAIL', 'EXAMINADOR_2_SIAPE', 'EXAMINADOR_2_INSTITUICAO',
  'EXAMINADOR_3_NOME', 'EXAMINADOR_3_EMAIL', 'EXAMINADOR_3_SIAPE', 'EXAMINADOR_3_INSTITUICAO',
  'BANCA_NOMES', 'BANCA_EMAILS', 'PARTICIPANTES_EMAILS',
  'DEFESA_DATA_HORA', 'DEFESA_LOCAL', 'RESULTADO', 'PARECER',
  'PUBLICAR_TRABALHO', 'PUBLICAR_TRABALHO_COMPLETO', 'INCLUIR_RESUMO_EXPANDIDO',
  'PUBLICAR_RESUMO_EXPANDIDO', 'PALAVRAS_CHAVE', 'RESUMO_SINTETICO',
  'TRABALHO_FINAL_PDF', 'RESUMO_EXPANDIDO_PDF', 'EVENTO', 'ATOR_EMAIL', 'LINK_PORTAL',
  'CAMPO_01', 'CAMPO_02', 'CAMPO_03', 'CAMPO_04', 'CAMPO_06', 'CAMPO_07',
  'CAMPO_07_LOCAL', 'CAMPO_09', 'CAMPO_11', 'CAMPO_12', 'CAMPO_13'
]);

// Somente endereços derivados do cadastro canônico do processo podem rotear
// mensagens. Respostas livres de formulários continuam disponíveis no corpo,
// mas nunca podem transformar o portal em encaminhador de anexos sigilosos.
export const SAFE_EMAIL_RECIPIENT_VARIABLES = new Set([
  'DEPARTAMENTO_EMAIL',
  'ALUNO_EMAIL', 'ALUNO_1_EMAIL', 'ALUNO_2_EMAIL',
  'ORIENTADOR_EMAIL', 'COORIENTADOR_EMAIL', 'EXAMINADOR_2_EMAIL', 'EXAMINADOR_3_EMAIL', 'BANCA_EMAILS',
  'PARTICIPANTES_EMAILS', 'ATOR_EMAIL'
]);

function templateVariableKeys(source: unknown): string[] {
  const textSource = String(source || '');
  const matches = [
    ...textSource.matchAll(/\{\{\s*([^{}\r\n]{1,100})\s*\}\}/g),
    ...textSource.matchAll(/<<\s*([^<>\r\n]{1,100})\s*>>/g),
    ...textSource.matchAll(/\[\[\s*([^\[\]\r\n]{1,100})\s*\]\]/g),
    ...textSource.matchAll(/«\s*([^«»\r\n]{1,100})\s*»/g),
    ...textSource.matchAll(/-((?:CAMPO_)?[A-Z][A-Z0-9_]{1,80})-/g)
  ];
  return Array.from(new Set(matches.map((match) => key(match[1])).filter(Boolean)));
}

function expectedDocumentTrigger(documentType: string): string | null {
  const canonicalType = key(documentType);
  const type = (Object.keys(SAFE_DOCUMENT_TRIGGER_BY_TYPE) as Array<keyof typeof SAFE_DOCUMENT_TRIGGER_BY_TYPE>)
    .find((candidate) => canonicalType.includes(candidate));
  return type ? SAFE_DOCUMENT_TRIGGER_BY_TYPE[type] : null;
}

function luminance(hex: string): number | null {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
  const rgb = [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16) / 255)
    .map((value) => value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

export function colorContrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  if (a === null || b === null) return 0;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function evaluateStudioCondition(condition: StudioCondition | undefined, values: Record<string, unknown>): boolean {
  if (!condition?.fieldKey) return true;
  const actual = values[key(condition.fieldKey)];
  const expected = condition.value ?? '';
  if (condition.operator === 'NOT_EMPTY') return actual !== null && actual !== undefined && String(actual).trim() !== '';
  if (condition.operator === 'IS_TRUE') return actual === true || String(actual).toLowerCase() === 'true' || String(actual) === '1';
  if (condition.operator === 'CONTAINS') return String(actual ?? '').toLowerCase().includes(expected.toLowerCase());
  if (condition.operator === 'NOT_EQUALS') return String(actual ?? '') !== expected;
  return String(actual ?? '') === expected;
}

export function validateStudioAnswer(value: unknown, rule: StudioValidationRule | undefined): string | null {
  if (!rule) return null;
  const source = String(value ?? '');
  if (rule.minLength !== undefined && source.length < rule.minLength) return rule.errorMessage || `Informe ao menos ${rule.minLength} caracteres.`;
  if (rule.maxLength !== undefined && source.length > rule.maxLength) return rule.errorMessage || `Use no máximo ${rule.maxLength} caracteres.`;
  const numeric = Number(value);
  if (rule.min !== undefined && Number.isFinite(numeric) && numeric < rule.min) return rule.errorMessage || `O valor mínimo é ${rule.min}.`;
  if (rule.max !== undefined && Number.isFinite(numeric) && numeric > rule.max) return rule.errorMessage || `O valor máximo é ${rule.max}.`;
  if (rule.pattern) {
    try { if (!new RegExp(rule.pattern).test(source)) return rule.errorMessage || 'O valor não segue o formato esperado.'; }
    catch { return 'A expressão de validação configurada é inválida.'; }
  }
  return null;
}

export function validateCourseStudio(studio: Partial<IntegrationStudioSettings>): CourseStudioValidationReport {
  const issues: CourseStudioValidationIssue[] = [];
  const add = (issue: CourseStudioValidationIssue) => issues.push(issue);
  const variables = new Set(rows(studio.matrixColumns).flatMap((item) => [key(item.id), key(item.name), ...(Array.isArray(item.aliases) ? item.aliases.map(key) : [])]).filter(Boolean));
  const docs = rows(studio.docTemplates);
  const emails = rows(studio.emailTemplates);
  const forms = rows(studio.formTemplates);
  const stages = rows(studio.workflowStages);
  for(const name of BUILT_IN_WORKFLOW_VARIABLES) variables.add(name);
  for(const q of REGISTRATION_QUESTIONS) variables.add(q.fieldKey);
  for(const form of forms) for(const question of rows(form.questions)) if(key(question.fieldKey))variables.add(key(question.fieldKey));
  const operations=operationalConfig(studio);
  const policy=workflowPolicy(studio);
  const policyErrors:string[]=[];
  if(!Number.isInteger(policy.draftExpiryDays)||policy.draftExpiryDays<1||policy.draftExpiryDays>180)policyErrors.push('Rascunhos: expiração entre 1 e 180 dias.');
  if(!Array.isArray(policy.weekdays)||!policy.weekdays.length||policy.weekdays.some(day=>!Number.isInteger(day)||day<0||day>6))policyErrors.push('Selecione dias úteis válidos.');
  if(!Array.isArray(policy.holidays)||policy.holidays.some(date=>!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))policyErrors.push('Feriados devem ter datas válidas.');
  if(!Number.isInteger(policy.documentLayout.signatureReservePoints)||!Number.isInteger(policy.documentLayout.maximumPages)||policy.documentLayout.signatureReservePoints<0||policy.documentLayout.signatureReservePoints>300||policy.documentLayout.maximumPages<1||policy.documentLayout.maximumPages>60)policyErrors.push('Revise a reserva de assinatura e o limite de páginas.');
  if(!Number.isInteger(policy.identity.minimumStudentIdLength)||policy.identity.minimumStudentIdLength<1||policy.identity.minimumStudentIdLength>30||!Number.isInteger(policy.identity.siapeLength)||policy.identity.siapeLength<1||policy.identity.siapeLength>20)policyErrors.push('Use comprimentos válidos para matrícula e SIAPE.');
  if(!Array.isArray(policy.deadlines)||policy.deadlines.length>20)policyErrors.push('Cadastre no máximo vinte regras de prazo.');
  const deadlineIds=new Set<string>();
  for(const rule of Array.isArray(policy.deadlines)?policy.deadlines:[]){
    if(!rule.id||deadlineIds.has(rule.id)||!['LOCATION','EVALUATION','ATA','FINAL_DELIVERY','TERM','DECLARATION'].includes(rule.milestone)||!Number.isInteger(rule.businessDays)||rule.businessDays<0||rule.businessDays>365||!Number.isInteger(rule.reminderEveryDays)||rule.reminderEveryDays<1||rule.reminderEveryDays>365||!Number.isInteger(rule.maxReminders)||rule.maxReminders<1||rule.maxReminders>10)policyErrors.push('Prazo ou limite de lembretes inválido.');
    deadlineIds.add(rule.id);
    if(rule.active&&!(studio.emailTemplates||[]).some(email=>email.id===rule.emailTemplateId&&!(Array.isArray(email.attachments)&&email.attachments.length)))policyErrors.push('Lembretes ativos exigem um modelo de e-mail sem anexos.');
  }
  for(const message of policyErrors)add({code:'INVALID_WORKFLOW_POLICY',path:'operationalConfig.workflow',message,severity:'ERROR',area:'WORKFLOW'});
  const originVariables=new Set(variables);
  for(const [artifact,rules] of Object.entries(operations.presentations)) {
    const seen=new Set<string>();
    for(const rule of rules){
      const marker=String(rule.marker||'').trim();
      if(!/^[\p{L}\p{N}_ ().,-]{1,100}$/u.test(marker)||seen.has(key(marker)))add({code:'INVALID_MARKER',path:`operationalConfig.presentations.${artifact}`,message:'Use marcadores únicos, sem os delimitadores, com até 100 caracteres.',severity:'ERROR',area:'DOCUMENT'});
      if(!originVariables.has(key(rule.source)))add({code:'UNKNOWN_SOURCE',path:`operationalConfig.presentations.${artifact}`,message:`A origem ${rule.source} não existe.`,severity:'ERROR',area:'DOCUMENT'});
      if(!['original','date','date_long','time','time_long','datetime','datetime_long'].includes(rule.format)||!['original','upper','lower'].includes(rule.letterCase))add({code:'INVALID_PRESENTATION',path:`operationalConfig.presentations.${artifact}`,message:'Formato de apresentação inválido.',severity:'ERROR',area:'DOCUMENT'});
      seen.add(key(marker));variables.add(key(marker));
    }
  }
  if(studio.operationalConfig){
    const reservationEmails=new Set(emails.filter(email=>String(email.recipient||'').includes('DEPARTAMENTO_EMAIL')).map(email=>email.id));
    const hasReservation=stages.some(stage=>key(stage.triggerEvent)==='TCC_CREATED'&&rows(stage.actions).some(action=>key(action.type)==='EMAIL'&&reservationEmails.has(action.refId)&&!action.condition));
    if(!hasReservation)add({code:'RESERVATION_ACTION_REQUIRED',path:'workflowStages',message:'O cadastro precisa enviar o pedido de reserva ao departamento, sem condição opcional.',severity:'ERROR',area:'WORKFLOW'});
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(operations.reservation.departmentEmail))add({code:'DEPARTMENT_REQUIRED',path:'operationalConfig.reservation',message:'Informe o e-mail do departamento para solicitar a reserva.',severity:'ERROR',area:'OPERATIONS'});
    if(!operations.reservation.locations.length||operations.reservation.locations.some(v=>!v.trim())||new Set(operations.reservation.locations.map(canonicalKey)).size!==operations.reservation.locations.length)add({code:'INVALID_LOCATIONS',path:'operationalConfig.reservation.locations',message:'Cadastre locais preenchidos e sem duplicidade.',severity:'ERROR',area:'OPERATIONS'});
    if(!Number.isInteger(operations.diagnostics.staleDays)||operations.diagnostics.staleDays<1||operations.diagnostics.staleDays>365||operations.diagnostics.minimumCoverage<1||operations.diagnostics.minimumCoverage>100)add({code:'INVALID_THRESHOLDS',path:'operationalConfig.diagnostics',message:'Use prazo de 1 a 365 dias e cobertura de 1 a 100%.',severity:'ERROR',area:'OPERATIONS'});
    const aliases=new Set<string>();
    for(const entry of operations.catalogs){
      const values=[entry.label,...entry.aliases].filter(v=>v.trim());
      if(!entry.label.trim()||(entry.validFrom&&entry.validUntil&&entry.validFrom>entry.validUntil))add({code:'INVALID_CATALOG',path:'operationalConfig.catalogs',message:'Categoria precisa de nome e vigência coerente.',severity:'ERROR',area:'OPERATIONS'});
      for(const value of new Set(values.map(canonicalKey))){const k=entry.kind+':'+value;if(aliases.has(k))add({code:'AMBIGUOUS_CATALOG',path:'operationalConfig.catalogs',message:`Sinônimo repetido na categoria: ${value}.`,severity:'ERROR',area:'OPERATIONS'});aliases.add(k);}
    }
  }
  const references = {
    doc: new Set(docs.map((item) => text(item.id))),
    email: new Set(emails.map((item) => text(item.id))),
    form: new Set(forms.map((item) => text(item.id)))
  };

  const brand = record(studio.brandKit);
  const ratio = colorContrast(text(brand.textColor) || '#172033', text(brand.primaryColor) || '#005a3c');
  if (ratio < 4.5) add({ code: 'LOW_CONTRAST', path: 'brandKit', message: `Contraste principal ${ratio.toFixed(2)}:1; o mínimo para texto normal é 4,5:1.`, severity: 'ERROR', area: 'APPEARANCE' });
  if (!text(brand.institutionName) || !text(brand.courseName)) add({ code: 'MISSING_IDENTITY', path: 'brandKit', message: 'Informe instituição e curso antes de publicar.', severity: 'ERROR', area: 'APPEARANCE' });

  const docIds = new Set<string>();
  docs.forEach((doc, index) => {
    const id = text(doc.id);
    if (!id || docIds.has(id)) add({ code: 'DUPLICATE_DOCUMENT', path: `docTemplates.${index}.id`, message: 'Cada modelo precisa de um identificador único.', severity: 'ERROR', area: 'DOCUMENT' });
    docIds.add(id);
    if (!text(doc.driveFileId) && !text(doc.driveFileUrl)) add({ code: 'MODEL_METADATA_PENDING', path: `docTemplates.${index}.driveFileUrl`, message: `“${text(doc.label) || id}” ainda não mostra o vínculo do catálogo documental. A homologação confirmará o modelo ativo cadastrado no painel de Modelos DOCX.`, severity: 'WARNING', area: 'DOCUMENT' });
    if (text(doc.templateContentText)) add({ code: 'EMBEDDED_TEMPLATE', path: `docTemplates.${index}.templateContentText`, message: 'O conteúdo do modelo não pode ficar embutido no portal.', severity: 'ERROR', area: 'DOCUMENT' });
  });

  forms.forEach((form, formIndex) => {
    const seen = new Set<string>();
    const questions = rows(form.questions);
    if (!text(form.title) || !questions.length) add({ code: 'EMPTY_FORM', path: `formTemplates.${formIndex}`, message: 'Todo formulário ativo precisa de título e ao menos um campo.', severity: 'ERROR', area: 'FORM' });
    questions.forEach((question, questionIndex) => {
      const fieldKey = key(question.fieldKey);
      if(form.id==='form-reserva-aluno'&&question.fieldType==='file')add({code:'INITIAL_FILE_UNSUPPORTED',path:`formTemplates.${formIndex}.questions.${questionIndex}`,message:'Anexos são enviados na etapa de entrega final; use um campo de texto no cadastro inicial.',severity:'ERROR',area:'FORM'});
      if(form.id==='form-parecer-banca'&&question.fieldType==='file')add({code:'EVALUATION_FILE_UNSUPPORTED',path:`formTemplates.${formIndex}.questions.${questionIndex}`,message:'Use texto para observações da avaliação. A ata é gerada pelo modelo DOCX.',severity:'ERROR',area:'FORM'});
      if (!text(question.label)) add({ code: 'UNLABELED_FIELD', path: `formTemplates.${formIndex}.questions.${questionIndex}.label`, message: 'O campo precisa de um rótulo visível.', severity: 'ERROR', area: 'FORM' });
      if (!fieldKey) add({ code: 'UNBOUND_FIELD', path: `formTemplates.${formIndex}.questions.${questionIndex}.fieldKey`, message: 'Vincule o campo a uma variável para reutilizar a informação.', severity: 'WARNING', area: 'FORM' });
      else if (!variables.has(fieldKey)) add({ code: 'UNKNOWN_VARIABLE', path: `formTemplates.${formIndex}.questions.${questionIndex}.fieldKey`, message: `A variável ${fieldKey} não existe na matriz.`, severity: 'ERROR', area: 'FORM' });
      if (fieldKey && seen.has(fieldKey) && !question.isReuseOfFieldKey) add({ code: 'DUPLICATE_FORM_FIELD', path: `formTemplates.${formIndex}.questions.${questionIndex}.fieldKey`, message: `A variável ${fieldKey} é solicitada duas vezes no mesmo formulário.`, severity: 'WARNING', area: 'FORM' });
      seen.add(fieldKey);
      const condition = record(question.visibleWhen);
      if (text(condition.fieldKey)) {
        const source = key(condition.fieldKey);
        if (!seen.has(source) || source === fieldKey) add({ code: 'INVALID_FORM_RULE', path: `formTemplates.${formIndex}.questions.${questionIndex}.visibleWhen`, message: 'A condição deve usar um campo anterior do mesmo formulário.', severity: 'ERROR', area: 'FORM' });
      }
      const pattern = text(record(question.validation).pattern);
      if (pattern) try { new RegExp(pattern); } catch { add({ code: 'INVALID_PATTERN', path: `formTemplates.${formIndex}.questions.${questionIndex}.validation.pattern`, message: 'A expressão de validação é inválida.', severity: 'ERROR', area: 'FORM' }); }
    });
  });

  emails.forEach((email, index) => {
    if (!text(email.name) || !text(email.subject) || !text(email.body)) add({ code: 'INCOMPLETE_EMAIL', path: `emailTemplates.${index}`, message: 'Cada e-mail precisa de nome, assunto e corpo em texto.', severity: 'ERROR', area: 'EMAIL' });
    if (!text(email.recipient)) add({ code: 'MISSING_RECIPIENT', path: `emailTemplates.${index}.recipient`, message: `Defina o destinatário de “${text(email.name) || text(email.id)}”.`, severity: 'ERROR', area: 'EMAIL' });
    const unsafeRecipientVariables = templateVariableKeys(email.recipient).filter((variable) => !SAFE_EMAIL_RECIPIENT_VARIABLES.has(variable));
    if (unsafeRecipientVariables.length) add({
      code: 'UNSAFE_EMAIL_RECIPIENT_VARIABLE',
      path: `emailTemplates.${index}.recipient`,
      message: `O destinatário só pode usar e-mails canônicos do processo. Remova: ${unsafeRecipientVariables.join(', ')}.`,
      severity: 'ERROR',
      area: 'EMAIL'
    });
    const unknownVariables = templateVariableKeys([email.recipient, email.subject, email.body, email.htmlBody].filter(Boolean).join('\n'))
      .filter((variable) => !variables.has(variable) && !BUILT_IN_WORKFLOW_VARIABLES.has(variable));
    if (unknownVariables.length) add({
      code: 'UNKNOWN_EMAIL_VARIABLE',
      path: `emailTemplates.${index}`,
      message: `O e-mail usa variável(is) inexistente(s): ${unknownVariables.join(', ')}.`,
      severity: 'ERROR',
      area: 'EMAIL'
    });
  });

  const stageIds = new Set<string>();
  stages.forEach((stage, stageIndex) => {
    const stageId = text(stage.id);
    if (!stageId || stageIds.has(stageId)) add({ code: 'DUPLICATE_STAGE', path: `workflowStages.${stageIndex}.id`, message: 'Cada etapa precisa de um identificador único.', severity: 'ERROR', area: 'WORKFLOW' });
    stageIds.add(stageId);
    if (!text(stage.triggerEvent)) add({ code: 'MISSING_TRIGGER', path: `workflowStages.${stageIndex}.triggerEvent`, message: 'Defina o evento que inicia a etapa.', severity: 'ERROR', area: 'WORKFLOW' });
    rows(stage.actions).forEach((action, actionIndex) => {
      const type = key(action.type).toLowerCase().replace('document', 'doc');
      const refId = text(action.refId || action.referenceId);
      if (type !== 'action' && type !== 'system_action' && (!refId || !(references as any)[type]?.has(refId))) add({ code: 'BROKEN_WORKFLOW_REFERENCE', path: `workflowStages.${stageIndex}.actions.${actionIndex}`, message: `A ação “${text(action.title)}” aponta para um artefato inexistente.`, severity: 'ERROR', area: 'WORKFLOW' });
      if (type === 'action' || type === 'system_action') add({ code: 'SYSTEM_ACTION_WITHOUT_EXECUTOR', path: `workflowStages.${stageIndex}.actions.${actionIndex}`, message: `A ação interna “${text(action.title)}” não possui executor seguro. Substitua por formulário, documento ou e-mail.`, severity: 'ERROR', area: 'WORKFLOW' });
      const condition = record(action.condition);
      if (text(condition.fieldKey) && !variables.has(key(condition.fieldKey))) add({ code: 'INVALID_CONDITION', path: `workflowStages.${stageIndex}.actions.${actionIndex}.condition`, message: 'A condição da ação usa uma variável inexistente.', severity: 'ERROR', area: 'WORKFLOW' });
      const referencedDocument = docs.find(doc => text(doc.id) === refId);
      const documentType = key(referencedDocument?.type || referencedDocument?.id);
      const expectedTrigger = expectedDocumentTrigger(documentType);
      if (type === 'doc' && expectedTrigger && key(stage.triggerEvent) !== expectedTrigger) add({
        code: 'INVALID_DOCUMENT_EVENT',
        path: `workflowStages.${stageIndex}.actions.${actionIndex}`,
        message: `O documento ${documentType} só pode ser executado pelo evento ${expectedTrigger}.`,
        severity: 'ERROR',
        area: 'WORKFLOW'
      });
      if (type === 'doc' && documentType.includes('TERMO') && (key(condition.fieldKey) !== 'PUBLICAR_TRABALHO' || key(condition.operator) !== 'IS_TRUE')) add({ code: 'TERM_WITHOUT_PUBLICATION_CONDITION', path: `workflowStages.${stageIndex}.actions.${actionIndex}.condition`, message: 'O Termo precisa da condição “PUBLICAR_TRABALHO é verdadeiro”.', severity: 'ERROR', area: 'WORKFLOW' });
      if (type === 'doc' && ['CONVITE', 'ATA', 'DECLARACAO'].some((requiredType) => documentType.includes(requiredType)) && Object.keys(condition).some((conditionKey) => condition[conditionKey] !== undefined && condition[conditionKey] !== null && String(condition[conditionKey]).trim() !== '')) add({
        code: 'REQUIRED_DOCUMENT_CANNOT_BE_CONDITIONAL',
        path: `workflowStages.${stageIndex}.actions.${actionIndex}.condition`,
        message: `${documentType} é obrigatório e não pode depender de uma condição opcional.`,
        severity: 'ERROR',
        area: 'WORKFLOW'
      });
      const referencedEmail = emails.find(email => text(email.id) === refId);
      const attachments = Array.isArray(referencedEmail?.attachments) ? referencedEmail.attachments.map(key) : [];
      if (type === 'email' && attachments.some(item => item.includes('CONVITE')) && key(stage.triggerEvent) === 'TCC_CREATED') add({ code: 'INVITATION_ATTACHMENT_TOO_EARLY', path: `workflowStages.${stageIndex}.actions.${actionIndex}`, message: 'A carta-convite só pode ser anexada em LOCATION_CONFIRMED ou depois, quando o PDF já foi gerado e arquivado.', severity: 'ERROR', area: 'WORKFLOW' });
      if (type === 'email' && attachments.some(item => ['ATA', 'TERMO', 'DECLARACAO'].some(document => item.includes(document))) && key(stage.triggerEvent) !== 'PROCESS_COMPLETED') add({ code: 'SIGNED_ATTACHMENT_TOO_EARLY', path: `workflowStages.${stageIndex}.actions.${actionIndex}`, message: 'E-mails com documentos assináveis devem ser enviados em PROCESS_COMPLETED, após o arquivamento do retorno da Asten.', severity: 'ERROR', area: 'WORKFLOW' });
    });
  });
  if (!stages.length) add({ code: 'EMPTY_WORKFLOW', path: 'workflowStages', message: 'O portal precisa de ao menos uma etapa de fluxo.', severity: 'ERROR', area: 'WORKFLOW' });

  const requiredDocumentTypes = Object.keys(SAFE_DOCUMENT_TRIGGER_BY_TYPE) as Array<keyof typeof SAFE_DOCUMENT_TRIGGER_BY_TYPE>;
  for (const requiredType of requiredDocumentTypes) {
    const document = docs.find((item) => key(item.type || item.id || item.label).includes(requiredType));
    if (!document) {
      add({ code: 'MISSING_REQUIRED_DOCUMENT', path: 'docTemplates', message: `Cadastre o modelo externo obrigatório ${requiredType}.`, severity: 'ERROR', area: 'DOCUMENT' });
      continue;
    }
    const referenced = stages.some((stage) => rows(stage.actions).some((action) => {
      const actionType = key(action.type).toLowerCase().replace('document', 'doc');
      return actionType === 'doc' && text(action.refId || action.referenceId) === text(document.id);
    }));
    if (!referenced) add({ code: 'MISSING_REQUIRED_DOCUMENT_ACTION', path: 'workflowStages', message: `Inclua ${requiredType} no fluxo publicado, no evento seguro correspondente.`, severity: 'ERROR', area: 'WORKFLOW' });
  }

  const invitationStage = stages.find((stage) => key(stage.triggerEvent) === 'LOCATION_CONFIRMED');
  const invitationActions = rows(invitationStage?.actions);
  const invitationDocumentIndex = invitationActions.findIndex((action) => {
    const referenced = docs.find((doc) => text(doc.id) === text(action.refId || action.referenceId));
    return key(action.type).toLowerCase().replace('document', 'doc') === 'doc' && key(referenced?.type || referenced?.id).includes('CONVITE');
  });
  const invitationEmailIndex = invitationActions.findIndex((action) => {
    if (key(action.type).toLowerCase() !== 'email') return false;
    const email = emails.find((item) => text(item.id) === text(action.refId || action.referenceId));
    return Array.isArray(email?.attachments) && email.attachments.some((attachment: unknown) => key(attachment).includes('CONVITE'));
  });
  if (invitationDocumentIndex < 0 || invitationEmailIndex < 0 || invitationEmailIndex <= invitationDocumentIndex) {
    add({ code: 'INVALID_INVITATION_PIPELINE', path: 'workflowStages', message: 'Em LOCATION_CONFIRMED, gere primeiro o convite e depois envie um e-mail que o anexe.', severity: 'ERROR', area: 'WORKFLOW' });
  }

  const guide = record(studio.replicationGuide);
  if (guide.enabled) {
    if (!/^https:\/\/github\.com\//i.test(text(guide.githubRepositoryUrl))) add({ code: 'INVALID_GITHUB_GUIDE', path: 'replicationGuide.githubRepositoryUrl', message: 'Informe um endereço HTTPS válido do GitHub para publicar o guia de replicação.', severity: 'ERROR', area: 'OPERATIONS' });
    const validGuideSteps = Array.isArray(guide.steps)
      ? guide.steps.filter((step: unknown) => text(step)).length
      : 0;
    if (validGuideSteps < 3) add({ code: 'INCOMPLETE_REPLICATION_GUIDE', path: 'replicationGuide.steps', message: 'Inclua pelo menos três etapas no passo a passo de replicação.', severity: 'ERROR', area: 'OPERATIONS' });
  }

  const operationsPolicy = { ...DEFAULT_COURSE_OPERATIONS_POLICY, ...(studio.operationsPolicy || {}) } as CourseOperationsPolicy;
  if (!operationsPolicy.supportedLocales.includes(operationsPolicy.defaultLocale)) add({ code: 'INVALID_LOCALE', path: 'operationsPolicy.supportedLocales', message: 'O idioma padrão precisa estar entre os idiomas habilitados.', severity: 'ERROR', area: 'OPERATIONS' });
  if (!/^([A-Za-z_]+\/[A-Za-z_]+|UTC)$/.test(operationsPolicy.timezone)) add({ code: 'INVALID_TIMEZONE', path: 'operationsPolicy.timezone', message: 'Use um fuso IANA, por exemplo America/Sao_Paulo.', severity: 'ERROR', area: 'OPERATIONS' });

  const areas: CourseStudioValidationIssue['area'][] = ['APPEARANCE', 'FORM', 'DOCUMENT', 'EMAIL', 'WORKFLOW', 'OPERATIONS'];
  const summary = Object.fromEntries(areas.map((area) => [area, {
    errors: issues.filter((issue) => issue.area === area && issue.severity === 'ERROR').length,
    warnings: issues.filter((issue) => issue.area === area && issue.severity === 'WARNING').length
  }])) as CourseStudioValidationReport['summary'];
  const errors = issues.filter((issue) => issue.severity === 'ERROR').length;
  const warnings = issues.length - errors;
  return { ready: errors === 0, score: Math.max(0, 100 - errors * 10 - warnings * 2), errors, warnings, issues, summary };
}
