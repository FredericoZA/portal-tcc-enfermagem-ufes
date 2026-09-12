import type {
  DocumentDesignConfig,
  EmailDesignConfig,
  FormDesignConfig,
  IntegrationAuditAction,
  IntegrationAuditEntry,
  IntegrationBrandKit,
  IntegrationStudioSettings,
  PortalReplicationGuide
} from '../types/integrationStudio';
import { DEFAULT_COURSE_OPERATIONS_POLICY } from '../utils/courseStudioValidator';

export const STUDIO_STORAGE_KEY = 'portal_integration_studio_v2';

export const DEFAULT_BRAND_KIT: IntegrationBrandKit = {
  institutionName: 'Universidade Federal do Espírito Santo',
  courseName: 'Curso de Graduação em Enfermagem e Obstetrícia',
  universityLogoUrl: '',
  courseLogoUrl: '',
  emailBannerUrl: '',
  primaryColor: '#005a3c',
  secondaryColor: '#005830',
  accentColor: '#005830',
  textColor: '#172033',
  fontFamily: 'Arial',
  documentHeaderText: 'UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO\nCURSO DE GRADUAÇÃO EM ENFERMAGEM E OBSTETRÍCIA',
  documentFooterText: 'Departamento de Enfermagem • Centro de Ciências da Saúde • Vitória/ES',
  emailFooterText: 'Colegiado do Curso de Graduação em Enfermagem e Obstetrícia • UFES'
};

export const DEFAULT_REPLICATION_GUIDE: PortalReplicationGuide = {
  enabled: false,
  githubRepositoryUrl: '',
  installationGuideUrl: '',
  title: 'Reutilizar este projeto em outra secretaria',
  description: 'O repositório público explica como criar uma instalação independente. Esta instalação continua atendendo somente o curso de Enfermagem.',
  steps: [
    'Criar uma cópia do repositório em uma conta institucional.',
    'Configurar Supabase e Vercel seguindo o guia de implantação.',
    'Conectar a conta Google institucional e criar a estrutura do Drive.',
    'Cadastrar os modelos DOCX, e-mails, formulários e o fluxo da nova instalação.',
    'Executar a homologação com dados fictícios antes de liberar o uso.'
  ]
};

export function defaultDocumentDesign(templateId: string, brand = DEFAULT_BRAND_KIT): DocumentDesignConfig {
  return {
    templateId,
    fontFamily: brand.fontFamily,
    fontSize: 11,
    lineSpacing: 1.15,
    marginTop: 2.2,
    marginBottom: 2,
    marginLeft: 2.5,
    marginRight: 2,
    showUniversityLogo: true,
    showCourseLogo: true,
    showPageNumbers: true,
    headerText: brand.documentHeaderText,
    footerText: brand.documentFooterText,
    logoAlignment: 'left'
  };
}

export function defaultEmailDesign(templateId: string, brand = DEFAULT_BRAND_KIT): EmailDesignConfig {
  return {
    templateId,
    logoUrl: brand.courseLogoUrl,
    heroImageUrl: brand.emailBannerUrl,
    buttonLabel: 'Acessar o Portal de TCC',
    buttonUrl: '{{LINK_PORTAL}}',
    footerText: brand.emailFooterText,
    contentWidth: 640,
    borderRadius: 12
  };
}

export function defaultFormDesign(templateId: string, brand = DEFAULT_BRAND_KIT): FormDesignConfig {
  return {
    templateId,
    logoUrl: brand.courseLogoUrl,
    bannerImageUrl: brand.emailBannerUrl,
    introText: 'Preencha os dados abaixo. As informações reutilizadas serão aproveitadas automaticamente nas etapas seguintes.',
    confirmationMessage: 'Dados recebidos com sucesso. Você receberá a confirmação por e-mail.',
    submitLabel: 'Enviar informações',
    showProgress: true
  };
}

const MARKER_PATTERNS = [
  /<<\s*([^<>]+?)\s*>>/g,
  /\{\{\s*([^{}]+?)\s*\}\}/g,
  /\[\[\s*([^\[\]]+?)\s*\]\]/g,
  /«\s*([^«»]+?)\s*»/g,
  /-((?:CAMPO|FIELD)_[A-Z0-9_]+)-/gi
];

export function normalizeVariableKey(value: string): string {
  return (value || '')
    .replace(/^<<|>>$/g, '')
    .replace(/^\{\{|\}\}$/g, '')
    .replace(/^\[\[|\]\]$/g, '')
    .replace(/^«|»$/g, '')
    .replace(/^-|-$/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

export function extractVariableKeys(...texts: Array<string | undefined | null>): string[] {
  const keys = new Set<string>();
  texts.filter(Boolean).forEach((text) => {
    MARKER_PATTERNS.forEach((pattern) => {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text as string)) !== null) {
        const key = normalizeVariableKey(match[1]);
        if (key && !key.startsWith('SE_') && !key.startsWith('FIM_')) keys.add(key);
      }
    });
  });
  return [...keys];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function replaceVariableReferences(text: string | undefined, oldKeys: string[], nextKey: string): string {
  if (!text) return text || '';
  const normalizedNext = normalizeVariableKey(nextKey);
  let result = text;
  oldKeys.map(normalizeVariableKey).filter(Boolean).forEach((key) => {
    const escaped = escapeRegExp(key).replace(/_/g, '[\\s_-]+');
    result = result
      .replace(new RegExp(`<<\\s*${escaped}\\s*>>`, 'gi'), `<<${normalizedNext}>>`)
      .replace(new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, 'gi'), `{{${normalizedNext}}}`)
      .replace(new RegExp(`\\[\\[\\s*${escaped}\\s*\\]\\]`, 'gi'), `[[${normalizedNext}]]`)
      .replace(new RegExp(`«\\s*${escaped}\\s*»`, 'gi'), `«${normalizedNext}»`)
      .replace(new RegExp(`-${escaped}-`, 'gi'), `-${normalizedNext}-`);
  });
  return result;
}

export interface StudioArtifacts {
  matrixColumns: any[];
  matrixRows: any[];
  docTemplates: any[];
  emailTemplates: any[];
  formTemplates: any[];
}

export interface VariableUsage {
  documents: string[];
  emails: string[];
  forms: string[];
}

export function getVariableUsage(key: string | string[], artifacts: StudioArtifacts): VariableUsage {
  const normalizedKeys = new Set((Array.isArray(key) ? key : [key]).map(normalizeVariableKey).filter(Boolean));
  const hasKey = (text?: string) => extractVariableKeys(text).some((value) => normalizedKeys.has(value));
  return {
    documents: artifacts.docTemplates
      .filter((doc) => (doc.variables || []).some((value: string) => normalizedKeys.has(normalizeVariableKey(value))) || hasKey(doc.templateContentText))
      .map((doc) => doc.label || doc.fileName || doc.id),
    emails: artifacts.emailTemplates
      .filter((email) => hasKey(`${email.recipient || ''}\n${email.subject || ''}\n${email.body || ''}\n${email.htmlBody || ''}`))
      .map((email) => email.name || email.id),
    forms: artifacts.formTemplates
      .filter((form) => (form.questions || []).some((question: any) => normalizedKeys.has(normalizeVariableKey(question.fieldKey))))
      .map((form) => form.title || form.id)
  };
}

export function discoverVariables(artifacts: StudioArtifacts): string[] {
  const keys = new Set<string>();
  artifacts.docTemplates.forEach((doc) => {
    (doc.variables || []).forEach((value: string) => keys.add(normalizeVariableKey(value)));
    extractVariableKeys(doc.templateContentText).forEach((key) => keys.add(key));
  });
  artifacts.emailTemplates.forEach((email) => {
    extractVariableKeys(email.recipient, email.subject, email.body, email.htmlBody).forEach((key) => keys.add(key));
  });
  artifacts.formTemplates.forEach((form) => {
    (form.questions || []).forEach((question: any) => {
      const key = normalizeVariableKey(question.fieldKey);
      if (key) keys.add(key);
    });
  });
  return [...keys].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function mergeVariableAcrossArtifacts(
  artifacts: StudioArtifacts,
  sourceColumnId: string,
  targetColumnId: string
): StudioArtifacts & { affectedArtifacts: string[] } {
  const source = artifacts.matrixColumns.find((column) => column.id === sourceColumnId);
  const target = artifacts.matrixColumns.find((column) => column.id === targetColumnId);
  if (!source || !target || source.id === target.id) return { ...artifacts, affectedArtifacts: [] };

  const sourceKeys = [source.id, source.name, source.label, ...(source.aliases || [])].filter(Boolean);
  const targetKey = normalizeVariableKey(target.name || target.id);
  const affected = new Set<string>();

  const matrixRows = artifacts.matrixRows.map((row) => {
    if (!row.fields?.[source.id]) return row;
    affected.add(row.name || row.id);
    const fields = { ...(row.fields || {}), [target.id]: true };
    delete fields[source.id];
    return { ...row, fields };
  });

  const docTemplates = artifacts.docTemplates.map((doc) => {
    const nextText = replaceVariableReferences(doc.templateContentText, sourceKeys, targetKey);
    const nextVariables = Array.from(new Set((doc.variables || []).map((value: string) => {
      const current = normalizeVariableKey(value);
      return sourceKeys.map(normalizeVariableKey).includes(current) ? `<<${targetKey}>>` : value;
    })));
    if (nextText !== doc.templateContentText || JSON.stringify(nextVariables) !== JSON.stringify(doc.variables || [])) affected.add(doc.label || doc.id);
    return { ...doc, templateContentText: nextText, variables: nextVariables };
  });

  const emailTemplates = artifacts.emailTemplates.map((email) => {
    const next = {
      ...email,
      recipient: replaceVariableReferences(email.recipient, sourceKeys, targetKey),
      subject: replaceVariableReferences(email.subject, sourceKeys, targetKey),
      body: replaceVariableReferences(email.body, sourceKeys, targetKey),
      htmlBody: replaceVariableReferences(email.htmlBody, sourceKeys, targetKey)
    };
    if (JSON.stringify(next) !== JSON.stringify(email)) affected.add(email.name || email.id);
    return next;
  });

  const formTemplates = artifacts.formTemplates.map((form) => {
    let changed = false;
    const questions = (form.questions || []).map((question: any) => {
      const current = normalizeVariableKey(question.fieldKey);
      if (!sourceKeys.map(normalizeVariableKey).includes(current)) return question;
      changed = true;
      return { ...question, fieldKey: targetKey, isReuseOfFieldKey: true };
    });
    if (changed) affected.add(form.title || form.id);
    return { ...form, questions };
  });

  const aliases = Array.from(new Set([
    ...(target.aliases || []),
    normalizeVariableKey(source.name || source.id),
    ...(source.aliases || []).map(normalizeVariableKey)
  ].filter(Boolean)));
  const matrixColumns = artifacts.matrixColumns
    .filter((column) => column.id !== source.id)
    .map((column) => column.id === target.id ? { ...column, aliases } : column);

  return { matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates, affectedArtifacts: [...affected] };
}

export function createAuditEntry(
  action: IntegrationAuditAction,
  entityType: IntegrationAuditEntry['entityType'],
  entityId: string,
  description: string,
  actorEmail: string,
  extras: Partial<Pick<IntegrationAuditEntry, 'before' | 'after' | 'affectedArtifacts'>> = {}
): IntegrationAuditEntry {
  return {
    id: `studio-audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    action,
    entityType,
    entityId,
    description,
    actorEmail,
    timestamp: new Date().toISOString(),
    ...extras
  };
}

export function normalizeStudioSettings(value?: Partial<IntegrationStudioSettings> | null): Partial<IntegrationStudioSettings> {
  if (!value) return {};
  return {
    ...value,
    schemaVersion: 3,
    brandKit: { ...DEFAULT_BRAND_KIT, ...(value.brandKit || {}) },
    documentDesigns: value.documentDesigns || {},
    emailDesigns: value.emailDesigns || {},
    formDesigns: value.formDesigns || {},
    auditTrail: Array.isArray(value.auditTrail) ? value.auditTrail : [],
    operationsPolicy: {
      ...DEFAULT_COURSE_OPERATIONS_POLICY,
      ...(value.operationsPolicy || {}),
      accessibility: { ...DEFAULT_COURSE_OPERATIONS_POLICY.accessibility, ...(value.operationsPolicy?.accessibility || {}) },
      notifications: { ...DEFAULT_COURSE_OPERATIONS_POLICY.notifications, ...(value.operationsPolicy?.notifications || {}) },
      retention: { ...DEFAULT_COURSE_OPERATIONS_POLICY.retention, ...(value.operationsPolicy?.retention || {}) }
    },
    replicationGuide: { ...DEFAULT_REPLICATION_GUIDE, ...(value.replicationGuide || {}), steps: Array.isArray(value.replicationGuide?.steps) ? value.replicationGuide.steps : DEFAULT_REPLICATION_GUIDE.steps },
    publication: value.publication || { status: 'DRAFT' }
  };
}

export function loadLocalStudio(): Partial<IntegrationStudioSettings> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STUDIO_STORAGE_KEY);
    return raw ? normalizeStudioSettings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveLocalStudio(snapshot: IntegrationStudioSettings): void {
  if (typeof window !== 'undefined') localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(snapshot));
}
