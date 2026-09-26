import { portalConfirm } from '../services/portalDialogs';
import { upgradeStudioDraft } from '../utils/studioUpgrade';
import { OperationalDesignerPanel } from './OperationalDesignerPanel';
import { MasterDocumentModelsPanel } from './MasterDocumentModelsPanel';
import { operationalConfig as resolveOperationalConfig } from '../utils/operationalConfig';
import type { OperationalConfig } from '../types/operationalConfig';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AtSign,
  BookOpenCheck,
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  Cloud,
  FileClock,
  FileText,
  FolderSync,
  History,
  Image,
  Layers,
  Link,
  Mail,
  Merge,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Type,
  Variable,
  Workflow,
  WandSparkles
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import {
  DEFAULT_BRAND_KIT,
  DEFAULT_REPLICATION_GUIDE,
  createAuditEntry,
  defaultEmailDesign,
  defaultFormDesign,
  discoverVariables,
  getVariableUsage,
  loadLocalStudio,
  mergeVariableAcrossArtifacts,
  normalizeStudioSettings,
  normalizeVariableKey,
  replaceVariableReferences,
  saveLocalStudio
} from '../services/integrationStudioService';
import type {
  CourseOperationsPolicy,
  DocumentDesignConfig,
  EmailDesignConfig,
  FormDesignConfig,
  IntegrationAuditEntry,
  IntegrationBrandKit,
  IntegrationStudioSettings,
  PortalReplicationGuide
} from '../types/integrationStudio';
import { DEFAULT_COURSE_OPERATIONS_POLICY, normalizePublishedWorkflowTrigger, validateCourseStudio } from '../utils/courseStudioValidator';
import type {
  DocTemplateItem,
  EmailTemplateItem,
  FormQuestionItem,
  FormTemplateItem,
  MatrixColumn,
  MatrixRow,
  WorkflowActionItem,
  WorkflowStageItem
} from '../pages/ConfiguracoesPage';

type StudioTab = 'models' | 'operation' | 'overview' | 'brand' | 'documents' | 'emails' | 'forms' | 'workflow' | 'variables' | 'audit';

interface IntegrationStudioPanelProps {
  actorEmail: string;
  initialStudio?: IntegrationStudioSettings;
  matrixColumns: MatrixColumn[];
  setMatrixColumns: React.Dispatch<React.SetStateAction<MatrixColumn[]>>;
  matrixRows: MatrixRow[];
  setMatrixRows: React.Dispatch<React.SetStateAction<MatrixRow[]>>;
  docTemplates: DocTemplateItem[];
  setDocTemplates: React.Dispatch<React.SetStateAction<DocTemplateItem[]>>;
  emailTemplates: EmailTemplateItem[];
  setEmailTemplates: React.Dispatch<React.SetStateAction<EmailTemplateItem[]>>;
  formTemplates: FormTemplateItem[];
  setFormTemplates: React.Dispatch<React.SetStateAction<FormTemplateItem[]>>;
  workflowStages: WorkflowStageItem[];
  setWorkflowStages: React.Dispatch<React.SetStateAction<WorkflowStageItem[]>>;
  driveModelosFolderUrl: string;
  setDriveModelosFolderUrl: (url: string) => void;
  onConnectDrive: () => void;
  onScanDrive: () => Promise<void>;
  isScanningDrive: boolean;
  notify: (message: string) => void;
}

const panelClass = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
const labelClass = 'mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-600';
const actionClass = 'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wide transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function safeHtmlText(value: string): string {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatAuditAction(action: string): string {
  const labels: Record<string, string> = {
    STUDIO_SAVED: 'Estúdio salvo', DRIVE_SCAN: 'Drive sincronizado', DRIVE_TEMPLATE_UPDATED: 'Google Docs atualizado',
    VARIABLE_DISCOVERED: 'Variável descoberta', VARIABLE_UPDATED: 'Variável alterada', VARIABLE_MERGED: 'Variável mesclada',
    VARIABLE_DELETED: 'Variável excluída', VARIABLE_PROPAGATED: 'Variável propagada', BRAND_UPDATED: 'Identidade atualizada',
    DOCUMENT_UPDATED: 'Modelo atualizado', EMAIL_UPDATED: 'E-mail atualizado', FORM_UPDATED: 'Formulário atualizado'
  };
  return labels[action] || action;
}

const FormQuestionEditor: React.FC<{
  question: FormQuestionItem;
  index: number;
  variables: Array<{ id: string; name: string; label?: string }>;
  previousQuestions: FormQuestionItem[];
  onChange: (updates: Partial<FormQuestionItem>) => void;
  onDelete: () => void;
}> = ({ question, index, variables, previousQuestions, onChange, onDelete }) => {
  const condition = question.visibleWhen || { fieldKey: '', operator: 'EQUALS' as const, value: '' };
  const validation = question.validation || {};
  return <article className="rounded-xl border border-slate-200 bg-slate-50 p-3" aria-label={`Campo ${index + 1}: ${question.label}`}>
    <div className="grid gap-2 sm:grid-cols-[1fr_.8fr_.7fr_auto]">
      <input aria-label="Rótulo do campo" value={question.label} onChange={(event) => onChange({ label: event.target.value })} className={inputClass} placeholder="Pergunta" />
      <input aria-label="Variável vinculada" value={question.fieldKey} onChange={event=>onChange({fieldKey:event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g,'_')})} className={inputClass} placeholder="CHAVE_DA_VARIAVEL" />
      <select aria-label="Tipo do campo" value={question.fieldType} onChange={(event) => onChange({ fieldType: event.target.value as FormQuestionItem['fieldType'] })} className={inputClass}>{['text', 'textarea', 'date', 'datetime-local', 'email', 'number', 'select', 'radio', 'checkbox', 'file'].map((type) => <option key={type}>{type}</option>)}</select>
      <button type="button" onClick={onDelete} aria-label={`Excluir campo ${question.label}`} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <input value={question.helpText || ''} onChange={(event) => onChange({ helpText: event.target.value })} className={inputClass} placeholder="Texto de ajuda opcional" />
      <input value={question.placeholder || ''} onChange={(event) => onChange({ placeholder: event.target.value })} className={inputClass} placeholder="Exemplo/placeholder" />
    </div>
    <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-bold text-slate-600">
      <label className="flex items-center gap-2"><input type="checkbox" checked={question.required} onChange={(event) => onChange({ required: event.target.checked })} />Campo obrigatório</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(question.visibleWhen?.fieldKey)} onChange={(event) => onChange({ visibleWhen: event.target.checked ? { fieldKey: previousQuestions[0]?.fieldKey || '', operator: 'EQUALS', value: '' } : undefined })} />Exibição condicional</label>
    </div>
    {(question.fieldType === 'select' || question.fieldType === 'radio') && <div className="mt-2"><label className={labelClass}>Opções (uma por linha)</label><textarea rows={3} value={(question.options || []).join('\n')} onChange={(event) => onChange({ options: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} className={inputClass}/></div>}
    {question.visibleWhen?.fieldKey !== undefined && <div className="mt-2 grid gap-2 rounded-lg border border-slate-300 bg-white p-2 sm:grid-cols-3"><select value={condition.fieldKey} onChange={(event) => onChange({ visibleWhen: { ...condition, fieldKey: event.target.value } })} className={inputClass}><option value="">Campo anterior…</option>{previousQuestions.filter((item) => item.fieldKey).map((item) => <option key={item.id} value={item.fieldKey}>{item.label}</option>)}</select><select value={condition.operator} onChange={(event) => onChange({ visibleWhen: { ...condition, operator: event.target.value as typeof condition.operator } })} className={inputClass}><option value="EQUALS">É igual a</option><option value="NOT_EQUALS">É diferente de</option><option value="CONTAINS">Contém</option><option value="NOT_EMPTY">Foi preenchido</option><option value="IS_TRUE">Está marcado</option></select>{!['NOT_EMPTY', 'IS_TRUE'].includes(condition.operator) && <input value={condition.value || ''} onChange={(event) => onChange({ visibleWhen: { ...condition, value: event.target.value } })} className={inputClass} placeholder="Valor esperado"/>}</div>}
    <label className="mt-2 block text-xs">Seção do cadastro<input value={question.section || ''} onChange={event=>onChange({section:event.target.value})} className={inputClass}/></label>
    <details className="mt-2 rounded-lg border border-slate-200 bg-white p-2"><summary className="cursor-pointer text-[10px] font-black uppercase text-slate-600">Validação avançada</summary><div className="mt-2 grid gap-2 sm:grid-cols-3"><input type="number" min={0} value={validation.minLength ?? ''} onChange={(event) => onChange({ validation: { ...validation, minLength: event.target.value === '' ? undefined : Number(event.target.value) } })} className={inputClass} placeholder="Mín. caracteres"/><input type="number" min={0} value={validation.maxLength ?? ''} onChange={(event) => onChange({ validation: { ...validation, maxLength: event.target.value === '' ? undefined : Number(event.target.value) } })} className={inputClass} placeholder="Máx. caracteres"/><input value={validation.pattern || ''} onChange={(event) => onChange({ validation: { ...validation, pattern: event.target.value } })} className={inputClass} placeholder="Expressão regular"/><input value={validation.errorMessage || ''} onChange={(event) => onChange({ validation: { ...validation, errorMessage: event.target.value } })} className={`${inputClass} sm:col-span-3`} placeholder="Mensagem de erro personalizada"/></div></details>
  </article>;
};

export const IntegrationStudioPanel: React.FC<IntegrationStudioPanelProps> = (props) => {
  const {
    actorEmail, initialStudio, matrixColumns, setMatrixColumns, matrixRows, setMatrixRows,
    docTemplates, setDocTemplates, emailTemplates, setEmailTemplates, formTemplates, setFormTemplates,
    workflowStages, setWorkflowStages, driveModelosFolderUrl, setDriveModelosFolderUrl,
    onConnectDrive, onScanDrive, isScanningDrive, notify
  } = props;

  const localStudio = useMemo(() => loadLocalStudio(), []);
  const initialMeta = normalizeStudioSettings(initialStudio || localStudio);
  const [activeTab, setActiveTab] = useState<StudioTab>('models');
  const [brandKit, setBrandKit] = useState<IntegrationBrandKit>(initialMeta.brandKit || DEFAULT_BRAND_KIT);
  const [documentDesigns, setDocumentDesigns] = useState<Record<string, DocumentDesignConfig>>(initialMeta.documentDesigns || {});
  const [emailDesigns, setEmailDesigns] = useState<Record<string, EmailDesignConfig>>(initialMeta.emailDesigns || {});
  const [formDesigns, setFormDesigns] = useState<Record<string, FormDesignConfig>>(initialMeta.formDesigns || {});
  const [operationalConfig, setOperationalConfig] = useState<OperationalConfig>(resolveOperationalConfig(initialMeta));
  const [operationsPolicy, setOperationsPolicy] = useState<CourseOperationsPolicy>(initialMeta.operationsPolicy || DEFAULT_COURSE_OPERATIONS_POLICY);
  const [replicationGuide, setReplicationGuide] = useState<PortalReplicationGuide>(initialMeta.replicationGuide || DEFAULT_REPLICATION_GUIDE);
  const [auditTrail, setAuditTrail] = useState<IntegrationAuditEntry[]>(initialMeta.auditTrail || []);
  const [revision, setRevision] = useState(initialMeta.revision || 0);
  const [lastDriveSyncAt, setLastDriveSyncAt] = useState(initialMeta.lastDriveSyncAt || '');
  const [lastDriveSyncStatus, setLastDriveSyncStatus] = useState<IntegrationStudioSettings['lastDriveSyncStatus']>(initialMeta.lastDriveSyncStatus || 'never');
  const [selectedDocId, setSelectedDocId] = useState(docTemplates[0]?.id || '');
  const [selectedEmailId, setSelectedEmailId] = useState(emailTemplates[0]?.id || '');
  const [selectedFormId, setSelectedFormId] = useState(formTemplates[0]?.id || '');
  const [selectedQuestionId, setSelectedQuestionId] = useState(formTemplates[0]?.questions?.[0]?.id || '');
  const [expandedWorkflowStageId, setExpandedWorkflowStageId] = useState(workflowStages[0]?.id || '');
  const [selectedVariableId, setSelectedVariableId] = useState(matrixColumns[0]?.id || '');
  const [variableDraft, setVariableDraft] = useState<MatrixColumn | null>(matrixColumns[0] || null);
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [newVariableKey, setNewVariableKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(initialMeta.savedAt || '');
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const appliedSnapshotRef = useRef<string>('');
  const hasHydratedRef = useRef(false);

  const selectedDoc = docTemplates.find((item) => item.id === selectedDocId) || docTemplates[0];
  const selectedEmail = emailTemplates.find((item) => item.id === selectedEmailId) || emailTemplates[0];
  const selectedForm = formTemplates.find((item) => item.id === selectedFormId) || formTemplates[0];
  const selectedVariable = matrixColumns.find((item) => item.id === selectedVariableId) || matrixColumns[0];
  const selectedEmailDesign = selectedEmail
    ? emailDesigns[selectedEmail.id] || defaultEmailDesign(selectedEmail.id, brandKit)
    : defaultEmailDesign('', brandKit);
  const selectedFormDesign = selectedForm
    ? formDesigns[selectedForm.id] || defaultFormDesign(selectedForm.id, brandKit)
    : defaultFormDesign('', brandKit);
  const validationReport = useMemo(() => validateCourseStudio({
    schemaVersion: 3,
    brandKit,
    matrixColumns: matrixColumns as unknown as Array<Record<string, unknown>>,
    docTemplates: docTemplates as unknown as Array<Record<string, unknown>>,
    emailTemplates: emailTemplates as unknown as Array<Record<string, unknown>>,
    formTemplates: formTemplates as unknown as Array<Record<string, unknown>>,
    workflowStages: workflowStages as unknown as Array<Record<string, unknown>>,
    operationalConfig,
    operationsPolicy,
    replicationGuide
  }), [brandKit, matrixColumns, docTemplates, emailTemplates, formTemplates, workflowStages, operationsPolicy, operationalConfig, replicationGuide]);

  const recordAudit = (entry: IntegrationAuditEntry) => {
    setAuditTrail((previous) => [entry, ...previous].slice(0, 500));
    setIsDirty(true);
  };

  useEffect(() => {
    setVariableDraft(selectedVariable ? { ...selectedVariable, aliases: [...(selectedVariable.aliases || [])], format: { ...(selectedVariable.format || {}) } } : null);
  }, [selectedVariableId, selectedVariable?.id]);

  useEffect(() => {
    const remote = normalizeStudioSettings(initialStudio);
    const local = normalizeStudioSettings(!hasHydratedRef.current ? localStudio : loadLocalStudio());
    const remoteTime = Date.parse(String(remote.savedAt || '')) || 0;
    const localTime = Date.parse(String(local.savedAt || '')) || 0;
    const preferred = localTime > remoteTime ? local : (initialStudio || localStudio);
    const source = upgradeStudioDraft(normalizeStudioSettings(preferred));
    const sourceKey = `${source.savedAt || ''}:${source.revision || 0}`;
    if (!source.savedAt || sourceKey === appliedSnapshotRef.current) return;
    appliedSnapshotRef.current = sourceKey;
    hasHydratedRef.current = true;
    if (source.brandKit) setBrandKit(source.brandKit);
    if (source.documentDesigns) setDocumentDesigns(source.documentDesigns);
    if (source.emailDesigns) setEmailDesigns(source.emailDesigns);
    if (source.formDesigns) setFormDesigns(source.formDesigns);
    setOperationalConfig(resolveOperationalConfig(source));
    if (source.operationsPolicy) setOperationsPolicy(source.operationsPolicy);
    if (source.replicationGuide) setReplicationGuide(source.replicationGuide);
    if (source.auditTrail) setAuditTrail(source.auditTrail);
    if (source.matrixColumns?.length) {
      const seen = new Set<string>();
      const deduped: MatrixColumn[] = [];
      for (const col of (source.matrixColumns as unknown as MatrixColumn[])) {
        const idKey = String(col.id || col.name || '').trim().toLowerCase();
        if (idKey && !seen.has(idKey)) {
          seen.add(idKey);
          deduped.push(col);
        }
      }
      if (deduped.length) setMatrixColumns(deduped);
    }
    if (source.matrixRows?.length) setMatrixRows(source.matrixRows as unknown as MatrixRow[]);
    if (source.docTemplates?.length) setDocTemplates((source.docTemplates as unknown as DocTemplateItem[]).map((doc) => ({ ...doc, templateContentText: '' })));
    if (source.emailTemplates?.length) setEmailTemplates(source.emailTemplates as unknown as EmailTemplateItem[]);
    if (source.formTemplates?.length) setFormTemplates(source.formTemplates as unknown as FormTemplateItem[]);
    if (source.workflowStages?.length) {
      const eventFallback=['TCC_CREATED','LOCATION_CONFIRMED','INVITATION_SENT','EVALUATION_SUBMITTED','REPOSITORY_SUBMITTED','SIGNATURE_REQUESTED','SIGNATURE_COMPLETED','PROCESS_COMPLETED'];
      setWorkflowStages((source.workflowStages as unknown as WorkflowStageItem[]).map((stage,index)=>({
        ...stage,
        stageNumber:index+1,
        triggerEvent:normalizePublishedWorkflowTrigger(stage.triggerEvent,eventFallback[index]||'TCC_CREATED')
      })));
    }
    if (source.driveModelosFolderUrl) setDriveModelosFolderUrl(source.driveModelosFolderUrl);
    setRevision(source.revision || 0);
    setLastSavedAt(source.savedAt || '');
    setLastDriveSyncAt(source.lastDriveSyncAt || '');
    setLastDriveSyncStatus(source.lastDriveSyncStatus || 'never');
    setIsDirty(false);
  }, [initialStudio]);

  useEffect(() => {
    if (!hasHydratedRef.current) hasHydratedRef.current = true;
  }, []);

  const buildSnapshot = (nextAudit = auditTrail): IntegrationStudioSettings => ({
    schemaVersion: 3,
    revision: revision + 1,
    savedAt: new Date().toISOString(),
    savedBy: actorEmail,
    driveModelosFolderUrl,
    brandKit,
    documentDesigns,
    emailDesigns,
    formDesigns,
    matrixColumns: matrixColumns as unknown as Array<Record<string, unknown>>,
    matrixRows: matrixRows as unknown as Array<Record<string, unknown>>,
    docTemplates: docTemplates.map((doc) => ({ ...doc, templateContentText: '' })) as unknown as Array<Record<string, unknown>>,
    emailTemplates: emailTemplates as unknown as Array<Record<string, unknown>>,
    formTemplates: formTemplates as unknown as Array<Record<string, unknown>>,
    workflowStages: workflowStages as unknown as Array<Record<string, unknown>>,
    operationalConfig,
    operationsPolicy,
    replicationGuide,
    publication: {
      status: validationReport.ready ? 'PUBLISHED' : 'DRAFT',
      publishedRevision: validationReport.ready ? revision + 1 : undefined,
      publishedAt: validationReport.ready ? new Date().toISOString() : undefined,
      validationScore: validationReport.score
    },
    auditTrail: nextAudit,
    lastDriveSyncAt: lastDriveSyncAt || undefined,
    lastDriveSyncStatus
  });

  const draftFingerprint = useMemo(() => JSON.stringify({ brandKit, documentDesigns, emailDesigns, formDesigns, matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates, workflowStages, operationalConfig, operationsPolicy, replicationGuide, driveModelosFolderUrl }), [brandKit, documentDesigns, emailDesigns, formDesigns, matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates, workflowStages, operationalConfig, operationsPolicy, replicationGuide, driveModelosFolderUrl]);

  useEffect(() => {
    if (!hasHydratedRef.current || !isDirty || isSaving) return;
    const timer = window.setTimeout(() => {
      const draft = buildSnapshot();
      draft.revision = revision;
      draft.savedAt = new Date().toISOString();
      draft.publication = { status: 'DRAFT', publishedRevision: initialMeta.publication?.publishedRevision, publishedAt: initialMeta.publication?.publishedAt, validationScore: validationReport.score };
      saveLocalStudio(draft);
      setDraftSavedAt(draft.savedAt);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [draftFingerprint, isDirty, isSaving, revision, validationReport.score]);

  const persistSnapshot = async (withAudit = false) => {
    if (isSaving) return;
    if (!validationReport.ready) {
      setActiveTab('overview');
      notify(`Publicação bloqueada: corrija ${validationReport.errors} erro(s) na configuração operacional do portal.`);
      return;
    }
    setIsSaving(true);
    try {
      const nextAudit = withAudit
        ? [createAuditEntry('STUDIO_SAVED', 'studio', 'integration-studio', 'Configuração integrada salva e publicada no servidor.', actorEmail), ...auditTrail].slice(0, 500)
        : auditTrail;
      const snapshot = buildSnapshot(nextAudit);
      saveLocalStudio(snapshot);
      await apiClient.updateSettings({ integrationStudio: snapshot });
      setAuditTrail(nextAudit);
      setRevision(snapshot.revision);
      setLastSavedAt(snapshot.savedAt);
      setDraftSavedAt('');
      appliedSnapshotRef.current = `${snapshot.savedAt}:${snapshot.revision}`;
      setIsDirty(false);
      if (withAudit) notify('Estúdio integrado salvo e publicado para todo o portal.');
    } catch (error: any) {
      console.error(error);
      notify(`Não foi possível publicar o estúdio: ${error.message || error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const updateBrand = <K extends keyof IntegrationBrandKit>(key: K, value: IntegrationBrandKit[K]) => {
    setBrandKit((previous) => ({ ...previous, [key]: value }));
    setIsDirty(true);
  };

  const handleImageFile = async (file: File | undefined, field: keyof Pick<IntegrationBrandKit, 'universityLogoUrl' | 'courseLogoUrl' | 'emailBannerUrl'>) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify('A imagem deve ter até 2 MB para não sobrecarregar as configurações.');
      return;
    }
    updateBrand(field, await fileToDataUrl(file));
  };

  const readTemplateImage = async (file?: File): Promise<string> => {
    if (!file) return '';
    if (file.size > 2 * 1024 * 1024) {
      notify('A imagem deve ter até 2 MB. Prefira WebP ou PNG otimizado.');
      return '';
    }
    return fileToDataUrl(file);
  };

  const updateSelectedDoc = (updates: Partial<DocTemplateItem>) => {
    if (!selectedDoc) return;
    setDocTemplates((previous) => previous.map((item) => item.id === selectedDoc.id ? { ...item, ...updates, lastUpdated: new Date().toLocaleString('pt-BR') } : item));
    setIsDirty(true);
  };

  const registerDocUpdate = () => {
    if (!selectedDoc) return;
    recordAudit(createAuditEntry('DOCUMENT_UPDATED', 'document', selectedDoc.id, `Modelo "${selectedDoc.label}" atualizado no estúdio.`, actorEmail));
    notify('Modelo atualizado e colocado na fila de persistência.');
  };

  const updateSelectedEmail = (updates: Partial<EmailTemplateItem>) => {
    if (!selectedEmail) return;
    setEmailTemplates((previous) => previous.map((item) => item.id === selectedEmail.id ? { ...item, ...updates } : item));
    setIsDirty(true);
  };

  const updateSelectedEmailDesign = (updates: Partial<EmailDesignConfig>) => {
    if (!selectedEmail) return;
    setEmailDesigns((previous) => ({ ...previous, [selectedEmail.id]: { ...selectedEmailDesign, ...updates, templateId: selectedEmail.id } }));
    setIsDirty(true);
  };

  const registerEmailUpdate = () => {
    if (!selectedEmail) return;
    recordAudit(createAuditEntry('EMAIL_UPDATED', 'email', selectedEmail.id, `E-mail "${selectedEmail.name}" atualizado.`, actorEmail));
    notify('Modelo de e-mail atualizado e propagado.');
  };

  const createEmailTemplate = () => {
    const id=`email-${Date.now()}`;
    const next: EmailTemplateItem={id,name:'Novo e-mail',triggerStage:'',subject:'',body:'',recipient:'',cc:'',bcc:'',attachments:[]};
    setEmailTemplates(previous=>[...previous,next]);setSelectedEmailId(id);setIsDirty(true);
  };
  const deleteSelectedEmail = async () => {
    if(!selectedEmail||emailTemplates.length<=1)return;
    if(!(await portalConfirm(`Excluir o modelo de e-mail "${selectedEmail.name}"?`)))return;
    const next=emailTemplates.filter(item=>item.id!==selectedEmail.id);setEmailTemplates(next);setSelectedEmailId(next[0]?.id||'');setIsDirty(true);
  };

  const updateSelectedForm = (updates: Partial<FormTemplateItem>) => {
    if (!selectedForm) return;
    setFormTemplates((previous) => previous.map((item) => item.id === selectedForm.id ? { ...item, ...updates } : item));
    setIsDirty(true);
  };

  const updateSelectedFormDesign = (updates: Partial<FormDesignConfig>) => {
    if (!selectedForm) return;
    setFormDesigns((previous) => ({ ...previous, [selectedForm.id]: { ...selectedFormDesign, ...updates, templateId: selectedForm.id } }));
    setIsDirty(true);
  };
  const createFormTemplate = () => {
    const id=`form-${Date.now()}`;
    const next: FormTemplateItem={id,title:'Novo formulário',stage:'',targetRole:'Aluno',description:'',questions:[],isActive:true};
    setFormTemplates(previous=>[...previous,next]);setSelectedFormId(id);setIsDirty(true);
  };
  const deleteSelectedForm = async () => {
    if(!selectedForm||formTemplates.length<=1)return;
    if(!(await portalConfirm(`Excluir o formulário "${selectedForm.title}"?`)))return;
    const next=formTemplates.filter(item=>item.id!==selectedForm.id);setFormTemplates(next);setSelectedFormId(next[0]?.id||'');setIsDirty(true);
  };
  const moveSelectedFormQuestion = (index:number,direction:-1|1) => {
    if(!selectedForm)return;const target=index+direction;if(target<0||target>=selectedForm.questions.length)return;
    const questions=[...selectedForm.questions];[questions[index],questions[target]]=[questions[target],questions[index]];updateSelectedForm({questions});
  };

  const handleDriveScan = async () => {
    try {
      await onScanDrive();
      const timestamp = new Date().toISOString();
      setLastDriveSyncAt(timestamp);
      setLastDriveSyncStatus('success');
      recordAudit(createAuditEntry('DRIVE_SCAN', 'drive', 'modelos-folder', 'Pasta de modelos varrida e variáveis atualizadas.', actorEmail));
    } catch (error) {
      setLastDriveSyncStatus('error');
      throw error;
    }
  };

  const handleDiscoverVariables = () => {
    const artifacts = { matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates };
    const keys = discoverVariables(artifacts);
    const existing = new Set<string>();
    matrixColumns.forEach((column) => [column.id, column.name, column.label, ...(column.aliases || [])].filter(Boolean).forEach((value) => {
      existing.add(normalizeVariableKey(String(value)));
      existing.add(String(value).trim().toLowerCase());
    }));
    const additions: MatrixColumn[] = [];
    const addedKeys = new Set<string>();

    keys.forEach((key) => {
      const normKey = normalizeVariableKey(key);
      const varId = `var_${normKey.toLowerCase()}`;
      if (!existing.has(normKey) && !existing.has(varId) && !addedKeys.has(normKey) && !addedKeys.has(varId)) {
        addedKeys.add(normKey);
        addedKeys.add(varId);
        additions.push({
          id: varId,
          name: key,
          label: key.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
          dataType: 'text' as const,
          aliases: [],
          format: { bold: false, italic: false, color: brandKit.primaryColor }
        });
      }
    });

    if (additions.length) setMatrixColumns((previous) => [...previous, ...additions]);
    additions.forEach((column) => recordAudit(createAuditEntry('VARIABLE_DISCOVERED', 'variable', column.id, `Variável ${column.name} descoberta automaticamente.`, actorEmail)));
    setIsDirty(true);
    notify(additions.length ? `${additions.length} nova(s) variável(is) consolidada(s) na matriz.` : 'Varredura concluída: nenhuma variável nova ou duplicada.');
  };

  // New routines immediately feed the variable matrix; the explicit scan button
  // remains available for a full reconciliation with the Google Drive folder.
  useEffect(() => {
    if (!hasHydratedRef.current) return;
    const keys = discoverVariables({ matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates });
    const existing = new Set<string>();
    matrixColumns.forEach((column) => [column.id, column.name, column.label, ...(column.aliases || [])].filter(Boolean).forEach((value) => {
      existing.add(normalizeVariableKey(String(value)));
      existing.add(String(value).trim().toLowerCase());
    }));
    const additions: MatrixColumn[] = [];
    const addedKeys = new Set<string>();

    keys.forEach((key) => {
      const normKey = normalizeVariableKey(key);
      const varId = `var_${normKey.toLowerCase()}`;
      if (!existing.has(normKey) && !existing.has(varId) && !addedKeys.has(normKey) && !addedKeys.has(varId)) {
        addedKeys.add(normKey);
        addedKeys.add(varId);
        additions.push({
          id: varId,
          name: key,
          label: key.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
          dataType: 'text', aliases: [], format: { color: brandKit.primaryColor }
        });
      }
    });

    if (!additions.length) return;
    setMatrixColumns((previous) => [...previous, ...additions]);
    setAuditTrail((previous) => [
      ...additions.map((column) => createAuditEntry('VARIABLE_DISCOVERED', 'variable', column.id, `Variável ${column.name} descoberta automaticamente na rotina editada.`, actorEmail)),
      ...previous
    ].slice(0, 500));
    setIsDirty(true);
  }, [docTemplates, emailTemplates, formTemplates]);

  const handleCreateVariable = () => {
    const key = normalizeVariableKey(newVariableKey);
    if (!key) return;
    const exists = matrixColumns.some((column) => [column.id, column.name, ...(column.aliases || [])].some((value) => normalizeVariableKey(String(value)) === key));
    if (exists) {
      notify('Essa variável ou um de seus aliases já existe.');
      return;
    }
    const column: MatrixColumn = { id: `var_${key.toLowerCase()}`, name: key, label: key, dataType: 'text', aliases: [], format: { color: brandKit.primaryColor } };
    setMatrixColumns((previous) => [...previous, column]);
    setSelectedVariableId(column.id);
    setNewVariableKey('');
    recordAudit(createAuditEntry('VARIABLE_DISCOVERED', 'variable', column.id, `Variável ${key} criada manualmente.`, actorEmail));
  };

  const updateVariableAndPropagate = (updates: Partial<MatrixColumn>) => {
    if (!selectedVariable) return;
    const before = selectedVariable;
    const nextName = updates.name ? normalizeVariableKey(updates.name) : selectedVariable.name;
    const duplicate = matrixColumns.some((column) => column.id !== selectedVariable.id && [column.id, column.name, ...(column.aliases || [])].some((value) => normalizeVariableKey(String(value)) === normalizeVariableKey(nextName)));
    if (duplicate) {
      notify('Já existe uma variável ou alias com essa chave. Use a operação de mescla.');
      return;
    }
    const oldKeys = [selectedVariable.id, selectedVariable.name, ...(selectedVariable.aliases || [])];
    if (nextName !== selectedVariable.name) {
      setDocTemplates((previous) => previous.map((doc) => ({
        ...doc,
        templateContentText: replaceVariableReferences(doc.templateContentText, oldKeys, nextName),
        variables: (doc.variables || []).map((value) => oldKeys.map(normalizeVariableKey).includes(normalizeVariableKey(value)) ? `<<${nextName}>>` : value)
      })));
      setEmailTemplates((previous) => previous.map((email) => ({
        ...email,
        recipient: replaceVariableReferences(email.recipient, oldKeys, nextName),
        subject: replaceVariableReferences(email.subject, oldKeys, nextName),
        body: replaceVariableReferences(email.body, oldKeys, nextName),
        htmlBody: replaceVariableReferences(email.htmlBody, oldKeys, nextName)
      })));
      setFormTemplates((previous) => previous.map((form) => ({
        ...form,
        questions: form.questions.map((question) => oldKeys.map(normalizeVariableKey).includes(normalizeVariableKey(question.fieldKey)) ? { ...question, fieldKey: nextName } : question)
      })));
    }
    const after = {
      ...selectedVariable,
      ...updates,
      name: nextName,
      aliases: Array.from(new Set([...(selectedVariable.aliases || []), ...(nextName !== selectedVariable.name ? [selectedVariable.name] : [])]))
    };
    setMatrixColumns((previous) => previous.map((column) => column.id === selectedVariable.id ? after : column));
    setVariableDraft(after);
    recordAudit(createAuditEntry('VARIABLE_UPDATED', 'variable', selectedVariable.id, `Variável ${selectedVariable.name} atualizada e propagada.`, actorEmail, { before, after }));
  };

  const buildVariableMergeImpact = (sourceVariable: MatrixColumn, targetVariable: MatrixColumn) => {
    const artifacts = { matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates };
    const sourceUsage = getVariableUsage([sourceVariable.id, sourceVariable.name, ...(sourceVariable.aliases || [])], artifacts);
    const targetUsage = getVariableUsage([targetVariable.id, targetVariable.name, ...(targetVariable.aliases || [])], artifacts);
    const affectedArtifacts = Array.from(new Set([...sourceUsage.documents, ...sourceUsage.emails, ...sourceUsage.forms]));
    const sourceFormat = sourceVariable.format || {};
    const targetFormat = targetVariable.format || {};
    const formatChanges = JSON.stringify(sourceFormat) !== JSON.stringify(targetFormat);
    return { sourceUsage, targetUsage, affectedArtifacts, formatChanges, sourceFormat, targetFormat };
  };

  const variableMergeImpact = useMemo(() => {
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) return null;
    const sourceVariable = matrixColumns.find((column) => column.id === mergeSourceId);
    const targetVariable = matrixColumns.find((column) => column.id === mergeTargetId);
    return sourceVariable && targetVariable ? buildVariableMergeImpact(sourceVariable, targetVariable) : null;
  }, [mergeSourceId, mergeTargetId, matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates]);

  const handleMergeVariables = async () => {
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) return;
    const sourceVariable = matrixColumns.find((column) => column.id === mergeSourceId);
    const targetVariable = matrixColumns.find((column) => column.id === mergeTargetId);
    if (!sourceVariable || !targetVariable) return;
    const impact = buildVariableMergeImpact(sourceVariable, targetVariable);
    const details = [
      `${impact.sourceUsage.documents.length} documento(s)`,
      `${impact.sourceUsage.emails.length} e-mail(s)`,
      `${impact.sourceUsage.forms.length} formulário(s)`,
      `${impact.affectedArtifacts.length} artefato(s) único(s)`
    ].join(' · ');
    const formattingNote = impact.formatChanges
      ? ' A formatação das duas variáveis difere; após a mescla prevalece a formatação da variável principal.'
      : '';
    if (!(await portalConfirm(`Mesclar “${sourceVariable.label || sourceVariable.name}” em “${targetVariable.label || targetVariable.name}”? Impacto: ${details}.${formattingNote} A chave antiga será mantida como alias e as referências serão reescritas.`))) return;
    const merged = mergeVariableAcrossArtifacts({ matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates }, sourceVariable.id, targetVariable.id);
    setMatrixColumns(merged.matrixColumns);
    setMatrixRows(merged.matrixRows);
    setDocTemplates(merged.docTemplates);
    setEmailTemplates(merged.emailTemplates);
    setFormTemplates(merged.formTemplates);
    setSelectedVariableId(targetVariable.id);
    setMergeSourceId('');
    setMergeTargetId('');
    recordAudit(createAuditEntry('VARIABLE_MERGED', 'variable', targetVariable.id, `${sourceVariable.name} foi mesclada em ${targetVariable.name} após conferência explícita do impacto; todas as referências foram reescritas.`, actorEmail, {
      before: sourceVariable, after: { target: targetVariable, impact }, affectedArtifacts: merged.affectedArtifacts
    }));
    notify(`Mescla concluída em ${merged.affectedArtifacts.length} artefato(s).`);
  };

  const deleteSelectedVariable = async () => {
    if (!selectedVariable) return;
    const usage = getVariableUsage([selectedVariable.id, selectedVariable.name, ...(selectedVariable.aliases || [])], { matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates });
    const affected = [...usage.documents, ...usage.emails, ...usage.forms];
    if (affected.length) {
      notify(`Exclusão bloqueada: a variável ainda é usada em ${affected.length} artefato(s). Mescle-a com uma variável substituta primeiro.`);
      return;
    }
    if (!(await portalConfirm(`Arquivar a variável "${selectedVariable.name}"? Ela não possui vínculos ativos.`))) return;
    setMatrixColumns((previous) => previous.filter((column) => column.id !== selectedVariable.id));
    setMatrixRows((previous) => previous.map((row) => {
      const fields = { ...row.fields };
      delete fields[selectedVariable.id];
      return { ...row, fields };
    }));
    recordAudit(createAuditEntry('VARIABLE_DELETED', 'variable', selectedVariable.id, `Variável ${selectedVariable.name} excluída da matriz.`, actorEmail, { before: selectedVariable, affectedArtifacts: affected }));
    setSelectedVariableId(matrixColumns.find((column) => column.id !== selectedVariable.id)?.id || '');
  };

  const workflowEvents = [
    ['TCC_CREATED','TCC criado'],['LOCATION_CONFIRMED','Local confirmado'],['INVITATION_SENT','Convite enviado'],
    ['EVALUATION_SUBMITTED','Avaliação concluída'],['PUBLICATION_CLEARED', 'Ata e Termo aplicável assinados e arquivados'],
    ['REPOSITORY_SUBMITTED','Dados finais enviados'],
    ['SIGNATURE_REQUESTED','Assinatura solicitada'],['SIGNATURE_COMPLETED','Assinatura concluída'],['PROCESS_COMPLETED','Processo concluído']
  ] as const;
  const addWorkflowStage = () => {
    const stageNumber=workflowStages.length+1;
    setWorkflowStages(previous=>[...previous,{id:`stage-${Date.now()}`,stageNumber,title:`Nova etapa ${stageNumber}`,triggerEvent:'TCC_CREATED',description:'Descreva a condição e o resultado esperado desta etapa.',actions:[]}]);
    setIsDirty(true);
  };
  const updateWorkflowStage = (id:string,patch:Partial<WorkflowStageItem>) => {setWorkflowStages(previous=>previous.map(stage=>stage.id===id?{...stage,...patch}:stage));setIsDirty(true);};
  const moveWorkflowStage = (index:number,direction:-1|1) => {setWorkflowStages(previous=>{const target=index+direction;if(target<0||target>=previous.length)return previous;const next=[...previous];[next[index],next[target]]=[next[target],next[index]];return next.map((stage,position)=>({...stage,stageNumber:position+1}));});setIsDirty(true);};
  const removeWorkflowStage = (id:string) => {
    if(workflowStages.length<=1){notify('O fluxo precisa manter ao menos uma etapa.');return;}
    setWorkflowStages(previous=>previous.filter(stage=>stage.id!==id).map((stage,index)=>({...stage,stageNumber:index+1})));
    setIsDirty(true);
  };
  const addWorkflowAction = (stageId:string,value:string) => {
    const [type,refId]=value.split(':',2) as ['doc'|'email'|'form'|'action',string];
    if(!type)return;
    const source=type==='doc'?docTemplates.find(item=>item.id===refId):type==='email'?emailTemplates.find(item=>item.id===refId):type==='form'?formTemplates.find(item=>item.id===refId):undefined;
    const title=type==='doc'?(source as DocTemplateItem | undefined)?.label:type==='email'?(source as EmailTemplateItem | undefined)?.name:type==='form'?(source as FormTemplateItem | undefined)?.title:'Ação interna do sistema';
    setWorkflowStages(previous=>previous.map(stage=>stage.id===stageId?{...stage,actions:[...stage.actions,{id:`action-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,type,refId:type==='action'?undefined:refId,title:title||'Nova ação',recipientOrDetail:''}]}:stage));
    setIsDirty(true);
  };
  const updateWorkflowAction = (stageId:string,actionId:string,patch:Partial<WorkflowActionItem>) => {setWorkflowStages(previous=>previous.map(stage=>stage.id===stageId?{...stage,actions:stage.actions.map(action=>action.id===actionId?{...action,...patch}:action)}:stage));setIsDirty(true);};
  const removeWorkflowAction = (stageId:string,actionId:string) => {setWorkflowStages(previous=>previous.map(stage=>stage.id===stageId?{...stage,actions:stage.actions.filter(action=>action.id!==actionId)}:stage));setIsDirty(true);};

  const moveWorkflowAction = (stageId:string, actionIndex:number, direction:-1|1) => {
    setWorkflowStages(previous=>previous.map(stage=>{
      if(stage.id!==stageId)return stage;
      const target=actionIndex+direction;
      if(target<0||target>=stage.actions.length)return stage;
      const actions=[...stage.actions];
      [actions[actionIndex],actions[target]]=[actions[target],actions[actionIndex]];
      return {...stage,actions};
    }));
    setIsDirty(true);
  };

  const setWorkflowDragPayload = (event:React.DragEvent, payload:Record<string,unknown>) => {
    event.dataTransfer.effectAllowed='move';
    event.dataTransfer.setData('application/x-portal-workflow', JSON.stringify(payload));
  };

  const readWorkflowDragPayload = (event:React.DragEvent):Record<string,any>|null => {
    try {
      const raw=event.dataTransfer.getData('application/x-portal-workflow');
      return raw?JSON.parse(raw):null;
    } catch {
      return null;
    }
  };

  const handleWorkflowStageDrop = (event:React.DragEvent, targetStageId:string) => {
    event.preventDefault();
    const payload=readWorkflowDragPayload(event);
    if(!payload)return;
    if(payload.kind==='palette' && typeof payload.value==='string'){
      addWorkflowAction(targetStageId,payload.value);
      return;
    }
    if(payload.kind==='stage' && typeof payload.stageId==='string' && payload.stageId!==targetStageId){
      setWorkflowStages(previous=>{
        const from=previous.findIndex(stage=>stage.id===payload.stageId);
        const to=previous.findIndex(stage=>stage.id===targetStageId);
        if(from<0||to<0)return previous;
        const next=[...previous];
        const [moved]=next.splice(from,1);
        next.splice(to,0,moved);
        return next.map((stage,index)=>({...stage,stageNumber:index+1}));
      });
      setIsDirty(true);
      return;
    }
    if(payload.kind==='action' && typeof payload.stageId==='string' && typeof payload.actionId==='string'){
      setWorkflowStages(previous=>{
        const sourceStage=previous.find(stage=>stage.id===payload.stageId);
        const action=sourceStage?.actions.find(item=>item.id===payload.actionId);
        if(!action)return previous;
        return previous.map(stage=>{
          if(stage.id===payload.stageId && stage.id===targetStageId){
            const actions=stage.actions.filter(item=>item.id!==payload.actionId);
            return {...stage,actions:[...actions,action]};
          }
          if(stage.id===payload.stageId)return {...stage,actions:stage.actions.filter(item=>item.id!==payload.actionId)};
          if(stage.id===targetStageId)return {...stage,actions:[...stage.actions,action]};
          return stage;
        });
      });
      setIsDirty(true);
    }
  };

  const emailPreviewHtml = useMemo(() => {
    if (!selectedEmail) return '';
    const body = selectedEmail.htmlBody?.trim()
      ? selectedEmail.htmlBody
      : `<div style="white-space:pre-wrap">${safeHtmlText(selectedEmail.body || '')}</div>`;
    const logo = selectedEmailDesign.logoUrl || brandKit.courseLogoUrl;
    const hero = selectedEmailDesign.heroImageUrl || brandKit.emailBannerUrl;
    return `<!doctype html><html><body style="margin:0;background:#eef2f6;font-family:${brandKit.fontFamily},Arial,sans-serif;color:${brandKit.textColor}"><div style="max-width:${selectedEmailDesign.contentWidth}px;margin:24px auto;background:#fff;border-radius:${selectedEmailDesign.borderRadius}px;overflow:hidden;border:1px solid #dbe3ea"><div style="padding:20px 24px;background:${brandKit.primaryColor};color:#fff">${logo ? `<img src="${logo}" alt="Logo" style="height:54px;max-width:160px;object-fit:contain;background:#fff;border-radius:8px;padding:4px">` : ''}<div style="font-size:12px;margin-top:10px;letter-spacing:.08em;text-transform:uppercase">${safeHtmlText(brandKit.courseName)}</div></div>${hero ? `<img src="${hero}" alt="Banner" style="width:100%;max-height:220px;object-fit:cover">` : ''}<div style="padding:26px"><h2 style="margin:0 0 18px;color:${brandKit.secondaryColor};font-size:20px">${safeHtmlText(selectedEmail.subject)}</h2><div style="font-size:14px;line-height:1.65">${body}</div>${selectedEmailDesign.buttonLabel ? `<p style="margin:24px 0 0"><a href="#" style="display:inline-block;background:${brandKit.primaryColor};color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">${safeHtmlText(selectedEmailDesign.buttonLabel)}</a></p>` : ''}</div><div style="padding:16px 24px;background:#f5f7f9;border-top:1px solid #e3e8ee;font-size:11px;color:#5b6573">${safeHtmlText(selectedEmailDesign.footerText)}</div></div></body></html>`;
  }, [selectedEmail, selectedEmailDesign, brandKit]);

  const tabs: Array<{ id: StudioTab; label: string; icon: React.ElementType }> = [
    { id: 'models', label: 'Modelos', icon: Layers },
    { id: 'documents', label: 'Documentos', icon: FileText },
    { id: 'emails', label: 'E-mails', icon: Mail },
    { id: 'forms', label: 'Formulários', icon: ClipboardList },
    { id: 'workflow', label: 'Fluxo', icon: Workflow },
    { id: 'variables', label: 'Variáveis', icon: Variable }
  ];

  const variableUsage = selectedVariable
    ? getVariableUsage([selectedVariable.id, selectedVariable.name, ...(selectedVariable.aliases || [])], { matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates })
    : { documents: [], emails: [], forms: [] };

  const similarVariableSuggestions = useMemo(() => {
    const canonical = (value:string) => normalizeVariableKey(value).split('_').filter(Boolean);
    const pairs:Array<{source:MatrixColumn;target:MatrixColumn;score:number;reason:string}> = [];
    for(let i=0;i<matrixColumns.length;i++)for(let j=i+1;j<matrixColumns.length;j++){
      const a=matrixColumns[i],b=matrixColumns[j],aTokens=canonical(a.name),bTokens=canonical(b.name);
      const shared=aTokens.filter(token=>bTokens.includes(token));
      const union=new Set([...aTokens,...bTokens]);
      const tokenScore=union.size?shared.length/union.size:0;
      const aKey=normalizeVariableKey(a.name),bKey=normalizeVariableKey(b.name);
      const prefixScore=aKey.startsWith(bKey)||bKey.startsWith(aKey)?0.82:0;
      const aliasScore=[...(a.aliases||[]),a.name].some(alias=>[...(b.aliases||[]),b.name].map(normalizeVariableKey).includes(normalizeVariableKey(alias)))?1:0;
      const score=Math.max(tokenScore,prefixScore,aliasScore);
      if(score>=0.5)pairs.push({source:a,target:b,score,reason:aliasScore===1?'Alias/chave equivalente':prefixScore?'Chaves com prefixo equivalente':`Vocabulário compartilhado: ${shared.join(', ')}`});
    }
    return pairs.sort((a,b)=>b.score-a.score).slice(0,8);
  }, [matrixColumns]);

  const describeWorkflowAction = (action: WorkflowActionItem): string => {
    if (action.type === 'form') {
      const form = formTemplates.find(item => item.id === action.refId);
      return `libera “${form?.title || action.title}” para ${form?.targetRole || 'o perfil definido'}`;
    }
    if (action.type === 'email') {
      const email = emailTemplates.find(item => item.id === action.refId);
      return `envia “${email?.name || action.title}” para ${email?.recipient || 'destinatários ainda não definidos'}`;
    }
    if (action.type === 'doc') {
      const doc = docTemplates.find(item => item.id === action.refId);
      const type = String(doc?.type || doc?.id || '').toUpperCase();
      if (type.includes('CONVITE')) return `gera o Convite em PDF, arquiva no Drive e não solicita assinatura`;
      if (type.includes('ATA')) return `gera a Ata pelo modelo ativo e envia à Asten para o orientador`;
      if (type.includes('TERMO')) return `gera o Termo somente com publicação e envia à Asten para aluno(s) e orientador, simultaneamente`;
      if (type.includes('DECLARACAO')) return `gera a Declaração e envia à Asten para o Presidente da Comissão`;
      return `gera “${doc?.label || action.title}” pelo modelo ativo do Drive`;
    }
    return `executa uma ação interna; a publicação será bloqueada se não houver executor`;
  };

  return (
    <div className={`portal-workspace portal-studio ${panelClass} mb-5 overflow-hidden`}>
      <div className="portal-studio-heading flex flex-wrap items-center justify-between gap-2 border-b border-[#286a4d] bg-[#337959] px-3 py-2.5 text-white">
        <div><h3 className="text-xs font-black uppercase tracking-wide">Editor de modelos e variáveis</h3><p className="mt-0.5 text-[9px] text-white/80">Selecione uma área acima e trabalhe com seleção, edição e visualização no mesmo contexto.</p></div>
        <div className="flex items-center gap-2"><div className="hidden text-right text-[9px] font-semibold text-white/80 md:block">{isDirty ? (draftSavedAt ? `Rascunho automático ${new Date(draftSavedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` : 'Salvando rascunho…') : (lastSavedAt ? `Publicado ${new Date(lastSavedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` : 'Ainda não publicado')}</div><button type="button" onClick={() => void persistSnapshot(true)} disabled={isSaving} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-white bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-black shadow-sm disabled:opacity-50"><Save className="h-3.5 w-3.5" />{isSaving ? 'Publicando…' : 'Publicar'}</button></div>
      </div>
      <div className="grid min-h-[68vh] md:grid-cols-[220px_minmax(0,1fr)]" style={{ backgroundColor: 'var(--portal-surface-layer-1)' }}>
        <nav className="portal-studio-tabs flex flex-row flex-wrap items-stretch gap-1.5 border-b border-slate-300 p-2.5 md:flex-col md:flex-nowrap md:border-b-0 md:border-r" style={{ backgroundColor: 'var(--portal-surface-layer-2)' }} aria-label="Áreas de modelos e variáveis">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex min-w-[132px] items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-black uppercase transition-colors md:w-full ${selected ? 'text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-[#337959]'}`}
              style={selected ? { backgroundColor: 'var(--portal-green-action)', borderColor: 'var(--portal-green-action-border)' } : undefined}
            ><Icon className="h-3.5 w-3.5 shrink-0"/>{tab.label}</button>;
          })}
        </nav>
        <div className="min-w-0 p-3 sm:p-4" style={{ backgroundColor: 'var(--portal-surface-layer-1)' }}>
        {activeTab === 'models' && <MasterDocumentModelsPanel />}
        {activeTab === 'operation' && <OperationalDesignerPanel studio={buildSnapshot()} config={operationalConfig} onChange={value=>{setOperationalConfig(value);setIsDirty(true);}} onInitialForm={questions=>{setFormTemplates(forms=>forms.map(f=>f.id==='form-reserva-aluno'?{...f,questions}:f));setIsDirty(true);notify('Cadastro sincronizado. Edite os campos na aba Formulários e publique.');}}/>}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                { icon: FileText, value: docTemplates.length, label: 'modelos de documento', color: 'text-slate-800 bg-white border-slate-200 shadow-2xs' },
                { icon: Mail, value: emailTemplates.length, label: 'modelos de e-mail', color: 'text-slate-800 bg-white border-slate-200 shadow-2xs' },
                { icon: ClipboardList, value: formTemplates.length, label: 'formulários integrados', color: 'text-slate-800 bg-white border-slate-200 shadow-2xs' },
                { icon: Variable, value: matrixColumns.length, label: 'variáveis consolidadas', color: 'text-slate-800 bg-white border-slate-200 shadow-2xs' }
              ].map((card) => <div key={card.label} className={`rounded-xl border p-3 ${card.color}`}><card.icon className="mb-2 h-4 w-4 text-slate-700" /><div className="text-xl font-black text-slate-900">{card.value}</div><div className="text-[10px] font-black uppercase text-slate-600">{card.label}</div></div>)}
            </div>

            <section className={`${panelClass} p-4`} aria-labelledby="course-package-readiness-title">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-700"/><h4 id="course-package-readiness-title" className="text-xs font-black uppercase">Validação operacional do portal</h4></div><p className="mt-1 text-[11px] leading-5 text-slate-600">Cruza aparência, modelos externos, formulários, e-mails, variáveis e etapas. Um fluxo incompleto fica em rascunho e não alcança os usuários.</p></div>
                <div className={`rounded-xl border px-4 py-2 text-center ${validationReport.ready ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}><strong className="block text-xl">{validationReport.score}</strong><span className="text-[9px] font-black uppercase">{validationReport.ready ? 'pronto para publicar' : 'publicação bloqueada'}</span></div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{Object.entries(validationReport.summary).map(([area, result]) => { const counts = result as { errors: number; warnings: number }; return <div key={area} className="rounded-xl border border-slate-200 bg-slate-50 p-2"><strong className="block text-[10px] text-slate-800">{area}</strong><span className="text-[10px] text-slate-500">{counts.errors} erro(s) · {counts.warnings} aviso(s)</span></div>; })}</div>
              {validationReport.issues.length > 0 && <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-[10px] font-black uppercase text-slate-700">Ver pendências encontradas ({validationReport.issues.length})</summary><div className="mt-2 space-y-2">{validationReport.issues.slice(0, 30).map((issue, index) => <div key={`${issue.code}-${issue.path}-${index}`} className={`rounded-lg border p-2 text-[10px] ${issue.severity === 'ERROR' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}><strong>{issue.area} · {issue.code}</strong><p className="mt-0.5">{issue.message}</p><code className="mt-1 block text-[9px] opacity-70">{issue.path}</code></div>)}</div></details>}
            </section>

            <section className={`${panelClass} p-4`} aria-labelledby="course-policy-title">
              <div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-slate-700"/><h4 id="course-policy-title" className="text-xs font-black uppercase">Políticas comuns da instalação</h4></div>
              <p className="mt-1 text-[11px] text-slate-600">Configurações institucionais compartilhadas por todas as telas e rotinas deste curso.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label><span className={labelClass}>Idioma padrão</span><select value={operationsPolicy.defaultLocale} onChange={(event) => { setOperationsPolicy(current => ({ ...current, defaultLocale: event.target.value as CourseOperationsPolicy['defaultLocale'], supportedLocales: Array.from(new Set([...current.supportedLocales, event.target.value as CourseOperationsPolicy['defaultLocale']])) })); setIsDirty(true); }} className={inputClass}><option value="pt-BR">Português (Brasil)</option><option value="en-US">English</option><option value="es-ES">Español</option></select></label>
                <label><span className={labelClass}>Fuso horário IANA</span><input value={operationsPolicy.timezone} onChange={(event) => { setOperationsPolicy(current => ({ ...current, timezone: event.target.value })); setIsDirty(true); }} className={inputClass} placeholder="America/Sao_Paulo"/></label>
                <label><span className={labelClass}>Contraste mínimo</span><select value={operationsPolicy.accessibility.minimumContrast} onChange={(event) => { setOperationsPolicy(current => ({ ...current, accessibility: { ...current.accessibility, minimumContrast: event.target.value as 'AA' | 'AAA' } })); setIsDirty(true); }} className={inputClass}><option value="AA">WCAG AA</option><option value="AAA">WCAG AAA</option></select></label>
                <label><span className={labelClass}>Alvo de toque</span><select value={operationsPolicy.accessibility.minimumTargetSize} onChange={(event) => { setOperationsPolicy(current => ({ ...current, accessibility: { ...current.accessibility, minimumTargetSize: Number(event.target.value) as 44 | 48 } })); setIsDirty(true); }} className={inputClass}><option value="44">44 px</option><option value="48">48 px</option></select></label>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex items-center gap-2 rounded-xl border bg-slate-50 p-3 text-[10px] font-bold"><input type="checkbox" checked={operationsPolicy.notifications.emailEnabled} onChange={(event) => { setOperationsPolicy(current => ({ ...current, notifications: { ...current.notifications, emailEnabled: event.target.checked } })); setIsDirty(true); }}/>Notificações por e-mail</label>
                <label className="flex items-center gap-2 rounded-xl border bg-slate-50 p-3 text-[10px] font-bold"><input type="checkbox" checked={operationsPolicy.notifications.inPortalEnabled} onChange={(event) => { setOperationsPolicy(current => ({ ...current, notifications: { ...current.notifications, inPortalEnabled: event.target.checked } })); setIsDirty(true); }}/>Central no portal</label>
                <label className="flex items-center gap-2 rounded-xl border bg-slate-50 p-3 text-[10px] font-bold"><input type="checkbox" checked={operationsPolicy.accessibility.requireVisibleFocus} onChange={(event) => { setOperationsPolicy(current => ({ ...current, accessibility: { ...current.accessibility, requireVisibleFocus: event.target.checked } })); setIsDirty(true); }}/>Foco visível obrigatório</label>
                <label className="flex items-center gap-2 rounded-xl border bg-slate-50 p-3 text-[10px] font-bold"><input type="checkbox" checked={operationsPolicy.retention.allowLegalHold} onChange={(event) => { setOperationsPolicy(current => ({ ...current, retention: { ...current.retention, allowLegalHold: event.target.checked } })); setIsDirty(true); }}/>Bloqueio legal de exclusão</label>
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
              <div className={`${panelClass} p-4`}>
                <div className="mb-3 flex items-center gap-2"><FolderSync className="h-4 w-4 text-slate-700" /><h4 className="text-xs font-black uppercase text-slate-900">Pasta mestre do Google Drive</h4></div>
                <label className={labelClass}>Link da pasta de modelos</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input value={driveModelosFolderUrl} onChange={(event) => { setDriveModelosFolderUrl(event.target.value); setIsDirty(true); }} className={inputClass} placeholder="https://drive.google.com/drive/folders/..." />
                  <button type="button" onClick={() => void handleDriveScan()} disabled={isScanningDrive} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[10px] font-black uppercase tracking-wide text-slate-800 transition hover:bg-slate-100 shadow-2xs cursor-pointer shrink-0 disabled:bg-slate-100 disabled:text-slate-400"><RefreshCw className={`h-3.5 w-3.5 ${isScanningDrive ? 'animate-spin text-slate-700' : 'text-slate-700'}`} />Varrer e consolidar</button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <button type="button" onClick={onConnectDrive} className={`${actionClass} border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer`}><Cloud className="h-3.5 w-3.5 text-slate-600" />Conectar Google</button>
                  <button type="button" onClick={handleDiscoverVariables} className={`${actionClass} border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer`}><Sparkles className="h-3.5 w-3.5 text-slate-600" />Reindexar variáveis</button>
                  <button type="button" onClick={() => setActiveTab('audit')} className={`${actionClass} border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer`}><History className="h-3.5 w-3.5 text-slate-600" />Ver histórico</button>
                </div>
              </div>
              <div className={`${panelClass} p-4`}>
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-slate-700" /><h4 className="text-xs font-black uppercase text-slate-900">Estado da integração</h4></div>
                <div className="mt-3 space-y-2 text-[11px]">
                  <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">Revisão publicada</span><strong>#{revision}</strong></div>
                  <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">Último salvamento</span><strong>{lastSavedAt ? new Date(lastSavedAt).toLocaleString('pt-BR') : 'Ainda não publicado'}</strong></div>
                  <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">Último Drive</span><strong>{lastDriveSyncAt ? new Date(lastDriveSyncAt).toLocaleString('pt-BR') : 'Ainda não sincronizado'}</strong></div>
                  <div className="flex justify-between"><span className="text-slate-500">Status Drive</span><strong className={lastDriveSyncStatus === 'error' ? 'text-rose-700' : 'text-emerald-700'}>{lastDriveSyncStatus === 'success' ? 'Íntegro' : lastDriveSyncStatus === 'error' ? 'Com erro' : 'Pendente'}</strong></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'brand' && (
          <div className="grid gap-4 xl:grid-cols-[1fr_.85fr]">
            <div className={`${panelClass} space-y-4 p-4`}>
              <div className="flex items-center gap-2"><Palette className="h-4 w-4 text-emerald-700" /><h4 className="text-xs font-black uppercase">Identidade visual institucional</h4></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-950"><strong>Identidade fixa:</strong> Universidade Federal do Espírito Santo · Curso de Graduação em Enfermagem e Obstetrícia. Esta instalação atende exclusivamente à Enfermagem/UFES.</div>
                <div><label className={labelClass}>Logo institucional — URL pública</label><input value={brandKit.universityLogoUrl} onChange={(e) => updateBrand('universityLogoUrl', e.target.value)} className={inputClass} placeholder="https://.../logo-institucional.png" /></div>
                <div><label className={labelClass}>Logo do colegiado — URL ou arquivo</label><input value={brandKit.courseLogoUrl} onChange={(e) => updateBrand('courseLogoUrl', e.target.value)} className={inputClass} /></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {([['universityLogoUrl', 'Enviar logo institucional'], ['courseLogoUrl', 'Enviar logo do curso'], ['emailBannerUrl', 'Enviar banner']] as const).map(([field, label]) => <label key={field} className={`${actionClass} cursor-pointer border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}><Image className="h-3.5 w-3.5" />{label}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => void handleImageFile(e.target.files?.[0], field)} /></label>)}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700"><strong>Cores do site:</strong> use a Personalização do Portal. Este editor não mantém uma paleta paralela.</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className={labelClass}>Fonte institucional</label><select value={brandKit.fontFamily} onChange={(e) => updateBrand('fontFamily', e.target.value as IntegrationBrandKit['fontFamily'])} className={inputClass}>{['Arial', 'Calibri', 'Georgia', 'Times New Roman'].map((font) => <option key={font}>{font}</option>)}</select></div>
                <div><label className={labelClass}>Banner de e-mail/formulário — URL</label><input value={brandKit.emailBannerUrl} onChange={(e) => updateBrand('emailBannerUrl', e.target.value)} className={inputClass} placeholder="https://.../banner.jpg" /></div>
              </div>
              <div><label className={labelClass}>Cabeçalho institucional dos documentos</label><textarea rows={3} value={brandKit.documentHeaderText} onChange={(e) => updateBrand('documentHeaderText', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Rodapé institucional dos documentos</label><textarea rows={2} value={brandKit.documentFooterText} onChange={(e) => updateBrand('documentFooterText', e.target.value)} className={inputClass} /></div>
              <button type="button" onClick={() => { recordAudit(createAuditEntry('BRAND_UPDATED', 'brand', 'global-brand', 'Identidade institucional atualizada.', actorEmail, { after: brandKit })); notify('Identidade institucional aplicada aos editores.'); }} className={`${actionClass} border-emerald-800 bg-emerald-800 text-white hover:bg-emerald-900`}><Check className="h-3.5 w-3.5" />Aplicar identidade</button>
            </div>
            <div className={`${panelClass} overflow-hidden`}>
              <div className="p-5 text-white" style={{ background: `linear-gradient(135deg, ${brandKit.primaryColor}, ${brandKit.secondaryColor})`, fontFamily: brandKit.fontFamily }}>
                <div className="flex items-center gap-3">{brandKit.courseLogoUrl && <img src={brandKit.courseLogoUrl} alt="Logo" className="h-14 w-14 rounded-xl bg-white object-contain p-1" />}<div><div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{brandKit.institutionName}</div><div className="text-lg font-black">{brandKit.courseName}</div></div></div>
              </div>
              <div className="space-y-4 p-5" style={{ fontFamily: brandKit.fontFamily, color: brandKit.textColor }}><span className="rounded-full px-2 py-1 text-[9px] font-black uppercase text-white" style={{ backgroundColor: brandKit.accentColor }}>Identidade ativa</span><h3 className="text-lg font-black">Documento institucional profissional</h3><p className="text-xs leading-relaxed text-slate-600">Esta identidade é reutilizada no cabeçalho dos documentos, na moldura dos e-mails e na apresentação dos formulários.</p><div className="border-t border-slate-200 pt-3 text-[10px] text-slate-500">{brandKit.documentFooterText}</div></div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && selectedDoc && (
          <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
            <div className={`${panelClass} space-y-3 p-4`}>
              <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-orange-700" /><h4 className="text-xs font-black uppercase">Editor de documentos</h4></div><select value={selectedDoc.id} onChange={(e) => setSelectedDocId(e.target.value)} className="max-w-[55%] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-bold">{docTemplates.map((doc) => <option key={doc.id} value={doc.id}>{doc.label}</option>)}</select></div>
              <div className="grid gap-3 sm:grid-cols-2"><div><label className={labelClass}>Título do modelo</label><input value={selectedDoc.label} onChange={(e) => updateSelectedDoc({ label: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>Nome do arquivo</label><input value={selectedDoc.fileName} onChange={(e) => updateSelectedDoc({ fileName: e.target.value })} className={inputClass} /></div></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">O arquivo visual permanece no Google Drive; o Portal substitui apenas as variáveis reconhecidas e preserva a formatação do modelo.{selectedDoc.driveFileUrl && <a href={selectedDoc.driveFileUrl} target="_blank" rel="noreferrer" className="mt-2 block font-black underline">Abrir e editar o modelo no Google Drive</a>}</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-[10px] font-black uppercase text-slate-600">Variáveis reconhecidas neste modelo</div><div className="mt-2 flex flex-wrap gap-1.5">{(selectedDoc.variables || []).map((variable) => <code key={variable} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] text-[#337959]">{variable}</code>)}{!(selectedDoc.variables || []).length && <span className="text-[11px] text-slate-500">As variáveis aparecerão após o cadastro do DOCX oficial.</span>}</div></div>
            </div>
            <div className="rounded-2xl border border-slate-300 bg-slate-100 p-5 sm:p-8"><div className="mx-auto flex min-h-[420px] max-w-[720px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><FileText className="mb-4 h-10 w-10 text-emerald-700"/><strong className="text-base text-slate-900">A aparência vem integralmente do DOCX oficial</strong><p className="mt-3 max-w-lg text-xs leading-6 text-slate-600">Para evitar perda de cabeçalhos, tabelas, assinaturas, margens ou paginação, o portal não reestiliza o modelo. Ele cria uma cópia temporária no Google Docs, substitui somente marcadores explícitos, exporta o PDF e preserva o arquivo original.</p><div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-semibold text-amber-950">Visualize e altere a diagramação diretamente no arquivo do Google Drive. Use este Estúdio para controlar dados, destinatários, regras e sequência.</div></div></div>
          </div>
        )}

        {activeTab === 'emails' && selectedEmail && (
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className={`${panelClass} space-y-3 p-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-amber-700" /><h4 className="text-xs font-black uppercase">Editor profissional de e-mail</h4></div><div className="flex items-center gap-1"><select value={selectedEmail.id} onChange={(e) => setSelectedEmailId(e.target.value)} className="max-w-[220px] rounded-lg border border-slate-300 px-2 py-1.5 text-[10px] font-bold">{emailTemplates.map((email) => <option key={email.id} value={email.id}>{email.name}</option>)}</select><button type="button" onClick={createEmailTemplate} className="portal-action" aria-label="Criar modelo de e-mail"><Plus className="h-3.5 w-3.5"/></button><button type="button" onClick={()=>void deleteSelectedEmail()} disabled={emailTemplates.length<=1} className="portal-action text-rose-700 disabled:opacity-30" aria-label="Excluir modelo de e-mail"><Trash2 className="h-3.5 w-3.5"/></button></div></div>
              <div><label className={labelClass}>Nome da rotina</label><input value={selectedEmail.name} onChange={(e) => updateSelectedEmail({ name: e.target.value })} className={inputClass} /></div>
              <div className="grid gap-3 sm:grid-cols-2"><div><label className={labelClass}>Destinatário</label><input value={selectedEmail.recipient || ''} onChange={(e) => updateSelectedEmail({ recipient: e.target.value })} className={inputClass} placeholder="{{ALUNO_EMAIL}}" /></div><div><label className={labelClass}>Responder para</label><input value={selectedEmail.replyTo || ''} onChange={(e) => updateSelectedEmail({ replyTo: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>CC</label><input value={selectedEmail.cc || ''} onChange={(e) => updateSelectedEmail({ cc: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>CCO</label><input value={selectedEmail.bcc || ''} onChange={(e) => updateSelectedEmail({ bcc: e.target.value })} className={inputClass} /></div></div>
              <div><label className={labelClass}>Assunto</label><input value={selectedEmail.subject} onChange={(e) => updateSelectedEmail({ subject: e.target.value })} className={inputClass} /></div>
              <div><label className={labelClass}>Corpo em texto</label><textarea rows={8} value={selectedEmail.body} onChange={(e) => updateSelectedEmail({ body: e.target.value })} className={inputClass} /></div>
              <details className="rounded-xl border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer text-[10px] font-black uppercase text-slate-700">HTML avançado opcional</summary><textarea rows={7} value={selectedEmail.htmlBody || ''} onChange={(e) => updateSelectedEmail({ htmlBody: e.target.value })} className={`${inputClass} mt-3 font-mono`} placeholder="<p>Conteúdo HTML...</p>" /></details>
              <div className="grid gap-3 sm:grid-cols-2"><div><label className={labelClass}>Logo deste e-mail</label><input value={selectedEmailDesign.logoUrl} onChange={(e) => updateSelectedEmailDesign({ logoUrl: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>Imagem/banner</label><input value={selectedEmailDesign.heroImageUrl} onChange={(e) => updateSelectedEmailDesign({ heroImageUrl: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>Texto do botão</label><input value={selectedEmailDesign.buttonLabel} onChange={(e) => updateSelectedEmailDesign({ buttonLabel: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>Destino do botão</label><input value={selectedEmailDesign.buttonUrl} onChange={(e) => updateSelectedEmailDesign({ buttonUrl: e.target.value })} className={inputClass} /></div></div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className={`${actionClass} cursor-pointer border-slate-300 bg-white text-slate-700`}><Image className="h-3.5 w-3.5" />Enviar logo deste e-mail<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const value = await readTemplateImage(e.target.files?.[0]); if (value) updateSelectedEmailDesign({ logoUrl: value }); }} /></label>
                <label className={`${actionClass} cursor-pointer border-slate-300 bg-white text-slate-700`}><Image className="h-3.5 w-3.5" />Enviar imagem/banner<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const value = await readTemplateImage(e.target.files?.[0]); if (value) updateSelectedEmailDesign({ heroImageUrl: value }); }} /></label>
              </div>
              <div><label className={labelClass}>Rodapé</label><textarea rows={2} value={selectedEmailDesign.footerText} onChange={(e) => updateSelectedEmailDesign({ footerText: e.target.value })} className={inputClass} /></div>
              <div><label className={labelClass}>Anexos gerados pelo Portal</label><select multiple value={selectedEmail.attachments||[]} onChange={(e)=>updateSelectedEmail({attachments:Array.from(e.currentTarget.selectedOptions, (option: HTMLOptionElement) => option.value)})} className={`${inputClass} min-h-24`}>{docTemplates.map(doc=><option key={doc.id} value={doc.id}>{doc.label}</option>)}</select><p className="mt-1 text-[9px] text-slate-500">Use Ctrl/Cmd para selecionar mais de um documento. A etapa do fluxo define quando o e-mail será enviado.</p></div>
            </div>
            <div className={`${panelClass} overflow-hidden bg-slate-200`}><div className="border-b border-slate-300 bg-white px-4 py-3"><div className="text-[10px] font-black uppercase text-slate-500">Pré-visualização protegida</div><div className="mt-1 truncate text-xs font-bold text-slate-800">Assunto: {selectedEmail.subject}</div></div><iframe title="Pré-visualização do e-mail" sandbox="" srcDoc={emailPreviewHtml} className="h-[760px] w-full border-0 bg-slate-100" /></div>
          </div>
        )}

        {activeTab === 'forms' && selectedForm && (
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className={`${panelClass} space-y-3 p-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-sky-700" /><h4 className="text-xs font-black uppercase">Construtor de formulário</h4></div><div className="flex items-center gap-1"><select value={selectedForm.id} onChange={(e) => setSelectedFormId(e.target.value)} className="max-w-[220px] rounded-lg border border-slate-300 px-2 py-1.5 text-[10px] font-bold">{formTemplates.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}</select><button type="button" onClick={createFormTemplate} className="portal-action" aria-label="Criar formulário"><Plus className="h-3.5 w-3.5"/></button><button type="button" onClick={()=>void deleteSelectedForm()} disabled={formTemplates.length<=1} className="portal-action text-rose-700 disabled:opacity-30" aria-label="Excluir formulário"><Trash2 className="h-3.5 w-3.5"/></button></div></div>
              <div><label className={labelClass}>Título</label><input value={selectedForm.title} onChange={(e) => updateSelectedForm({ title: e.target.value })} className={inputClass} /></div>
              <div className="grid gap-3 sm:grid-cols-2"><div><label className={labelClass}>Etapa</label><input value={selectedForm.stage} onChange={(e) => updateSelectedForm({ stage: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>Público</label><select value={selectedForm.targetRole} onChange={(e) => updateSelectedForm({ targetRole: e.target.value as FormTemplateItem['targetRole'] })} className={inputClass}>{['Aluno', 'Orientador', 'Banca', 'Presidente da Comissão'].map((role) => <option key={role}>{role}</option>)}</select></div></div>
              <div><label className={labelClass}>Descrição</label><textarea rows={3} value={selectedForm.description} onChange={(e) => updateSelectedForm({ description: e.target.value })} className={inputClass} /></div>
              <div className="grid gap-3 sm:grid-cols-2"><div><label className={labelClass}>Logo</label><input value={selectedFormDesign.logoUrl} onChange={(e) => updateSelectedFormDesign({ logoUrl: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>Banner</label><input value={selectedFormDesign.bannerImageUrl} onChange={(e) => updateSelectedFormDesign({ bannerImageUrl: e.target.value })} className={inputClass} /></div></div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className={`${actionClass} cursor-pointer border-slate-300 bg-white text-slate-700`}><Image className="h-3.5 w-3.5" />Enviar logo do formulário<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const value = await readTemplateImage(e.target.files?.[0]); if (value) updateSelectedFormDesign({ logoUrl: value }); }} /></label>
                <label className={`${actionClass} cursor-pointer border-slate-300 bg-white text-slate-700`}><Image className="h-3.5 w-3.5" />Enviar banner do formulário<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const value = await readTemplateImage(e.target.files?.[0]); if (value) updateSelectedFormDesign({ bannerImageUrl: value }); }} /></label>
              </div>
              <div><label className={labelClass}>Introdução</label><textarea rows={2} value={selectedFormDesign.introText} onChange={(e) => updateSelectedFormDesign({ introText: e.target.value })} className={inputClass} /></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><span className={labelClass}>Campos, regras e variáveis</span><button type="button" onClick={() => { const id = `question-${Date.now()}`; updateSelectedForm({ questions: [...selectedForm.questions, { id, fieldKey: '', label: 'Novo campo', fieldType: 'text', expectedAnswer: '', required: false, validation: {} }] }); setSelectedQuestionId(id); }} className={`${actionClass} border-[#286a4d] bg-[#337959] text-white`}><Plus className="h-3 w-3" />Adicionar campo</button></div>
                <div className="grid gap-2 lg:grid-cols-[.78fr_1.22fr]">
                  <div className="max-h-[430px] overflow-y-auto rounded-xl border border-slate-300 bg-[var(--portal-surface-layer-2)] p-2">
                    {selectedForm.questions.map((question, index) => <button key={question.id} type="button" onClick={() => setSelectedQuestionId(question.id)} className={`mb-1 flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left ${(selectedQuestionId || selectedForm.questions[0]?.id) === question.id ? 'border-[#286a4d] bg-[#337959] text-white' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'}`}><span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-current/20 bg-white/15 text-[9px] font-black">{index + 1}</span><span className="min-w-0 flex-1"><strong className="block truncate text-[10px]">{question.label || 'Campo sem título'}</strong><span className="block truncate text-[8.5px] opacity-75">{question.fieldKey || 'sem variável'} · {question.fieldType}</span></span></button>)}
                  </div>
                  <div className="min-w-0">{(() => { const index = Math.max(0, selectedForm.questions.findIndex((item) => item.id === selectedQuestionId)); const question = selectedForm.questions[index] || selectedForm.questions[0]; if (!question) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">Adicione um campo para iniciar a edição.</div>; return <div className="space-y-1"><div className="flex justify-end gap-1"><button type="button" className="portal-action" disabled={index===0} onClick={()=>moveSelectedFormQuestion(index,-1)} aria-label={`Mover ${question.label} para cima`}>↑</button><button type="button" className="portal-action" disabled={index===selectedForm.questions.length-1} onClick={()=>moveSelectedFormQuestion(index,1)} aria-label={`Mover ${question.label} para baixo`}>↓</button></div><FormQuestionEditor question={question} index={index} variables={matrixColumns} previousQuestions={selectedForm.questions.slice(0, index)} onChange={(updates) => updateSelectedForm({ questions: selectedForm.questions.map((item) => item.id === question.id ? { ...item, ...updates } : item) })} onDelete={() => { updateSelectedForm({ questions: selectedForm.questions.filter((item) => item.id !== question.id) }); setSelectedQuestionId(selectedForm.questions.find((item) => item.id !== question.id)?.id || ''); }}/></div>; })()}</div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2"><div><label className={labelClass}>Texto do botão</label><input value={selectedFormDesign.submitLabel} onChange={(e) => updateSelectedFormDesign({ submitLabel: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>Mensagem após envio</label><input value={selectedFormDesign.confirmationMessage} onChange={(e) => updateSelectedFormDesign({ confirmationMessage: e.target.value })} className={inputClass} /></div></div>
            </div>
            <div className="rounded-2xl border border-slate-300 bg-slate-200/70 p-4"><div className="mx-auto max-w-xl overflow-hidden rounded-2xl bg-white shadow-lg" style={{ fontFamily: brandKit.fontFamily }}>{selectedFormDesign.bannerImageUrl && <img src={selectedFormDesign.bannerImageUrl} alt="Banner" className="h-36 w-full object-cover" />}<div className="p-6"><div className="mb-5 flex items-start gap-3">{selectedFormDesign.logoUrl && <img src={selectedFormDesign.logoUrl} alt="Logo" className="h-14 w-14 rounded-xl border border-slate-200 object-contain p-1" />}<div><div className="text-[9px] font-black uppercase tracking-wider" style={{ color: brandKit.primaryColor }}>{selectedForm.stage}</div><h3 className="mt-1 text-lg font-black text-slate-900">{selectedForm.title}</h3><p className="mt-1 text-xs text-slate-500">{selectedFormDesign.introText || selectedForm.description}</p></div></div>{selectedFormDesign.showProgress && <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-1/3 rounded-full" style={{ backgroundColor: brandKit.primaryColor }} /></div>}<div className="space-y-4">{selectedForm.questions.map((question, index) => <div key={question.id}><label className="mb-1.5 block text-xs font-bold text-slate-800">{index + 1}. {question.label}{question.required && <span className="ml-1 text-rose-600">*</span>}</label>{question.fieldType === 'textarea' ? <textarea disabled className={inputClass} rows={3} /> : question.fieldType === 'select' || question.fieldType === 'radio' ? <select disabled className={inputClass}><option>Selecione uma opção</option></select> : question.fieldType === 'checkbox' ? <label className="flex items-center gap-2 text-xs"><input type="checkbox" disabled />Confirmar</label> : <input disabled type={question.fieldType === 'date' ? 'date' : question.fieldType === 'number' ? 'number' : question.fieldType === 'email' ? 'email' : question.fieldType === 'file' ? 'file' : 'text'} className={inputClass} placeholder={`Variável: ${question.fieldKey || 'não vinculada'}`} />}</div>)}<button type="button" className="w-full rounded-xl px-4 py-3 text-xs font-black uppercase text-white" style={{ backgroundColor: brandKit.primaryColor }}>{selectedFormDesign.submitLabel}</button></div></div></div></div>
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="space-y-4">
            <div className={`${panelClass} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
              <div><div className="flex items-center gap-2"><Workflow className="h-4 w-4 text-emerald-700"/><h4 className="text-xs font-black uppercase">Fluxo executável</h4></div><p className="mt-1 text-[11px] leading-relaxed text-slate-600">Cada etapa responde a um evento real do processo. Vincule documentos, e-mails e formulários publicados; o servidor valida as referências antes de executar.</p></div>
              <button type="button" onClick={addWorkflowStage} className={`${actionClass} shrink-0 border-emerald-700 bg-emerald-700 text-white`}><Plus className="h-3.5 w-3.5"/>Adicionar etapa</button>
            </div>
            <section className={`${panelClass} p-4`} aria-labelledby="workflow-secretary-mode-title">
              <div className="flex items-center gap-2"><BookOpenCheck className="h-4 w-4 text-emerald-700"/><h4 id="workflow-secretary-mode-title" className="text-xs font-black uppercase">Leitura simples do fluxo</h4></div>
              <p className="mt-1 text-[11px] leading-5 text-slate-600">O portal executa as ações de cima para baixo. Formulários liberam dados, documentos usam o modelo ativo do Drive, a Asten coleta as assinaturas e o Gmail envia somente os anexos já disponíveis.</p>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">{workflowStages.map((stage, stageIndex) => <article key={`summary-${stage.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-[10px] font-black uppercase text-slate-500">Etapa {stageIndex + 1} · quando {workflowEvents.find(([value]) => value === stage.triggerEvent)?.[1] || stage.triggerEvent}</div><p className="mt-1 text-xs leading-5 text-slate-800">{stage.actions.length ? stage.actions.map(describeWorkflowAction).join('; depois, ') : 'nenhuma ação configurada.'}</p></article>)}</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[
                ['Convite', 'Sem assinatura'], ['Ata', 'Orientador'], ['Termo', 'Aluno(s) + orientador, prioridade 1'], ['Declaração', 'Presidente da Comissão']
              ].map(([document, rule]) => <div key={document} className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><strong className="block text-[10px] uppercase text-emerald-900">{document}</strong><span className="text-[10px] text-emerald-800">{rule}</span></div>)}</div>
            </section>
            <section className={`${panelClass} p-4`} aria-label="Paleta de ações do fluxo">
              <div className="text-[10px] font-black uppercase text-slate-500">Arraste para uma etapa</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {docTemplates.map(item=><button key={`palette-doc-${item.id}`} type="button" draggable onDragStart={event=>setWorkflowDragPayload(event,{kind:'palette',value:`doc:${item.id}`})} className="portal-action cursor-grab"><FileText className="h-3.5 w-3.5"/>{item.label}</button>)}
                {emailTemplates.map(item=><button key={`palette-email-${item.id}`} type="button" draggable onDragStart={event=>setWorkflowDragPayload(event,{kind:'palette',value:`email:${item.id}`})} className="portal-action cursor-grab"><Mail className="h-3.5 w-3.5"/>{item.name}</button>)}
                {formTemplates.map(item=><button key={`palette-form-${item.id}`} type="button" draggable onDragStart={event=>setWorkflowDragPayload(event,{kind:'palette',value:`form:${item.id}`})} className="portal-action cursor-grab"><ClipboardList className="h-3.5 w-3.5"/>{item.title}</button>)}
                <button type="button" draggable onDragStart={event=>setWorkflowDragPayload(event,{kind:'palette',value:'action:internal'})} className="portal-action cursor-grab"><Settings2 className="h-3.5 w-3.5"/>Ação interna</button>
              </div>
              <p className="mt-2 text-[9px] text-slate-500">Também é possível usar os seletores e setas abaixo; o arrastar e soltar é um atalho, não a única forma de operar.</p>
            </section>
            <div className="space-y-3">
              {workflowStages.map((stage,index)=><div key={stage.id} draggable onDragStart={event=>setWorkflowDragPayload(event,{kind:'stage',stageId:stage.id})} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='move';}} onDrop={event=>handleWorkflowStageDrop(event,stage.id)} className={`${panelClass} overflow-hidden`}>
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 p-3">
                  <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[9px] font-black text-white">ETAPA {index+1}</span>
                  <input aria-label="Título da etapa" value={stage.title} onChange={event=>updateWorkflowStage(stage.id,{title:event.target.value})} className={`${inputClass} min-w-[220px] flex-1 font-bold`}/>
                  <button type="button" onClick={()=>moveWorkflowStage(index,-1)} disabled={index===0} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold disabled:opacity-30">↑</button>
                  <button type="button" onClick={()=>moveWorkflowStage(index,1)} disabled={index===workflowStages.length-1} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold disabled:opacity-30">↓</button>
                  <button type="button" onClick={()=>setExpandedWorkflowStageId(expandedWorkflowStageId === stage.id ? '' : stage.id)} className="rounded-lg border border-[#286a4d] bg-[#337959] px-2.5 py-1 text-[9px] font-black uppercase text-white">{expandedWorkflowStageId === stage.id ? 'Recolher' : 'Editar'}</button><button type="button" onClick={()=>removeWorkflowStage(stage.id)} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700"><Trash2 className="h-3.5 w-3.5"/></button>
                </div>
                <div className={`${expandedWorkflowStageId === stage.id ? 'block' : 'hidden'} space-y-3 p-4`}>
                  <div className="grid gap-3 md:grid-cols-[.8fr_1.2fr]"><div><label className={labelClass}>Evento disparador</label><input list={`workflow-event-catalog-${stage.id}`} value={stage.triggerEvent} onChange={event=>updateWorkflowStage(stage.id,{triggerEvent:event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g,'_')})} className={inputClass} placeholder="Ex.: FORM_AVALIACAO_SUBMITTED"/><datalist id={`workflow-event-catalog-${stage.id}`}>{workflowEvents.map(([value,label])=><option key={value} value={value}>{label}</option>)}</datalist><p className="mt-1 text-[9px] text-slate-500">Para formulário personalizado, use FORM_ID_DO_FORMULARIO_SUBMITTED.</p></div><div><label className={labelClass}>Objetivo da etapa</label><input value={stage.description} onChange={event=>updateWorkflowStage(stage.id,{description:event.target.value})} className={inputClass}/></div></div>
                  <div className="space-y-2"><div className="text-[10px] font-black uppercase text-slate-500">Ações em ordem</div>{stage.actions.map((action,actionIndex)=><div key={action.id} draggable onDragStart={event=>{event.stopPropagation();setWorkflowDragPayload(event,{kind:'action',stageId:stage.id,actionId:action.id});}} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="grid gap-2 md:grid-cols-[auto_.8fr_1fr_auto]"><span className="self-center rounded-full bg-white px-2 py-1 text-[9px] font-black text-slate-500">{actionIndex+1}</span><div className="flex gap-1"><button type="button" aria-label={`Mover ${action.title} para cima`} disabled={actionIndex===0} onClick={()=>moveWorkflowAction(stage.id,actionIndex,-1)} className="portal-action">↑</button><button type="button" aria-label={`Mover ${action.title} para baixo`} disabled={actionIndex===stage.actions.length-1} onClick={()=>moveWorkflowAction(stage.id,actionIndex,1)} className="portal-action">↓</button></div><input value={action.title} onChange={event=>updateWorkflowAction(stage.id,action.id,{title:event.target.value})} className={inputClass}/><input value={action.recipientOrDetail||''} onChange={event=>updateWorkflowAction(stage.id,action.id,{recipientOrDetail:event.target.value})} className={inputClass} placeholder="Destinatário ou detalhe"/><button type="button" onClick={()=>removeWorkflowAction(stage.id,action.id)} className="rounded-lg border border-rose-200 bg-white p-2 text-rose-700"><Trash2 className="h-3.5 w-3.5"/></button></div><details className="mt-2 rounded-lg border border-slate-200 bg-white p-2"><summary className="cursor-pointer text-[9px] font-black uppercase text-slate-600">Condição para executar</summary><div className="mt-2 grid gap-2 sm:grid-cols-3"><select value={action.condition?.fieldKey||''} onChange={event=>updateWorkflowAction(stage.id,action.id,{condition:event.target.value?{fieldKey:event.target.value,operator:action.condition?.operator||'EQUALS',value:action.condition?.value||''}:undefined})} className={inputClass}><option value="">Sempre executar</option>{matrixColumns.map(item=><option key={item.id} value={normalizeVariableKey(item.name)}>{item.label||item.name}</option>)}</select>{action.condition&&<><select value={action.condition.operator} onChange={event=>updateWorkflowAction(stage.id,action.id,{condition:{...action.condition!,operator:event.target.value as any}})} className={inputClass}><option value="EQUALS">É igual a</option><option value="NOT_EQUALS">É diferente de</option><option value="CONTAINS">Contém</option><option value="NOT_EMPTY">Foi preenchido</option><option value="IS_TRUE">É verdadeiro</option></select>{!['NOT_EMPTY','IS_TRUE'].includes(action.condition.operator)&&<input value={action.condition.value||''} onChange={event=>updateWorkflowAction(stage.id,action.id,{condition:{...action.condition!,value:event.target.value}})} className={inputClass} placeholder="Valor esperado"/>}</>}</div></details></div>)}</div>
                  <div><label className={labelClass}>Adicionar ação vinculada</label><select value="" onChange={event=>{if(event.target.value)addWorkflowAction(stage.id,event.target.value);}} className={inputClass}><option value="">Selecione documento, e-mail ou formulário…</option><optgroup label="Documentos">{docTemplates.map(item=><option key={item.id} value={`doc:${item.id}`}>{item.label}</option>)}</optgroup><optgroup label="E-mails">{emailTemplates.map(item=><option key={item.id} value={`email:${item.id}`}>{item.name}</option>)}</optgroup><optgroup label="Formulários">{formTemplates.map(item=><option key={item.id} value={`form:${item.id}`}>{item.title}</option>)}</optgroup></select></div>
                </div>
              </div>)}
            </div>
          </div>
        )}

        {activeTab === 'variables' && (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
              <div className={`${panelClass} p-4`}><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#337959]" /><h4 className="text-xs font-black uppercase">Descoberta e consolidação</h4></div><p className="mt-2 text-[11px] leading-relaxed text-slate-600">A varredura cruza modelos do Drive, documentos, assuntos/corpos de e-mail e perguntas dos formulários. Chaves equivalentes são reutilizadas em vez de solicitar a informação novamente.</p><div className="mt-3 flex gap-2"><input value={newVariableKey} onChange={(e) => setNewVariableKey(e.target.value)} className={inputClass} placeholder="Ex.: ALUNO_NOME_COMPLETO" /><button type="button" onClick={handleCreateVariable} className={`${actionClass} shrink-0 border-[#286a4d] bg-[#337959] text-white`}><Plus className="h-3.5 w-3.5" />Criar</button></div><button type="button" onClick={handleDiscoverVariables} className={`${actionClass} mt-2 w-full border-slate-300 bg-white text-slate-800`}><RefreshCw className="h-3.5 w-3.5" />Levantar variáveis automaticamente</button></div>
              <div className={`${panelClass} p-4`}><div className="flex items-center gap-2"><Merge className="h-4 w-4 text-emerald-700" /><h4 className="text-xs font-black uppercase">Mesclar sem duplicar requisições</h4></div><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto]"><select value={mergeSourceId} onChange={(e) => setMergeSourceId(e.target.value)} className={inputClass}><option value="">Variável duplicada</option>{matrixColumns.map((column, cIdx) => <option key={`source-${column.id}-${cIdx}`} value={column.id}>{column.label || column.name}</option>)}</select><div className="self-center text-center text-xs font-black text-slate-400">→</div><select value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)} className={inputClass}><option value="">Variável principal</option>{matrixColumns.map((column, cIdx) => <option key={`target-${column.id}-${cIdx}`} value={column.id}>{column.label || column.name}</option>)}</select><button type="button" onClick={handleMergeVariables} disabled={!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId} className={`${actionClass} border-emerald-800 bg-emerald-800 text-white`}><Merge className="h-3.5 w-3.5" />Mesclar</button></div>{variableMergeImpact && <div className="mt-3 rounded-xl border border-slate-300 bg-white p-3 text-[10px] leading-relaxed text-slate-900"><div className="flex items-center gap-1.5 font-black uppercase"><CircleAlert className="h-3.5 w-3.5"/>Impacto antes da mescla</div><p className="mt-1">A variável descartada aparece em <strong>{variableMergeImpact.affectedArtifacts.length}</strong> artefato(s): {variableMergeImpact.sourceUsage.documents.length} documento(s), {variableMergeImpact.sourceUsage.emails.length} e-mail(s) e {variableMergeImpact.sourceUsage.forms.length} formulário(s).</p>{variableMergeImpact.affectedArtifacts.length > 0 && <p className="mt-1 break-words text-slate-700">{variableMergeImpact.affectedArtifacts.slice(0, 8).join(' · ')}{variableMergeImpact.affectedArtifacts.length > 8 ? ' …' : ''}</p>}{variableMergeImpact.formatChanges && <p className="mt-1 font-bold text-amber-800">A formatação das duas variáveis difere. Após a mescla prevalece a formatação da variável principal.</p>}</div>}<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-900"><strong>Operação auditável:</strong> a chave descartada vira alias da principal e todas as referências em documentos, e-mails, formulários e matriz são reescritas somente após confirmação explícita.</div></div>
            </div>
            <div className="grid gap-4 xl:grid-cols-[.75fr_1.25fr]">
              <div className={`${panelClass} max-h-[620px] overflow-y-auto p-2`}><div className="sticky top-0 z-10 bg-white p-2"><div className="text-[10px] font-black uppercase text-slate-500">{matrixColumns.length} variáveis registradas</div></div>{matrixColumns.map((column, cIdx) => { const usage = getVariableUsage([column.id, column.name, ...(column.aliases || [])], { matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates }); const count = usage.documents.length + usage.emails.length + usage.forms.length; return <button key={`varbtn-${column.id}-${cIdx}`} type="button" onClick={() => setSelectedVariableId(column.id)} className={`mb-1 w-full rounded-xl border p-3 text-left transition ${selectedVariable?.id === column.id ? 'border-[#286a4d] bg-[#e1e6e9] shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'}`}><div className="flex items-center justify-between gap-2"><div className="truncate text-xs font-black text-slate-900">{column.label || column.name}</div><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">{count} usos</span></div><code className="mt-1 block truncate text-[9px] text-[#337959]">&lt;&lt;{normalizeVariableKey(column.name)}&gt;&gt;</code></button>; })}</div>
              {selectedVariable && variableDraft && <div className={`${panelClass} space-y-4 p-4`}>
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Variable className="h-4 w-4 text-[#337959]" /><h4 className="text-xs font-black uppercase">Definição da variável</h4></div><button type="button" onClick={deleteSelectedVariable} aria-label="Excluir variável selecionada" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className={labelClass}>Chave técnica</label><input value={variableDraft.name} onChange={(e) => setVariableDraft({ ...variableDraft, name: e.target.value })} className={`${inputClass} font-mono`} /></div>
                  <div><label className={labelClass}>Nome legível</label><input value={variableDraft.label || ''} onChange={(e) => setVariableDraft({ ...variableDraft, label: e.target.value })} className={inputClass} /></div>
                  <div><label className={labelClass}>Tipo de dado</label><select value={variableDraft.dataType || 'text'} onChange={(e) => setVariableDraft({ ...variableDraft, dataType: e.target.value as MatrixColumn['dataType'] })} className={inputClass}>{['text', 'date', 'email', 'number', 'url'].map((type) => <option key={type}>{type}</option>)}</select></div>
                  <div><label className={labelClass}>Aliases (separados por vírgula)</label><input value={(variableDraft.aliases || []).join(', ')} onChange={(e) => setVariableDraft({ ...variableDraft, aliases: e.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} className={inputClass} /></div>
                </div>
                <div><label className={labelClass}>Descrição e regra de preenchimento</label><textarea rows={2} value={variableDraft.description || ''} onChange={(e) => setVariableDraft({ ...variableDraft, description: e.target.value })} className={inputClass} /></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] font-bold"><input type="checkbox" checked={!!variableDraft.format?.bold} onChange={(e) => setVariableDraft({ ...variableDraft, format: { ...variableDraft.format, bold: e.target.checked } })} />Negrito</label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] font-bold"><input type="checkbox" checked={!!variableDraft.format?.italic} onChange={(e) => setVariableDraft({ ...variableDraft, format: { ...variableDraft.format, italic: e.target.checked } })} />Itálico</label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-[10px] font-bold"><input type="color" value={variableDraft.format?.color || brandKit.primaryColor} onChange={(e) => setVariableDraft({ ...variableDraft, format: { ...variableDraft.format, color: e.target.value } })} className="h-8 w-10" />Cor no modelo</label>
                </div>
                <button type="button" onClick={() => updateVariableAndPropagate(variableDraft)} className={`${actionClass} border-[#286a4d] bg-[#337959] text-white hover:bg-violet-800`}><Save className="h-3.5 w-3.5" />Salvar e propagar variável</button>
                <div className="grid gap-3 sm:grid-cols-3">{([['Documentos', variableUsage.documents], ['E-mails', variableUsage.emails], ['Formulários', variableUsage.forms]] as const).map(([label, items]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-[9px] font-black uppercase text-slate-500">{label} • {items.length}</div><div className="mt-2 space-y-1">{items.length ? items.map((item) => <div key={item} className="truncate text-[10px] font-bold text-slate-700">• {item}</div>) : <div className="text-[10px] text-slate-400">Nenhum uso</div>}</div></div>)}</div>
              </div>}
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><div className={`${panelClass} p-4`}><FileClock className="h-4 w-4 text-slate-600" /><div className="mt-2 text-xl font-black">{auditTrail.length}</div><div className="text-[9px] font-black uppercase text-slate-500">eventos registrados</div></div><div className={`${panelClass} p-4`}><Merge className="h-4 w-4 text-[#337959]" /><div className="mt-2 text-xl font-black">{auditTrail.filter((item) => item.action === 'VARIABLE_MERGED').length}</div><div className="text-[9px] font-black uppercase text-slate-500">mesclas de variável</div></div><div className={`${panelClass} p-4`}><Cloud className="h-4 w-4 text-emerald-700" /><div className="mt-2 text-xl font-black">{auditTrail.filter((item) => item.entityType === 'drive').length}</div><div className="text-[9px] font-black uppercase text-slate-500">operações no Drive</div></div></div><div className={`${panelClass} overflow-hidden`}><div className="border-b border-slate-200 bg-slate-50 px-4 py-3"><h4 className="text-xs font-black uppercase text-slate-900">Registro imutável de alterações do estúdio</h4><p className="mt-1 text-[10px] text-slate-500">Cada evento registra autor, data, entidade e artefatos atingidos. O histórico é publicado junto com a configuração central.</p></div><div className="max-h-[620px] overflow-auto"><table className="w-full border-collapse text-left"><thead className="sticky top-0 z-10 bg-slate-100 text-[9px] font-black uppercase text-slate-600"><tr><th className="p-3">Data</th><th className="p-3">Ação</th><th className="p-3">Descrição</th><th className="p-3">Autor</th><th className="p-3">Impacto</th></tr></thead><tbody className="divide-y divide-slate-100">{auditTrail.map((entry) => <tr key={entry.id} className="bg-white text-[10px]"><td className="whitespace-nowrap p-3 text-slate-500">{new Date(entry.timestamp).toLocaleString('pt-BR')}</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 font-black text-slate-700">{formatAuditAction(entry.action)}</span></td><td className="max-w-md p-3 font-medium text-slate-700">{entry.description}</td><td className="p-3 text-slate-500">{entry.actorEmail}</td><td className="p-3 font-bold text-slate-600">{entry.affectedArtifacts?.length || 0} artefato(s)</td></tr>)}{auditTrail.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-xs text-slate-400">O primeiro salvamento ou sincronização iniciará o histórico.</td></tr>}</tbody></table></div></div></div>
        )}
        </div>
      </div>
    </div>
  );
};
