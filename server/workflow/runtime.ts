import { presentVariables } from '../../src/utils/operationalConfig';
import { createHash } from 'crypto';
import nodeProcess from 'node:process';
import type { IntegrationStudioSettings } from '../../src/types/integrationStudio';
import type { StudioCondition } from '../../src/types/integrationStudio';
import type {
  ExecutableWorkflowAction,
  ExecutableWorkflowStage,
  WorkflowActionExecution,
  WorkflowPlan,
  WorkflowPlanAction,
  WorkflowRun,
  WorkflowRuntimeContext,
  WorkflowValidationIssue
} from '../../src/types/automation';
import { evaluateStudioCondition, SAFE_EMAIL_RECIPIENT_VARIABLES } from '../../src/utils/courseStudioValidator';

type GenericRecord = Record<string, unknown>;

export interface WorkflowRuntimePorts {
  createDocument(input: {
    template: GenericRecord;
    variables: Record<string, string>;
    processId: string;
    idempotencyKey: string;
  }): Promise<{ externalId?: string }>;
  createFormTask(input: {
    form: GenericRecord;
    variables: Record<string, string>;
    processId: string;
    targetRole?: string;
    idempotencyKey: string;
  }): Promise<{ externalId?: string }>;
  sendEmail(input: {
    template: GenericRecord;
    to: string[];
    subject: string;
    text: string;
    html?: string;
    variables: Record<string, string>;
    processId: string;
    protocol: string;
    eventVariables: Record<string, string>;
    idempotencyKey: string;
  }): Promise<{ externalId?: string }>;
  executeSystemAction?(input: {
    action: WorkflowPlanAction;
    variables: Record<string, string>;
    processId: string;
    idempotencyKey: string;
  }): Promise<{ externalId?: string }>;
}

const isRecord = (value: unknown): value is GenericRecord => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const list = (value: unknown): GenericRecord[] => Array.isArray(value) ? value.filter(isRecord) : [];

// Values that identify the process or route communications must always come
// from the authenticated process snapshot. A configurable form may add new
// variables, but it cannot impersonate another student/advisor or redirect an
// e-mail by submitting a field with the same name as a canonical variable.
const RESERVED_PROCESS_VARIABLES = new Set([
  'PROCESS_ID', 'TCC_ID', 'TCC_CODIGO', 'PROTOCOLO',
  'ALUNO_1_NOME', 'ALUNO_1_EMAIL', 'ALUNO_1_MATRICULA', 'ALUNO_NOME', 'ALUNO_EMAIL',
  'ALUNO_2_NOME', 'ALUNO_2_EMAIL', 'ALUNO_2_MATRICULA',
  'ORIENTADOR_NOME', 'ORIENTADOR_EMAIL', 'ORIENTADOR_SIAPE', 'ORIENTADOR_INSTITUICAO',
  'COORIENTADOR_NOME', 'COORIENTADOR_EMAIL', 'COORIENTADOR_SIAPE', 'COORIENTADOR_INSTITUICAO',
  'EXAMINADOR_2_NOME', 'EXAMINADOR_2_EMAIL', 'EXAMINADOR_2_SIAPE', 'EXAMINADOR_2_INSTITUICAO',
  'EXAMINADOR_3_NOME', 'EXAMINADOR_3_EMAIL', 'EXAMINADOR_3_SIAPE', 'EXAMINADOR_3_INSTITUICAO',
  'BANCA_NOMES', 'BANCA_EMAILS', 'PARTICIPANTES_EMAILS',
  'EVENTO', 'ATOR_EMAIL', 'DEPARTAMENTO_EMAIL', 'LOCAL_ALTERNATIVO'
]);

export function normalizeWorkflowEventCode(value: unknown): string {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function normalizeActionKind(value: unknown): ExecutableWorkflowAction['kind'] {
  const normalized = normalizeWorkflowEventCode(value);
  if (normalized === 'DOC' || normalized === 'DOCUMENT' || normalized === 'DOCUMENTO') return 'DOCUMENT';
  if (normalized === 'EMAIL' || normalized === 'E_MAIL') return 'EMAIL';
  if (normalized === 'FORM' || normalized === 'FORMULARIO') return 'FORM';
  return 'SYSTEM_ACTION';
}

export function compileWorkflow(studio: IntegrationStudioSettings): {
  stages: ExecutableWorkflowStage[];
  issues: WorkflowValidationIssue[];
} {
  const issues: WorkflowValidationIssue[] = [];
  const stageIds = new Set<string>();
  const actionIds = new Set<string>();
  const references = {
    DOCUMENT: new Set(list(studio.docTemplates).map((item) => text(item.id)).filter(Boolean)),
    EMAIL: new Set(list(studio.emailTemplates).map((item) => text(item.id)).filter(Boolean)),
    FORM: new Set(list(studio.formTemplates).map((item) => text(item.id)).filter(Boolean))
  };

  const stages = list(studio.workflowStages).map((raw, index): ExecutableWorkflowStage => {
    const id = text(raw.id) || `stage-${index + 1}`;
    if (stageIds.has(id)) issues.push({ code: 'DUPLICATE_STAGE', path: `workflowStages.${index}.id`, message: `Etapa duplicada: ${id}.`, severity: 'ERROR' });
    stageIds.add(id);
    const eventCode = normalizeWorkflowEventCode(raw.eventCode || raw.triggerEvent || raw.title);
    if (!eventCode) issues.push({ code: 'MISSING_TRIGGER', path: `workflowStages.${index}.triggerEvent`, message: 'A etapa precisa de um evento disparador.', severity: 'ERROR' });

    const actions = list(raw.actions).map((action, actionIndex): ExecutableWorkflowAction => {
      const actionId = text(action.id) || `${id}-action-${actionIndex + 1}`;
      if (actionIds.has(actionId)) issues.push({ code: 'DUPLICATE_ACTION', path: `workflowStages.${index}.actions.${actionIndex}.id`, message: `Ação duplicada: ${actionId}.`, severity: 'ERROR' });
      actionIds.add(actionId);
      const kind = normalizeActionKind(action.type);
      const referenceId = text(action.refId || action.referenceId) || undefined;
      const rawCondition = isRecord(action.condition) ? action.condition : undefined;
      const condition = rawCondition && text(rawCondition.fieldKey) ? {
        fieldKey: normalizeWorkflowEventCode(rawCondition.fieldKey),
        operator: text(rawCondition.operator || 'EQUALS') as StudioCondition['operator'],
        value: text(rawCondition.value) || undefined
      } : undefined;
      if (condition && !['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_EMPTY', 'IS_TRUE'].includes(String(condition.operator))) {
        issues.push({ code: 'INVALID_CONDITION', path: `workflowStages.${index}.actions.${actionIndex}.condition`, message: `Operador de condição inválido em ${actionId}.`, severity: 'ERROR' });
      }
      if (kind !== 'SYSTEM_ACTION' && !referenceId) issues.push({ code: 'MISSING_REFERENCE', path: `workflowStages.${index}.actions.${actionIndex}.refId`, message: `${kind} precisa apontar para um artefato do Estúdio.`, severity: 'ERROR' });
      if (referenceId && kind !== 'SYSTEM_ACTION' && !references[kind].has(referenceId)) issues.push({ code: 'UNKNOWN_REFERENCE', path: `workflowStages.${index}.actions.${actionIndex}.refId`, message: `Referência inexistente: ${referenceId}.`, severity: 'ERROR' });
      return {
        id: actionId,
        kind,
        referenceId,
        title: text(action.title) || `${kind} ${actionIndex + 1}`,
        detail: text(action.recipientOrDetail || action.detail) || undefined,
        condition
      };
    });

    return {
      id,
      order: Number(raw.stageNumber || raw.order || index + 1),
      title: text(raw.title) || `Etapa ${index + 1}`,
      eventCode,
      description: text(raw.description) || undefined,
      actions
    };
  }).sort((a, b) => a.order - b.order);

  return { stages, issues };
}

function scalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(scalar).filter(Boolean).join(', ');
  return '';
}

export function buildProcessVariables(context: WorkflowRuntimeContext): Record<string, string> {
  const portalProcess = context.process;
  const configuredPortalUrl = String(nodeProcess.env.PORTAL_PUBLIC_URL || nodeProcess.env.APP_URL || nodeProcess.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  const portalUrl = configuredPortalUrl
    ? (/^https?:\/\//i.test(configuredPortalUrl) ? configuredPortalUrl : `https://${configuredPortalUrl}`).replace(/\/$/, '')
    : '';
  const process = portalProcess;
  const studentNames = [process.aluno1.nome, process.aluno2?.nome].filter(Boolean).join(' e ');
  const bankNames = process.banca.map((member) => member.nome).filter(Boolean).join(', ');
  const bankEmails = process.banca.map((member) => member.email).filter(Boolean).join(', ');
  const examiner2 = process.banca.find((member) => member.funcao === 'EXAMINER_2') || process.banca[0];
  const examiner3 = process.banca.find((member) => member.funcao === 'EXAMINER_3') || process.banca[1];
  const participantEmails = [process.aluno1.email, process.aluno2?.email, process.orientador.email, process.coorientador?.email, ...process.banca.map((member) => member.email)]
    .filter(Boolean)
    .join(', ');
  const variables: Record<string, string> = {
    PROCESS_ID: process.id,
    TCC_ID: process.id,
    TCC_CODIGO: process.protocolo,
    PROTOCOLO: process.protocolo,
    TITULO: process.titulo,
    ALUNO_1_NOME: process.aluno1.nome,
    ALUNO_1_EMAIL: process.aluno1.email,
    ALUNO_1_MATRICULA: process.aluno1.matricula,
    ALUNO_NOME: process.aluno1.nome,
    ALUNO_EMAIL: process.aluno1.email,
    ALUNO_2_NOME: process.aluno2?.nome || '',
    ALUNO_2_EMAIL: process.aluno2?.email || '',
    ALUNO_2_MATRICULA: process.aluno2?.matricula || '',
    ORIENTADOR_NOME: process.orientador.nome,
    ORIENTADOR_EMAIL: process.orientador.email,
    ORIENTADOR_SIAPE: process.orientador.siape || '',
    ORIENTADOR_INSTITUICAO: process.orientador.instituicao || '',
    DEPARTAMENTO_EMAIL: String(context.extraVariables?.DEPARTAMENTO_EMAIL || ''),
    LOCAL_ALTERNATIVO: process.defesa.alternateLocation || '',
    COORIENTADOR_NOME: process.coorientador?.nome || '',
    COORIENTADOR_EMAIL: process.coorientador?.email || '',
    COORIENTADOR_SIAPE: process.coorientador?.siape || '',
    COORIENTADOR_INSTITUICAO: process.coorientador?.instituicao || '',
    EXAMINADOR_2_NOME: examiner2?.nome || '',
    EXAMINADOR_2_EMAIL: examiner2?.email || '',
    EXAMINADOR_2_SIAPE: examiner2?.siape || '',
    EXAMINADOR_2_INSTITUICAO: examiner2?.instituicao || '',
    EXAMINADOR_3_NOME: examiner3?.nome || '',
    EXAMINADOR_3_EMAIL: examiner3?.email || '',
    EXAMINADOR_3_SIAPE: examiner3?.siape || '',
    EXAMINADOR_3_INSTITUICAO: examiner3?.instituicao || '',
    BANCA_NOMES: bankNames,
    BANCA_EMAILS: bankEmails,
    PARTICIPANTES_EMAILS: participantEmails,
    DEFESA_DATA_HORA: process.defesa.startAt,
    DEFESA_LOCAL: process.defesa.local,
    RESULTADO: process.avaliacao.resultadoLabel || '',
    NOTA_FINAL: process.avaliacao.notaFinal === undefined ? '' : String(process.avaliacao.notaFinal),
    NOTA: process.avaliacao.notaFinal === undefined ? '' : String(process.avaliacao.notaFinal),
    AVALIACAO_NOTA: process.avaliacao.notaFinal === undefined ? '' : String(process.avaliacao.notaFinal),
    PARECER: process.avaliacao.parecer || '',
    PUBLICAR_TRABALHO: process.acervo?.publishFullWork || process.acervo?.publishExpandedAbstract ? 'true' : 'false',
    PUBLICAR_TRABALHO_COMPLETO: process.acervo?.publishFullWork ? 'SIM' : 'NÃO',
    INCLUIR_RESUMO_EXPANDIDO: process.acervo?.resumoExpandidoFileId ? 'SIM' : 'NÃO',
    PUBLICAR_RESUMO_EXPANDIDO: process.acervo?.publishExpandedAbstract ? 'SIM' : 'NÃO',
    PALAVRAS_CHAVE: process.acervo?.palavrasChave?.join('; ') || '',
    RESUMO_SINTETICO: process.acervo?.resumoSintese || '',
    TRABALHO_FINAL_PDF: process.acervo?.trabalhoCompletoFileUrl || '',
    RESUMO_EXPANDIDO_PDF: process.acervo?.resumoExpandidoFileUrl || '',
    LINK_PORTAL: portalUrl,
    EVENTO: context.eventCode,
    ATOR_EMAIL: context.actorEmail
  };
  Object.assign(variables, {
    CAMPO_01: studentNames,
    CAMPO_02: process.titulo,
    CAMPO_03: process.orientador.nome,
    CAMPO_04: process.defesa.startAt,
    CAMPO_06: bankNames,
    CAMPO_07: process.defesa.local,
    CAMPO_07_LOCAL: process.defesa.local,
    CAMPO_09: process.avaliacao.resultadoLabel || '',
    CAMPO_10: process.avaliacao.notaFinal === undefined ? '' : String(process.avaliacao.notaFinal),
    CAMPO_11: process.avaliacao.parecer || '',
    CAMPO_12: process.protocolo,
    CAMPO_13: process.driveFolderUrl || ''
  });
  for (const [key, value] of Object.entries({ ...process.avaliacao.answers, ...context.extraVariables })) {
    const normalized = normalizeWorkflowEventCode(key);
    if (normalized && !(normalized in variables) && !RESERVED_PROCESS_VARIABLES.has(normalized)) variables[normalized] = scalar(value);
  }
  return variables;
}

const workflowMarkers = () => /\{\{\s*([^{}\n]{1,100}?)\s*\}\}|<<\s*([^<>\n]{1,100}?)\s*>>|\[\[\s*([^\[\]\n]{1,100}?)\s*\]\]|«\s*([^«»\n]{1,100}?)\s*»|-((?:CAMPO_)?[A-Z0-9_]+)-/g;

function mergeMarkers(source: string, variables: Record<string, string>, html: boolean): string {
  // One pass: marker-looking text submitted by a participant stays literal.
  return String(source || '').replace(workflowMarkers(), (match, braces, angles, brackets, guillemets, legacy) => {
    const key = String(braces ?? angles ?? brackets ?? guillemets ?? legacy).trim();
    const value = variables[key] ?? variables[normalizeWorkflowEventCode(key)] ?? (legacy ? variables[normalizeWorkflowEventCode(`CAMPO_${key}`)] : undefined);
    return value === undefined ? (legacy ? match : '') : html ? escapeHtml(value) : value;
  });
}

export function mergeWorkflowVariables(source: string, variables: Record<string, string>): string {
  return mergeMarkers(source, variables, false);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character] || character);
}

/** Mantém o HTML publicado pelo Master, mas trata todo valor dinâmico como
 * texto. Assim título, parecer ou resposta de formulário não injeta marcação
 * no e-mail recebido. */
export function mergeWorkflowHtmlVariables(source: string, variables: Record<string, string>): string {
  return mergeMarkers(source, variables, true);
}

function makeIdempotencyKey(parts: unknown[]): string {
  return createHash('sha256').update(parts.map((part) => scalar(part)).join('|')).digest('hex');
}

export function planWorkflowEvent(studio: IntegrationStudioSettings, context: WorkflowRuntimeContext): WorkflowPlan {
  const compiled = compileWorkflow(studio);
  const eventCode = normalizeWorkflowEventCode(context.eventCode);
  const variables = buildProcessVariables({ ...context, eventCode });
  const actions = compiled.stages
    .filter((stage) => stage.eventCode === eventCode)
    .flatMap((stage) => stage.actions.filter((action) => evaluateStudioCondition(action.condition, variables)).map((action): WorkflowPlanAction => ({
      ...action,
      stageId: stage.id,
      idempotencyKey: makeIdempotencyKey([
        context.process.id,
        eventCode,
        context.process.dataRevision,
        studio.revision,
        stage.id,
        action.id,
        action.referenceId,
        // Hash the effective variables, not raw answers. Attempts to override
        // a reserved identity variable therefore cannot create a second side
        // effect with otherwise identical content.
        JSON.stringify(Object.entries(variables).sort(([a], [b]) => a.localeCompare(b)))
      ])
    })));
  return {
    eventCode,
    processId: context.process.id,
    protocol: context.process.protocolo,
    variables,
    actions,
    issues: compiled.issues
  };
}

function artifactById(items: Array<Record<string, unknown>>, id?: string): GenericRecord | undefined {
  return id ? items.find((item) => text(item.id) === id) : undefined;
}

export function parseRecipients(source: string, variables: Record<string, string>): string[] {
  const variableKeys = Array.from(source.matchAll(workflowMarkers()), match => normalizeWorkflowEventCode(match.slice(1, 6).find(value => value !== undefined) || ''));
  const unsafe = variableKeys.filter((variable) => !SAFE_EMAIL_RECIPIENT_VARIABLES.has(variable));
  if (unsafe.length) throw new Error(`Destinatário usa variável não autorizada: ${Array.from(new Set(unsafe)).join(', ')}.`);
  const merged = mergeWorkflowVariables(source, variables);
  return Array.from(new Set(merged.split(/[;,\n]+/).map((item) => item.trim().toLowerCase()).filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))));
}

export async function executeWorkflowEvent(
  studio: IntegrationStudioSettings,
  context: WorkflowRuntimeContext,
  ports: WorkflowRuntimePorts
): Promise<WorkflowRun> {
  const plan = planWorkflowEvent(studio, context);
  const startedAt = context.occurredAt || new Date().toISOString();
  const eventVariables = Object.fromEntries(Object.entries(context.extraVariables || {}).map(([key, value]) => [normalizeWorkflowEventCode(key), scalar(value)]));
  const runId = `workflow_${makeIdempotencyKey([plan.processId, plan.eventCode, context.process.dataRevision, studio.revision, startedAt]).slice(0, 24)}`;
  if (plan.issues.some((issue) => issue.severity === 'ERROR')) {
    return { id: runId, studioRevision: studio.revision, sourceDataRevision: context.process.dataRevision, processId: plan.processId, protocol: plan.protocol, eventCode: plan.eventCode, actorEmail: context.actorEmail, startedAt, completedAt: startedAt, status: 'FAILED_VALIDATION', actions: [], issues: plan.issues, eventVariables };
  }

  const executions: WorkflowActionExecution[] = [];
  for (const action of plan.actions) {
    const preserved=context.completedActions?.find(previous=>previous.actionId===action.id&&previous.stageId===action.stageId&&previous.kind===action.kind&&previous.status==='COMPLETED');
    if(preserved){executions.push({...preserved});continue;}
    const actionStartedAt = new Date().toISOString();
    try {
      let output: { externalId?: string } = {};
      if (action.kind === 'DOCUMENT') {
        const template = artifactById(studio.docTemplates, action.referenceId);
        if (!template) throw new Error(`Modelo ${action.referenceId} não localizado.`);
        output = await ports.createDocument({ template, variables: plan.variables, processId: plan.processId, idempotencyKey: action.idempotencyKey });
      } else if (action.kind === 'FORM') {
        const form = artifactById(studio.formTemplates, action.referenceId);
        if (!form) throw new Error(`Formulário ${action.referenceId} não localizado.`);
        output = await ports.createFormTask({ form, variables: plan.variables, processId: plan.processId, targetRole: text(form.targetRole), idempotencyKey: action.idempotencyKey });
      } else if (action.kind === 'EMAIL') {
        const template = artifactById(studio.emailTemplates, action.referenceId);
        if (!template) throw new Error(`E-mail ${action.referenceId} não localizado.`);
        const renderedVariables = presentVariables(plan.variables, String(template.id), studio);
        const recipients = parseRecipients(text(template.recipient) || action.detail || '', plan.variables);
        if (!recipients.length) throw new Error(`E-mail ${action.referenceId} sem destinatário válido.`);
        output = await ports.sendEmail({
          template,
          to: recipients,
          subject: mergeWorkflowVariables(text(template.subject), renderedVariables),
          text: mergeWorkflowVariables(text(template.body), renderedVariables),
          html: text(template.htmlBody) ? mergeWorkflowHtmlVariables(text(template.htmlBody), renderedVariables) : undefined,
          variables: plan.variables,
          processId: plan.processId,
          protocol: plan.protocol,
          eventVariables,
          idempotencyKey: action.idempotencyKey
        });
      } else if (ports.executeSystemAction) {
        output = await ports.executeSystemAction({ action, variables: plan.variables, processId: plan.processId, idempotencyKey: action.idempotencyKey });
      } else throw new Error(`A ação interna “${action.title}” não possui executor seguro.`);
      executions.push({ actionId: action.id, stageId: action.stageId, kind: action.kind, status: 'COMPLETED', startedAt: actionStartedAt, completedAt: new Date().toISOString(), externalId: output.externalId });
    } catch (error) {
      const failedExternalId = isRecord(error) ? text(error.externalId) : '';
      executions.push({
        actionId: action.id,
        stageId: action.stageId,
        kind: action.kind,
        status: 'FAILED',
        startedAt: actionStartedAt, completedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Falha desconhecida.',
        ...(failedExternalId ? { externalId: failedExternalId } : {})
      });
      // O fluxo é sequencial e fail-closed: nenhuma ação posterior pode ser
      // liberada quando uma dependência anterior falha.
      break;
    }
  }
  const completedAt = new Date().toISOString();
  return {
    id: runId, studioRevision: studio.revision, sourceDataRevision: context.process.dataRevision,
    processId: plan.processId,
    protocol: plan.protocol,
    eventCode: plan.eventCode,
    actorEmail: context.actorEmail,
    startedAt,
    completedAt,
    status: executions.some((item) => item.status === 'FAILED') ? 'PARTIAL_FAILURE' : 'COMPLETED',
    actions: executions,
    issues: plan.issues,
    eventVariables
  };
}
