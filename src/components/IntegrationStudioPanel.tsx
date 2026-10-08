import { portalConfirm } from '../services/portalDialogs';
import { upgradeStudioDraft } from '../utils/studioUpgrade';
import { OperationalDesignerPanel } from './OperationalDesignerPanel';
import { operationalConfig as resolveOperationalConfig } from '../utils/operationalConfig';
import type { OperationalConfig } from '../types/operationalConfig';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
import {
  Activity,
  AtSign,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Cloud,
  Eye,
  FileClock,
  FileText,
  FolderSync,
  History,
  Image,
  Link,
  Mail,
  Merge,
  Palette,
  Pencil,
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
import { SettingsWorkspaceHeaderPortal } from './SettingsWorkspaceModal';
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

type StudioTab = 'operation' | 'overview' | 'brand' | 'documents' | 'emails' | 'forms' | 'workflow' | 'variables' | 'audit';

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
  initialTab?: 'documents' | 'emails' | 'forms' | 'workflow' | 'variables';
  hideTabs?: boolean;
}

const panelClass = 'portal-studio-panel rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-panel)]';
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] text-slate-900 outline-none focus:border-[var(--portal-brand-action)] focus:ring-2 focus:ring-emerald-100';
const labelClass = 'mb-1 block text-[9px] font-black uppercase tracking-wider text-slate-600';
const actionClass = 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wide transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50';

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

const PREVIEW_VARIABLES: Record<string,string> = {
  TITULO:'Segurança do paciente e qualidade da assistência de enfermagem', TCC_TITULO:'Segurança do paciente e qualidade da assistência de enfermagem', TITULO_TRABALHO:'Segurança do paciente e qualidade da assistência de enfermagem', CAMPO_02:'Segurança do paciente e qualidade da assistência de enfermagem',
  ALUNOS_NOMES:'Ana Carolina Souza e Bruno Martins Lima', ALUNO_NOME:'Ana Carolina Souza', NOME_ALUNO:'Ana Carolina Souza', CAMPO_01:'Ana Carolina Souza e Bruno Martins Lima',
  ORIENTADOR_NOME:'Profa. Dra. Maria Silva', CAMPO_03:'Profa. Dra. Maria Silva', DEFESA_DATA_HORA:'15 de outubro de 2026 às 14h', DEFESA_DATA_HORA_EXTENSO:'15 de outubro de 2026 às 14h', CAMPO_04:'15 de outubro de 2026 às 14h',
  DEFESA_LOCAL:'Auditório do CCS — UFES', LOCAL_DEFESA:'Auditório do CCS — UFES', CAMPO_07_LOCAL:'Auditório do CCS — UFES', PROTOCOLO:'2026-999', CAMPO_12:'2026-999'
};
function applyPreviewVariables(value:string):string{
 let out=String(value||'');
 for(const[key,replacement]of Object.entries(PREVIEW_VARIABLES)){
  const escaped=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const patterns=[
   new RegExp('\\{\\{\\s*'+escaped+'\\s*\\}\\}','gi'),
   new RegExp('<<\\s*'+escaped+'\\s*>>','gi'),
   new RegExp('\\[\\[\\s*'+escaped+'\\s*\\]\\]','gi'),
   new RegExp('«\\s*'+escaped+'\\s*»','gi'),
   new RegExp('-'+escaped+'-','gi')
  ];
  for(const pattern of patterns) out=out.replace(pattern,replacement);
 }
 return out;
}
const PdfCanvasPreview: React.FC<{base64?:string;remoteUrl?:string;label:string}> = ({base64,remoteUrl,label}) => {
 const hostRef=useRef<HTMLDivElement|null>(null); const [error,setError]=useState('');
 useEffect(()=>{ let cancelled=false; const host=hostRef.current; if(!host)return; host.replaceChildren(); setError(''); if(!base64&&!remoteUrl)return;
  void (async()=>{try{ let bytes:Uint8Array; if(base64){const bin=atob(base64);bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);}else{const response=await fetch(String(remoteUrl));if(!response.ok)throw new Error('Falha ao carregar o PDF de prévia.');bytes=new Uint8Array(await response.arrayBuffer());}
   const pdf=await getDocument({data:bytes}).promise;if(cancelled)return;for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){const page=await pdf.getPage(pageNumber);if(cancelled)return;const viewport=page.getViewport({scale:1.2});const canvas=document.createElement('canvas');canvas.width=Math.floor(viewport.width);canvas.height=Math.floor(viewport.height);canvas.className='mx-auto mb-4 h-auto max-w-full bg-white shadow-sm';canvas.setAttribute('aria-label',label+' — página '+pageNumber);host.appendChild(canvas);const context=canvas.getContext('2d');if(!context)throw new Error('Canvas indisponível.');await page.render({canvasContext:context,viewport,canvas}).promise;}
  }catch(err){if(!cancelled)setError(err instanceof Error?err.message:'Não foi possível renderizar a prévia.');}})(); return()=>{cancelled=true;host.replaceChildren();};
 },[base64,remoteUrl,label]);
 return <div className="min-h-[420px]">{error?<div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">{error}</div>:null}<div ref={hostRef} className="max-h-[72vh] overflow-auto rounded-xl bg-slate-200 p-4"/></div>;
};

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
      <select aria-label="Variável vinculada" value={question.fieldKey} onChange={event=>onChange({fieldKey:event.target.value,isReuseOfFieldKey:Boolean(event.target.value)})} className={inputClass}>
        <option value="">Selecione a variável…</option>
        {variables.map(variable=><option key={variable.id} value={normalizeVariableKey(variable.name||variable.id)}>{variable.label||variable.name}</option>)}
      </select>
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
    {question.visibleWhen?.fieldKey !== undefined && <div className="mt-2 grid gap-2 rounded-lg border border-slate-300 bg-slate-50 p-2 sm:grid-cols-3"><select value={condition.fieldKey} onChange={(event) => onChange({ visibleWhen: { ...condition, fieldKey: event.target.value } })} className={inputClass}><option value="">Campo anterior…</option>{previousQuestions.filter((item) => item.fieldKey).map((item) => <option key={item.id} value={item.fieldKey}>{item.label}</option>)}</select><select value={condition.operator} onChange={(event) => onChange({ visibleWhen: { ...condition, operator: event.target.value as typeof condition.operator } })} className={inputClass}><option value="EQUALS">É igual a</option><option value="NOT_EQUALS">É diferente de</option><option value="CONTAINS">Contém</option><option value="NOT_EMPTY">Foi preenchido</option><option value="IS_TRUE">Está marcado</option></select>{!['NOT_EMPTY', 'IS_TRUE'].includes(condition.operator) && <input value={condition.value || ''} onChange={(event) => onChange({ visibleWhen: { ...condition, value: event.target.value } })} className={inputClass} placeholder="Valor esperado"/>}</div>}
    <label className="mt-2 block text-xs">Seção do cadastro<input value={question.section || ''} onChange={event=>onChange({section:event.target.value})} className={inputClass}/></label>
    <details className="mt-2 rounded-lg border border-slate-200 bg-white p-2"><summary className="cursor-pointer text-[10px] font-black uppercase text-slate-600">Validação avançada</summary><div className="mt-2 grid gap-2 sm:grid-cols-3"><input type="number" min={0} value={validation.minLength ?? ''} onChange={(event) => onChange({ validation: { ...validation, minLength: event.target.value === '' ? undefined : Number(event.target.value) } })} className={inputClass} placeholder="Mín. caracteres"/><input type="number" min={0} value={validation.maxLength ?? ''} onChange={(event) => onChange({ validation: { ...validation, maxLength: event.target.value === '' ? undefined : Number(event.target.value) } })} className={inputClass} placeholder="Máx. caracteres"/><input value={validation.pattern || ''} onChange={(event) => onChange({ validation: { ...validation, pattern: event.target.value } })} className={inputClass} placeholder="Expressão regular"/><input value={validation.errorMessage || ''} onChange={(event) => onChange({ validation: { ...validation, errorMessage: event.target.value } })} className={`${inputClass} sm:col-span-3`} placeholder="Mensagem de erro personalizada"/></div></details>
  </article>;
};

export const IntegrationStudioPanel: React.FC<IntegrationStudioPanelProps> = (props) => {
  const {
    actorEmail, initialStudio, matrixColumns, setMatrixColumns, matrixRows, setMatrixRows,
    docTemplates, setDocTemplates, emailTemplates, setEmailTemplates, formTemplates, setFormTemplates,
    workflowStages, setWorkflowStages, driveModelosFolderUrl, setDriveModelosFolderUrl,
    onConnectDrive, onScanDrive, isScanningDrive, notify, initialTab, hideTabs = false
  } = props;

  const localStudio = useMemo(() => loadLocalStudio(), []);
  const initialMeta = normalizeStudioSettings(initialStudio || localStudio);
  const [activeTab, setActiveTab] = useState<StudioTab>(initialTab || 'documents');
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
  const [showEmailHtmlAdvanced, setShowEmailHtmlAdvanced] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState(formTemplates[0]?.id || '');
  const [selectedVariableId, setSelectedVariableId] = useState(matrixColumns[0]?.id || '');
  const [selectedFormQuestionId, setSelectedFormQuestionId] = useState(formTemplates[0]?.questions?.[0]?.id || '');
  const [editingFormPart, setEditingFormPart] = useState<'title'|'description'|'stage'|'submit'|null>(null);
  const [editingFormQuestionLabelId, setEditingFormQuestionLabelId] = useState('');
  const [showFormFieldComposer, setShowFormFieldComposer] = useState(false);
  const [newFormFieldVariableId, setNewFormFieldVariableId] = useState('');
  const [newFormVariableName, setNewFormVariableName] = useState('');
  const [selectedWorkflowStageId, setSelectedWorkflowStageId] = useState(workflowStages[0]?.id || '');
  const [documentPreview, setDocumentPreview] = useState<{docId:string;base64?:string;remoteUrl?:string;analysis?:unknown}|null>(null);
  const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
  const [documentPreviewError, setDocumentPreviewError] = useState('');
  const documentPreviewRequestRef = useRef(0);
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

  useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);

  const selectedDoc = docTemplates.find((item) => item.id === selectedDocId) || docTemplates[0];
  useEffect(()=>{documentPreviewRequestRef.current+=1;setDocumentPreview(null);setDocumentPreviewError('');setDocumentPreviewLoading(false);},[selectedDocId]);
  const selectedEmail = emailTemplates.find((item) => item.id === selectedEmailId) || emailTemplates[0];
  const selectedForm = formTemplates.find((item) => item.id === selectedFormId) || formTemplates[0];
  useEffect(() => {
    if (!selectedForm) return;
    if (!selectedForm.questions.some((question) => question.id === selectedFormQuestionId)) {
      setSelectedFormQuestionId(selectedForm.questions[0]?.id || '');
    }
  }, [selectedForm?.id, selectedForm?.questions, selectedFormQuestionId]);
  useEffect(() => {
    setEditingFormPart(null);
    setEditingFormQuestionLabelId('');
    setShowFormFieldComposer(false);
    setNewFormFieldVariableId('');
    setNewFormVariableName('');
  }, [selectedForm?.id]);
  const selectedVariable = matrixColumns.find((item) => item.id === selectedVariableId) || matrixColumns[0];
  const selectedEmailDesign = selectedEmail
    ? { ...defaultEmailDesign(selectedEmail.id, brandKit), ...(emailDesigns[selectedEmail.id] || {}) }
    : defaultEmailDesign('', brandKit);
  const selectedFormDesign = selectedForm
    ? { ...defaultFormDesign(selectedForm.id, brandKit), ...(formDesigns[selectedForm.id] || {}) }
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
  const flushDraftRef = useRef<() => void>(()=>{});
  flushDraftRef.current = () => { if(!hasHydratedRef.current||!isDirty||isSaving)return; const draft=buildSnapshot(); draft.revision=revision; draft.savedAt=new Date().toISOString(); draft.publication={status:'DRAFT',publishedRevision:initialMeta.publication?.publishedRevision,publishedAt:initialMeta.publication?.publishedAt,validationScore:validationReport.score}; saveLocalStudio(draft); };
  useEffect(()=>()=>flushDraftRef.current(),[]);

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

  const generateFaithfulDocumentPreview = async () => {
    if(!selectedDoc)return; const raw=String(selectedDoc.type||selectedDoc.id||'').toUpperCase(); const type=(['CONVITE','ATA','TERMO','DECLARACAO'] as const).find(item=>raw.includes(item));
    if(!type){setDocumentPreviewError('Associe este modelo a um tipo oficial antes de gerar a prévia.');return;}
    const requestId=++documentPreviewRequestRef.current; const requestedDocId=selectedDoc.id; setDocumentPreviewLoading(true);setDocumentPreviewError('');
    try{const response=await apiClient.previewDocumentModel(type,buildSnapshot());if(requestId!==documentPreviewRequestRef.current||requestedDocId!==selectedDocId)return;setDocumentPreview({docId:requestedDocId,base64:response.contentBase64,remoteUrl:response.downloadUrl,analysis:response.analysis});}
    catch(error:any){if(requestId===documentPreviewRequestRef.current)setDocumentPreviewError(error?.message||'Não foi possível gerar a prévia fiel.');}
    finally{if(requestId===documentPreviewRequestRef.current)setDocumentPreviewLoading(false);}
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
    const next: EmailTemplateItem={id,name:'Novo e-mail',triggerStage:'',subject:'',body:'',recipient:'',cc:'',bcc:'',attachments:[],attachmentModes:{}};
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

  const variableSimilarityScore = (candidate:string, column:MatrixColumn):number => {
    const candidateKey=normalizeVariableKey(candidate);
    const columnKey=normalizeVariableKey(column.name||column.id);
    if(!candidateKey||!columnKey)return 0;
    if(candidateKey===columnKey)return 1;
    if(candidateKey.includes(columnKey)||columnKey.includes(candidateKey))return .86;
    const a=new Set(candidateKey.split('_').filter(Boolean));
    const b=new Set(columnKey.split('_').filter(Boolean));
    const shared=[...a].filter(token=>b.has(token)).length;
    const union=new Set([...a,...b]).size;
    return union?shared/union:0;
  };

  const createFormVariable = async () => {
    const candidate=normalizeVariableKey(newFormVariableName);
    if(!candidate){notify('Informe o nome da nova variável.');return;}
    const exact=matrixColumns.find(column=>normalizeVariableKey(column.name||column.id)===candidate);
    if(exact){setNewFormFieldVariableId(exact.id);setNewFormVariableName('');notify('Essa variável já existe e foi selecionada.');return;}
    const similar=matrixColumns
      .map(column=>({column,score:variableSimilarityScore(candidate,column)}))
      .filter(item=>item.score>=.48)
      .sort((a,b)=>b.score-a.score)
      .slice(0,4);
    if(similar.length){
      const names=similar.map(item=>item.column.label||item.column.name).join(', ');
      const confirmed=await portalConfirm(`Já existem variáveis semelhantes: ${names}. Deseja criar “${candidate}” mesmo assim?`);
      if(!confirmed)return;
    }
    const id=`var_${candidate.toLowerCase()}_${Date.now().toString(36)}`;
    const label=candidate.toLowerCase().split('_').map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' ');
    const next:MatrixColumn={id,name:candidate,label,dataType:'text',aliases:[],format:{bold:false,italic:false,color:brandKit.primaryColor}};
    setMatrixColumns(previous=>[...previous,next]);
    setNewFormFieldVariableId(id);
    setNewFormVariableName('');
    setIsDirty(true);
    notify(`Variável ${label} criada e selecionada.`);
  };

  const addFormQuestionFromVariable = () => {
    if(!selectedForm)return;
    const variable=matrixColumns.find(column=>column.id===newFormFieldVariableId);
    if(!variable){notify('Selecione uma variável antes de adicionar o campo.');return;}
    const fieldKey=normalizeVariableKey(variable.name||variable.id);
    const existing=selectedForm.questions.find(question=>normalizeVariableKey(question.fieldKey)===fieldKey);
    if(existing){
      setSelectedFormQuestionId(existing.id);
      setEditingFormQuestionLabelId('');
      setShowFormFieldComposer(false);
      notify('Essa variável já está vinculada a um campo deste formulário.');
      return;
    }
    const question:FormQuestionItem={
      id:`question-${Date.now()}`,
      fieldKey,
      label:variable.label||variable.name||fieldKey,
      fieldType:variable.dataType==='date'?'date':variable.dataType==='email'?'email':variable.dataType==='number'?'number':'text',
      expectedAnswer:'',
      required:false,
      validation:{},
      isReuseOfFieldKey:true
    };
    updateSelectedForm({questions:[...selectedForm.questions,question]});
    setSelectedFormQuestionId(question.id);
    setEditingFormQuestionLabelId(question.id);
    setShowFormFieldComposer(false);
    setNewFormFieldVariableId('');
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
    const id=`stage-${Date.now()}`;
    setWorkflowStages(previous=>[...previous,{id,stageNumber,title:`Nova etapa ${stageNumber}`,triggerEvent:'TCC_CREATED',description:'Descreva a condição e o resultado esperado desta etapa.',actions:[]}]);
    setSelectedWorkflowStageId(id);
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
    setWorkflowStages(previous=>previous.map(stage=>{
      if(stage.id!==stageId)return stage;
      const alreadyExists=type==='action'
        ? stage.actions.some(action=>action.type==='action'&&!action.refId)
        : stage.actions.some(action=>action.type===type&&action.refId===refId);
      if(alreadyExists)return stage;
      return {...stage,actions:[...stage.actions,{id:`action-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,type,refId:type==='action'?undefined:refId,title:title||'Nova ação',recipientOrDetail:''}]};
    }));
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

  const emailPreviewHtml = useMemo(() => {
    if (!selectedEmail) return '';
    const previewSubject=applyPreviewVariables(selectedEmail.subject);
    const bodySource=applyPreviewVariables(selectedEmail.htmlBody?.trim()?selectedEmail.htmlBody:selectedEmail.body||'');
    const body = selectedEmail.htmlBody?.trim()?bodySource:`<div style="white-space:pre-wrap">${safeHtmlText(bodySource)}</div>`;
    const courseLogo = selectedEmailDesign.logoUrl || brandKit.courseLogoUrl;
    const universityLogo = brandKit.universityLogoUrl;
    const hero = selectedEmailDesign.heroImageUrl || brandKit.emailBannerUrl;
    const headerText = applyPreviewVariables(selectedEmailDesign.headerText || brandKit.courseName);
    const institutionalGreen = brandKit.primaryColor;
    const institutionalNavy = '#0f172a';
    const logos = [universityLogo, courseLogo].filter((value,index,array)=>value&&array.indexOf(value)===index);
    const logoHtml = logos.length ? `<div style="display:flex;align-items:center;gap:8px;flex:0 0 auto">${logos.map((logo,index)=>`<img src="${logo}" alt="${index===0&&universityLogo?'UFES':'Curso de Enfermagem'}" style="display:block;height:54px;max-width:92px;object-fit:contain;background:#fff;border-radius:9px;padding:3px">`).join('')}</div>` : '';
    return `<!doctype html><html><body style="margin:0;background:#eef2f6;font-family:${brandKit.fontFamily},Arial,sans-serif;color:${brandKit.textColor}"><div style="max-width:${selectedEmailDesign.contentWidth}px;margin:22px auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #c4ced4;box-shadow:0 8px 24px rgba(15,23,42,.08)">${hero ? `<img src="${hero}" alt="Imagem institucional" style="display:block;width:100%;max-height:200px;object-fit:cover">` : ''}<div style="display:flex;align-items:center;gap:16px;padding:16px 20px;background:${institutionalGreen};border-bottom:5px solid #fff">${logoHtml}<div style="min-width:0"><div style="color:#fff;font-size:11px;line-height:1.25;font-weight:800;letter-spacing:.16em;text-transform:uppercase;opacity:.88">UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO</div><div style="margin-top:5px;color:#fff;font-size:16px;line-height:1.25;font-weight:800;text-transform:uppercase">${safeHtmlText(headerText)}</div></div></div><div style="padding:24px 26px"><h2 style="margin:0 0 16px;color:${institutionalNavy};font-size:18px;line-height:1.35">${safeHtmlText(previewSubject)}</h2><div style="font-size:14px;line-height:1.7">${body}</div>${selectedEmailDesign.buttonLabel ? `<p style="margin:22px 0 0"><a href="#" style="display:inline-block;background:${institutionalGreen};color:white;padding:10px 16px;border-radius:7px;text-decoration:none;font-weight:700">${safeHtmlText(selectedEmailDesign.buttonLabel)}</a></p>` : ''}</div><div style="padding:13px 26px;background:#f5f7f9;border-top:1px solid #c4ced4;font-size:11px;line-height:1.5;color:#526273">${safeHtmlText(applyPreviewVariables(selectedEmailDesign.footerText))}</div></div></body></html>`;
  }, [selectedEmail, selectedEmailDesign, brandKit]);

  const tabs: Array<{ id: StudioTab; label: string; icon: React.ElementType }> = [
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

  const selectedWorkflowStage = workflowStages.find(stage => stage.id === selectedWorkflowStageId) || workflowStages[0];
  const selectedWorkflowStageIndex = selectedWorkflowStage ? workflowStages.findIndex(stage => stage.id === selectedWorkflowStage.id) : -1;
  const workflowCatalog = [
    ...docTemplates.map(item => ({ value:`doc:${item.id}`, type:'doc' as const, label:item.label, detail:'Documento' })),
    ...emailTemplates.map(item => ({ value:`email:${item.id}`, type:'email' as const, label:item.name, detail:'E-mail' })),
    ...formTemplates.map(item => ({ value:`form:${item.id}`, type:'form' as const, label:item.title, detail:'Formulário' })),
    { value:'action:internal', type:'action' as const, label:'Ação interna do sistema', detail:'Ação' },
  ];
  const workflowCatalogAction = (stage: WorkflowStageItem, value:string) => {
    if(value.startsWith('existing:'))return stage.actions.find(action=>action.id===value.slice('existing:'.length));
    const [type,refId]=value.split(':',2);
    return stage.actions.find(action => type==='action'
      ? action.type==='action'&&!action.refId
      : action.type===type&&action.refId===refId);
  };
  const toggleWorkflowCatalogItem = (stage:WorkflowStageItem,value:string,checked:boolean) => {
    const existing=workflowCatalogAction(stage,value);
    if(checked){
      if(!existing&&!value.startsWith('existing:'))addWorkflowAction(stage.id,value);
      return;
    }
    if(existing)removeWorkflowAction(stage.id,existing.id);
  };
  const selectedWorkflowRows = selectedWorkflowStage
    ? (() => {
        const matchedIds=new Set<string>();
        const catalogRows=workflowCatalog.map(item=>{
          const action=workflowCatalogAction(selectedWorkflowStage,item.value);
          if(action)matchedIds.add(action.id);
          return {...item,action};
        });
        const preservedRows=selectedWorkflowStage.actions
          .filter(action=>!matchedIds.has(action.id))
          .map(action=>({value:`existing:${action.id}`,type:action.type,label:action.title,detail:'Ação existente',action}));
        return [...catalogRows,...preservedRows];
      })()
    : [];
  return (
    <div className={`portal-workspace portal-studio ${hideTabs ? 'mb-0 overflow-visible border-0 bg-transparent shadow-none' : `${panelClass} mb-5 overflow-hidden`}`}>
      <div className={`${hideTabs ? 'hidden' : 'portal-studio-heading flex flex-wrap items-center justify-between gap-2 border-b border-[var(--portal-brand-action-border)] bg-[var(--portal-brand-action)] px-3 py-2.5 text-white'}`}>
        <div><h3 className="text-xs font-black uppercase tracking-wide">Editor de modelos e variáveis</h3><p className="mt-0.5 text-[9px] text-white/80">Selecione uma área acima e trabalhe com seleção, edição e visualização no mesmo contexto.</p></div>
        <div className="flex items-center gap-2"><div className="hidden text-right text-[9px] font-semibold text-white/80 md:block">{isDirty ? (draftSavedAt ? `Rascunho automático ${new Date(draftSavedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` : 'Salvando rascunho…') : (lastSavedAt ? `Publicado ${new Date(lastSavedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` : 'Ainda não publicado')}</div><button type="button" onClick={() => void persistSnapshot(true)} disabled={isSaving} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-white bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-black shadow-sm disabled:opacity-50"><Save className="h-3.5 w-3.5" />{isSaving ? 'Publicando…' : 'Publicar'}</button></div>
      </div>
      <div className={hideTabs ? 'min-h-[68vh]' : 'min-h-[68vh]'} style={{ backgroundColor: hideTabs ? 'transparent' : 'var(--portal-surface-panel)' }}>
        <nav className={`${hideTabs ? 'hidden' : 'portal-studio-tabs flex flex-wrap items-center gap-1.5 border-b border-slate-300 p-2.5'}`} style={{ backgroundColor: 'var(--portal-surface-card)' }} aria-label="Áreas de modelos e variáveis">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-black uppercase transition-colors ${selected ? 'text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-[var(--portal-brand-action)]'}`}
              style={selected ? { backgroundColor: 'var(--portal-brand-action)', borderColor: 'var(--portal-brand-action-border)' } : undefined}
            ><Icon className="h-3.5 w-3.5 shrink-0"/>{tab.label}</button>;
          })}
        </nav>
        <div className={`min-w-0 ${hideTabs ? 'p-0' : 'p-3 sm:p-4'}`} style={{ backgroundColor: hideTabs ? 'transparent' : 'var(--portal-surface-panel)' }}>
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

            <section className={`${panelClass} p-3`} aria-labelledby="course-package-readiness-title">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-700"/><h4 id="course-package-readiness-title" className="text-xs font-black uppercase">Validação operacional do portal</h4></div><p className="mt-1 text-[11px] leading-5 text-slate-600">Cruza aparência, modelos externos, formulários, e-mails, variáveis e etapas. Um fluxo incompleto fica em rascunho e não alcança os usuários.</p></div>
                <div className={`rounded-xl border px-4 py-2 text-center ${validationReport.ready ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}><strong className="block text-xl">{validationReport.score}</strong><span className="text-[9px] font-black uppercase">{validationReport.ready ? 'pronto para publicar' : 'publicação bloqueada'}</span></div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{Object.entries(validationReport.summary).map(([area, result]) => { const counts = result as { errors: number; warnings: number }; return <div key={area} className="rounded-xl border border-slate-200 bg-slate-50 p-2"><strong className="block text-[10px] text-slate-800">{area}</strong><span className="text-[10px] text-slate-500">{counts.errors} erro(s) · {counts.warnings} aviso(s)</span></div>; })}</div>
              {validationReport.issues.length > 0 && <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-[10px] font-black uppercase text-slate-700">Ver pendências encontradas ({validationReport.issues.length})</summary><div className="mt-2 space-y-2">{validationReport.issues.slice(0, 30).map((issue, index) => <div key={`${issue.code}-${issue.path}-${index}`} className={`rounded-lg border p-2 text-[10px] ${issue.severity === 'ERROR' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}><strong>{issue.area} · {issue.code}</strong><p className="mt-0.5">{issue.message}</p><code className="mt-1 block text-[9px] opacity-70">{issue.path}</code></div>)}</div></details>}
            </section>

            <section className={`${panelClass} p-3`} aria-labelledby="course-policy-title">
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
              <div className={`${panelClass} p-3`}>
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
              <div className={`${panelClass} p-3`}>
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
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700"><strong>Cores do Portal:</strong> a identidade visual do site é definida pelo código. Este editor altera somente os artefatos operacionais do processo.</div>
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
                <div className="flex items-center gap-3">{brandKit.courseLogoUrl && <img src={brandKit.courseLogoUrl} alt="Logo" className="h-11 w-11 rounded-lg bg-white object-contain p-1" />}<div><div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{brandKit.institutionName}</div><div className="text-lg font-black">{brandKit.courseName}</div></div></div>
              </div>
              <div className="space-y-4 p-5" style={{ fontFamily: brandKit.fontFamily, color: brandKit.textColor }}><span className="rounded-full px-2 py-1 text-[9px] font-black uppercase text-white" style={{ backgroundColor: brandKit.accentColor }}>Identidade ativa</span><h3 className="text-lg font-black">Documento institucional profissional</h3><p className="text-xs leading-relaxed text-slate-600">Esta identidade é reutilizada no cabeçalho dos documentos, na moldura dos e-mails e na apresentação dos formulários.</p><div className="border-t border-slate-200 pt-3 text-[10px] text-slate-500">{brandKit.documentFooterText}</div></div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && selectedDoc && (
          <div className="portal-artifact-editor portal-artifact-editor-document grid gap-3 xl:grid-cols-[.9fr_1.1fr]">
            <div className={`${panelClass} space-y-3 p-4`}>
              <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-[var(--portal-brand-action)]" /><h4 className="text-xs font-black uppercase">Editor de documentos</h4></div><select value={selectedDoc.id} onChange={(e) => setSelectedDocId(e.target.value)} className="max-w-[55%] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-bold">{docTemplates.map((doc) => <option key={doc.id} value={doc.id}>{doc.label}</option>)}</select></div>
              <div className="grid gap-3 sm:grid-cols-2"><div><label className={labelClass}>Título do modelo</label><input value={selectedDoc.label} onChange={(e) => updateSelectedDoc({ label: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>Nome do arquivo</label><input value={selectedDoc.fileName} onChange={(e) => updateSelectedDoc({ fileName: e.target.value })} className={inputClass} /></div></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">O arquivo visual permanece no Google Drive; o Portal substitui apenas as variáveis reconhecidas e preserva a formatação do modelo.{selectedDoc.driveFileUrl && <a href={selectedDoc.driveFileUrl} target="_blank" rel="noreferrer" className="mt-2 block font-black underline">Abrir e editar o modelo no Google Drive</a>}</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-[10px] font-black uppercase text-slate-600">Variáveis reconhecidas neste modelo</div><div className="mt-2 flex flex-wrap gap-1.5">{(selectedDoc.variables || []).map((variable) => <code key={variable} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] text-[var(--portal-brand-action)]">{variable}</code>)}{!(selectedDoc.variables || []).length && <span className="text-[11px] text-slate-500">As variáveis aparecerão após o cadastro do DOCX oficial.</span>}</div></div>
            </div>
            <div className="rounded-2xl border border-slate-300 bg-slate-100 p-4 sm:p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><strong className="text-xs uppercase text-slate-900">Prévia fiel do PDF final</strong><p className="mt-1 text-[10px] text-slate-600">Mesmo pipeline oficial do Google Drive, com dados fictícios estáveis; o modelo original não é alterado.</p></div><button type="button" onClick={()=>void generateFaithfulDocumentPreview()} disabled={documentPreviewLoading} className="portal-action border-emerald-700 bg-emerald-700 text-white disabled:opacity-50"><FileText className="h-3.5 w-3.5"/>{documentPreviewLoading?'Gerando…':'Gerar prévia fiel'}</button></div>{documentPreviewError?<div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{documentPreviewError}</div>:null}{documentPreview?.docId===selectedDoc.id?<PdfCanvasPreview base64={documentPreview.base64} remoteUrl={documentPreview.remoteUrl} label={selectedDoc.label}/>:<div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-600">Gere a amostra para conferir margens, cores, paginação, tabelas e substituição das variáveis.</div>}</div>
          </div>
        )}

        {activeTab === 'emails' && selectedEmail && (
          <>
            <SettingsWorkspaceHeaderPortal>
              <button type="button" onClick={()=>setShowEmailHtmlAdvanced(value=>!value)} className="portal-settings-header-pill" aria-pressed={showEmailHtmlAdvanced}>
                <Type className="h-3.5 w-3.5" />
                HTML avançado
              </button>
            </SettingsWorkspaceHeaderPortal>
            <div className="portal-artifact-editor portal-artifact-editor-email grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(420px,.92fr)]">
              <div className="space-y-2.5">
                <section className={`${panelClass} overflow-hidden`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 px-3 py-2.5">
                    <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-[var(--portal-brand-action)]" /><h4 className="text-xs font-black uppercase">Editor profissional de e-mail</h4></div>
                    <div className="flex items-center gap-1">
                      <select value={selectedEmail.id} onChange={(e) => setSelectedEmailId(e.target.value)} className="max-w-[220px] rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[10px] font-bold">{emailTemplates.map((email) => <option key={email.id} value={email.id}>{email.name}</option>)}</select>
                      <button type="button" onClick={createEmailTemplate} className="portal-action rounded-full bg-white" aria-label="Criar modelo de e-mail"><Plus className="h-3.5 w-3.5"/></button>
                      <button type="button" onClick={()=>void deleteSelectedEmail()} disabled={emailTemplates.length<=1} className="portal-action rounded-full bg-white text-rose-700 disabled:opacity-30" aria-label="Excluir modelo de e-mail"><Trash2 className="h-3.5 w-3.5"/></button>
                    </div>
                  </div>

                  <div className="space-y-2 p-3">
                    <details open className="rounded-xl border border-slate-300 bg-[var(--portal-surface-card)]">
                      <summary className="cursor-pointer select-none px-3 py-2 text-[10px] font-black uppercase text-slate-800">Dados do e-mail</summary>
                      <div className="grid gap-2 border-t border-slate-300 p-3 sm:grid-cols-2">
                        <div className="sm:col-span-2"><label className={labelClass}>Nome da rotina</label><input value={selectedEmail.name} onChange={(e) => updateSelectedEmail({ name: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>Destinatário</label><input value={selectedEmail.recipient || ''} onChange={(e) => updateSelectedEmail({ recipient: e.target.value })} className={inputClass} placeholder="<<ALUNO_EMAIL>>" /></div>
                        <div><label className={labelClass}>Responder para</label><input value={selectedEmail.replyTo || ''} onChange={(e) => updateSelectedEmail({ replyTo: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>CC</label><input value={selectedEmail.cc || ''} onChange={(e) => updateSelectedEmail({ cc: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>CCO</label><input value={selectedEmail.bcc || ''} onChange={(e) => updateSelectedEmail({ bcc: e.target.value })} className={inputClass} /></div>
                        <div className="sm:col-span-2"><label className={labelClass}>Assunto</label><input value={selectedEmail.subject} onChange={(e) => updateSelectedEmail({ subject: e.target.value })} className={inputClass} /></div>
                        <div className="sm:col-span-2"><label className={labelClass}>Corpo em texto</label><textarea rows={7} value={selectedEmail.body} onChange={(e) => updateSelectedEmail({ body: e.target.value })} className={inputClass} /></div>
                      </div>
                    </details>

                    <details className="rounded-xl border border-slate-300 bg-[var(--portal-surface-card)]">
                      <summary className="cursor-pointer select-none px-3 py-2 text-[10px] font-black uppercase text-slate-800">Cabeçalho</summary>
                      <div className="grid gap-2 border-t border-slate-300 p-3 sm:grid-cols-2">
                        <div className="sm:col-span-2"><label className={labelClass}>Texto do cabeçalho</label><input value={selectedEmailDesign.headerText} onChange={(e) => updateSelectedEmailDesign({ headerText: e.target.value })} className={inputClass} placeholder="Curso de Graduação em Enfermagem e Obstetrícia" /></div>
                        <div><label className={labelClass}>Logo do curso</label><input value={selectedEmailDesign.logoUrl} onChange={(e) => updateSelectedEmailDesign({ logoUrl: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>Imagem acima do cabeçalho</label><input value={selectedEmailDesign.heroImageUrl} onChange={(e) => updateSelectedEmailDesign({ heroImageUrl: e.target.value })} className={inputClass} /></div>
                        <label className={`${actionClass} cursor-pointer rounded-full border-slate-300 bg-white text-slate-700`}><Image className="h-3.5 w-3.5" />Adicionar logo<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const value = await readTemplateImage(e.target.files?.[0]); if (value) updateSelectedEmailDesign({ logoUrl: value }); }} /></label>
                        <label className={`${actionClass} cursor-pointer rounded-full border-slate-300 bg-white text-slate-700`}><Image className="h-3.5 w-3.5" />Adicionar imagem<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const value = await readTemplateImage(e.target.files?.[0]); if (value) updateSelectedEmailDesign({ heroImageUrl: value }); }} /></label>
                      </div>
                    </details>

                    <details className="rounded-xl border border-slate-300 bg-[var(--portal-surface-card)]">
                      <summary className="cursor-pointer select-none px-3 py-2 text-[10px] font-black uppercase text-slate-800">Rodapé e ação</summary>
                      <div className="grid gap-2 border-t border-slate-300 p-3 sm:grid-cols-2">
                        <div className="sm:col-span-2"><label className={labelClass}>Rodapé</label><textarea rows={2} value={selectedEmailDesign.footerText} onChange={(e) => updateSelectedEmailDesign({ footerText: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>Texto do botão</label><input value={selectedEmailDesign.buttonLabel} onChange={(e) => updateSelectedEmailDesign({ buttonLabel: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>Destino do botão</label><input value={selectedEmailDesign.buttonUrl} onChange={(e) => updateSelectedEmailDesign({ buttonUrl: e.target.value })} className={inputClass} /></div>
                      </div>
                    </details>

                    <details className="rounded-xl border border-slate-300 bg-[var(--portal-surface-card)]">
                      <summary className="cursor-pointer select-none px-3 py-2 text-[10px] font-black uppercase text-slate-800">Anexos <span className="ml-1 font-normal text-slate-500">({(selectedEmail.attachments||[]).length})</span></summary>
                      <div className="grid gap-1.5 border-t border-slate-300 p-3">{docTemplates.map(doc=>{const attached=(selectedEmail.attachments||[]).includes(doc.id);const mode=selectedEmail.attachmentModes?.[doc.id]||'SIGNED';return <div key={doc.id} className={`rounded-lg border px-2.5 py-2 ${attached?'border-[#9bb9a8] bg-white':'border-slate-200 bg-[var(--portal-surface-panel)]'}`}><div className="flex flex-wrap items-center justify-between gap-2"><label className="flex min-w-0 items-center gap-2 text-[10px] font-bold text-slate-800"><input type="checkbox" checked={attached} onChange={(e)=>{const next=e.target.checked?Array.from(new Set([...(selectedEmail.attachments||[]),doc.id])):(selectedEmail.attachments||[]).filter(id=>id!==doc.id);updateSelectedEmail({attachments:next});}}/><span className="truncate">{doc.label}</span></label>{attached&&<select aria-label={`Versão do anexo ${doc.label}`} value={mode} onChange={(e)=>updateSelectedEmail({attachmentModes:{...(selectedEmail.attachmentModes||{}),[doc.id]:e.target.value as 'AVAILABLE'|'SIGNED'}})} className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[9px] font-bold text-slate-700"><option value="AVAILABLE">Anexar quando gerado</option><option value="SIGNED">Somente após assinatura</option></select>}</div></div>;})}</div>
                    </details>

                    {showEmailHtmlAdvanced&&<div className="rounded-xl border border-slate-300 bg-[var(--portal-surface-card)] p-3"><div className="mb-2 flex items-center justify-between"><strong className="text-[10px] uppercase text-slate-800">HTML avançado opcional</strong><span className="text-[9px] text-slate-500">Sobrescreve a composição textual quando preenchido</span></div><textarea rows={8} value={selectedEmail.htmlBody || ''} onChange={(e) => updateSelectedEmail({ htmlBody: e.target.value })} className={`${inputClass} font-mono`} placeholder="<p>Conteúdo HTML...</p>" /></div>}
                  </div>
                </section>
              </div>

              <section className={`${panelClass} overflow-hidden`}>
                <div className="border-b border-slate-300 px-3 py-2.5">
                  <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-[var(--portal-brand-action)]" /><h4 className="text-xs font-black uppercase text-slate-900">Pré-visualização</h4></div>
                  <p className="mt-0.5 truncate text-[9px] text-slate-500">Assunto: {selectedEmail.subject}</p>
                </div>
                <iframe title="Pré-visualização do e-mail" sandbox="" srcDoc={emailPreviewHtml} className="h-[620px] w-full border-0 bg-white" />
              </section>
            </div>
          </>
        )}

        {activeTab === 'forms' && selectedForm && (
          <div className="portal-artifact-editor portal-artifact-editor-form grid gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(380px,.92fr)]">
            <div className={`${panelClass} space-y-2.5 p-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-[var(--portal-brand-action)]" /><h4 className="text-xs font-black uppercase">Construtor de formulário</h4></div><div className="flex items-center gap-1"><select value={selectedForm.id} onChange={(e) => setSelectedFormId(e.target.value)} className="max-w-[220px] rounded-lg border border-slate-300 px-2 py-1.5 text-[10px] font-bold">{formTemplates.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}</select><button type="button" onClick={createFormTemplate} className="portal-action" aria-label="Criar formulário"><Plus className="h-3.5 w-3.5"/></button><button type="button" onClick={()=>void deleteSelectedForm()} disabled={formTemplates.length<=1} className="portal-action text-rose-700 disabled:opacity-30" aria-label="Excluir formulário"><Trash2 className="h-3.5 w-3.5"/></button></div></div>
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
                <div className="flex items-center justify-between"><span className={labelClass}>Campos, regras e variáveis</span><button type="button" onClick={() => updateSelectedForm({ questions: [...selectedForm.questions, { id: `question-${Date.now()}`, fieldKey: '', label: 'Novo campo', fieldType: 'text', expectedAnswer: '', required: false, validation: {} }] })} className={`${actionClass} border-[var(--portal-brand-action-border)] bg-white text-[var(--portal-brand-action)]`}><Plus className="h-3 w-3" />Adicionar campo</button></div>
                <div className="space-y-2"><div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 p-2"><span className="text-[9px] font-black uppercase text-slate-500">Editar campo</span><select value={selectedFormQuestionId} onChange={(e)=>setSelectedFormQuestionId(e.target.value)} className="min-w-[220px] flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-bold">{selectedForm.questions.map((question,index)=><option key={question.id} value={question.id}>{index+1}. {question.label}</option>)}</select></div>{selectedForm.questions.map((question,index)=>question.id===selectedFormQuestionId?<div key={question.id} className="space-y-1"><div className="flex justify-end gap-1"><button type="button" className="portal-action" disabled={index===0} onClick={()=>moveSelectedFormQuestion(index,-1)} aria-label={`Mover ${question.label} para cima`}>↑</button><button type="button" className="portal-action" disabled={index===selectedForm.questions.length-1} onClick={()=>moveSelectedFormQuestion(index,1)} aria-label={`Mover ${question.label} para baixo`}>↓</button></div><FormQuestionEditor question={question} index={index} variables={matrixColumns} previousQuestions={selectedForm.questions.slice(0,index)} onChange={(updates)=>updateSelectedForm({questions:selectedForm.questions.map((item)=>item.id===question.id?{...item,...updates}:item)})} onDelete={()=>updateSelectedForm({questions:selectedForm.questions.filter((item)=>item.id!==question.id)})}/></div>:null)}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2"><div><label className={labelClass}>Texto do botão</label><input value={selectedFormDesign.submitLabel} onChange={(e) => updateSelectedFormDesign({ submitLabel: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>Mensagem após envio</label><input value={selectedFormDesign.confirmationMessage} onChange={(e) => updateSelectedFormDesign({ confirmationMessage: e.target.value })} className={inputClass} /></div></div>
            </div>
            <div className="portal-official-preview rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-panel)] p-3"><div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-[var(--portal-border)] bg-white shadow-sm" style={{ fontFamily: brandKit.fontFamily }}><div className="flex items-center gap-3 border-b-[5px] border-white bg-[var(--portal-brand-header)] px-4 py-3">{(selectedFormDesign.logoUrl || brandKit.universityLogoUrl || brandKit.courseLogoUrl) && <img src={selectedFormDesign.logoUrl || brandKit.universityLogoUrl || brandKit.courseLogoUrl} alt="UFES" className="h-12 w-12 shrink-0 rounded-full bg-white object-contain p-1" />}<div className="min-w-0"><div className="text-[9px] font-black uppercase tracking-[0.14em] text-white/85">UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO</div><div className="mt-1 text-[11px] font-black uppercase leading-tight text-white">{brandKit.courseName}</div></div></div>{selectedFormDesign.bannerImageUrl && <img src={selectedFormDesign.bannerImageUrl} alt="Banner" className="h-28 w-full object-cover" />}<div className="p-4"><div className="mb-3"><div className="text-[9px] font-black uppercase tracking-wider text-[var(--portal-brand-action)]">{selectedForm.stage}</div><h3 className="mt-1 text-lg font-black text-slate-900">{selectedForm.title}</h3><p className="mt-1 text-xs text-slate-500">{selectedFormDesign.introText || selectedForm.description}</p></div>{selectedFormDesign.showProgress && <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-1/3 rounded-full" style={{ backgroundColor: brandKit.primaryColor }} /></div>}<div className="space-y-3">{selectedForm.questions.map((question, index) => <div key={question.id}><label className="mb-1.5 block text-xs font-bold text-slate-800">{index + 1}. {question.label}{question.required && <span className="ml-1 text-rose-600">*</span>}</label>{question.fieldType === 'textarea' ? <textarea disabled className={inputClass} rows={3} /> : question.fieldType === 'select' || question.fieldType === 'radio' ? <select disabled className={inputClass}><option>Selecione uma opção</option></select> : question.fieldType === 'checkbox' ? <label className="flex items-center gap-2 text-xs"><input type="checkbox" disabled />Confirmar</label> : <input disabled type={question.fieldType === 'date' ? 'date' : question.fieldType === 'number' ? 'number' : question.fieldType === 'email' ? 'email' : question.fieldType === 'file' ? 'file' : 'text'} className={inputClass} placeholder={`Variável: ${question.fieldKey || 'não vinculada'}`} />}</div>)}<button type="button" className="w-full rounded-lg px-3 py-2 text-[10px] font-black uppercase text-white" style={{ backgroundColor: brandKit.primaryColor }}>{selectedFormDesign.submitLabel}</button></div></div></div></div>
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="space-y-3 pb-5" data-portal-workflow-editor="true">
            <section
              className="overflow-hidden rounded-xl border border-[var(--portal-border)]"
              style={{ backgroundColor: 'var(--portal-surface-inner)' }}
              aria-labelledby="workflow-timeline-title"
            >
              <div className="flex items-center justify-between px-4 pt-3">
                <div>
                  <h4 id="workflow-timeline-title" className="text-[11px] font-black uppercase tracking-wider text-slate-700">Fluxo do Processo</h4>
                  <p className="mt-0.5 text-[9px] text-slate-500">Selecione uma etapa para editar. A ordem exibida aqui é a ordem do processo.</p>
                </div>
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
                  {workflowStages.length} etapa(s)
                </span>
              </div>

              <div className="overflow-x-auto px-4 pb-3 pt-2">
                <div className="flex min-w-max items-start">
                  {workflowStages.map((stage,index)=>{
                    const selected=stage.id===selectedWorkflowStage?.id;
                    return <React.Fragment key={stage.id}>
                      <button
                        type="button"
                        onClick={()=>setSelectedWorkflowStageId(stage.id)}
                        className="group flex w-28 shrink-0 flex-col items-center text-center"
                        aria-pressed={selected}
                        title={stage.title}
                      >
                        <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black transition-colors ${selected ? 'bg-slate-900 text-white ring-2 ring-emerald-600 ring-offset-1' : 'border border-emerald-700 bg-white text-emerald-800 group-hover:bg-emerald-50'}`}>
                          {index+1}
                        </span>
                        <span className={`mt-1.5 max-w-28 text-[9px] leading-3 ${selected?'font-black text-slate-900':'font-semibold text-slate-600'}`}>
                          {stage.title}
                        </span>
                      </button>
                      <span className="mt-3.5 h-0.5 w-10 shrink-0 bg-emerald-700/70" aria-hidden="true" />
                    </React.Fragment>;
                  })}
                  <button type="button" onClick={addWorkflowStage} className="group flex w-24 shrink-0 flex-col items-center text-center" title="Adicionar etapa" aria-label="Adicionar etapa">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition-colors group-hover:border-emerald-600 group-hover:text-emerald-700"><Plus className="h-3.5 w-3.5"/></span>
                    <span className="mt-1.5 text-[9px] font-black text-slate-600">Adicionar etapa</span>
                  </button>
                </div>
              </div>
            </section>

            {selectedWorkflowStage && (
              <section
                className="overflow-hidden rounded-xl border border-[var(--portal-border)]"
                style={{ backgroundColor: 'var(--portal-surface-panel)' }}
                aria-label={`Configuração da etapa ${selectedWorkflowStageIndex+1}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">Etapa {selectedWorkflowStageIndex+1}</div>
                    <div className="truncate text-xs font-black text-slate-900">{selectedWorkflowStage.title}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={()=>moveWorkflowStage(selectedWorkflowStageIndex,-1)} disabled={selectedWorkflowStageIndex<=0} className="portal-toolbar-icon-button disabled:opacity-30" title="Mover etapa para a esquerda" aria-label="Mover etapa para a esquerda"><ChevronLeft className="h-3.5 w-3.5"/></button>
                    <button type="button" onClick={()=>moveWorkflowStage(selectedWorkflowStageIndex,1)} disabled={selectedWorkflowStageIndex<0||selectedWorkflowStageIndex>=workflowStages.length-1} className="portal-toolbar-icon-button disabled:opacity-30" title="Mover etapa para a direita" aria-label="Mover etapa para a direita"><ChevronRight className="h-3.5 w-3.5"/></button>
                    <button type="button" onClick={()=>removeWorkflowStage(selectedWorkflowStage.id)} className="portal-toolbar-icon-button text-rose-700" title="Excluir etapa" aria-label="Excluir etapa"><Trash2 className="h-3.5 w-3.5"/></button>
                  </div>
                </div>

                <div className="grid gap-2 border-b border-slate-300 p-3 md:grid-cols-[1fr_.9fr_1.2fr]">
                  <div><label className={labelClass}>Título da etapa</label><input value={selectedWorkflowStage.title} onChange={event=>updateWorkflowStage(selectedWorkflowStage.id,{title:event.target.value})} className={inputClass}/></div>
                  <div><label className={labelClass}>Evento disparador</label><input list={`workflow-event-catalog-${selectedWorkflowStage.id}`} value={selectedWorkflowStage.triggerEvent} onChange={event=>updateWorkflowStage(selectedWorkflowStage.id,{triggerEvent:event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g,'_')})} className={inputClass}/><datalist id={`workflow-event-catalog-${selectedWorkflowStage.id}`}>{workflowEvents.map(([value,label])=><option key={value} value={value}>{label}</option>)}</datalist></div>
                  <div><label className={labelClass}>Objetivo da etapa</label><input value={selectedWorkflowStage.description} onChange={event=>updateWorkflowStage(selectedWorkflowStage.id,{description:event.target.value})} className={inputClass}/></div>
                </div>

                <div className="overflow-auto" data-portal-workflow-stage-sheet="true">
                  <table className="w-full min-w-[1180px] border-collapse text-left text-[10px]">
                    <thead>
                      <tr className="text-white" style={{ backgroundColor:'var(--portal-brand-header)' }}>
                        <th className="w-16 border-r border-white/25 px-2 py-2 text-center">Usar</th>
                        <th className="w-24 border-r border-white/25 px-2 py-2 text-center">Ordem</th>
                        <th className="w-28 border-r border-white/25 px-2 py-2">Tipo</th>
                        <th className="min-w-[220px] border-r border-white/25 px-2 py-2">Item / título</th>
                        <th className="min-w-[210px] border-r border-white/25 px-2 py-2">Destinatário / detalhe</th>
                        <th className="min-w-[340px] border-r border-white/25 px-2 py-2">Condição para execução</th>
                        <th className="w-16 px-2 py-2 text-center">Excluir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedWorkflowRows.map((row)=>{
                        const action=row.action;
                        const actionIndex=action?selectedWorkflowStage.actions.findIndex(item=>item.id===action.id):-1;
                        const condition=action?.condition;
                        return <tr key={row.value} className="border-b border-slate-300" style={{ backgroundColor:'var(--portal-surface-panel)' }}>
                          <td className="border-r border-slate-300 px-2 py-2 text-center">
                            <input type="checkbox" checked={Boolean(action)} onChange={event=>toggleWorkflowCatalogItem(selectedWorkflowStage,row.value,event.target.checked)} aria-label={`Usar ${row.label} nesta etapa`} />
                          </td>
                          <td className="border-r border-slate-300 px-2 py-2">
                            {action ? <div className="flex items-center justify-center gap-1"><span className="min-w-5 text-center font-black text-slate-700">{actionIndex+1}</span><button type="button" className="portal-toolbar-icon-button !h-6 !min-h-6 !w-6 !min-w-6" disabled={actionIndex===0} onClick={()=>moveWorkflowAction(selectedWorkflowStage.id,actionIndex,-1)} aria-label={`Mover ${action.title} para cima`}>↑</button><button type="button" className="portal-toolbar-icon-button !h-6 !min-h-6 !w-6 !min-w-6" disabled={actionIndex===selectedWorkflowStage.actions.length-1} onClick={()=>moveWorkflowAction(selectedWorkflowStage.id,actionIndex,1)} aria-label={`Mover ${action.title} para baixo`}>↓</button></div> : <span className="block text-center text-slate-400">—</span>}
                          </td>
                          <td className="border-r border-slate-300 px-2 py-2 font-black uppercase text-slate-600">{row.detail}</td>
                          <td className="border-r border-slate-300 px-2 py-2"><input disabled={!action} value={action?.title||row.label} onChange={event=>action&&updateWorkflowAction(selectedWorkflowStage.id,action.id,{title:event.target.value})} className={inputClass}/></td>
                          <td className="border-r border-slate-300 px-2 py-2"><input disabled={!action} value={action?.recipientOrDetail||''} onChange={event=>action&&updateWorkflowAction(selectedWorkflowStage.id,action.id,{recipientOrDetail:event.target.value})} className={inputClass} placeholder={action?'Detalhe opcional':'Selecione o item'}/></td>
                          <td className="border-r border-slate-300 px-2 py-2">
                            <div className="grid grid-cols-3 gap-1">
                              <select disabled={!action} value={condition?.fieldKey||''} onChange={event=>action&&updateWorkflowAction(selectedWorkflowStage.id,action.id,{condition:event.target.value?{fieldKey:event.target.value,operator:condition?.operator||'EQUALS',value:condition?.value||''}:undefined})} className={inputClass}><option value="">Sempre executar</option>{matrixColumns.map(item=><option key={item.id} value={normalizeVariableKey(item.name)}>{item.label||item.name}</option>)}</select>
                              <select disabled={!action||!condition} value={condition?.operator||'EQUALS'} onChange={event=>action&&condition&&updateWorkflowAction(selectedWorkflowStage.id,action.id,{condition:{...condition,operator:event.target.value as any}})} className={inputClass}><option value="EQUALS">É igual a</option><option value="NOT_EQUALS">É diferente de</option><option value="CONTAINS">Contém</option><option value="NOT_EMPTY">Foi preenchido</option><option value="IS_TRUE">É verdadeiro</option></select>
                              <input disabled={!action||!condition||['NOT_EMPTY','IS_TRUE'].includes(condition.operator)} value={condition?.value||''} onChange={event=>action&&condition&&updateWorkflowAction(selectedWorkflowStage.id,action.id,{condition:{...condition,value:event.target.value}})} className={inputClass} placeholder="Valor"/>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">{action?<button type="button" onClick={()=>removeWorkflowAction(selectedWorkflowStage.id,action.id)} className="portal-toolbar-icon-button !h-6 !min-h-6 !w-6 !min-w-6 text-rose-700" title="Remover item da etapa" aria-label={`Remover ${action.title} da etapa`}><Trash2 className="h-3 w-3"/></button>:<span className="text-slate-400">—</span>}</td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === 'variables' && (
          <div className="space-y-4">
            <div className="portal-studio-variable-maintenance grid gap-2 lg:grid-cols-2">
              <div className={`${panelClass} p-3`}><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--portal-brand-action)]" /><h4 className="text-xs font-black uppercase">Descoberta e consolidação</h4></div><p className="mt-2 text-[11px] leading-relaxed text-slate-600">A varredura cruza modelos do Drive, documentos, assuntos/corpos de e-mail e perguntas dos formulários. Chaves equivalentes são reutilizadas em vez de solicitar a informação novamente.</p><div className="mt-3 flex gap-2"><input value={newVariableKey} onChange={(e) => setNewVariableKey(e.target.value)} className={inputClass} placeholder="Ex.: ALUNO_NOME_COMPLETO" /><button type="button" onClick={handleCreateVariable} className={`${actionClass} shrink-0 border-violet-700 bg-violet-700 text-white`}><Plus className="h-3.5 w-3.5" />Criar</button></div><button type="button" onClick={handleDiscoverVariables} className={`${actionClass} mt-2 w-full border-[#b9cfc2] bg-[#eef4f0] text-[#285f48]`}><RefreshCw className="h-3.5 w-3.5" />Levantar variáveis automaticamente</button></div>
              <div className={`${panelClass} p-3`}><div className="flex items-center gap-2"><Merge className="h-4 w-4 text-emerald-700" /><h4 className="text-xs font-black uppercase">Mesclar sem duplicar requisições</h4></div><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto]"><select value={mergeSourceId} onChange={(e) => setMergeSourceId(e.target.value)} className={inputClass}><option value="">Variável duplicada</option>{matrixColumns.map((column, cIdx) => <option key={`source-${column.id}-${cIdx}`} value={column.id}>{column.label || column.name}</option>)}</select><div className="self-center text-center text-xs font-black text-slate-400">→</div><select value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)} className={inputClass}><option value="">Variável principal</option>{matrixColumns.map((column, cIdx) => <option key={`target-${column.id}-${cIdx}`} value={column.id}>{column.label || column.name}</option>)}</select><button type="button" onClick={handleMergeVariables} disabled={!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId} className={`${actionClass} border-emerald-800 bg-emerald-800 text-white`}><Merge className="h-3.5 w-3.5" />Mesclar</button></div>{variableMergeImpact && <div className="mt-3 rounded-xl border border-slate-300 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-900"><div className="flex items-center gap-1.5 font-black uppercase"><CircleAlert className="h-3.5 w-3.5"/>Impacto antes da mescla</div><p className="mt-1">A variável descartada aparece em <strong>{variableMergeImpact.affectedArtifacts.length}</strong> artefato(s): {variableMergeImpact.sourceUsage.documents.length} documento(s), {variableMergeImpact.sourceUsage.emails.length} e-mail(s) e {variableMergeImpact.sourceUsage.forms.length} formulário(s).</p>{variableMergeImpact.affectedArtifacts.length > 0 && <p className="mt-1 break-words text-slate-700">{variableMergeImpact.affectedArtifacts.slice(0, 8).join(' · ')}{variableMergeImpact.affectedArtifacts.length > 8 ? ' …' : ''}</p>}{variableMergeImpact.formatChanges && <p className="mt-1 font-bold text-amber-800">A formatação das duas variáveis difere. Após a mescla prevalece a formatação da variável principal.</p>}</div>}<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-900"><strong>Operação auditável:</strong> a chave descartada vira alias da principal e todas as referências em documentos, e-mails, formulários e matriz são reescritas somente após confirmação explícita.</div></div>
            </div>
            {similarVariableSuggestions.length > 0 && <div className={`${panelClass} p-3`}><div className="flex items-center gap-2"><WandSparkles className="h-4 w-4 text-[var(--portal-brand-action)]"/><h4 className="text-xs font-black uppercase">Sugestões inteligentes de normalização</h4></div><p className="mt-2 text-[11px] text-slate-600">O Portal destaca chaves potencialmente duplicadas e mostra a semelhança antes de qualquer mescla. Nada é alterado sem confirmação explícita.</p><div className="mt-3 grid gap-2 md:grid-cols-2">{similarVariableSuggestions.map(({source,target,score,reason})=><button key={`similar-${source.id}-${target.id}`} type="button" onClick={()=>{setMergeSourceId(source.id);setMergeTargetId(target.id);}} className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-left hover:border-violet-400"><div className="flex items-center justify-between gap-2"><strong className="text-[11px] text-slate-900">{source.label||source.name} → {target.label||target.name}</strong><span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-[var(--portal-brand-action)]">{Math.round(score*100)}%</span></div><p className="mt-1 text-[10px] text-slate-700">{reason}</p></button>)}</div></div>}
            <div className="grid gap-4 xl:grid-cols-[.75fr_1.25fr]">
              <div className={`${panelClass} max-h-[620px] overflow-y-auto p-2`}><div className="sticky top-0 z-10 bg-white p-2"><div className="text-[10px] font-black uppercase text-slate-500">{matrixColumns.length} variáveis registradas</div></div>{matrixColumns.map((column, cIdx) => { const usage = getVariableUsage([column.id, column.name, ...(column.aliases || [])], { matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates }); const count = usage.documents.length + usage.emails.length + usage.forms.length; return <button key={`varbtn-${column.id}-${cIdx}`} type="button" onClick={() => setSelectedVariableId(column.id)} className={`mb-1 w-full rounded-xl border p-3 text-left transition ${selectedVariable?.id === column.id ? 'border-[var(--portal-brand-action)] bg-[#eef4f0] shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'}`}><div className="flex items-center justify-between gap-2"><div className="truncate text-xs font-black text-slate-900">{column.label || column.name}</div><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">{count} usos</span></div><code className="mt-1 block truncate text-[9px] text-[var(--portal-brand-action)]">&lt;&lt;{normalizeVariableKey(column.name)}&gt;&gt;</code></button>; })}</div>
              {selectedVariable && variableDraft && <div className={`${panelClass} space-y-4 p-4`}>
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Variable className="h-4 w-4 text-[var(--portal-brand-action)]" /><h4 className="text-xs font-black uppercase">Definição da variável</h4></div><button type="button" onClick={deleteSelectedVariable} aria-label="Excluir variável selecionada" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button></div>
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
                <button type="button" onClick={() => updateVariableAndPropagate(variableDraft)} className={`${actionClass} border-[var(--portal-brand-action-border)] bg-[var(--portal-brand-action)] text-white hover:bg-[var(--portal-brand-action-border)]`}><Save className="h-3.5 w-3.5" />Salvar e propagar variável</button>
                <div className="grid gap-3 sm:grid-cols-3">{([['Documentos', variableUsage.documents], ['E-mails', variableUsage.emails], ['Formulários', variableUsage.forms]] as const).map(([label, items]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-[9px] font-black uppercase text-slate-500">{label} • {items.length}</div><div className="mt-2 space-y-1">{items.length ? items.map((item) => <div key={item} className="truncate text-[10px] font-bold text-slate-700">• {item}</div>) : <div className="text-[10px] text-slate-400">Nenhum uso</div>}</div></div>)}</div>
              </div>}
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><div className={`${panelClass} p-3`}><FileClock className="h-4 w-4 text-slate-600" /><div className="mt-2 text-xl font-black">{auditTrail.length}</div><div className="text-[9px] font-black uppercase text-slate-500">eventos registrados</div></div><div className={`${panelClass} p-3`}><Merge className="h-4 w-4 text-[var(--portal-brand-action)]" /><div className="mt-2 text-xl font-black">{auditTrail.filter((item) => item.action === 'VARIABLE_MERGED').length}</div><div className="text-[9px] font-black uppercase text-slate-500">mesclas de variável</div></div><div className={`${panelClass} p-3`}><Cloud className="h-4 w-4 text-emerald-700" /><div className="mt-2 text-xl font-black">{auditTrail.filter((item) => item.entityType === 'drive').length}</div><div className="text-[9px] font-black uppercase text-slate-500">operações no Drive</div></div></div><div className={`${panelClass} overflow-hidden`}><div className="border-b border-slate-200 bg-slate-50 px-4 py-3"><h4 className="text-xs font-black uppercase text-slate-900">Registro imutável de alterações do estúdio</h4><p className="mt-1 text-[10px] text-slate-500">Cada evento registra autor, data, entidade e artefatos atingidos. O histórico é publicado junto com a configuração central.</p></div><div className="max-h-[620px] overflow-auto"><table className="w-full border-collapse text-left"><thead className="sticky top-0 z-10 bg-slate-100 text-[9px] font-black uppercase text-slate-600"><tr><th className="p-3">Data</th><th className="p-3">Ação</th><th className="p-3">Descrição</th><th className="p-3">Autor</th><th className="p-3">Impacto</th></tr></thead><tbody className="divide-y divide-slate-100">{auditTrail.map((entry) => <tr key={entry.id} className="bg-white text-[10px]"><td className="whitespace-nowrap p-3 text-slate-500">{new Date(entry.timestamp).toLocaleString('pt-BR')}</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 font-black text-slate-700">{formatAuditAction(entry.action)}</span></td><td className="max-w-md p-3 font-medium text-slate-700">{entry.description}</td><td className="p-3 text-slate-500">{entry.actorEmail}</td><td className="p-3 font-bold text-slate-600">{entry.affectedArtifacts?.length || 0} artefato(s)</td></tr>)}{auditTrail.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-xs text-slate-400">O primeiro salvamento ou sincronização iniciará o histórico.</td></tr>}</tbody></table></div></div></div>
        )}
        </div>
      </div>
    </div>
  );
};
