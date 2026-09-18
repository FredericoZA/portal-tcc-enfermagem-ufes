import { portalNotice, portalPrompt, portalConfirm } from '../services/portalDialogs';
import { REGISTRATION_QUESTIONS } from '../utils/operationalConfig';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient, getApiAuthHeaders } from '../services/apiClient';
import { updateGoogleDocContent } from '../services/googleDocsService';
import { GoogleDriveExplorer } from '../components/GoogleDriveExplorer';
import { bootstrapPortalDriveStructure, ensureProcessDriveStructure, extractGoogleDriveFolderId } from '../services/googleDriveOrganizer';
import { IntegrationStudioPanel } from '../components/IntegrationStudioPanel';
import { InfrastructureIntegrationsPanel } from '../components/InfrastructureIntegrationsPanel';
import { AuthorizedStudentsPanel } from '../components/AuthorizedStudentsPanel';
import { MasterDocumentModelsPanel } from '../components/MasterDocumentModelsPanel';
import { updateRuntimeDocumentTemplates, BASE_DOCUMENT_TEMPLATES } from '../utils/documentTemplateEngine';
import { loadGlobalTableConfig, saveGlobalTableConfig, GLOBAL_TABLE_EVENT, getTableStyles, PORTAL_TABLE_PRESETS, PortalTablePreset } from '../utils/tableFormatters';
import { loadSiteLayoutConfig, saveSiteLayoutConfig, SITE_LAYOUT_EVENT, SiteLayoutConfig, DEFAULT_SITE_LAYOUT_CONFIG } from '../utils/siteLayoutConfig';
import { UnifiedPortalEditorModal, UnifiedEditorTab, UnifiedEditorScope } from '../components/UnifiedPortalEditorModal';
import { CalendarPopupEditorModal } from '../components/CalendarPopupEditorModal';
import { loadCalendarPopupConfig, saveCalendarPopupConfig, CalendarPopupFormat } from '../utils/calendarPopupConfig';
import { TccDetailPopupEditorModal } from '../components/TccDetailPopupEditorModal';
import { loadTccDetailPopupFormat, saveTccDetailPopupFormat, TccDetailPopupFormat } from '../types/tccDetailFormat';
import { LoginPopupEditorModal } from '../components/LoginPopupEditorModal';
import { loadLoginPopupConfig, saveLoginPopupConfig, LoginPopupConfig } from '../utils/loginPopupConfig';
import { AuditAndSecuritySection, AuditLogsTable, MasterAndPresidentConfigForm } from '../components/AuditAndSecuritySection';
import { CommissionIdentityPanel } from '../components/CommissionIdentityPanel';
import { PortalPersonalizationHubModal } from '../components/PortalPersonalizationHubModal';
import { 
  TableTextFormat, 
  DEFAULT_TABLE_TEXT_FORMAT, 
  HeaderTheme, 
  HeaderTextColor, 
  BodyTextColor, 
  CellAlignment, 
  TableDensity, 
  TableFontSize 
} from '../components/TableColumnSelectorPanel';
import {
  Settings,
  Settings as SettingsIcon,
  BookOpen,
  HelpCircle,
  X,
  FileText,
  Mail,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Check,
  Clock,
  ArrowRight,
  Info,
  Calendar,
  Award,
  Sparkles,
  FileCheck2,
  Wand2,
  Palette,
  Eye,
  Folder,
  FolderOpen,
  ExternalLink,
  RefreshCw,
  GripVertical,
  MoveLeft,
  MoveRight,
  Layers,
  Send,
  RotateCcw,
  Zap,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Search,
  AlertCircle,
  Globe,
  Type,
  Columns,
  Edit3,
  Layout,
  Square,
  Building2,
  Menu,
  PanelTop,
  PanelLeft,
  PanelBottom,
  TableProperties,
  LayoutTemplate,
  Lock,
  Upload,
  Download
} from 'lucide-react';

export interface MatrixColumn {
  id: string;
  name: string;
  label?: string;
  description?: string;
  dataType?: 'text' | 'date' | 'email' | 'number' | 'url';
  aliases?: string[];
  format?: { bold?: boolean; italic?: boolean; color?: string };
}

export interface SimilarityConflict {
  col1: MatrixColumn;
  col2: MatrixColumn;
  similarityRatio: number;
  reason: string;
}

export interface MatrixRow {
  id: string;
  name: string;
  driveFileUrl: string;
  fields: Record<string, boolean>;
}

export const DEFAULT_MATRIX_COLUMNS: MatrixColumn[] = [
  { id: 'CAMPO_01', name: 'ALUNOS_NOMES', label: 'Nome do(s) aluno(s)', dataType: 'text', aliases: ['ALUNO_NOME', 'NOME_ALUNO'], format: { bold: true, color: '#0f172a' } },
  { id: 'CAMPO_02', name: 'TCC_TITULO', label: 'Título do TCC', dataType: 'text', aliases: ['TITULO_TRABALHO'], format: { bold: true } },
  { id: 'CAMPO_03', name: 'ORIENTADOR_NOME', label: 'Orientador(a)', dataType: 'text', aliases: ['NOME_ORIENTADOR'] },
  { id: 'CAMPO_04', name: 'DEFESA_DATA_HORA_EXTENSO', label: 'Data e horário da defesa', dataType: 'date', aliases: ['DATA_DEFESA', 'DEFESA_DATA'] },
  { id: 'CAMPO_06', name: 'BANCA_NOMES', label: 'Membros da banca', dataType: 'text', aliases: ['BANCA_MEMBRO_1', 'BANCA_MEMBRO_2'] },
  { id: 'CAMPO_07_LOCAL', name: 'DEFESA_LOCAL', label: 'Local da defesa', dataType: 'text', aliases: ['LOCAL_DEFESA'] },
  { id: 'CAMPO_09', name: 'AVALIACAO_RESULTADO', label: 'Resultado da avaliação', dataType: 'text' },
  { id: 'CAMPO_11', name: 'AVALIACAO_PARECER', label: 'Parecer da banca', dataType: 'text' },
  { id: 'CAMPO_12', name: 'PROTOCOLO', label: 'Nº do processo', dataType: 'text' },
  { id: 'CAMPO_13', name: 'DRIVE_PASTA_URL', label: 'Pasta do processo no Drive', dataType: 'url' },
  { id: 'CAMPO_COORIENTADOR', name: 'COORIENTADOR_NOME', label: 'Coorientador(a)', dataType: 'text' },
  { id: 'ALUNO_MATRICULA', name: 'ALUNO_MATRICULA', label: 'Matrícula do aluno', dataType: 'text' },
  { id: 'ALUNO_EMAIL', name: 'ALUNO_EMAIL', label: 'E-mail do aluno', dataType: 'email', aliases: ['EMAIL_ALUNO'] },
  { id: 'ALUNO_2_NOME', name: 'ALUNO_2_NOME', label: 'Segundo aluno', dataType: 'text' },
  { id: 'ALUNO_2_EMAIL', name: 'ALUNO_2_EMAIL', label: 'E-mail do segundo aluno', dataType: 'email' },
  { id: 'ALUNO_2_MATRICULA', name: 'ALUNO_2_MATRICULA', label: 'Matrícula do segundo aluno', dataType: 'text' },
  { id: 'ORIENTADOR_EMAIL', name: 'ORIENTADOR_EMAIL', label: 'E-mail do orientador', dataType: 'email' },
  { id: 'COORIENTADOR_EMAIL', name: 'COORIENTADOR_EMAIL', label: 'E-mail do coorientador', dataType: 'email' },
  { id: 'BANCA_EMAILS', name: 'BANCA_EMAILS', label: 'E-mails da banca', dataType: 'email' },
  { id: 'PARTICIPANTES_EMAILS', name: 'PARTICIPANTES_EMAILS', label: 'E-mails de todos os participantes', dataType: 'email' },
  { id: 'PUBLICAR_TRABALHO', name: 'PUBLICAR_TRABALHO', label: 'Existe algum conteúdo autorizado para publicação', dataType: 'text' },
  { id: 'PUBLICAR_TRABALHO_COMPLETO', name: 'PUBLICAR_TRABALHO_COMPLETO', label: 'Publicação do trabalho completo', dataType: 'text' },
  { id: 'INCLUIR_RESUMO_EXPANDIDO', name: 'INCLUIR_RESUMO_EXPANDIDO', label: 'Inclusão de resumo expandido', dataType: 'text' },
  { id: 'PUBLICAR_RESUMO_EXPANDIDO', name: 'PUBLICAR_RESUMO_EXPANDIDO', label: 'Publicação do resumo expandido autorizada', dataType: 'text' },
  { id: 'PALAVRAS_CHAVE', name: 'PALAVRAS_CHAVE', label: 'Cinco palavras-chave', dataType: 'text' },
  { id: 'RESUMO_SINTETICO', name: 'RESUMO_SINTETICO', label: 'Resumo sintético', dataType: 'text' },
  { id: 'TRABALHO_FINAL_PDF', name: 'TRABALHO_FINAL_PDF', label: 'Arquivo final do trabalho', dataType: 'url' },
  { id: 'RESUMO_EXPANDIDO_PDF', name: 'RESUMO_EXPANDIDO_PDF', label: 'Arquivo do resumo expandido', dataType: 'url' },
  { id: 'COMPROVANTE_LOCAL_URL', name: 'COMPROVANTE_LOCAL_URL', label: 'Comprovação do local da defesa', dataType: 'url' },
];

const defaultFieldMap = Object.fromEntries(DEFAULT_MATRIX_COLUMNS.map((column) => [column.id, true]));
export const DEFAULT_MATRIX_ROWS: MatrixRow[] = [
  { id: 'modelo_convite', name: 'Convite para Banca', driveFileUrl: '', fields: { ...defaultFieldMap } },
  { id: 'modelo_ata', name: 'Ata de Defesa', driveFileUrl: '', fields: { ...defaultFieldMap } },
  { id: 'modelo_termo', name: 'Termo de Autorização e Publicação', driveFileUrl: '', fields: { ...defaultFieldMap } },
  { id: 'modelo_declaracao', name: 'Declaração de Participação', driveFileUrl: '', fields: { ...defaultFieldMap } },
];

export interface WorkflowActionItem {
  id: string;
  type: 'doc' | 'email' | 'form' | 'action';
  refId?: string;
  title: string;
  recipientOrDetail?: string;
  condition?: import('../types/integrationStudio').StudioCondition;
}

export interface FormQuestionItem {
  section?: string;
  id: string;
  fieldKey: string;
  label: string;
  fieldType: 'datetime-local' | 'text' | 'textarea' | 'date' | 'select' | 'radio' | 'checkbox' | 'file' | 'number' | 'email';
  expectedAnswer: string;
  required: boolean;
  isReuseOfFieldKey?: boolean;
  helpText?: string;
  placeholder?: string;
  options?: string[];
  visibleWhen?: import('../types/integrationStudio').StudioCondition;
  validation?: import('../types/integrationStudio').StudioValidationRule;
}

export interface FormTemplateItem {
  id: string;
  title: string;
  stage: string;
  targetRole: 'Aluno' | 'Orientador' | 'Banca' | 'Presidente da Comissão';
  description: string;
  questions: FormQuestionItem[];
  isActive?: boolean;
}

export interface WorkflowStageItem {
  id: string;
  stageNumber: number;
  title: string;
  triggerEvent: string;
  description: string;
  actions: WorkflowActionItem[];
}

export interface DocFieldItem {
  key: string;
  label: string;
  description: string;
}

export interface DocTemplateItem {
  id: string;
  type?: string;
  label: string;
  fileName: string;
  description: string;
  variables: string[];
  fields?: DocFieldItem[];
  templateContentText: string;
  lastUpdated: string;
  driveFileUrl?: string;
  driveFileId?: string;
}

export interface EmailTemplateItem {
  id: string;
  name: string;
  triggerStage: string;
  subject: string;
  body: string;
  recipient?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  htmlBody?: string;
  attachments?: string[];
}

const cleanFileNameForDrive = (name: string): string => {
  if (!name) return '';
  return name.replace(/\.gdoc$/, '').replace(/\.docx$/, '').replace(/\.doc$/, '');
};

const normalizeFileName = (name: string): string => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\.gdoc$/, '')
    .replace(/\.docx$/, '')
    .replace(/\.doc$/, '')
    .replace(/[^a-z0-9]/g, '');
};

const extractVariablesFromContent = (text: string): string[] => {
  if (!text) return [];
  const matches = text.match(/-CAMPO_[A-Z0-9_]+-/g);
  if (!matches) return ['-CAMPO_01-', '-CAMPO_02-', '-CAMPO_03-', '-CAMPO_04-', '-CAMPO_06-', '-CAMPO_07_LOCAL-', '-CAMPO_12-'];
  return Array.from(new Set(matches));
};

export const ConfiguracoesPage: React.FC = () => {
  const { userEmail, settings, refreshAuth, isMasterAdmin } = useAuth();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Accordion Sections Expand/Collapse State (all closed by default as requested)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    personalizacao_portal: false,
    barras_navegacao: false,
    popups_modais: false,
    paginas_telas: false,
    tabelas_planilhas: false,
    registro_logs: false,
    automacoes_drive: false,
    security: false,
    sync: false,
    master_system: false,
  });

  const expandAllSections = () => {
    setOpenSections({
      personalizacao_portal: true,
      barras_navegacao: true,
      popups_modais: true,
      paginas_telas: true,
      tabelas_planilhas: true,
      automacoes_drive: true,
      security: true,
      sync: true,
      master_system: true,
    });
  };

  const collapseAllSections = () => {
    setOpenSections({
      personalizacao_portal: false,
      barras_navegacao: false,
      popups_modais: false,
      paginas_telas: false,
      tabelas_planilhas: false,
      automacoes_drive: false,
      security: false,
      sync: false,
      master_system: false,
    });
  };

  // Site Layout Configuration State (Header, Sidebar, Footer)
  const [siteLayout, setSiteLayout] = useState<SiteLayoutConfig>(() => loadSiteLayoutConfig());
  const [unifiedEditorOpen, setUnifiedEditorOpen] = useState(false);
  const [personalizationHubOpen, setPersonalizationHubOpen] = useState(false);
  const [unifiedEditorTab, setUnifiedEditorTab] = useState<UnifiedEditorTab>('site_header');
  const [unifiedEditorScope, setUnifiedEditorScope] = useState<UnifiedEditorScope>('site_header');

  useEffect(() => {
    const handleLayoutUpdate = (e: any) => {
      if (e.detail) {
        setSiteLayout(e.detail);
      } else {
        setSiteLayout(loadSiteLayoutConfig());
      }
    };
    window.addEventListener(SITE_LAYOUT_EVENT, handleLayoutUpdate);
    return () => window.removeEventListener(SITE_LAYOUT_EVENT, handleLayoutUpdate);
  }, []);

  const openUnifiedEditor = (tab: UnifiedEditorTab, scopeTarget?: UnifiedEditorScope) => {
    setUnifiedEditorTab(tab);
    setUnifiedEditorScope(scopeTarget || (tab as UnifiedEditorScope));
    setUnifiedEditorOpen(true);
  };

  // Popups configuration states (Master Admin)
  const [calendarPopupEditorOpen, setCalendarPopupEditorOpen] = useState(false);
  const [calendarPopupFormat, setCalendarPopupFormat] = useState<CalendarPopupFormat>(() => loadCalendarPopupConfig());

  const [tccDetailPopupEditorOpen, setTccDetailPopupEditorOpen] = useState(false);
  const [tccDetailPopupFormat, setTccDetailPopupFormat] = useState<TccDetailPopupFormat>(() => loadTccDetailPopupFormat());

  const [loginPopupEditorOpen, setLoginPopupEditorOpen] = useState(false);
  const [loginPopupConfig, setLoginPopupConfig] = useState<LoginPopupConfig>(() => loadLoginPopupConfig());

  const [devolucaoConfigModalOpen, setDevolucaoConfigModalOpen] = useState(false);
  const [pdfViewerConfigModalOpen, setPdfViewerConfigModalOpen] = useState(false);
  const [aiModalConfigOpen, setAiModalConfigOpen] = useState(false);
  const [uploadPdfConfigModalOpen, setUploadPdfConfigModalOpen] = useState(false);
  const [downloadConfirmConfigModalOpen, setDownloadConfirmConfigModalOpen] = useState(false);
  const [tutorialConfigModalOpen, setTutorialConfigModalOpen] = useState(false);

  // Table specific configuration states
  const [unifiedStorageKey, setUnifiedStorageKey] = useState<string>('defenses');
  const [unifiedTableTitle, setUnifiedTableTitle] = useState<string>('Planilha');
  const [unifiedAllColumns, setUnifiedAllColumns] = useState<Array<{ key: string; label: string }>>([]);
  const [unifiedColumnOrder, setUnifiedColumnOrder] = useState<string[]>([]);
  const [unifiedVisibleColumns, setUnifiedVisibleColumns] = useState<Record<string, boolean>>({});
  const [unifiedRecordsLimit, setUnifiedRecordsLimit] = useState<number | 'all'>(25);

  const handleOpenTablePresetEditor = (preset: PortalTablePreset) => {
    setUnifiedStorageKey(preset.storageKey);
    setUnifiedTableTitle(preset.defaultTitle);
    setUnifiedAllColumns(preset.columns.map((c) => ({ key: c.key, label: c.label })));

    try {
      const raw = localStorage.getItem(`default_table_config_${preset.storageKey}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        const savedOrder = Array.isArray(parsed.columnOrder) ? parsed.columnOrder : [];
        const canonicalKeys = preset.columns.map((column) => column.key);
        setUnifiedColumnOrder([
          ...savedOrder.filter((key: string) => canonicalKeys.includes(key)),
          ...canonicalKeys.filter((key) => !savedOrder.includes(key)),
        ]);
        if (parsed.visibleColumns) setUnifiedVisibleColumns(parsed.visibleColumns);
        else {
          const vis: Record<string, boolean> = {};
          preset.columns.forEach((c) => (vis[c.key] = c.defaultVisible !== false));
          setUnifiedVisibleColumns(vis);
        }
        if (parsed.recordsLimit) setUnifiedRecordsLimit(parsed.recordsLimit);
      } else {
        setUnifiedColumnOrder(preset.columns.map((column) => column.key));
        const vis: Record<string, boolean> = {};
        preset.columns.forEach((c) => (vis[c.key] = c.defaultVisible !== false));
        setUnifiedVisibleColumns(vis);
        setUnifiedRecordsLimit(25);
      }
    } catch (e) {
      setUnifiedColumnOrder(preset.columns.map((column) => column.key));
      const vis: Record<string, boolean> = {};
      preset.columns.forEach((c) => (vis[c.key] = c.defaultVisible !== false));
      setUnifiedVisibleColumns(vis);
      setUnifiedRecordsLimit(25);
    }

    setUnifiedEditorTab('table_columns');
    setUnifiedEditorScope('table');
    setUnifiedEditorOpen(true);
  };

  // Global Table Formatting State (Master Admin)
  const [globalTableConfig, setGlobalTableConfig] = useState<TableTextFormat>(() => loadGlobalTableConfig());
  const [globalSaveFeedback, setGlobalSaveFeedback] = useState<string | null>(null);

  useEffect(() => {
    const handleTableFormatUpdate = (e: any) => {
      if (e.detail) {
        setGlobalTableConfig(e.detail);
      } else {
        setGlobalTableConfig(loadGlobalTableConfig());
      }
    };
    window.addEventListener(GLOBAL_TABLE_EVENT, handleTableFormatUpdate);
    return () => window.removeEventListener(GLOBAL_TABLE_EVENT, handleTableFormatUpdate);
  }, []);

  const handleUpdateGlobalFormat = (updates: Partial<TableTextFormat>) => {
    const updated = { ...globalTableConfig, ...updates };
    setGlobalTableConfig(updated);
    saveGlobalTableConfig(updated);
  };

  const handleSaveGlobalTableConfig = () => {
    saveGlobalTableConfig(globalTableConfig);
    setGlobalSaveFeedback('✓ Padrão global salvo e sincronizado com todas as planilhas do site!');
    setTimeout(() => setGlobalSaveFeedback(null), 4000);
  };

  const handleResetGlobalTableConfig = () => {
    setGlobalTableConfig({ ...DEFAULT_TABLE_TEXT_FORMAT });
    saveGlobalTableConfig({ ...DEFAULT_TABLE_TEXT_FORMAT });
    setGlobalSaveFeedback('Padrão restaurado para a configuração inicial do sistema.');
    setTimeout(() => setGlobalSaveFeedback(null), 3000);
  };

  // Active Sub-item tab state: 'docs' | 'emails' | 'forms'
  const [activeElementTab, setActiveElementTab] = useState<'docs' | 'emails' | 'forms'>('docs');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTextContent, setImportTextContent] = useState('');

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Google Calendar & Workspace Sync State
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncError, setSyncError] = useState(false);
  const [isWorkspaceSynced, setIsWorkspaceSynced] = useState<boolean>(() => {
    return localStorage.getItem('google_workspace_synced') === 'true';
  });

  const handleGoogleCalendarSync = async () => {
    setIsSyncingCalendar(true);
    setSyncError(false);
    setSyncStatus('Sincronizando pelo servidor seguro...');
    try {
      const result = await apiClient.syncGoogleWorkspaceCalendar();
      setIsWorkspaceSynced(true);
      setSyncError(false);
      setSyncStatus(`Google Calendar sincronizado: ${result.events.length} evento(s), ${result.created} novo(s).`);
      setTimeout(() => setSyncStatus(null), 4000);
    } catch (error: any) {
      console.error(error);
      setSyncError(true);
      setSyncStatus(`Erro: ${error.message || 'Falha na sincronização'}`);
      setTimeout(() => setSyncStatus(null), 5000);
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  // General settings state
  const [coordinatorName, setCoordinatorName] = useState(settings?.commissionPresidentName || '');
  const [substituteCoordinatorName, setSubstituteCoordinatorName] = useState(settings?.substituteCoordinatorName || '');
  const [commissionMember2Name, setCommissionMember2Name] = useState(settings?.commissionMember2Name || '');
  const [commissionMember3Name, setCommissionMember3Name] = useState(settings?.commissionMember3Name || '');
  const [commissionMember4Name, setCommissionMember4Name] = useState(settings?.commissionMember4Name || '');
  const [commissionMember5Name, setCommissionMember5Name] = useState(settings?.commissionMember5Name || '');
  const [maintainerName, setMaintainerName] = useState(settings?.portalMaintainerName || '');
  const [contactEmail, setContactEmail] = useState(settings?.contactEmail || '');
  const [whatsappUrl, setWhatsappUrl] = useState(settings?.whatsappUrl || '');
  const [isSavingGeneralSettings, setIsSavingGeneralSettings] = useState(false);

  useEffect(() => {
    if (settings) {
      setCoordinatorName(settings.commissionPresidentName || '');
      setSubstituteCoordinatorName(settings.substituteCoordinatorName || '');
      setCommissionMember2Name(settings.commissionMember2Name || '');
      setCommissionMember3Name(settings.commissionMember3Name || '');
      setCommissionMember4Name(settings.commissionMember4Name || '');
      setCommissionMember5Name(settings.commissionMember5Name || '');
      setMaintainerName(settings.portalMaintainerName || '');
      setContactEmail(settings.contactEmail || '');
      setWhatsappUrl(settings.whatsappUrl || '');
      if (settings.calendarId || localStorage.getItem('google_workspace_synced') === 'true') {
        setIsWorkspaceSynced(true);
      }
    }
  }, [settings]);

  const handleSaveGeneralSettings = async () => {
    setIsSavingGeneralSettings(true);
    try {
      await apiClient.updateSettings({
        commissionPresidentName: coordinatorName,
        substituteCoordinatorName: substituteCoordinatorName,
        commissionMember2Name: commissionMember2Name,
        commissionMember3Name: commissionMember3Name,
        commissionMember4Name: commissionMember4Name,
        commissionMember5Name: commissionMember5Name,
        portalMaintainerName: maintainerName,
        contactEmail: contactEmail,
        whatsappUrl: whatsappUrl
      });
      await refreshAuth();
      showNotification('Configurações gerais salvas com sucesso!');
    } catch (err: any) {
      console.error(err);
      portalNotice('Erro ao salvar configurações gerais.');
    } finally {
      setIsSavingGeneralSettings(false);
    }
  };

  // Planilha / Matriz de Mapeamento de Modelos (Linhas) x Campos (Colunas)
  const [matrixColumns, setMatrixColumns] = useState<MatrixColumn[]>(() => {
    const saved = localStorage.getItem('portal_doc_matrix_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Deduplicate by normalized column id/name to guarantee unique keys
          const seen = new Set<string>();
          const deduped: MatrixColumn[] = [];
          for (const col of parsed) {
            const normalized = String(col.id || col.name || '').trim().toLowerCase();
            if (normalized && !seen.has(normalized)) {
              seen.add(normalized);
              deduped.push(col);
            }
          }
          if (deduped.length > 0) return deduped;
        }
      } catch (e) { console.error(e); }
    }
    return DEFAULT_MATRIX_COLUMNS;
  });

  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>(() => {
    const saved = localStorage.getItem('portal_doc_matrix_rows');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { console.error(e); }
    }
    return DEFAULT_MATRIX_ROWS;
  });

  useEffect(() => {
    localStorage.setItem('portal_doc_matrix_columns', JSON.stringify(matrixColumns));
  }, [matrixColumns]);

  useEffect(() => {
    localStorage.setItem('portal_doc_matrix_rows', JSON.stringify(matrixRows));
  }, [matrixRows]);

  // Modais para Planilha de Mapeamento
  const [isAddRowOpen, setIsAddRowOpen] = useState(false);
  const [newRowName, setNewRowName] = useState('');
  const [newRowUrl, setNewRowUrl] = useState('');
  const [newRowTagsInput, setNewRowTagsInput] = useState('');
  const [isScanningDoc, setIsScanningDoc] = useState(false);

  // Credenciais Google são mantidas exclusivamente no servidor.
  const googleToken = '';

  const [isUpdatingAllDocs, setIsUpdatingAllDocs] = useState(false);
  const [compatibilityConflicts, setCompatibilityConflicts] = useState<SimilarityConflict[]>([]);
  const [isCompatibilityModalOpen, setIsCompatibilityModalOpen] = useState(false);

  const handleConnectGoogleDrive = async () => {
    window.location.href='/api/integrations/google/oauth/start?returnTo=/?google=connected';
  };

  // Checagem de similaridade para verificar grafia parecida (Ex: ALUNO vs ALUNOS)
  const getTagSimilarity = (tag1: string, tag2: string): { ratio: number; reason: string } => {
    const norm1 = tag1.toLowerCase().replace(/<<|>>/g, '').replace(/_/g, ' ').trim();
    const norm2 = tag2.toLowerCase().replace(/<<|>>/g, '').replace(/_/g, ' ').trim();

    if (norm1 === norm2) return { ratio: 1.0, reason: 'Nomes idênticos' };

    if (
      norm1 + 's' === norm2 ||
      norm2 + 's' === norm1 ||
      norm1 + 'es' === norm2 ||
      norm2 + 'es' === norm1
    ) {
      return { ratio: 0.95, reason: 'Diferença apenas de singular/plural (Ex: ALUNO vs ALUNOS)' };
    }

    if (norm1.length > 3 && norm2.length > 3 && (norm1.includes(norm2) || norm2.includes(norm1))) {
      return { ratio: 0.88, reason: 'Um campo está contido no outro (Ex: NOME vs NOME_DO_ALUNO)' };
    }

    let matches = 0;
    const minLen = Math.min(norm1.length, norm2.length);
    const maxLen = Math.max(norm1.length, norm2.length);
    for (let i = 0; i < minLen; i++) {
      if (norm1[i] === norm2[i]) matches++;
    }
    const ratio = matches / maxLen;
    return { ratio, reason: ratio >= 0.75 ? 'Grafia extremamente parecida' : 'Nomes de campos semelhantes' };
  };

  // Função Inteligente de Importação & Varredura de Documentos / Textos (Evita Duplicatas)
  const handleImportTextOrUrl = async (content: string) => {
    if (!content || !content.trim()) {
      portalNotice('Por favor, insira o link do arquivo Google Drive ou o texto/código com as tags.');
      return;
    }
    setIsScanningDoc(true);
    try {
      // 1. Se for URL de arquivo do Drive/Docs, aciona o backend para extrair o texto real do documento
      if (content.includes('drive.google.com') || content.includes('docs.google.com')) {
        const res = await fetch('/api/scan-drive-doc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await getApiAuthHeaders())
          },
          body: JSON.stringify({ url: content })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.tags && Array.isArray(data.tags)) {
            let addedCount = 0;
            const newCols = [...matrixColumns];
            data.tags.forEach((rawTag: string) => {
              const cleanTag = rawTag.replace(/<<|>>|{{|}}|\[\[|\]\]|«|»|<|>/g, '').trim();
              if (!cleanTag) return;
              const normTag = cleanTag.toLowerCase().replace(/[\s_-]+/g, '');
              const exists = newCols.some(col => {
                const colNorm = col.name.toLowerCase().replace(/[\s_-]+/g, '');
                return colNorm === normTag || colNorm + 's' === normTag || normTag + 's' === colNorm;
              });
              if (!exists) {
                newCols.push({ id: cleanTag.toLowerCase().replace(/[^a-z0-9]/g, '_'), name: cleanTag });
                addedCount++;
              }
            });
            setMatrixColumns(newCols);

            // Criar linha na planilha de modelos caso o nome do documento esteja definido
            const fileName = data.title || cleanFileNameForDrive(content) || 'Modelo Importado';
            const existsRow = matrixRows.some(r => r.driveFileUrl === content || r.name.toLowerCase() === fileName.toLowerCase());
            if (!existsRow) {
              const rowFields: Record<string, boolean> = {};
              data.tags.forEach((rawTag: string) => {
                const cleanTag = rawTag.replace(/<<|>>|{{|}}|\[\[|\]\]|«|»|<|>/g, '').trim();
                const colMatch = newCols.find(c => c.name.toLowerCase() === cleanTag.toLowerCase() || c.id === cleanTag.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                if (colMatch) rowFields[colMatch.id] = true;
              });
              setMatrixRows(prev => [...prev, {
                id: 'row_' + Date.now(),
                name: fileName,
                driveFileUrl: content,
                fields: rowFields
              }]);
            }

            setIsImportModalOpen(false);
            setImportTextContent('');
            showNotification(`Documento do Drive importado e analisado com sucesso! ${addedCount} novos campos vinculados sem duplicações.`);
            return;
          }
        }
      }

      // 2. Caso seja texto direto contendo marcadores
      const tagRegex = /(?:<<|{{|\[\[|«|<)([^<>{}\[\]»]+)(?:>>|}}|\]\]|»|>)/g;
      const htmlTagNames = /^(p|span|div|br|b|i|u|strong|em|a|img|h[1-6]|table|tr|td|th|tbody|thead|tfoot|ul|ol|li|font|xml|code|pre|hr|blockquote|canvas)$/i;

      let match;
      const foundTags = new Set<string>();
      while ((match = tagRegex.exec(content)) !== null) {
        const rawTag = match[1].trim();
        if (rawTag && !htmlTagNames.test(rawTag)) {
          foundTags.add(rawTag);
        }
      }

      if (foundTags.size === 0) {
        showNotification('Nenhum campo com marcadores foi identificado no texto. Use marcadores como <<campo>>, {{campo}}, [[campo]] ou <campo>.');
        return;
      }

      let addedCount = 0;
      const newCols = [...matrixColumns];
      foundTags.forEach(cleanTag => {
        const normTag = cleanTag.toLowerCase().replace(/[\s_-]+/g, '');
        const exists = newCols.some(col => {
          const colNorm = col.name.toLowerCase().replace(/[\s_-]+/g, '');
          return colNorm === normTag || colNorm + 's' === normTag || normTag + 's' === colNorm;
        });
        if (!exists) {
          newCols.push({ id: cleanTag.toLowerCase().replace(/[^a-z0-9]/g, '_'), name: cleanTag });
          addedCount++;
        }
      });

      setMatrixColumns(newCols);
      setIsImportModalOpen(false);
      setImportTextContent('');
      showNotification(`Varredura concluída! ${addedCount} novos campos de formulário/modelo integrados à planilha de padronização.`);
    } catch (err: any) {
      console.error(err);
      portalNotice('Erro na varredura/importação: ' + err.message);
    } finally {
      setIsScanningDoc(false);
    }
  };

  const handleUpdateAllDocumentsAndFields = async () => {
    setIsUpdatingAllDocs(true);

    const executeFolderScan = async () => {
      return await fetch('/api/scan-drive-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getApiAuthHeaders())
        },
        body: JSON.stringify({
          folderUrl: driveModelosFolderUrl
        })
      });
    };

    try {
      let currentRows = [...matrixRows];

      // 1. Se houver link da pasta do Google Drive, realizar a varredura automática dos arquivos da pasta
      if (driveModelosFolderUrl && driveModelosFolderUrl.trim().length > 10) {
        try {
          showNotification('Varrendo pasta do Google Drive em busca de modelos (.docx)...');
          const folderRes = await executeFolderScan();
          let folderData = folderRes.ok ? await folderRes.json() : null;

          if (folderData && folderData.files && folderData.files.length > 0) {
            const updatedRowsList = [...currentRows];

            folderData.files.forEach((file: any) => {
              const cleanName = cleanFileNameForDrive(file.name);
              const fileUrl = file.driveFileUrl || `https://docs.google.com/document/d/${file.id}/edit`;

              const existingIndex = updatedRowsList.findIndex(
                r => (r.driveFileUrl && r.driveFileUrl.includes(file.id)) ||
                     (fileUrl && r.driveFileUrl && r.driveFileUrl.trim().toLowerCase() === fileUrl.trim().toLowerCase())
              );

              if (existingIndex >= 0) {
                updatedRowsList[existingIndex] = {
                  ...updatedRowsList[existingIndex],
                  name: cleanName || updatedRowsList[existingIndex].name,
                  driveFileUrl: fileUrl
                };
              } else {
                updatedRowsList.push({
                  id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  name: cleanName || 'Modelo Google Drive',
                  driveFileUrl: fileUrl,
                  fields: {}
                });
              }
            });

            currentRows = updatedRowsList;
            showNotification(`${folderData.files.length} modelos localizados na pasta do Google Drive!`);
          }
        } catch (folderErr) {
          console.warn('[UpdateAllDocs] Failed to scan drive folder:', folderErr);
        }
      }

      if (currentRows.length === 0) {
        showNotification('Nenhum modelo cadastrado ou encontrado. Adicione a URL da pasta do Google Drive acima ou adicione manualmente em "+ INSERIR LINHA NA PLANILHA".');
        setIsUpdatingAllDocs(false);
        return;
      }

      const updatedCols = [...matrixColumns];
      const newRows: MatrixRow[] = [];

      for (const row of currentRows) {
        let rowTags: string[] = [];

        try {
          const res = await fetch('/api/scan-drive-doc', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(await getApiAuthHeaders())
            },
            body: JSON.stringify({
              url: row.driveFileUrl,
              name: row.name
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.tags && data.tags.length > 0) {
              rowTags = data.tags;
            }
          }
        } catch (e) {
          console.error('[UpdateAllDocs] Error scanning doc:', row.name, e);
        }

        if (rowTags.length === 0) {
          const activeCols = Object.keys(row.fields || {})
            .filter(colId => row.fields[colId])
            .map(colId => {
              const c = updatedCols.find(col => col.id === colId);
              return c ? c.name : null;
            })
            .filter(Boolean) as string[];

          rowTags = activeCols;
        }

        const newFields: Record<string, boolean> = {};

        rowTags.forEach(displayTagName => {
          const cleanTagName = displayTagName.replace(/^<<|>>$/g, '').replace(/^\{\{|\}\}$/g, '').replace(/^\[\[|\]\]$/g, '').replace(/^«|»$/g, '').replace(/^-|-$/g, '').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
          let col = updatedCols.find(c => c.id.toUpperCase() === cleanTagName || c.name.toUpperCase() === cleanTagName || (c.aliases || []).some(alias => alias.toUpperCase() === cleanTagName));
          if (!col) {
            col = { id: cleanTagName, name: cleanTagName, label: cleanTagName.replace(/_/g, ' '), aliases: [] };
            updatedCols.push(col);
          }
          newFields[col.id] = true;
        });

        newRows.push({ ...row, fields: newFields });
      }

      // Variáveis podem ser usadas apenas em e-mails ou formulários; nunca as
      // excluímos automaticamente porque não apareceram nos documentos atuais.
      const finalCols = updatedCols;

      setMatrixColumns(finalCols);
      setMatrixRows(newRows);

      // Verificação de compatibilidade de grafia (Ex: <<ALUNO>> vs <<ALUNOS>>)
      const conflicts: SimilarityConflict[] = [];
      for (let i = 0; i < finalCols.length; i++) {
        for (let j = i + 1; j < finalCols.length; j++) {
          const c1 = finalCols[i];
          const c2 = finalCols[j];
          const sim = getTagSimilarity(c1.name, c2.name);
          if (sim.ratio >= 0.75) {
            conflicts.push({
              col1: c1,
              col2: c2,
              similarityRatio: sim.ratio,
              reason: sim.reason
            });
          }
        }
      }

      if (conflicts.length > 0) {
        setCompatibilityConflicts(conflicts);
        setIsCompatibilityModalOpen(true);
      } else {
        showNotification('Varredura concluída! Todos os documentos foram analisados e os campos <<>> foram atualizados automaticamente.');
      }
    } catch (err) {
      console.error(err);
      showNotification('Ocorreu um erro durante a atualização dos documentos.');
    } finally {
      setIsUpdatingAllDocs(false);
    }
  };

  const handleMergeColumns = (keepColId: string, mergeColId: string) => {
    setMatrixRows(prevRows =>
      prevRows.map(row => {
        const hasMergeCol = !!row.fields[mergeColId];
        const newFields = { ...row.fields };
        delete newFields[mergeColId];
        if (hasMergeCol) {
          newFields[keepColId] = true;
        }
        return { ...row, fields: newFields };
      })
    );

    setMatrixColumns(prevCols => prevCols.filter(c => c.id !== mergeColId));
    setCompatibilityConflicts(prev => {
      const updated = prev.filter(c => c.col1.id !== mergeColId && c.col2.id !== mergeColId);
      if (updated.length === 0) {
        setIsCompatibilityModalOpen(false);
      }
      return updated;
    });

    showNotification('Colunas unificadas na mesma coluna com sucesso!');
  };

  const handleKeepColumnsSeparate = (col1Id: string, col2Id: string) => {
    setCompatibilityConflicts(prev => {
      const updated = prev.filter(c => !(c.col1.id === col1Id && c.col2.id === col2Id));
      if (updated.length === 0) {
        setIsCompatibilityModalOpen(false);
      }
      return updated;
    });
    showNotification('Colunas mantidas em colunas separadas.');
  };

  // Extrair tags no formato <<CAMPO>>, <CAMPO>, «CAMPO» ou lista por vírgula
  const extractTagsFromString = (text: string): string[] => {
    if (!text) return [];

    const unescaped = text
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&laquo;/gi, '«')
      .replace(/&raquo;/gi, '»');

    const tagsSet = new Set<string>();

    const isValidTag = (val: string): boolean => {
      if (!val) return false;
      const clean = val.replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
      if (clean.length < 2 || clean.length > 80) return false;
      if (/^\d+$/.test(clean)) return false;
      if (/^(https?:\/\/|www\.)/i.test(clean)) return false;
      if (/[{};=\[\]~^|&+\*\/\\?$'"><%]/.test(clean)) return false;
      const jsKeywords = /\b(function|return|else|break|while|for|charCodeAt|typeof|var|let|const|this|window|document|eval|undefined|null|true|false|if|switch|case)\b/i;
      if (jsKeywords.test(clean)) return false;
      if ((clean.match(/,/g) || []).length > 1) return false;
      if (!/[a-zA-Z0-9\u00C0-\u024F]/.test(clean)) return false;
      return true;
    };

    // Double brackets <<...>> or guillemets «...»
    const matches = unescaped.match(/<<([^>]+)>>|«([^»]+)»/g);
    if (matches && matches.length > 0) {
      matches.forEach(m => {
        const clean = m.replace(/<<|>>|«|»/g, '').replace(/<[^>]*>/g, '').trim();
        if (isValidTag(clean)) {
          tagsSet.add(`<<${clean}>>`);
        }
      });
    }

    // Single angle brackets <...> (excluding standard HTML tags)
    const htmlTagNames = /^(p|span|div|br|b|i|u|strong|em|a|img|h[1-6]|table|tr|td|th|tbody|thead|tfoot|ul|ol|li|font|xml|code|pre|hr|blockquote|canvas)$/i;
    const singleMatches = unescaped.match(/<([a-zA-Z0-9\u00C0-\u024F\s_()#-]+)>/g);
    if (singleMatches) {
      singleMatches.forEach(m => {
        const clean = m.replace(/<|>/g, '').trim();
        if (!htmlTagNames.test(clean) && isValidTag(clean)) {
          tagsSet.add(`<<${clean}>>`);
        }
      });
    }

    if (tagsSet.size > 0) {
      return Array.from(tagsSet);
    }

    text.split(/[,;\n]/).forEach(s => {
      const clean = s.trim().replace(/<<|>>|<|>|«|»/g, '');
      if (isValidTag(clean)) {
        tagsSet.add(`<<${clean}>>`);
      }
    });

    return Array.from(tagsSet);
  };

  // Varrer arquivo/URL do Google Drive e extrair as tags reais do documento
  const handleScanDocument = async (overrideUrl?: string) => {
    const urlToScan = overrideUrl || newRowUrl;
    if (!newRowName && !urlToScan && !newRowTagsInput) {
      portalNotice('Por favor, informe o nome ou o link do arquivo do Google Drive para realizar a varredura.');
      return;
    }
    setIsScanningDoc(true);

    const executeScan = async () => {
      return await fetch('/api/scan-drive-doc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getApiAuthHeaders())
        },
        body: JSON.stringify({
          url: urlToScan,
          name: newRowName,
          text: newRowTagsInput
        })
      });
    };

    try {
      const res = await executeScan();
      let data = res.ok ? await res.json() : null;

      if (data && data.tags && data.tags.length > 0) {
        setNewRowTagsInput(data.tags.join(', '));
        showNotification(`Varredura concluída! ${data.tags.length} campos (<<...>>) identificados no documento.`);
      } else if (data && data.unreadable) {
        showNotification(data.reason || 'Não foi possível ler o documento no Google Drive. Verifique se o link está compartilhado ou digite as variáveis.');
      } else {
        showNotification('Nenhum campo <<...>> foi localizado no documento. Você pode digitar os campos manualmente abaixo.');
      }
    } catch (err) {
      console.error(err);
      const fallbackTags = extractTagsFromString(newRowTagsInput);
      if (fallbackTags.length > 0) {
        setNewRowTagsInput(fallbackTags.join(', '));
        showNotification('Varredura concluída a partir do texto informado.');
      } else {
        showNotification('Não foi possível extrair campos do link. Por favor, verifique as permissões no Google Drive ou digite as variáveis.');
      }
    } finally {
      setIsScanningDoc(false);
    }
  };

  const handleSaveNewRow = () => {
    if (!newRowName.trim()) {
      portalNotice('Por favor, informe o nome do modelo de arquivo.');
      return;
    }

    const detectedTags = extractTagsFromString(newRowTagsInput);
    const updatedColumns = [...matrixColumns];
    const rowFields: Record<string, boolean> = {};

    detectedTags.forEach(tag => {
      const displayTagName = tag.startsWith('<<') ? tag : `<<${tag.replace(/<<|>>/g, '').trim()}>>`;
      
      let existingCol = updatedColumns.find(
        c => c.name.toLowerCase().trim() === displayTagName.toLowerCase().trim()
      );

      if (!existingCol) {
        const newColId = `col-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        existingCol = { id: newColId, name: displayTagName };
        updatedColumns.push(existingCol);
      }

      rowFields[existingCol.id] = true;
    });

    const newRowId = `row-${Date.now()}`;
    const newRowObj: MatrixRow = {
      id: newRowId,
      name: newRowName.trim(),
      driveFileUrl: newRowUrl.trim() || 'https://drive.google.com',
      fields: rowFields
    };

    setMatrixColumns(updatedColumns);
    setMatrixRows(prev => [...prev, newRowObj]);

    setNewRowName('');
    setNewRowUrl('');
    setNewRowTagsInput('');
    setIsAddRowOpen(false);
    showNotification('Novo modelo (.docx) adicionado e varrido na planilha com sucesso!');
  };

  const handleToggleMatrixCell = (rowId: string, colId: string) => {
    setMatrixRows(prev =>
      prev.map(row => {
        if (row.id === rowId) {
          return {
            ...row,
            fields: {
              ...row.fields,
              [colId]: !row.fields[colId]
            }
          };
        }
        return row;
      })
    );
  };

  const handleDeleteMatrixRow = (rowId: string) => {
    const rowToDelete = matrixRows.find(r => r.id === rowId);
    const rowName = rowToDelete ? rowToDelete.name : 'este modelo';

    setMatrixRows(prevRows => {
      const remainingRows = prevRows.filter(r => r.id !== rowId);
      // Clean up columns that no longer belong to any remaining row
      setMatrixColumns(prevCols => {
        const usedColIds = new Set<string>();
        remainingRows.forEach(r => {
          Object.keys(r.fields || {}).forEach(colId => {
            if (r.fields[colId]) usedColIds.add(colId);
          });
        });
        return prevCols.filter(c => usedColIds.has(c.id));
      });
      return remainingRows;
    });
    showNotification(`Modelo "${rowName}" removido da planilha com sucesso!`);
  };

  const handleDeleteMatrixColumn = (colId: string) => {
    setMatrixColumns(prev => prev.filter(c => c.id !== colId));
    showNotification('Campo (coluna) removido da planilha com sucesso!');
  };

  const handleMoveColumn = (colIndex: number, direction: 'left' | 'right') => {
    if (direction === 'left' && colIndex === 0) return;
    if (direction === 'right' && colIndex === matrixColumns.length - 1) return;
    const targetIndex = direction === 'left' ? colIndex - 1 : colIndex + 1;
    setMatrixColumns(prev => {
      const updated = [...prev];
      const temp = updated[colIndex];
      updated[colIndex] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });
    showNotification('Ordem das colunas atualizada!');
  };

  const handleMoveRow = (rowIndex: number, direction: 'up' | 'down') => {
    if (direction === 'up' && rowIndex === 0) return;
    if (direction === 'down' && rowIndex === matrixRows.length - 1) return;
    const targetIndex = direction === 'up' ? rowIndex - 1 : rowIndex + 1;
    setMatrixRows(prev => {
      const updated = [...prev];
      const temp = updated[rowIndex];
      updated[rowIndex] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });
    showNotification('Ordem dos modelos atualizada!');
  };

  // Document Templates State (Mirrored directly from Google Drive /Modelos folder)
  const [docTemplates, setDocTemplates] = useState<DocTemplateItem[]>(() => {
    return [
      {
        id: 'tmpl-convite',
        type: 'CONVITE',
        label: BASE_DOCUMENT_TEMPLATES.CONVITE.label,
        fileName: BASE_DOCUMENT_TEMPLATES.CONVITE.fileName,
        description: 'Cadastre o modelo próprio do Master para a carta-convite.',
        variables: ['<<Alunos>>', '<<Título do Trabalho>>', '<<Orientador (1)>>', '<<Examinador (2)>>', '<<Examinador (3)>>', '<<Data da Defesa (por extenso total)>>', '<<Hora de Início da Defesa (por extenso)>>', '<<Local da Defesa>>'],
        fields: [],
        templateContentText: BASE_DOCUMENT_TEMPLATES.CONVITE.templateContentText,
        lastUpdated: '',
        driveFileUrl: ''
      },
      {
        id: 'tmpl-ata',
        type: 'ATA',
        label: BASE_DOCUMENT_TEMPLATES.ATA.label,
        fileName: BASE_DOCUMENT_TEMPLATES.ATA.fileName,
        description: 'Cadastre o modelo próprio do Master para a ata de defesa.',
        variables: ['<<Alunos>>', '<<Título do Trabalho>>', '<<Orientador (1)>>', '<<Examinador (2)>>', '<<Examinador (3)>>', '<<Situação>>', '<<Parecer>>', '<<Local da Defesa>>'],
        fields: [],
        templateContentText: BASE_DOCUMENT_TEMPLATES.ATA.templateContentText,
        lastUpdated: '',
        driveFileUrl: ''
      },
      {
        id: 'tmpl-termo',
        type: 'TERMO',
        label: BASE_DOCUMENT_TEMPLATES.TERMO.label,
        fileName: BASE_DOCUMENT_TEMPLATES.TERMO.fileName,
        description: 'Cadastre o modelo próprio do Master para o termo de autorização.',
        variables: ['<<Alunos>>', '<<Título do Trabalho>>', '<<Orientador (1)>>', '<<Publicar Trabalho Completo>>', '<<Publicar Resumo Expandido>>', '<<Palavras-chave>>', '<<Resumo Sintético>>'],
        fields: [],
        templateContentText: BASE_DOCUMENT_TEMPLATES.TERMO.templateContentText,
        lastUpdated: '',
        driveFileUrl: ''
      },
      {
        id: 'tmpl-declaracao',
        type: 'DECLARACAO',
        label: BASE_DOCUMENT_TEMPLATES.DECLARACAO.label,
        fileName: BASE_DOCUMENT_TEMPLATES.DECLARACAO.fileName,
        description: 'Cadastre o modelo próprio do Master para a declaração de participação.',
        variables: ['<<Membros da Banca>>', '<<Título do Trabalho>>', '<<Alunos>>', '<<Data da Defesa (por extenso total)>>', '<<Orientador (1)>>', '<<Local da Defesa>>', '<<Protocolo>>'],
        fields: [],
        templateContentText: BASE_DOCUMENT_TEMPLATES.DECLARACAO.templateContentText,
        lastUpdated: '',
        driveFileUrl: ''
      }
    ];
  });

  // Keep runtime document template engine synchronized with docTemplates state & localStorage
  useEffect(() => {
    localStorage.setItem('portal_doc_templates', JSON.stringify(docTemplates));
    const formattedMap: Record<string, any> = {};
    docTemplates.forEach((dt) => {
      const typeKey = dt.type || dt.id.replace(/^tmpl-/, '').toUpperCase();
      formattedMap[typeKey] = {
        id: dt.id,
        type: typeKey,
        label: dt.label,
        fileName: dt.fileName,
        templateContentText: dt.templateContentText
      };
    });
    updateRuntimeDocumentTemplates(formattedMap);
  }, [docTemplates]);

  // Fluxos legados que ainda exigem um token local permanecem bloqueados.
  const getValidToken = async (): Promise<string | null> => {
    showNotification('Use a Central segura de integrações; tokens Google não são entregues ao navegador.');
    return null;
  };

  const [selectedDocId, setSelectedDocId] = useState<string>('tmpl-convite');
  const [selectedModelosFolder, setSelectedModelosFolder] = useState<string>('/0-Modelos');
  const [newDocFieldName, setNewDocFieldName] = useState<string>('');
  const [newDocFieldDesc, setNewDocFieldDesc] = useState<string>('');
  const [newVarInput, setNewVarInput] = useState<string>('');

  // Document Template Active Tab & Scenario Simulator State
  const [docActiveTab, setDocActiveTab] = useState<'preview' | 'editor' | 'variables'>('preview');
  const [docWriterMode, setDocWriterMode] = useState<'editor' | 'preview'>('editor');
  const [editorFontFamily, setEditorFontFamily] = useState<'sans' | 'serif' | 'mono'>('sans');
  const [simNumAlunos, setSimNumAlunos] = useState<'1' | '2'>('1');
  const [simTemCoorientador, setSimTemCoorientador] = useState<boolean>(false);
  const [simLocalFormato, setSimLocalFormato] = useState<'PRESENCIAL' | 'ONLINE' | 'HIBRIDO'>('PRESENCIAL');

  // Google Drive Integration & Links State
  const [driveFolderUrl, setDriveFolderUrl] = useState<string>(() => {
    return localStorage.getItem('portal_drive_folder_url') || '';
  });
  const [driveModelosFolderUrl, setDriveModelosFolderUrl] = useState<string>(() => {
    return localStorage.getItem('portal_drive_modelos_folder_url') || '';
  });

  useEffect(() => {
    localStorage.setItem('portal_drive_folder_url', driveFolderUrl);
  }, [driveFolderUrl]);

  useEffect(() => {
    localStorage.setItem('portal_drive_modelos_folder_url', driveModelosFolderUrl);
  }, [driveModelosFolderUrl]);

  const handleBootstrapDriveStructure=async()=>{const token=await getValidToken();if(!token)throw new Error('Faça login no Google Drive.');const manifest=await bootstrapPortalDriveStructure(token,driveFolderUrl),rootFolderId=extractGoogleDriveFolderId(driveFolderUrl),models=manifest.folders.models;setDriveModelosFolderUrl(models.webViewLink||`https://drive.google.com/drive/folders/${models.id}`);await apiClient.updateDriveRootFolder(rootFolderId);const processes=await apiClient.getProcesses();let processFolders=0;for(const process of processes){const processManifest=await ensureProcessDriveStructure(token,manifest.folders.processes.id,process);await apiClient.updateProcess(process.id,{driveFolderId:processManifest.root.id,driveFolderUrl:processManifest.root.webViewLink||`https://drive.google.com/drive/folders/${processManifest.root.id}`,driveSyncedAt:new Date().toISOString()});processFolders++;}showNotification(`Estrutura validada: ${manifest.createdCount} pasta(s) criada(s), ${manifest.existingCount} existente(s) e ${processFolders} processo(s) organizados.`);};

  const [showSampleData, setShowSampleData] = useState(true);

  // Email Templates State with localStorage persistence
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateItem[]>(() => {
    const saved = localStorage.getItem('portal_email_templates');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      {
        id: 'email-reserva', name: 'Solicitação de reserva ao departamento', triggerStage: 'Cadastro inicial',
        recipient: '{{DEPARTAMENTO_EMAIL}}', subject: '[TCC {{PROTOCOLO}}] Solicitação de reserva',
        body: 'Prezados,\n\nSolicitamos reserva para a defesa de {{CAMPO_01}}.\nTítulo: {{TITULO}}\nData e hora: {{DEFESA_DATA_HORA}}\nLocal preferido: {{DEFESA_LOCAL}}\nCaso indisponível, solicitamos o local alternativo: {{LOCAL_ALTERNATIVO}}.\n\nPor favor, confirmem o agendamento ao aluno: {{ALUNO_1_EMAIL}}.\nOrientador: {{ORIENTADOR_NOME}}.\n\nAtenciosamente, Secretaria do curso', attachments: []
      },
      {
        id: 'email-convite',
        name: 'E-mail de Convite para Membros da Banca',
        triggerStage: 'Etapa 2 - Confirmação da Banca pelo Aluno/Orientador',
        recipient: '{{BANCA_EMAILS}}, {{ORIENTADOR_EMAIL}}',
        subject: '[Portal TCC] Convite para Banca Examinadora — -CAMPO_01-',
        body: 'Prezado(a),\n\nConvidamos V. Sa. para compor a Comissão Examinadora da defesa de TCC do discente -CAMPO_01-, sob orientação de -CAMPO_03-.\n\nTítulo: -CAMPO_02-\nData/Horário: -CAMPO_04-\nLocal: -CAMPO_07_LOCAL-\n\nAcesse o portal: {{LINK_PORTAL}}\n\nAtenciosamente,\nComissão de TCC',
        attachments: ['tmpl-convite']
      },
      {
        id: 'email-confirmacao',
        name: 'E-mail de Confirmação de Agendamento',
        triggerStage: 'Etapa 3 - Agendamento Confirmado',
        recipient: '{{ALUNO_EMAIL}}, {{ALUNO_2_EMAIL}}, {{ORIENTADOR_EMAIL}}',
        subject: '[Portal TCC] Agendamento confirmado — -CAMPO_12-',
        body: 'Prezado(a) -CAMPO_01-,\n\nSua defesa de TCC foi agendada e confirmada.\n\nTítulo: -CAMPO_02-\nData/Horário: -CAMPO_04-\nLocal: -CAMPO_07_LOCAL-\n\nAcompanhe o status em seu painel: {{LINK_PORTAL}}\n\nAtenciosamente,\nComissão de TCC',
        attachments: []
      },
      {
        id: 'email-conclusao',
        name: 'E-mail de Envio de Ata e Certificados Assinados',
        triggerStage: 'Etapa 5 - Conclusão e Assinatura do Presidente',
        recipient: '{{PARTICIPANTES_EMAILS}}',
        subject: '[Portal TCC] Documentos da defesa disponíveis — -CAMPO_01-',
        body: 'Prezado(a) -CAMPO_01-,\n\nA ata e as declarações concluídas estão disponíveis no seu painel: {{LINK_PORTAL}}\n\nAtenciosamente,\nComissão de TCC',
        attachments: ['tmpl-ata', 'tmpl-declaracao', 'tmpl-termo']
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('portal_email_templates', JSON.stringify(emailTemplates));
  }, [emailTemplates]);

  const [selectedEmailId, setSelectedEmailId] = useState<string>('email-convite');

  // Process Forms & Questions State (Formulários do Processo)
  const defaultFormTemplates: FormTemplateItem[] = [
    {
      id: 'form-reserva-aluno',
      title: 'Formulário 1: Cadastro inicial do TCC e participantes',
      stage: 'Etapa 1 - Cadastro inicial pelo aluno',
      targetRole: 'Aluno',
      description: 'O aluno autor informa os dados do trabalho, do segundo autor, se houver, do orientador, coorientador e banca. Os e-mails informados passam a ter acesso somente a este processo.',
      questions: REGISTRATION_QUESTIONS.map(q => ({ ...q, expectedAnswer: q.helpText || '' })) as FormQuestionItem[]
    },
    {
      id: 'form-banca-orientador',
      title: 'Formulário 2: Confirmação do local da defesa',
      stage: 'Etapa 2 - Confirmação do local e convite',
      targetRole: 'Aluno',
      description: 'O aluno confirma o local autorizado pelo Departamento de Enfermagem. O convite só é gerado depois desta confirmação.',
      questions: [
        { id: 'q2-1', fieldKey: 'CAMPO_07_LOCAL', label: 'Local confirmado para a defesa', fieldType: 'text', expectedAnswer: 'Sala, auditório ou endereço eletrônico autorizado', required: true },
        { id: 'q2-2', fieldKey: 'COMPROVANTE_LOCAL_URL', label: 'Comprovação da autorização do local (opcional)', fieldType: 'file', expectedAnswer: 'Comprovante opcional em PDF; o aluno declara a confirmação recebida', required: false }
      ]
    },
    {
      id: 'form-parecer-banca',
      title: 'Formulário 3: Conferência, nota e parecer da defesa',
      stage: 'Etapa 4 - Apresentação & Preenchimento da Ata',
      targetRole: 'Orientador',
      description: 'O orientador confere os dados do aluno, registra nota de 0 a 10, resultado e parecer para preencher o DOCX da ata.',
      questions: [
        { id: 'q3-1', fieldKey: 'CAMPO_09', label: 'Resultado da defesa', fieldType: 'select', expectedAnswer: 'Aprovado, aprovado com ressalva ou reprovado', required: true, options: ['Aprovado', 'Aprovado com ressalva', 'Reprovado'] },
        { id: 'q3-grade', fieldKey: 'NOTA_FINAL', label: 'Nota final (0 a 10)', fieldType: 'number', required: true, expectedAnswer: 'Nota com até duas casas decimais', validation: { min: 0, max: 10 } },
        { id: 'q3-2', fieldKey: 'CAMPO_11', label: 'Parágrafo do parecer do orientador', fieldType: 'textarea', expectedAnswer: 'Um ou dois parágrafos sobre apresentação, arguição e resultado; sem repetir abertura ou encerramento da ata', required: true }
      ]
    },
    {
      id: 'form-homologacao-coordenador',
      title: 'Formulário 4: Entrega final e decisão de publicação',
      stage: 'Etapa 5 - Assinatura, Certificados & Repositório',
      targetRole: 'Aluno',
      description: 'Formulário final do aluno para entregar o trabalho, registrar cinco palavras-chave, resumo sintético e decidir a publicação.',
      questions: [
        { id: 'q4-1', fieldKey: 'PALAVRAS_CHAVE', label: 'Cinco palavras-chave', fieldType: 'text', expectedAnswer: 'Exatamente cinco palavras ou expressões, separadas por ponto e vírgula', required: true },
        { id: 'q4-2', fieldKey: 'RESUMO_SINTETICO', label: 'Resumo sintético do trabalho', fieldType: 'textarea', expectedAnswer: 'De três a cinco parágrafos separados por linha em branco', required: true },
        { id: 'q4-3', fieldKey: 'TRABALHO_FINAL_PDF', label: 'Trabalho final em PDF', fieldType: 'file', expectedAnswer: 'Arquivo final completo em PDF', required: true },
        { id: 'q4-4', fieldKey: 'PUBLICAR_TRABALHO_COMPLETO', label: 'Autoriza tornar o trabalho completo público?', fieldType: 'radio', expectedAnswer: 'Sim ou não', required: true, options: ['Sim', 'Não'] },
        { id: 'q4-5', fieldKey: 'INCLUIR_RESUMO_EXPANDIDO', label: 'Deseja anexar um resumo expandido?', fieldType: 'radio', expectedAnswer: 'Sim ou não', required: true, options: ['Sim', 'Não'] },
        { id: 'q4-6', fieldKey: 'RESUMO_EXPANDIDO_PDF', label: 'Resumo expandido em PDF', fieldType: 'file', expectedAnswer: 'Arquivo opcional em PDF', required: false, visibleWhen: { fieldKey: 'INCLUIR_RESUMO_EXPANDIDO', operator: 'EQUALS', value: 'Sim' } },
        { id: 'q4-7', fieldKey: 'PUBLICAR_RESUMO_EXPANDIDO', label: 'Autoriza tornar o resumo expandido público?', fieldType: 'radio', expectedAnswer: 'Sim ou não', required: true, options: ['Sim', 'Não'], visibleWhen: { fieldKey: 'INCLUIR_RESUMO_EXPANDIDO', operator: 'EQUALS', value: 'Sim' } }
      ]
    }
  ];

  const [formTemplates, setFormTemplates] = useState<FormTemplateItem[]>(() => {
    const saved = localStorage.getItem('portal_form_templates');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return defaultFormTemplates;
  });

  const [selectedFormId, setSelectedFormId] = useState<string>('form-reserva-aluno');

  // Save forms to localStorage
  useEffect(() => {
    localStorage.setItem('portal_form_templates', JSON.stringify(formTemplates));
  }, [formTemplates]);

  // Dynamic Flowchart Pipeline State
  const initialPipelineStages: WorkflowStageItem[] = [
    {
      id: 'stg-1',
      stageNumber: 1,
      title: 'Cadastro inicial do TCC',
      triggerEvent: 'TCC_CREATED',
      description: 'Registra autoria, título, orientador, coorientador, banca, data e horário; o local permanece pendente.',
      actions: [
        { id: 'act-200', type: 'form', refId: 'form-banca-orientador', title: 'Libera Formulário 2 (Confirmação do local)', recipientOrDetail: 'Preenchido pelo aluno antes da geração do convite' },
        { id: 'act-102', type: 'email', refId: 'email-reserva', title: 'Solicita reserva ao departamento', recipientOrDetail: 'Destinatário definido pelo Master' }
      ]
    },
    {
      id: 'stg-2',
      stageNumber: 2,
      title: 'Confirmação do local e convite',
      triggerEvent: 'LOCATION_CONFIRMED',
      description: 'Depois da comprovação do local, gera o convite oficial e envia o e-mail aos participantes.',
      actions: [
        { id: 'act-201', type: 'doc', refId: 'tmpl-convite', title: 'Gera Convite Oficial de Banca (.docx)', recipientOrDetail: 'Salvo em Google Drive /Modelos' },
        { id: 'act-202', type: 'email', refId: 'email-convite', title: 'Dispara E-mail com Convite para Examinadores', recipientOrDetail: 'Destinatários: membros da banca e orientador' }
      ]
    },
    {
      id: 'stg-3',
      stageNumber: 3,
      title: 'Preparação e realização da defesa',
      triggerEvent: 'INVITATION_SENT',
      description: 'Mantém os participantes informados e orienta o acesso do orientador no dia da avaliação.',
      actions: [
        { id: 'act-301', type: 'form', refId: 'form-parecer-banca', title: 'Libera Formulário 3 (Resultado e parecer)', recipientOrDetail: 'Disponível ao orientador a partir da defesa' },
        { id: 'act-302', type: 'email', refId: 'email-confirmacao', title: 'Lembrete da defesa e acesso à avaliação', recipientOrDetail: 'Destinatários: aluno, orientador e banca' }
      ]
    },
    {
      id: 'stg-4',
      stageNumber: 4,
      title: 'Apresentação & Preenchimento da Ata',
      triggerEvent: 'EVALUATION_SUBMITTED',
      description: 'O orientador confere os dados, registra o resultado e escreve o parágrafo variável do parecer.',
      actions: [
        { id: 'act-401', type: 'doc', refId: 'tmpl-ata', title: 'Gera Ata de Defesa e envia à Asten', recipientOrDetail: 'Assinatura do orientador' },
        { id: 'act-402', type: 'form', refId: 'form-homologacao-coordenador', title: 'Libera Formulário 4 (Entrega final)', recipientOrDetail: 'Disponível ao aluno após a avaliação' }
      ]
    },
    {
      id: 'stg-5',
      stageNumber: 5,
      title: 'Entrega final, assinaturas e conclusão',
      triggerEvent: 'REPOSITORY_SUBMITTED',
      description: 'Arquiva trabalho, resumo, cinco palavras-chave e decisão de publicação; gera somente os documentos aplicáveis.',
      actions: [
        { id: 'act-502', type: 'doc', refId: 'tmpl-termo', title: 'Gera Termo de Autorização de Repositório', recipientOrDetail: 'Somente quando houver pedido de publicação; aluno(s) e orientador na prioridade 1', condition: { fieldKey: 'PUBLICAR_TRABALHO', operator: 'IS_TRUE' } },
      ]
    },
    { id: 'stg-president', stageNumber: 6, title: 'Declaração da banca', triggerEvent: 'PUBLICATION_CLEARED', description: 'Somente após Ata e Termo aplicável assinados e arquivados.', actions: [{ id: 'act-501', type: 'doc', refId: 'tmpl-declaracao', title: 'Envia declaração para assinatura do Presidente', recipientOrDetail: 'Presidente da Comissão' }] },
    {
      id: 'stg-6',
      stageNumber: 6,
      title: 'Conclusão e entrega dos documentos assinados',
      triggerEvent: 'PROCESS_COMPLETED',
      description: 'Somente depois que todos os documentos aplicáveis retornarem assinados da Asten e forem arquivados no Drive.',
      actions: [
        { id: 'act-601', type: 'email', refId: 'email-conclusao', title: 'Envia documentos assinados aos participantes', recipientOrDetail: 'Destinatários: todos os participantes do processo' }
      ]
    }
  ];

  const [workflowStages, setWorkflowStages] = useState<WorkflowStageItem[]>(() => {
    const saved = localStorage.getItem('workflow_pipeline_stages');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return initialPipelineStages;
  });

  const [draggedPayload, setDraggedPayload] = useState<{ type: 'doc' | 'email' | 'form' | 'action'; id: string; title: string; recipientOrDetail?: string } | null>(null);
  const [addingToStageId, setAddingToStageId] = useState<string | null>(null);

  // Save workflow pipeline to localStorage on changes
  useEffect(() => {
    localStorage.setItem('workflow_pipeline_stages', JSON.stringify(workflowStages));
  }, [workflowStages]);

  const handleMoveStage = (index: number, direction: 'left' | 'right') => {
    const newStages = [...workflowStages];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newStages.length) return;
    
    const temp = newStages[index];
    newStages[index] = newStages[targetIndex];
    newStages[targetIndex] = temp;

    const renumbered = newStages.map((stg, i) => ({ ...stg, stageNumber: i + 1 }));
    setWorkflowStages(renumbered);
    showNotification(`Etapa "${temp.title}" movida para Posição ${targetIndex + 1}!`);
  };

  const handleAddStage = () => {
    const newNum = workflowStages.length + 1;
    const newStage: WorkflowStageItem = {
      id: `stg-${Date.now()}`,
      stageNumber: newNum,
      title: `Nova Etapa ${newNum}`,
      triggerEvent: 'Evento acionado pelo usuário ou sistema',
      description: 'Descreva os procedimentos desta nova etapa.',
      actions: []
    };
    setWorkflowStages([...workflowStages, newStage]);
    showNotification(`Nova Etapa ${newNum} criada com sucesso no fluxo!`);
  };

  const handleDeleteStage = (stageId: string) => {
    if (workflowStages.length <= 1) {
      showNotification('O fluxo precisa ter pelo menos 1 etapa.');
      return;
    }
    const filtered = workflowStages.filter(s => s.id !== stageId);
    const renumbered = filtered.map((stg, i) => ({ ...stg, stageNumber: i + 1 }));
    setWorkflowStages(renumbered);
    showNotification('Etapa removida do fluxo de trabalho.');
  };

  const handleUpdateStage = (stageId: string, fields: Partial<WorkflowStageItem>) => {
    setWorkflowStages(prev => prev.map(s => s.id === stageId ? { ...s, ...fields } : s));
  };

  const handleRemoveAction = (stageId: string, actionId: string) => {
    setWorkflowStages(prev => prev.map(s => {
      if (s.id === stageId) {
        return {
          ...s,
          actions: s.actions.filter(a => a.id !== actionId)
        };
      }
      return s;
    }));
    showNotification('Item removido da etapa.');
  };

  const handleMoveAction = (stageId: string, actionIndex: number, direction: 'up' | 'down') => {
    setWorkflowStages(prev => prev.map(s => {
      if (s.id === stageId) {
        const newActions = [...s.actions];
        const targetIndex = direction === 'up' ? actionIndex - 1 : actionIndex + 1;
        if (targetIndex < 0 || targetIndex >= newActions.length) return s;
        const temp = newActions[actionIndex];
        newActions[actionIndex] = newActions[targetIndex];
        newActions[targetIndex] = temp;
        return { ...s, actions: newActions };
      }
      return s;
    }));
  };

  const handleAddItemToStage = (stageId: string, itemType: 'doc' | 'email' | 'form' | 'action', itemObj?: any, customTitle?: string) => {
    let title = '';
    let recipientOrDetail = '';
    let refId = '';

    if (itemType === 'doc' && itemObj) {
      title = `Gera ${itemObj.label || itemObj.fileName} (.docx)`;
      recipientOrDetail = `Modelo: ${itemObj.fileName}`;
      refId = itemObj.id;
    } else if (itemType === 'email' && itemObj) {
      title = `Dispara ${itemObj.name}`;
      recipientOrDetail = `Assunto: ${itemObj.subject}`;
      refId = itemObj.id;
    } else if (itemType === 'form' && itemObj) {
      title = `Preenchimento: ${itemObj.title}`;
      recipientOrDetail = `Preenchido por ${itemObj.targetRole} (${itemObj.questions?.length || 0} campos)`;
      refId = itemObj.id;
    } else if (itemType === 'action') {
      title = customTitle || 'Ação Automática de Sistema';
      recipientOrDetail = 'Ação ou validação realizada no portal';
    }

    const newAction: WorkflowActionItem = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: itemType,
      refId,
      title,
      recipientOrDetail
    };

    setWorkflowStages(prev => prev.map(s => {
      if (s.id === stageId) {
        return { ...s, actions: [...s.actions, newAction] };
      }
      return s;
    }));

    setAddingToStageId(null);
    showNotification(`Item "${title}" inserido na etapa!`);
  };

  // Process Forms Management Handlers
  const currentForm = formTemplates.find((f) => f.id === selectedFormId) || formTemplates[0];

  const handleAddNewFormTemplate = () => {
    const newId = `form-${Date.now()}`;
    const newForm: FormTemplateItem = {
      id: newId,
      title: `Formulário ${formTemplates.length + 1}: Novo Formulário de Processo`,
      stage: 'Etapa 1 - Reserva & Formulário do Aluno',
      targetRole: 'Aluno',
      description: 'Descrição e orientações gerais para o preenchimento deste formulário no portal.',
      questions: [
        { id: `q-${Date.now()}-1`, fieldKey: 'CAMPO_01', label: 'Campo Exemplo 1', fieldType: 'text', expectedAnswer: 'Preenchimento obrigatório', required: true }
      ]
    };
    setFormTemplates([...formTemplates, newForm]);
    setSelectedFormId(newId);
    showNotification('Novo formulário criado! Adicione os campos desejados.');
  };

  const handleDeleteFormTemplate = (formId: string) => {
    if (formTemplates.length <= 1) {
      showNotification('O sistema deve manter ao menos 1 formulário configurado.');
      return;
    }
    const updated = formTemplates.filter(f => f.id !== formId);
    setFormTemplates(updated);
    setSelectedFormId(updated[0].id);
    showNotification('Formulário excluído do sistema.');
  };

  const handleAddQuestionToForm = () => {
    // Generate next available field key e.g. CAMPO_14
    let maxNum = 0;
    formTemplates.forEach(f => f.questions.forEach(q => {
      const match = q.fieldKey ? q.fieldKey.match(/CAMPO_(\d+)/i) : null;
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }));
    const nextNum = (maxNum + 1).toString().padStart(2, '0');
    const newFieldKey = `CAMPO_${nextNum}`;

    const newQ: FormQuestionItem = {
      id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      fieldKey: newFieldKey,
      label: 'Novo Campo do Processo',
      fieldType: 'text',
      expectedAnswer: 'Descreva a resposta ou regra esperada',
      required: true
    };
    setFormTemplates(prev => prev.map(f => {
      if (f.id === currentForm.id) {
        return { ...f, questions: [...f.questions, newQ] };
      }
      return f;
    }));
    showNotification(`Novo campo (-${newFieldKey}-) inserido no formulário!`);
  };

  const handleUpdateQuestion = (formId: string, qId: string, fields: Partial<FormQuestionItem>) => {
    setFormTemplates(prev => prev.map(f => {
      if (f.id === formId) {
        return {
          ...f,
          questions: f.questions.map(q => q.id === qId ? { ...q, ...fields } : q)
        };
      }
      return f;
    }));
  };

  const handleDeleteQuestion = (formId: string, qId: string) => {
    setFormTemplates(prev => prev.map(f => {
      if (f.id === formId) {
        return {
          ...f,
          questions: f.questions.filter(q => q.id !== qId)
        };
      }
      return f;
    }));
  };

  const handleResetWorkflow = () => {
    setWorkflowStages(initialPipelineStages);
    localStorage.removeItem('workflow_pipeline_stages');
    showNotification('Fluxograma restaurado para o padrão inicial do portal.');
  };

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Helper to construct highly accurate URLs based on configured Google Drive models folder
  const getEffectiveFileUrl = (doc: any) => {
    if (!doc) return 'https://drive.google.com';
    if (doc.driveFileId && !doc.driveFileId.startsWith('tmpl-')) {
      return `https://docs.google.com/document/d/${doc.driveFileId}/edit`;
    }
    // Parse folder ID from driveModelosFolderUrl
    const match = driveModelosFolderUrl.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      const folderId = match[1];
      // Search query inside folder for files with this name
      return `https://drive.google.com/drive/search?q=parent:'${folderId}'%20and%20title%20contains%20'${encodeURIComponent(doc.fileName.replace(/\.docx$/, '').replace(/\.gdoc$/, ''))}'`;
    }
    return driveModelosFolderUrl || 'https://drive.google.com';
  };

  // Helper to extract File ID and generate Google Drive File Preview Link
  const getGoogleDrivePreviewUrl = (doc: any) => {
    if (!doc) return '';
    let fileId = doc.driveFileId || '';
    
    // If no direct file ID is stored, try to parse it from the driveFileUrl
    if (!fileId && doc.driveFileUrl) {
      const docMatch = doc.driveFileUrl.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      const fileMatch = doc.driveFileUrl.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
      const idParamMatch = doc.driveFileUrl.match(/[?&]id=([a-zA-Z0-9-_]+)/);
      
      if (docMatch) fileId = docMatch[1];
      else if (fileMatch) fileId = fileMatch[1];
      else if (idParamMatch) fileId = idParamMatch[1];
    }
    
    if (!fileId || fileId.startsWith('tmpl-') || fileId.includes('modelo_ufes') || fileId.length < 15) {
      return ''; // Indicates it is using mock initial data
    }
    
    // For Word files (.docx) or Google Docs, the /preview path of Google Drive File link is the absolute gold standard for embedding
    return `https://drive.google.com/file/d/${fileId}/preview`;
  };

  // Helper for current selected document
  const currentDoc = docTemplates.find((d) => d.id === selectedDocId) || docTemplates[0];

  // Helper for current selected email
  const currentEmail = emailTemplates.find((e) => e.id === selectedEmailId) || emailTemplates[0];

  // Toggle Attachment on Selected Email Template
  const handleToggleEmailAttachment = (docId: string) => {
    setEmailTemplates(prev => prev.map(e => {
      if (e.id === currentEmail.id) {
        const currentList = e.attachments || [];
        const exists = currentList.includes(docId);
        const updated = exists ? currentList.filter(id => id !== docId) : [...currentList, docId];
        return { ...e, attachments: updated };
      }
      return e;
    }));
    showNotification('Anexos do e-mail atualizados!');
  };

  // Find which form(s) and specific question(s) correspond to a field tag/label
  const findCorrespondingFormsForField = (fieldKey: string, fieldLabel: string) => {
    const results: Array<{ formTitle: string; questionLabel: string; fieldKey: string }> = [];
    const searchKey = fieldKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    const searchLabel = fieldLabel.toLowerCase().trim();

    formTemplates.forEach((form) => {
      form.questions.forEach((q) => {
        const qKey = (q.fieldKey || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const qLabel = (q.label || '').toLowerCase().trim();

        // Match either by fieldKey (e.g. "CAMPO_01") or label similarity
        if (
          (qKey && qKey === searchKey) ||
          (qKey && searchKey.includes(qKey)) ||
          (qKey && qKey.includes(searchKey)) ||
          qLabel === searchLabel ||
          (qLabel.length > 3 && searchLabel.length > 3 && (qLabel.includes(searchLabel) || searchLabel.includes(qLabel)))
        ) {
          results.push({
            formTitle: form.title,
            questionLabel: q.label,
            fieldKey: q.fieldKey || ''
          });
        }
      });
    });

    return results;
  };

  // Helper to check if a field already exists in other documents for duplicate warning
  const findExistingDocFieldDocs = (fieldNameOrKey: string, excludeDocId: string): string[] => {
    if (!fieldNameOrKey || !fieldNameOrKey.trim()) return [];
    const cleanSearch = fieldNameOrKey.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const matches: string[] = [];
    docTemplates.forEach((doc) => {
      if (doc.id === excludeDocId) return;
      const hasField = (doc.fields || []).some(
        (f) =>
          f.key.toLowerCase() === cleanSearch ||
          f.label.toLowerCase().includes(fieldNameOrKey.trim().toLowerCase())
      );
      if (hasField) {
        matches.push(doc.label);
      }
    });
    return matches;
  };

  // Add field to current document
  const handleAddDocField = () => {
    if (!newDocFieldName.trim()) return;
    const cleanLabel = newDocFieldName.trim();
    const cleanKey = cleanLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const cleanDesc = newDocFieldDesc.trim() || `Informação esperada para o campo ${cleanLabel}`;

    setDocTemplates((prev) =>
      prev.map((doc) => {
        if (doc.id === currentDoc.id) {
          const currentFields = doc.fields || [];
          if (currentFields.some((f) => f.key === cleanKey)) {
            portalNotice(`O campo "${cleanLabel}" ({{${cleanKey}}}) já está cadastrado neste modelo!`);
            return doc;
          }
          return {
            ...doc,
            fields: [...currentFields, { key: cleanKey, label: cleanLabel, description: cleanDesc }]
          };
        }
        return doc;
      })
    );

    setNewDocFieldName('');
    setNewDocFieldDesc('');
    showNotification(`Campo "{{${cleanKey}}}" vinculado ao modelo "${currentDoc.label}"!`);
  };

  // Remove field from current document
  const handleRemoveDocField = (fieldKey: string) => {
    setDocTemplates((prev) =>
      prev.map((doc) => {
        if (doc.id === currentDoc.id) {
          return {
            ...doc,
            fields: (doc.fields || []).filter((f) => f.key !== fieldKey)
          };
        }
        return doc;
      })
    );
    showNotification(`Campo "{{${fieldKey}}}" removido deste modelo.`);
  };

  // Add dynamic variable tag to current document
  const handleAddVariable = () => {
    if (!newVarInput.trim()) return;
    let varFormatted = newVarInput.trim();
    if (!varFormatted.startsWith('-')) varFormatted = '-' + varFormatted;
    if (!varFormatted.endsWith('-')) varFormatted = varFormatted + '-';
    varFormatted = varFormatted.toUpperCase();

    setDocTemplates((prev) =>
      prev.map((doc) => {
        if (doc.id === currentDoc.id) {
          if (doc.variables.includes(varFormatted)) return doc;
          return { ...doc, variables: [...doc.variables, varFormatted] };
        }
        return doc;
      })
    );
    setNewVarInput('');
    showNotification(`Tag ${varFormatted} adicionada ao mapeamento do modelo!`);
  };

  // Delete variable tag from current document
  const handleDeleteVariable = (varName: string) => {
    setDocTemplates((prev) =>
      prev.map((doc) => {
        if (doc.id === currentDoc.id) {
          return { ...doc, variables: doc.variables.filter((v) => v !== varName) };
        }
        return doc;
      })
    );
    showNotification(`Tag ${varName} removida do mapeamento.`);
  };

  // Rename variable tag and update all occurrences in document text
  const handleRenameVariable = async (oldVarName: string) => {
    const updated = (await portalPrompt(`Digite a nova tag para substituir "${oldVarName}" (ex: -CAMPO_01_NOME-):`, oldVarName));
    if (!updated || !updated.trim() || updated.trim() === oldVarName) return;

    let newTagFormatted = updated.trim();
    if (!newTagFormatted.startsWith('-')) newTagFormatted = '-' + newTagFormatted;
    if (!newTagFormatted.endsWith('-')) newTagFormatted = newTagFormatted + '-';
    newTagFormatted = newTagFormatted.toUpperCase();

    setDocTemplates((prev) =>
      prev.map((doc) => {
        if (doc.id === currentDoc.id) {
          const newVars = doc.variables.map((v) => (v === oldVarName ? newTagFormatted : v));
          const newText = doc.templateContentText.split(oldVarName).join(newTagFormatted);
          return { ...doc, variables: newVars, templateContentText: newText };
        }
        return doc;
      })
    );
    showNotification(`Tag ${oldVarName} alterada para ${newTagFormatted} no modelo e no texto!`);
  };

  // Insert tag into document text and ensure it's registered
  const handleInsertTagToText = (tag: string) => {
    setDocTemplates((prev) =>
      prev.map((doc) => {
        if (doc.id === currentDoc.id) {
          const hasVar = doc.variables.includes(tag);
          const newVars = hasVar ? doc.variables : [...doc.variables, tag];
          const newText = doc.templateContentText + (doc.templateContentText.endsWith(' ') || doc.templateContentText.endsWith('\n') ? '' : ' ') + tag;
          return { ...doc, variables: newVars, templateContentText: newText };
        }
        return doc;
      })
    );
    showNotification(`Tag ${tag} inserida no conteúdo do documento!`);
  };

  // Render Live PDF/Doc Preview evaluating conditional logic & scenario variables
  const renderLiveDocumentPreview = (
    templateText: string,
    scenario: {
      numAlunos: '1' | '2';
      temCoorientador: boolean;
      localFormato: 'PRESENCIAL' | 'ONLINE' | 'HIBRIDO';
    }
  ): string => {
    let text = templateText || '';

    // 1. Evaluate {{SE_DUPLA}} ... {{FIM_DUPLA}} vs {{SE_UNICO}} ... {{FIM_UNICO}}
    if (scenario.numAlunos === '1') {
      text = text.replace(/\{\{SE_DUPLA\}\}[\s\S]*?\{\{FIM_DUPLA\}\}/gi, '');
      text = text.replace(/\{\{SE_UNICO\}\}([\s\S]*?)\{\{FIM_UNICO\}\}/gi, '$1');
    } else {
      text = text.replace(/\{\{SE_UNICO\}\}[\s\S]*?\{\{FIM_UNICO\}\}/gi, '');
      text = text.replace(/\{\{SE_DUPLA\}\}([\s\S]*?)\{\{FIM_DUPLA\}\}/gi, '$1');
    }

    // 2. Evaluate {{SE_COORIENTADOR}} ... {{FIM_COORIENTADOR}}
    if (!scenario.temCoorientador) {
      text = text.replace(/\{\{SE_COORIENTADOR\}\}[\s\S]*?\{\{FIM_COORIENTADOR\}\}/gi, '');
    } else {
      text = text.replace(/\{\{SE_COORIENTADOR\}\}([\s\S]*?)\{\{FIM_COORIENTADOR\}\}/gi, '$1');
    }

    // 3. Evaluate {{SE_ONLINE}} / {{SE_PRESENCIAL}} / {{SE_HIBRIDO}}
    if (scenario.localFormato === 'ONLINE') {
      text = text.replace(/\{\{SE_PRESENCIAL\}\}[\s\S]*?\{\{FIM_PRESENCIAL\}\}/gi, '');
      text = text.replace(/\{\{SE_HIBRIDO\}\}[\s\S]*?\{\{FIM_HIBRIDO\}\}/gi, '');
      text = text.replace(/\{\{SE_ONLINE\}\}([\s\S]*?)\{\{FIM_ONLINE\}\}/gi, '$1');
    } else if (scenario.localFormato === 'PRESENCIAL') {
      text = text.replace(/\{\{SE_ONLINE\}\}[\s\S]*?\{\{FIM_ONLINE\}\}/gi, '');
      text = text.replace(/\{\{SE_HIBRIDO\}\}[\s\S]*?\{\{FIM_HIBRIDO\}\}/gi, '');
      text = text.replace(/\{\{SE_PRESENCIAL\}\}([\s\S]*?)\{\{FIM_PRESENCIAL\}\}/gi, '$1');
    } else {
      text = text.replace(/\{\{SE_ONLINE\}\}[\s\S]*?\{\{FIM_ONLINE\}\}/gi, '');
      text = text.replace(/\{\{SE_PRESENCIAL\}\}[\s\S]*?\{\{FIM_PRESENCIAL\}\}/gi, '');
      text = text.replace(/\{\{SE_HIBRIDO\}\}([\s\S]*?)\{\{FIM_HIBRIDO\}\}/gi, '$1');
    }

    // 4. Substitute sample variables
    const sampleMap: Record<string, string> = {
      '-CAMPO_01-': scenario.numAlunos === '1'
        ? 'MARIANA SILVA SANTOS (Matrícula: 2022101452)'
        : 'MARIANA SILVA SANTOS (Matrícula: 2022101452) e CARLOS EDUARDO OLIVEIRA (Matrícula: 2022101980)',
      '-CAMPO_02-': 'Título demonstrativo do Trabalho de Conclusão de Curso',
      '-CAMPO_03-': 'Prof.ª Dr.ª Luciana de Cássia Nunes Nascimento',
      '-CAMPO_04-': '25 de Novembro de 2026, às 14h00min',
      '-CAMPO_06-': 'Prof.ª Maria Costa (Instituição interna) e Prof. Fernando Souza (Instituição externa)',
      '-CAMPO_07_LOCAL-': scenario.localFormato === 'ONLINE'
        ? 'Transmissão Online via Google Meet (meet.google.com/ufes-tcc-enf)'
        : scenario.localFormato === 'PRESENCIAL'
        ? 'Sala de defesas da unidade acadêmica'
        : 'Sessão híbrida: sala de defesas e transmissão on-line',
      '-CAMPO_09-': 'APROVADO COM DISTINÇÃO',
      '-CAMPO_11-': 'Trabalho de excelente qualidade acadêmica, aprovado sem ressalvas e recomendado para publicação em periódico qualificado.',
      '-CAMPO_12-': '23068.019842/2026-11',
      '-CAMPO_13-': 'https://repositorio.ufes.br/handle/123456789/49102'
    };

    Object.entries(sampleMap).forEach(([tag, val]) => {
      text = text.replaceAll(tag, val);
    });

    return text;
  };

  // Helper to insert conditional tag blocks into document text
  const handleInsertConditionalBlock = (type: 'dupla' | 'coorientador' | 'online' | 'presencial') => {
    let block = '';
    if (type === 'dupla') {
      block = '\n{{SE_DUPLA}}\nDiscentes Autores (Em Dupla): -CAMPO_01-\n{{FIM_DUPLA}}\n';
    } else if (type === 'coorientador') {
      block = '\n{{SE_COORIENTADOR}}\nCoorientador(a): Prof. Dr. Rodrigo Ribeiro Santos\n{{FIM_COORIENTADOR}}\n';
    } else if (type === 'online') {
      block = '\n{{SE_ONLINE}}\nTransmissão Online via Google Meet: meet.google.com/ufes-tcc-enf\n{{FIM_ONLINE}}\n';
    } else if (type === 'presencial') {
      block = '\n{{SE_PRESENCIAL}}\nLocal: sala de defesas da unidade acadêmica\n{{FIM_PRESENCIAL}}\n';
    }

    setDocTemplates((prev) =>
      prev.map((d) => {
        if (d.id === currentDoc.id) {
          return { ...d, templateContentText: d.templateContentText + block };
        }
        return d;
      })
    );
    showNotification(`Bloco condicional "${type.toUpperCase()}" inserido no modelo!`);
  };

  // Google Drive Models Synchronizer & Mirror
  const [isSyncingModels, setIsSyncingModels] = useState(false);

  const extractDriveFolderId = (url: string): string => {
    if (!url) return '';
    const clean = url.trim();
    const folderMatch = clean.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) return folderMatch[1];
    const idMatch = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) return idMatch[1];
    if (!clean.includes('/') && clean.length >= 15) return clean;
    return '';
  };

  const handleSyncAllModelsWithDrive = async () => {
    setIsSyncingModels(true);
    try {
      const token = await getValidToken();
      if (!token) {
        setIsSyncingModels(false);
        return;
      }

      showNotification('Sincronizando e espelhando arquivos do Google Drive...');
      const { getOrCreateModelosFolder, listDriveFiles } = await import('../services/googleDriveService');

      let targetFolderId = extractDriveFolderId(driveModelosFolderUrl);

      if (!targetFolderId) {
        const modelosFolder = await getOrCreateModelosFolder(token);
        targetFolderId = modelosFolder.id;
      }

      // Query all files in the target folder (not trashed)
      const query = `'${targetFolderId}' in parents and trashed = false`;
      const driveDocs = await listDriveFiles(token, query);

      if (driveDocs && driveDocs.length > 0) {
        const syncedTemplates: DocTemplateItem[] = driveDocs.map((dDoc) => ({
          id: dDoc.id,
          type: dDoc.name.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
          label: dDoc.name.replace(/\.docx$/i, '').replace(/\.gdoc$/i, ''),
          fileName: dDoc.name,
          description: `Arquivo espelhado da pasta no Google Drive`,
          variables: [],
          fields: [],
          templateContentText: '',
          lastUpdated: dDoc.modifiedTime ? new Date(dDoc.modifiedTime).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR'),
          driveFileId: dDoc.id,
          driveFileUrl: dDoc.webViewLink || `https://docs.google.com/document/d/${dDoc.id}/edit`
        }));

        setDocTemplates(syncedTemplates);
        setSelectedDocId(syncedTemplates[0].id);
        showNotification(`🟢 ${syncedTemplates.length} arquivo(s) espelhado(s) com sucesso da pasta do Google Drive!`);
      } else {
        showNotification('ℹ️ Nenhum arquivo encontrado nesta pasta do Google Drive.');
      }
    } catch (err: any) {
      console.error(err);
      showNotification(`Aviso ao conectar no Google Drive: ${err.message || err}`);
    } finally {
      setIsSyncingModels(false);
    }
  };

  // Cria apenas o slot de metadados. O programa nunca fabrica conteúdo de
  // modelo: o Master precisa vincular ou enviar seu próprio DOCX.
  const handleAddNewDocTemplate = async () => {
    const label = (await portalPrompt('Digite o título do novo slot de modelo:'));
    if (!label || !label.trim()) return;

    const newId = `tmpl-${Date.now()}`;
    const typeKey = label.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const cleanFileName = label.trim().replace(/[^a-zA-Z0-9_]/g, '_') + '.docx';
    const newDoc: DocTemplateItem = {
      id: newId,
      type: typeKey,
      label: label.trim(),
      fileName: cleanFileName,
      description: 'Slot aguardando DOCX próprio do usuário Master.',
      variables: [],
      templateContentText: '',
      lastUpdated: '',
      driveFileUrl: ''
    };
    const updatedList = [...docTemplates, newDoc];
    setDocTemplates(updatedList);
    setSelectedDocId(newId);
    showNotification(`Slot "${label.trim()}" criado. Vincule ou envie o DOCX próprio do curso para ativá-lo.`);
  };

  // Save document template changes and mirror to Google Drive
  const handleSaveCurrentDocTemplate = async (doc: DocTemplateItem) => {
    // 1. Save locally
    const updated = docTemplates.map((d) =>
      d.id === doc.id ? { ...d, lastUpdated: new Date().toLocaleString('pt-BR') } : d
    );
    setDocTemplates(updated);

    showNotification(`Modelo "${doc.label}" Salvo localmente!`);

    // 2. Push/mirror to Google Docs
    try {
      const token = await getValidToken();
      if (token) {
        showNotification(`Sincronizando "${doc.label}" com Google Drive...`);
        const { getOrCreateModelosFolder, listDriveFiles } = await import('../services/googleDriveService');
        
        const modelosFolder = await getOrCreateModelosFolder(token);
        const driveName = cleanFileNameForDrive(doc.fileName);
        
        // Find existing file on Drive
        const query = `name = '${driveName}' and mimeType = 'application/vnd.google-apps.document' and '${modelosFolder.id}' in parents and trashed = false`;
        const existingFiles = await listDriveFiles(token, query);
        
        let fileId = doc.driveFileId;
        if (existingFiles.length > 0) {
          fileId = existingFiles[0].id;
        }

        if (fileId) {
          // Sync renaming & content
          await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: driveName })
          });

          await updateGoogleDocContent(token, fileId, doc.templateContentText);
          setDocTemplates(prev => prev.map(d => d.id === doc.id ? {
            ...d,
            driveFileId: fileId,
            driveFileUrl: `https://docs.google.com/document/d/${fileId}/edit`,
            lastUpdated: new Date().toLocaleString('pt-BR')
          } : d));
          showNotification(`🟢 Sucesso: O modelo "${doc.label}" foi atualizado e espelhado no Google Docs!`);
        } else {
          showNotification('Criando arquivo no Google Docs para espelhamento...');
          const metadata = {
            name: driveName,
            mimeType: 'application/vnd.google-apps.document',
            parents: [modelosFolder.id]
          };
          const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
          });
          
          if (createRes.ok) {
            const newFile = await createRes.json();
            await updateGoogleDocContent(token, newFile.id, doc.templateContentText);
            setDocTemplates(prev => prev.map(d => d.id === doc.id ? {
              ...d,
              driveFileId: newFile.id,
              driveFileUrl: `https://docs.google.com/document/d/${newFile.id}/edit`,
              lastUpdated: new Date().toLocaleString('pt-BR')
            } : d));
            showNotification(`🟢 Sucesso: O modelo "${doc.label}" foi criado e espelhado na pasta /Modelos!`);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      showNotification(`Salvo localmente, mas não pôde atualizar no Google Drive: ${err.message || err}`);
    }
  };

  // Delete current document template
  const handleDeleteDocTemplate = async (id: string) => {
    if (docTemplates.length <= 1) {
      portalNotice('Não é possível excluir todos os modelos. Mantenha pelo menos um.');
      return;
    }
    if ((await portalConfirm('Tem certeza de que deseja excluir este modelo de documento?'))) {
      const remaining = docTemplates.filter((d) => d.id !== id);
      setDocTemplates(remaining);
      setSelectedDocId(remaining[0].id);
      showNotification('Modelo removido da lista.');
    }
  };

  // Add new email template
  const handleAddNewEmailTemplate = async () => {
    const name = (await portalPrompt('Digite o nome do novo modelo de e-mail (ex: E-mail de Lembrete de Defesa):'));
    if (name && name.trim()) {
      const newId = `email-${Date.now()}`;
      const newEmail: EmailTemplateItem = {
        id: newId,
        name: name.trim(),
        triggerStage: 'Etapa 3 - Lembrete Automático 48h Antes',
        subject: '[Portal TCC] Lembrete de defesa',
        body: 'Prezado(a) {{ALUNO_NOME}},\n\nEste é um lembrete automático sobre sua defesa de TCC agendada para {{DATA_DEFESA}} às {{HORARIO}} no {{LOCAL}}.\n\nAtenciosamente,\nComissão de TCC'
      };
      setEmailTemplates((prev) => [...prev, newEmail]);
      setSelectedEmailId(newId);
      showNotification('Novo modelo de e-mail criado com sucesso!');
    }
  };

  // Delete current email template
  const handleDeleteEmailTemplate = async (id: string) => {
    if (emailTemplates.length <= 1) {
      portalNotice('Mantenha pelo menos um modelo de e-mail cadastrado.');
      return;
    }
    if ((await portalConfirm('Deseja remover este modelo de e-mail do fluxo?'))) {
      const remaining = emailTemplates.filter((e) => e.id !== id);
      setEmailTemplates(remaining);
      setSelectedEmailId(remaining[0].id);
      showNotification('Modelo de e-mail removido.');
    }
  };

  return (
    <div id="configuracoes-page-container" className="space-y-3.5 max-w-7xl mx-auto py-1.5">
      {/* Floating Success Message Notification */}
      {successMsg && (
        <div className="bg-slate-100 border border-slate-300 text-slate-900 px-4 py-3 rounded-sm text-xs font-bold flex items-center gap-2 shadow-sm animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-slate-700 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEÇÃO PRINCIPAL: PERSONALIZAÇÃO DO PORTAL                                 */}
      {/* ========================================================================= */}
      {isMasterAdmin && (
        <section id="section-personalizacao-portal" className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => setPersonalizationHubOpen(true)}
            className="w-full bg-slate-100/90 hover:bg-slate-200/80 active:bg-slate-300 text-slate-900 p-3.5 sm:p-4 flex items-center justify-between gap-3 text-left transition-all cursor-pointer rounded-2xl group"
          >
            <div className="flex items-center gap-2">
              <Palette className="w-4.5 h-4.5 text-slate-800 group-hover:scale-105 transition-transform" />
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
                Personalização do Portal
              </h2>
            </div>
            <Sliders className="w-4 h-4 text-slate-600 group-hover:text-slate-900 transition-colors shrink-0" />
          </button>
        </section>
      )}
      {/* 1. SINCRONIZAÇÃO */}
      <section id="google-workspace-sync-section" className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleSection('sync')}
          className={`w-full bg-slate-100/90 hover:bg-slate-200/80 text-slate-900 p-3.5 sm:p-4 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${openSections.sync ? 'border-b border-slate-200 rounded-t-2xl' : 'rounded-2xl'}`}
        >
          <div className="flex items-center">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">Sincronização e acessos</h2>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-extrabold text-slate-700 uppercase hidden sm:inline-block">
              {openSections.sync ? 'Recolher' : 'Expandir'}
            </span>
            {openSections.sync ? (
              <ChevronUp className="w-5 h-5 text-slate-700" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-700" />
            )}
          </div>
        </button>

        {openSections.sync && (
          <div className="p-3 sm:p-4 border-t border-slate-200 space-y-4">

            {isMasterAdmin && settings && (
              <section id="administrative-identity-panel" className="overflow-hidden rounded-xl border border-slate-300 bg-[#e1e6e9] shadow-sm">
                <div className="border-b border-slate-300 px-3 py-2">
                  <h3 className="text-xs font-black uppercase tracking-wide text-slate-900">Secretaria, Presidência e Comissão</h3>
                  <p className="mt-0.5 text-[10px] leading-4 text-slate-600">E-mail de acesso, contato público, responsável técnico, Presidência e integrantes adicionais em um único cadastro visual.</p>
                </div>
                <div className="space-y-2 p-2.5">
                  <MasterAndPresidentConfigForm settings={settings} onSettingsUpdated={() => { void refreshAuth(); showNotification('Contas administrativas atualizadas.'); }} showNotification={showNotification} />
                  <CommissionIdentityPanel isMaster />
                </div>
              </section>
            )}
            <InfrastructureIntegrationsPanel isMaster={isMasterAdmin} />
            {isMasterAdmin && <AuthorizedStudentsPanel canManage />}

          </div>
        )}
      </section>

      {/* 2. SISTEMA INTEGRADO DE FLUXOS, MODELOS, E-MAILS E FORMULÁRIOS */}
      {isMasterAdmin && <section id="master-flow-system-section" className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleSection('master_system')}
          className={`w-full bg-slate-100/90 hover:bg-slate-200/80 text-slate-900 p-3.5 sm:p-4 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${openSections.master_system ? 'border-b border-slate-200 rounded-t-2xl' : 'rounded-2xl'}`}
        >
          <div className="flex items-center">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
                  Modelos e Variáveis
                </h2>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-extrabold text-slate-700 uppercase hidden sm:inline-block">
              {openSections.master_system ? 'Recolher' : 'Expandir'}
            </span>
            {openSections.master_system ? (
              <ChevronUp className="w-5 h-5 text-slate-700" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-700" />
            )}
          </div>
        </button>

        {openSections.master_system && (
          <div className="p-3 sm:p-4 border-t border-slate-200">
            <MasterDocumentModelsPanel />
            <IntegrationStudioPanel
              actorEmail={userEmail || ''}
              initialStudio={settings?.integrationStudio}
              matrixColumns={matrixColumns}
              setMatrixColumns={setMatrixColumns}
              matrixRows={matrixRows}
              setMatrixRows={setMatrixRows}
              emailTemplates={emailTemplates}
              setEmailTemplates={setEmailTemplates}
              formTemplates={formTemplates}
              setFormTemplates={setFormTemplates}
              docTemplates={docTemplates}
              setDocTemplates={setDocTemplates}
              workflowStages={workflowStages}
              setWorkflowStages={setWorkflowStages}
              driveModelosFolderUrl={driveModelosFolderUrl}
              setDriveModelosFolderUrl={setDriveModelosFolderUrl}
              onConnectDrive={handleConnectGoogleDrive}
              onScanDrive={handleUpdateAllDocumentsAndFields}
              isScanningDrive={isUpdatingAllDocs}
              notify={showNotification}
            />
          </div>
        )}
      </section>}

      {/* REGISTRO DE LOGS (ITEM ISOLADO NO FINAL DA PÁGINA) */}
      {isMasterAdmin && (
        <section id="system-audit-logs-section" className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggleSection('registro_logs')}
            className={`w-full bg-slate-100/90 hover:bg-slate-200/80 text-slate-900 p-3.5 sm:p-4 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${openSections.registro_logs ? 'border-b border-slate-200 rounded-t-2xl' : 'rounded-2xl'}`}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
                Registro de logs
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-extrabold text-slate-700 uppercase hidden sm:inline-block">
                {openSections.registro_logs ? 'Recolher' : 'Expandir'}
              </span>
              {openSections.registro_logs ? (
                <ChevronUp className="w-5 h-5 text-slate-700" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-700" />
              )}
            </div>
          </button>

          {openSections.registro_logs && (
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50/50">
              <AuditLogsTable
                settings={settings}
                onSettingsUpdated={(newSet) => {
                  refreshAuth();
                  showNotification('Configurações salvas com sucesso!');
                }}
                showNotification={showNotification}
              />
            </div>
          )}
        </section>
      )}



        {false && (
          <div className="p-4 sm:p-5 border-t border-slate-200 space-y-6">
            {/* PLANILHA DE MAPEAMENTO DE MODELOS (.DOCX) x CAMPOS */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-xs space-y-4">
              
              {/* CABEÇALHO & BOTÕES DE AÇÃO */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📄</span>
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
                      PLANILHA DOS MODELOS DE ARQUIVOS (.DOCX)
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Insira o link de cada arquivo .docx no Google Drive para criar uma nova linha na planilha. Ao inserir o documento, o sistema fará a varredura e criará automaticamente as colunas para cada variável encontrada entre <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono font-bold border border-slate-300">&lt;&lt;...&gt;&gt;</code>.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsAddRowOpen(true)}
                    className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded shadow-2xs border border-slate-300 transition-all cursor-pointer"
                  >
                    <span>➕</span>
                    <span>INSERIR DOCUMENTO</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleUpdateAllDocumentsAndFields}
                    disabled={isUpdatingAllDocs}
                    className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded shadow-2xs transition-all cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-4 h-4 text-slate-700 stroke-[2.5] ${isUpdatingAllDocs ? 'animate-spin' : ''}`} />
                    <span>{isUpdatingAllDocs ? 'Varrendo Documentos...' : '🔄 ATUALIZAR DOCUMENTOS E CAMPOS'}</span>
                  </button>
                </div>
              </div>

              {/* CONFIGURAÇÃO DA PASTA DO GOOGLE DRIVE COM OS MODELOS */}
              <div className="bg-slate-50 border border-slate-300 p-3 sm:p-3.5 rounded-md space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-[11px] font-black uppercase tracking-wide text-slate-800 flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-emerald-700 shrink-0 stroke-[2.5]" />
                    <span>LINK DA PASTA DO GOOGLE DRIVE ONDE ESTÃO OS MODELOS (.DOCX):</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {googleToken ? (
                      <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-0.5 rounded text-[10.5px] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                        <span>Conectado ao Google Drive</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConnectGoogleDrive}
                        className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-800 font-bold text-[10.5px] uppercase tracking-wider px-2.5 py-1 rounded shadow-2xs cursor-pointer transition-colors border border-slate-300"
                        title="Conectar sua conta do Google Drive para permitir varredura de pastas e documentos"
                      >
                        <span>🔑</span>
                        <span>CONECTAR CONTA GOOGLE</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      value={driveModelosFolderUrl}
                      onChange={(e) => setDriveModelosFolderUrl(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/1..."
                      className="w-full bg-white border border-slate-300 pl-8 pr-3 py-1.5 rounded text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs"
                    />
                    <Folder className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>

                  {driveModelosFolderUrl && (
                    <a
                      href={driveModelosFolderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs uppercase px-3 py-1.5 rounded transition-all cursor-pointer shrink-0 shadow-2xs"
                      title="Abrir pasta no Google Drive em nova aba"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                      <span className="hidden md:inline">Abrir no Drive</span>
                    </a>
                  )}
                </div>
              </div>

              {/* MODAL / PANEL: INSERIR NOVO MODELO DE DOCUMENTO DO GOOGLE DRIVE */}
              {isAddRowOpen && (
                <div className="bg-slate-50 border border-slate-300 p-4 rounded-md space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="text-xs font-black uppercase text-slate-900 flex items-center gap-2">
                      <span>📄</span>
                      INSERIR NOVO MODELO DE DOCUMENTO DO GOOGLE DRIVE
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsAddRowOpen(false)}
                      className="text-slate-500 hover:text-slate-800 text-xs font-bold px-2 py-1"
                    >
                      ✕ Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10.5px] font-bold uppercase text-slate-700">
                        NOME DO DOCUMENTO / MODELO:
                      </label>
                      <input
                        type="text"
                        value={newRowName}
                        onChange={(e) => setNewRowName(e.target.value)}
                        placeholder="Ex: Convite de Banca 2026 ou Ata de Defesa"
                        className="w-full bg-white border border-slate-300 px-3 py-2 rounded text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10.5px] font-bold uppercase text-slate-700">
                        LINK DO ARQUIVO DO WORD NO GOOGLE DRIVE (.DOCX):
                      </label>
                      <input
                        type="url"
                        value={newRowUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewRowUrl(val);
                          if (val && (val.includes('docs.google.com') || val.includes('drive.google.com')) && val.length > 30) {
                            handleScanDocument(val);
                          }
                        }}
                        onBlur={() => {
                          if (newRowUrl && (newRowUrl.includes('docs.google.com') || newRowUrl.includes('drive.google.com'))) {
                            handleScanDocument(newRowUrl);
                          }
                        }}
                        placeholder="https://docs.google.com/document/d/1.../edit"
                        className="w-full bg-white border border-slate-300 px-3 py-2 rounded text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  {/* VARREDURA DE DOCUMENTO / VARIAVEIS */}
                  <div className="bg-white border border-slate-200 p-3.5 rounded-md space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <label className="block text-[10.5px] font-bold uppercase text-slate-900 flex items-center gap-1.5">
                        <Search className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>VARREDURA DE CAMPOS PERSONALIZÁVEIS (&lt;&lt;...&gt;&gt;)</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleScanDocument}
                          disabled={isScanningDoc}
                          className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase px-3 py-1.5 rounded transition-all cursor-pointer border border-slate-300"
                        >
                          {isScanningDoc ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                              <span>Varrendo Documento...</span>
                            </>
                          ) : (
                            <>
                              <span>🔍</span>
                              <span>VARRER DOCUMENTO AGORA</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <textarea
                        rows={2}
                        value={newRowTagsInput}
                        onChange={(e) => setNewRowTagsInput(e.target.value)}
                        placeholder="Dica: Clique no botão 'VARRER DOCUMENTO AGORA' ou cole as variáveis manualmente (Ex: <<alunos>>, <<titulodoTrabalho>>, <<orientador(1)>>)"
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                      
                      <div className="bg-emerald-50/80 border border-emerald-200 p-2.5 rounded text-[11px] text-emerald-950 space-y-1">
                        <span className="font-bold flex items-center gap-1 text-emerald-900">
                          💡 COMO ESCREVER OS CAMPOS NO GOOGLE DOCS / WORD PARA VARREDURA RÁPIDA:
                        </span>
                        <ul className="list-disc list-inside text-[10.5px] space-y-0.5 text-slate-800 font-medium leading-relaxed">
                          <li>Prefira escrever entre sinais de menor e maior duplos: <code className="bg-white px-1 py-0.5 rounded border border-emerald-300 font-bold text-emerald-900">&lt;&lt;alunos&gt;&gt;</code>, <code className="bg-white px-1 py-0.5 rounded border border-emerald-300 font-bold text-emerald-900">&lt;&lt;titulodoTrabalho&gt;&gt;</code>, <code className="bg-white px-1 py-0.5 rounded border border-emerald-300 font-bold text-emerald-900">&lt;&lt;orientador(1)&gt;&gt;</code></li>
                          <li>Também são identificados com chave simples ou aspas angulares: <code className="bg-white px-1 font-bold text-slate-900">&lt;alunos&gt;</code> ou <code className="bg-white px-1 font-bold text-slate-900">«alunos»</code></li>
                          <li>Mantenha o campo contínuo no documento Word/Docs sem alternar estilo/negrito no meio dos sinais <code className="font-bold">&lt;&lt;...&gt;&gt;</code>.</li>
                        </ul>
                      </div>
                    </div>

                    {newRowTagsInput && (
                      <div className="pt-1">
                        <span className="text-[10px] font-extrabold uppercase text-slate-900 block mb-1.5">
                          Colunas que serão criadas/marcadas para esta linha:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {extractTagsFromString(newRowTagsInput).map((tag, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-2xs"
                            >
                              <span>✅</span>
                              <span>{tag.startsWith('<<') ? tag : `<<${tag}>>`}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddRowOpen(false)}
                      className="bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase px-4 py-2 rounded border border-slate-300 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveNewRow}
                      className="bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs uppercase px-4 py-2.5 rounded shadow-2xs border border-slate-300 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>✅</span>
                      <span>SALVAR MODELO DE DOCUMENTO</span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODAL / DIÁLOGO: CHECAGEM INTELIGENTE DE COMPATIBILIDADE DE CAMPOS */}
              {isCompatibilityModalOpen && compatibilityConflicts.length > 0 && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
                  <div className="bg-white rounded-lg shadow-xl border border-emerald-300 max-w-2xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
                    <div className="flex items-start gap-3 border-b border-slate-200 pb-3">
                      <div className="p-2 bg-amber-100 text-amber-800 rounded-full shrink-0 mt-0.5">
                        <AlertCircle className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                          <span>💡</span> CHECAGEM INTELIGENTE DE COMPATIBILIDADE DE CAMPOS
                        </h3>
                        <p className="text-xs text-slate-600 mt-1">
                          A inteligência do sistema identificou campos com grafias muito semelhantes entre os seus documentos. Deseja unificá-los na mesma coluna ou mantê-los em colunas separadas?
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                      {compatibilityConflicts.map((conflict, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700">Conflito de similaridade #{idx + 1}:</span>
                            <span className="text-[10px] font-mono font-extrabold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                              {conflict.reason} ({Math.round(conflict.similarityRatio * 100)}% similar)
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 bg-white p-2.5 rounded border border-slate-200">
                            <span className="font-mono text-xs font-bold text-emerald-950 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                              {conflict.col1.name}
                            </span>
                            <span className="text-slate-400 font-bold text-xs">vs</span>
                            <span className="font-mono text-xs font-bold text-emerald-950 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                              {conflict.col2.name}
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleMergeColumns(conflict.col1.id, conflict.col2.id)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs uppercase px-3 py-2 rounded shadow-2xs transition-all cursor-pointer border border-slate-300"
                            >
                              <span>✅ Unificar em {conflict.col1.name}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMergeColumns(conflict.col2.id, conflict.col1.id)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase px-3 py-2 rounded shadow-2xs transition-all cursor-pointer border border-slate-300"
                            >
                              <span>✅ Unificar em {conflict.col2.name}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleKeepColumnsSeparate(conflict.col1.id, conflict.col2.id)}
                              className="inline-flex items-center justify-center bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase px-3 py-2 rounded border border-slate-300 transition-all cursor-pointer"
                            >
                              <span>Manter Separadas</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setIsCompatibilityModalOpen(false)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs uppercase px-4 py-2 rounded cursor-pointer"
                      >
                        Fechar Checagem
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PLANILHA TABULAR (TABELA DE MAPEAMENTO) */}
              <div className="overflow-x-auto bg-white">
                <table className="w-full text-left border-collapse min-w-[700px] table-fixed">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-slate-300 text-slate-900 font-extrabold text-[11px] uppercase tracking-wider">
                      {/* COLUNA FIXA DA ESQUERDA: NOME DO ARQUIVO / MODELO (SÓLIDA COM SHADOW FIXO) */}
                      <th className="sticky left-0 bg-slate-100 z-30 px-3 py-2 w-[260px] border-r-2 border-slate-300 text-slate-900 font-extrabold">
                        <div className="flex items-center justify-between">
                          <span>MODELO / ARQUIVO (.DOCX)</span>
                          <span className="text-[10px] text-slate-600 font-normal normal-case">Ações / Ordem</span>
                        </div>
                      </th>

                      {/* COLUNAS DINÂMICAS: CAMPOS PERSONALIZÁVEIS COM REORDENAÇÃO */}
                      {matrixColumns.map((col, colIdx) => (
                        <th
                          key={`${col.id}-${colIdx}`}
                          className="p-1.5 w-[125px] min-w-[110px] border-r border-slate-300 text-center relative group bg-slate-100"
                        >
                          <div className="flex flex-col items-center justify-between gap-1 min-h-[38px]">
                            <span className="font-mono text-slate-900 font-extrabold text-[10.5px] block w-full text-center truncate px-1 py-0.5 bg-white/90 rounded border border-slate-300 shadow-2xs" title={col.name}>
                              {col.name}
                            </span>
                            
                            {/* CONTROLES DE ORDEM DA COLUNA E LIXEIRA DE EXCLUSÃO */}
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveColumn(colIdx, 'left')}
                                disabled={colIdx === 0}
                                title="Mover coluna para esquerda"
                                className="px-1.5 text-[9px] font-bold rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 disabled:opacity-30 disabled:hover:bg-white cursor-pointer"
                              >
                                ◀
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMatrixColumn(col.id)}
                                title="Excluir este campo (coluna) da planilha"
                                className="p-0.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 cursor-pointer"
                              >
                                <Trash2 className="w-2.5 h-2.5 stroke-[2.5]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveColumn(colIdx, 'right')}
                                disabled={colIdx === matrixColumns.length - 1}
                                title="Mover coluna para direita"
                                className="px-1.5 text-[9px] font-bold rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 disabled:opacity-30 disabled:hover:bg-white cursor-pointer"
                              >
                                ▶
                              </button>
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {matrixRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={matrixColumns.length + 1}
                          className="p-6 text-center text-xs text-slate-500 italic bg-slate-50/50"
                        >
                          Nenhum modelo cadastrado na planilha. Clique em <strong>"➕ INSERIR LINHA NA PLANILHA"</strong> para adicionar o primeiro arquivo .docx.
                        </td>
                      </tr>
                    ) : (
                      matrixRows.map((row, rowIdx) => (
                        <tr
                          key={row.id}
                          className="hover:bg-slate-50 border-b border-slate-200 transition-colors group"
                        >
                          {/* COLUNA FIXA DA ESQUERDA: NOME DO ARQUIVO + LINK DRIVE + BOTOES */}
                          <td className="sticky left-0 bg-white z-20 p-1.5 w-[260px] border-r-2 border-slate-200 shadow-[3px_0_8px_rgba(0,0,0,0.06)] align-middle group/mcell cursor-pointer">
                            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-100 group-hover/mcell:bg-slate-200 text-slate-900 border border-slate-300 group-hover/mcell:border-slate-400 shadow-2xs group-hover/mcell:shadow-md group-hover/mcell:scale-[1.01] transition-all">
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <span className="text-xs font-bold text-slate-900 block truncate" title={row.name}>
                                  📄 {row.name}
                                </span>
                                <a
                                  href={row.driveFileUrl || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-slate-700 hover:underline truncate max-w-[150px]"
                                >
                                  <ExternalLink className="w-3 h-3 text-slate-600 shrink-0" />
                                  <span>{row.driveFileUrl.replace('https://', '')}</span>
                                </a>
                              </div>

                              {/* BOTOES DE SUBIR / DESCER LINHA + LIXEIRA */}
                              <div className="flex items-center gap-1 shrink-0">
                                <div className="flex flex-col gap-0.5">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleMoveRow(rowIdx, 'up'); }}
                                    disabled={rowIdx === 0}
                                    title="Mover modelo para cima"
                                    className="px-1 text-[9px] font-bold rounded bg-slate-100/90 hover:bg-white text-slate-700 disabled:opacity-20 cursor-pointer"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleMoveRow(rowIdx, 'down'); }}
                                    disabled={rowIdx === matrixRows.length - 1}
                                    title="Mover modelo para baixo"
                                    className="px-1 text-[9px] font-bold rounded bg-slate-100/90 hover:bg-white text-slate-700 disabled:opacity-20 cursor-pointer"
                                  >
                                    ▼
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteMatrixRow(row.id); }}
                                  title="Excluir este modelo"
                                  className="text-rose-600 hover:text-rose-800 group-hover/mcell:text-rose-200 group-hover/mcell:hover:text-white p-1 rounded transition-colors cursor-pointer ml-0.5"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* CÉLULAS DAS COLUNAS: STATUS IDENTIFICADO NA VARREDURA (READ-ONLY) */}
                          {matrixColumns.map((col, cIdx) => {
                            const isChecked = !!row.fields[col.id];
                            return (
                              <td
                                key={`${col.id}-${cIdx}`}
                                className="p-1.5 border-r border-slate-200 text-center align-middle w-[125px] min-w-[110px]"
                              >
                                {isChecked ? (
                                  <span
                                    title="Campo <<>> identificado no modelo"
                                    className="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-200 border border-slate-300 text-slate-800 font-extrabold text-xs shadow-2xs mx-auto select-none"
                                  >
                                    ✓
                                  </span>
                                ) : (
                                  <span
                                    title="Campo não presente neste modelo"
                                    className="inline-flex items-center justify-center w-5 h-5 text-slate-300 font-medium text-xs mx-auto select-none"
                                  >
                                    —
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        )}

      {false && (
      <>
      {/* 4. E-MAILS */}
      <section id="email-templates-editor-section" className="bg-white border border-slate-300 rounded-2xs shadow-2xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('email')}
          className="w-full bg-slate-200 hover:bg-slate-300/80 text-slate-800 p-3 sm:p-3.5 flex items-center justify-between gap-3 text-left transition-colors border-b border-slate-300 cursor-pointer"
        >
          <div className="flex items-center">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
                  E-mails
                </h2>
              </div>
              <p className="text-[11px] text-slate-600 font-normal mt-0.5">
                Configure em qual etapa do fluxo cada e-mail é disparado, selecione os documentos anexados e formate a mensagem.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-extrabold text-slate-700 uppercase hidden sm:inline-block">
              {openSections.email ? 'Recolher' : 'Expandir'}
            </span>
            {openSections.email ? (
              <ChevronUp className="w-5 h-5 text-slate-700" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-700" />
            )}
          </div>
        </button>

        {openSections.email && (
          <div className="p-3.5 sm:p-4 border-t border-slate-200 space-y-4">
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-slate-200 text-slate-800 border border-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-2xs uppercase tracking-wider mb-1">
                  <Mail className="w-3.5 h-3.5 text-slate-800" />
                  <span>NOTIFICAÇÕES AUTOMÁTICAS E E-MAILS DO FLUXO</span>
                </div>
                <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">
                  Formatação, Assunto, Anexos e Momento de Envio dos E-mails
                </h2>
                <p className="text-xs text-slate-500">
                  Configure em qual etapa do fluxo cada e-mail é disparado, selecione os documentos anexados e formate a mensagem.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddNewEmailTemplate}
                className="bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-2xs border border-slate-300 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
              >
                <span>✉️ Adicionar E-mail ao Fluxo</span>
              </button>
            </div>

            {/* MASTER ADMIN SENDER BANNER */}
            <div className="bg-slate-100 border border-slate-300 text-slate-800 p-2.5 rounded-2xs text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-slate-900">
                <Mail className="w-4 h-4 text-slate-700 shrink-0" />
                <span>📬 Remetente oficial: <strong>conta Google autorizada pelo usuário Master</strong></span>
              </span>
              <span className="bg-emerald-700 text-white text-[10px] font-mono px-2 py-0.5 rounded-2xs uppercase tracking-tight shrink-0 self-start sm:self-auto">
                Gmail autorizado
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Email Selector */}
              <div className="space-y-3 lg:col-span-1">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Selecione o E-mail para Configurar:
                </label>
                {emailTemplates.map((email) => {
                  const isSelected = email.id === currentEmail.id;
                  return (
                    <div
                      key={email.id}
                      onClick={() => setSelectedEmailId(email.id)}
                      className={`p-3.5 border rounded-2xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-slate-100 text-slate-900 border-slate-400 font-extrabold shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase text-slate-900 font-bold">
                          {email.name}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono mt-1 truncate text-slate-600">
                        📌 Trigger: {email.triggerStage}
                      </div>
                      {email.attachments && email.attachments.length > 0 && (
                        <div className="mt-1.5 flex items-center gap-1 text-[9px] font-bold">
                          <span className="px-1.5 py-0.5 rounded-2xs border bg-slate-200 border-slate-300 text-slate-800">
                            📎 {email.attachments.length} anexo(s) vinculado(s)
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Email Editor Form Panel */}
              <div className="lg:col-span-2 bg-slate-50 p-4 sm:p-5 border border-slate-300 rounded-2xs space-y-4">
                <div className="bg-white p-3 border border-slate-300 rounded-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wide mb-0.5">
                      Nome do Modelo de E-mail:
                    </label>
                    <input
                      type="text"
                      value={currentEmail.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEmailTemplates((prev) =>
                          prev.map((item) => (item.id === currentEmail.id ? { ...item, name: val } : item))
                        );
                      }}
                      className="w-full bg-transparent border-b border-slate-300 text-xs font-black text-slate-900 focus:border-slate-500 outline-none uppercase py-0.5"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteEmailTemplate(currentEmail.id)}
                    className="text-[10px] font-bold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-700 px-2 py-1 rounded-2xs border border-rose-200 flex items-center gap-1 uppercase transition-colors cursor-pointer self-start sm:self-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir E-mail</span>
                  </button>
                </div>

                {/* Trigger Moment Selector */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Momento de Envio no Fluxo do Processo:
                  </label>
                  <select
                    value={currentEmail.triggerStage}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmailTemplates((prev) =>
                        prev.map((item) => (item.id === currentEmail.id ? { ...item, triggerStage: val } : item))
                      );
                    }}
                    className="w-full bg-white p-2 text-xs font-bold text-slate-900 border border-slate-300 rounded-2xs focus:ring-1 focus:ring-slate-400 outline-none cursor-pointer"
                  >
                    <option value="Etapa 2 - Confirmação da Banca pelo Aluno/Orientador">
                      Etapa 2 - Ao Confirmar os Dados da Banca (Dispara Convite aos Examinadores)
                    </option>
                    <option value="Etapa 3 - Agendamento Confirmado">
                      Etapa 3 - Ao Validar Local e Agendar no Calendário
                    </option>
                    <option value="Etapa 3 - Lembrete Automático 48h Antes">
                      Etapa 3 - Lembrete Automático 48h Antes da Defesa
                    </option>
                    <option value="Etapa 5 - Conclusão e Assinatura do Presidente">
                      Etapa 5 - Ao concluir e o Presidente assinar a declaração
                    </option>
                    <option value="Envio Manual">Envio manual pelo painel do Presidente</option>
                  </select>
                </div>

                {/* Attachments Selection Checkboxes */}
                <div className="bg-white p-3 border border-slate-300 rounded-2xs space-y-2">
                  <label className="block text-xs font-black text-slate-900 uppercase tracking-wider">
                    📎 Anexos Automáticos Disparados com este E-mail:
                  </label>
                  <p className="text-[10px] text-slate-500">
                    Selecione quais documentos serão gerados ou recuperados para anexar à mensagem enviada aos destinatários:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                    {docTemplates.map((doc) => {
                      const isAttached = (currentEmail.attachments || []).includes(doc.id);
                      return (
                        <label
                          key={doc.id}
                          className={`p-2 border rounded-2xs flex items-center gap-2 cursor-pointer transition-colors ${
                            isAttached
                              ? 'bg-slate-200 border-slate-400 text-slate-900 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isAttached}
                            onChange={() => handleToggleEmailAttachment(doc.id)}
                            className="accent-slate-800 cursor-pointer"
                          />
                          <span className="text-[11px] truncate">{doc.label}</span>
                        </label>
                      );
                    })}

                    <label
                      className={`p-2 border rounded-2xs flex items-center gap-2 cursor-pointer transition-colors ${
                        (currentEmail.attachments || []).includes('tcc-pdf')
                          ? 'bg-slate-200 border-slate-400 text-slate-900 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={(currentEmail.attachments || []).includes('tcc-pdf')}
                        onChange={() => handleToggleEmailAttachment('tcc-pdf')}
                        className="accent-slate-800 cursor-pointer"
                      />
                      <span className="text-[11px] truncate">📄 Arquivo PDF do TCC (Enviado pelo Discente)</span>
                    </label>
                  </div>
                </div>

                {/* Subject Input */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Assunto do E-mail:
                  </label>
                  <input
                    type="text"
                    value={currentEmail.subject}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmailTemplates((prev) =>
                        prev.map((item) => (item.id === currentEmail.id ? { ...item, subject: val } : item))
                      );
                    }}
                    className="w-full bg-white p-2 text-xs font-mono text-slate-900 border border-slate-300 rounded-2xs focus:ring-1 focus:ring-slate-400 outline-none font-bold"
                  />
                </div>

                {/* Body Textarea */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Corpo do E-mail (Mensagem):
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Tags aceitas: -CAMPO_01-, -CAMPO_02-, -CAMPO_03-, &#123;&#123;LINK_PORTAL&#125;&#125;
                    </span>
                  </div>
                  <textarea
                    rows={7}
                    value={currentEmail.body}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmailTemplates((prev) =>
                        prev.map((item) => (item.id === currentEmail.id ? { ...item, body: val } : item))
                      );
                    }}
                    className="w-full bg-white p-2.5 text-xs font-mono text-slate-800 border border-slate-300 rounded-2xs focus:ring-1 focus:ring-slate-400 outline-none leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-300">
                  <span className="text-[10px] text-slate-500 italic">
                    * Os e-mails são disparados pela conta Google institucional autorizada pelo Master.
                  </span>
                  <button
                    type="button"
                    onClick={() => showNotification(`E-mail "${currentEmail.name}" salvo com sucesso!`)}
                    className="bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-2xs shadow-2xs border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-slate-700" />
                    <span>Salvar Modelo de E-mail</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 5. FORMULÁRIOS */}
      <section id="process-forms-questions-section" className="bg-white border border-slate-300 rounded-2xs shadow-2xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('forms')}
          className="w-full bg-slate-200 hover:bg-slate-300/80 text-slate-800 p-3 sm:p-3.5 flex items-center justify-between gap-3 text-left transition-colors border-b border-slate-300 cursor-pointer"
        >
          <div className="flex items-center">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
                  Formulários
                </h2>
              </div>
              <p className="text-[11px] text-slate-600 font-normal mt-0.5">
                Coleta contínua de dados durante o fluxo do TCC, com edição centralizada na aba "Meus TCCs" conforme a hierarquia do usuário.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-extrabold text-slate-700 uppercase hidden sm:inline-block">
              {openSections.forms ? 'Recolher' : 'Expandir'}
            </span>
            {openSections.forms ? (
              <ChevronUp className="w-5 h-5 text-slate-700" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-700" />
            )}
          </div>
        </button>

        {openSections.forms && (
          <div className="p-3.5 sm:p-4 border-t border-slate-200 space-y-4">
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-slate-200 text-slate-800 border border-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-2xs uppercase tracking-wider mb-1">
                  <ClipboardList className="w-3.5 h-3.5 text-slate-800" />
                  <span>FORMULÁRIOS & EDIÇÃO DIRETA EM "MEUS TCCs"</span>
                </div>
                <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">
                  Formulários do Processo, Campos e Permissões de Edição
                </h2>
                <p className="text-xs text-slate-500">
                  Coleta contínua de dados durante o fluxo do TCC, com edição centralizada na aba "Meus TCCs" conforme a hierarquia do usuário.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddNewFormTemplate}
                className="bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-2xs border border-slate-300 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
              >
                <span>📋 Criar Novo Formulário</span>
              </button>
            </div>

            {/* PERMISSIONS & DIRECT EDITING BANNER */}
            <div className="bg-slate-50 border border-slate-300 p-3.5 rounded-2xs space-y-2 text-xs text-slate-800">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <span className="bg-slate-200 text-slate-900 px-2 py-0.5 rounded-2xs font-mono text-[10px] uppercase border border-slate-300">
                  Fluxo Simplificado de Edição em "Meus TCCs"
                </span>
                <span>Edição direta de dados e arquivos sem formulários de auditoria maçantes</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-700">
                <strong>Como funciona a gestão de dados do TCC:</strong> À medida que o processo avança, as informações são coletadas e enviadas diretamente para a página do processo em <strong>"Meus TCCs"</strong>. As permissões de alteração funcionam de forma intuitiva:
              </p>
              <ul className="text-[11px] space-y-1 text-slate-700 list-disc list-inside font-medium pl-1">
                <li><strong>Discente (Aluno):</strong> Pode visualizar e editar os dados que ele próprio preencheu (Título, Data de Defesa, Resumo, Arquivo da Monografia) ou substituir arquivos enviados.</li>
                <li><strong>Orientador:</strong> Pode editar os dados preenchidos pelo aluno para correções rápidas, além de lançar a Nota Final, anexar a Ata de Defesa e preencher dados de sua competência.</li>
                <li><strong>Presidente da Comissão e Master:</strong> têm acesso administrativo máximo para visualizar, editar, reverter ou corrigir dados, notas, arquivos e participantes, sempre com registro de auditoria.</li>
              </ul>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form List Selector */}
              <div className="space-y-3 lg:col-span-1">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Selecione o Formulário do Processo:
                </label>
                {formTemplates.map((form) => {
                  const isSelected = form.id === currentForm.id;
                  return (
                    <div
                      key={form.id}
                      onClick={() => setSelectedFormId(form.id)}
                      className={`p-3.5 border rounded-2xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-slate-100 text-slate-900 border-slate-400 font-extrabold shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase text-slate-900 font-bold">
                          {form.title}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono mt-1 flex items-center justify-between text-slate-600">
                        <span>Responsável: <strong>{form.targetRole}</strong></span>
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-slate-200 text-slate-800 border border-slate-300">
                          {form.questions.length} campos
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Form Questions & Settings Editor */}
              <div className="lg:col-span-2 bg-slate-50 p-4 border border-slate-300 rounded-xl space-y-4">
                {/* Form Header Controls */}
                <div className="bg-white p-3 border border-slate-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-slate-800 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-md font-bold uppercase">
                      Público-Alvo: {currentForm.targetRole}
                    </span>
                    <input
                      type="text"
                      value={currentForm.title}
                      onChange={(e) => {
                        const title = e.target.value;
                        setFormTemplates(prev => prev.map(f => f.id === currentForm.id ? { ...f, title } : f));
                      }}
                      className="w-full mt-1 bg-transparent border-b border-slate-300 font-black text-xs text-slate-900 focus:border-slate-500 outline-none uppercase"
                      placeholder="Título do Formulário"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={currentForm.targetRole}
                      onChange={(e) => {
                        const role = e.target.value as any;
                        setFormTemplates(prev => prev.map(f => f.id === currentForm.id ? { ...f, targetRole: role } : f));
                      }}
                      className="bg-white border border-slate-300 text-xs font-bold text-slate-800 p-1.5 rounded-lg outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                    >
                      <option value="Aluno">Aluno (Discente)</option>
                      <option value="Orientador">Docente Orientador</option>
                      <option value="Banca">Membros da Banca</option>
                      <option value="Presidente da Comissão">Presidente da Comissão</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleDeleteFormTemplate(currentForm.id)}
                      className="text-[10px] font-bold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-700 px-2 py-1.5 rounded-lg border border-rose-200 flex items-center gap-1 uppercase transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>

                {/* Description Input */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                    Descrição / Instruções do Formulário:
                  </label>
                  <textarea
                    rows={2}
                    value={currentForm.description}
                    onChange={(e) => {
                      const desc = e.target.value;
                      setFormTemplates(prev => prev.map(f => f.id === currentForm.id ? { ...f, description: desc } : f));
                    }}
                    className="w-full bg-white p-2 text-xs text-slate-800 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-400 outline-none"
                  />
                </div>

                {/* Questions Table Header */}
                <div className="space-y-2 pt-2 border-t border-slate-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs font-black text-slate-900 uppercase">
                        Campos do Formulário & Nomenclatura (-CAMPO_XX-) ({currentForm.questions.length})
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddQuestionToForm}
                      className="bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-2xs border border-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-slate-700" />
                      <span>+ Adicionar Campo</span>
                    </button>
                  </div>

                  {/* Questions List */}
                  {currentForm.questions.length === 0 ? (
                    <div className="bg-white border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400 rounded-xl">
                      Nenhum campo cadastrado neste formulário. Clique no botão acima para incluir a primeira pergunta.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentForm.questions.map((q, qIdx) => {
                        const allOtherFieldKeys = Array.from(new Set(
                          formTemplates.flatMap(f => f.questions.map(item => item.fieldKey))
                        )).filter(Boolean);

                        return (
                          <div key={q.id} className="bg-white border border-slate-300 p-3 rounded-xl space-y-2.5 shadow-2xs">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black font-mono text-slate-900 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-md">
                                  -{q.fieldKey || `CAMPO_${(qIdx + 1).toString().padStart(2, '0')}`}-
                                </span>
                                {q.isReuseOfFieldKey && (
                                  <span className="text-[9px] font-bold bg-slate-200 text-slate-800 border border-slate-300 px-1.5 py-0.5 rounded-md">
                                    🔄 Campo Reutilizado / Auditado
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3">
                                <label className="flex items-center gap-1 text-[10px] font-bold text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={q.required}
                                    onChange={(e) => handleUpdateQuestion(currentForm.id, q.id, { required: e.target.checked })}
                                    className="accent-slate-800 rounded-sm cursor-pointer"
                                  />
                                  <span>Obrigatório</span>
                                </label>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteQuestion(currentForm.id, q.id)}
                                  className="text-rose-600 hover:text-rose-900 text-[10px] font-bold cursor-pointer hover:underline"
                                  title="Remover pergunta"
                                >
                                  Excluir
                                </button>
                              </div>
                            </div>

                            {/* REUSE FIELD SELECTOR BAR */}
                            <div className="bg-slate-50 p-2 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                              <span className="text-[10px] font-extrabold text-slate-700 uppercase shrink-0">
                                Identificador do Campo no Modelo Google Docs:
                              </span>
                              
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <select
                                  value={q.fieldKey}
                                  onChange={(e) => {
                                    const newKey = e.target.value;
                                    const isReuse = allOtherFieldKeys.includes(newKey);
                                    handleUpdateQuestion(currentForm.id, q.id, {
                                      fieldKey: newKey,
                                      isReuseOfFieldKey: isReuse
                                    });
                                  }}
                                  className="bg-white border border-slate-300 p-1 text-xs font-mono font-bold text-slate-900 rounded-lg focus:ring-1 focus:ring-slate-400 outline-none w-full sm:w-64 cursor-pointer"
                                >
                                  <option value={q.fieldKey}>{q.fieldKey} (Campo Atual)</option>
                                  {allOtherFieldKeys
                                    .filter(fk => fk !== q.fieldKey)
                                    .map(fk => (
                                      <option key={fk} value={fk}>
                                        🔄 Reutilizar {fk}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="sm:col-span-2">
                                <label className="block text-[9px] font-extrabold text-slate-600 uppercase">
                                  Nome / Rótulo do Campo:
                                </label>
                                <input
                                  type="text"
                                  value={q.label}
                                  onChange={(e) => handleUpdateQuestion(currentForm.id, q.id, { label: e.target.value })}
                                  className="w-full bg-slate-50 border border-slate-300 p-1.5 text-xs font-bold text-slate-900 rounded-lg focus:ring-1 focus:ring-slate-400 outline-none"
                                  placeholder="Ex: Título do TCC"
                                />
                              </div>

                              <div>
                                <label className="block text-[9px] font-extrabold text-slate-600 uppercase">
                                  Tipo de Dado:
                                </label>
                                <select
                                  value={q.fieldType}
                                  onChange={(e) => handleUpdateQuestion(currentForm.id, q.id, { fieldType: e.target.value as any })}
                                  className="w-full bg-slate-50 border border-slate-300 p-1.5 text-xs text-slate-800 rounded-lg focus:ring-1 focus:ring-slate-400 outline-none font-bold cursor-pointer"
                                >
                                  <option value="text">Texto Livre</option>
                                  <option value="date">Data / Horário</option>
                                  <option value="select">Múltipla Escolha / Seleção</option>
                                  <option value="file">Anexo de Arquivo (PDF/Doc)</option>
                                  <option value="number">Numérico / Nota</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[9px] font-extrabold text-slate-800 uppercase">
                                Regra de Validação / Instrução:
                              </label>
                              <input
                                type="text"
                                value={q.expectedAnswer}
                                onChange={(e) => handleUpdateQuestion(currentForm.id, q.id, { expectedAnswer: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-300 p-1.5 text-xs text-slate-900 font-medium rounded-lg focus:ring-1 focus:ring-slate-400 outline-none"
                                placeholder="Ex: Nota numérica de 0.0 a 10.0"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-300">
                  <span className="text-[10px] text-slate-500 italic">
                    * Os formulários alimentam automaticamente as tags dos documentos e e-mails.
                  </span>
                  <button
                    type="button"
                    onClick={() => showNotification(`Formulário "${currentForm.title}" salvo com sucesso!`)}
                    className="bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-lg shadow-2xs border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-slate-700" />
                    <span>Salvar Formulário</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* O editor legado foi retirado da interface: o Estúdio acima é a fonte única do fluxo. */}
      {false && <section id="process-pipeline-explanation-section" className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('workflow')}
          className="w-full bg-slate-100/90 hover:bg-slate-200/80 text-slate-800 p-3.5 sm:p-4 flex items-center justify-between gap-3 text-left transition-colors border-b border-slate-200 cursor-pointer"
        >
          <div className="flex items-center">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
                  Fluxo de Etapas
                </h2>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-extrabold text-slate-700 uppercase hidden sm:inline-block">
              {openSections.workflow ? 'Recolher' : 'Expandir'}
            </span>
            {openSections.workflow ? (
              <ChevronUp className="w-5 h-5 text-slate-700" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-700" />
            )}
          </div>
        </button>

        {openSections.workflow && (
          <div className="p-3.5 sm:p-4 border-t border-slate-200 space-y-3.5">
            {/* PREREQUISITE OBSERVATION BANNER */}
            <div className="bg-slate-100 border border-slate-300 p-3 rounded-xl text-slate-800 text-xs flex items-start gap-2.5 shadow-2xs">
              <Info className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold uppercase tracking-tight block text-slate-900 mb-0.5">
                  📌 Observação para Funcionamento do Fluxo de Etapas:
                </span>
                <p className="text-[11.5px] leading-relaxed text-slate-700">
                  Para que o fluxo funcione e executem as automações do processo de TCC, você deve primeiro configurar os <strong>Modelos de Documentos</strong>, os <strong>E-mails Notificatórios</strong> e os <strong>Formulários do Processo</strong> disponibilizados nas seções acima. Após criá-los, associe cada um à respectiva etapa neste fluxo.
                </p>
              </div>
            </div>

            <div className="border-b border-slate-200 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">
                  Fluxograma Dinâmico do Processo de TCC & Construtor de Workflow
                </h2>
                <span className="text-[9px] font-bold bg-slate-200 text-slate-900 border border-slate-300 px-2 py-0.5 rounded-md uppercase">
                  Interativo & Editável
                </span>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                <button
                  type="button"
                  onClick={handleAddStage}
                  className="bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer border border-slate-300 active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-700" />
                  <span>Criar Nova Etapa</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetWorkflow}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Restaurar fluxo inicial do portal"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar Padrão</span>
                </button>
              </div>
            </div>

            {/* WORKFLOW PIPELINE STAGES GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 pt-1">
              {workflowStages.map((stage, stgIdx) => (
                <div
                  key={stage.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    try {
                      const raw = e.dataTransfer.getData('text/plain');
                      if (raw) {
                        const data = JSON.parse(raw);
                        if (data.type === 'doc') {
                          const foundDoc = docTemplates.find(d => d.id === data.id);
                          handleAddItemToStage(stage.id, 'doc', foundDoc || { fileName: data.title, id: data.id });
                        } else if (data.type === 'email') {
                          const foundEmail = emailTemplates.find(em => em.id === data.id);
                          handleAddItemToStage(stage.id, 'email', foundEmail || { name: data.title, subject: data.recipientOrDetail, id: data.id });
                        } else if (data.type === 'form') {
                          const foundForm = formTemplates.find(f => f.id === data.id);
                          handleAddItemToStage(stage.id, 'form', foundForm || { title: data.title, targetRole: 'Aluno', questions: [] });
                        }
                      } else if (draggedPayload) {
                        if (draggedPayload.type === 'doc') {
                          const foundDoc = docTemplates.find(d => d.id === draggedPayload.id);
                          handleAddItemToStage(stage.id, 'doc', foundDoc);
                        } else if (draggedPayload.type === 'email') {
                          const foundEmail = emailTemplates.find(em => em.id === draggedPayload.id);
                          handleAddItemToStage(stage.id, 'email', foundEmail);
                        } else if (draggedPayload.type === 'form') {
                          const foundForm = formTemplates.find(f => f.id === draggedPayload.id);
                          handleAddItemToStage(stage.id, 'form', foundForm);
                        }
                      }
                    } catch (err) {
                      console.error(err);
                    }
                    setDraggedPayload(null);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 flex flex-col justify-between shadow-2xs hover:border-slate-400 transition-colors relative group"
                >
                  {/* Stage Header Controls */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-[10px] font-black text-slate-900 bg-slate-200 border border-slate-300 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        Etapa {stage.stageNumber}
                      </span>
                      
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={stgIdx === 0}
                          onClick={() => handleMoveStage(stgIdx, 'left')}
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 hover:bg-slate-200 rounded-md cursor-pointer"
                          title="Mover para esquerda / antes"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={stgIdx === workflowStages.length - 1}
                          onClick={() => handleMoveStage(stgIdx, 'right')}
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 hover:bg-slate-200 rounded-md cursor-pointer"
                          title="Mover para direita / depois"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStage(stage.id)}
                          className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md cursor-pointer"
                          title="Remover esta etapa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Stage Title Input */}
                    <div>
                      <input
                        type="text"
                        value={stage.title}
                        onChange={(e) => handleUpdateStage(stage.id, { title: e.target.value })}
                        className="w-full bg-white border border-slate-300 font-extrabold text-xs text-slate-900 p-1 rounded-lg focus:ring-1 focus:ring-slate-400 outline-none uppercase tracking-tight"
                        placeholder="Nome da Etapa"
                      />
                    </div>

                    {/* Stage Trigger Input */}
                    <div>
                      <label className="block text-[8px] font-black text-slate-500 uppercase tracking-wider">
                        ⚡ Evento Gatilho:
                      </label>
                      <input
                        type="text"
                        value={stage.triggerEvent}
                        onChange={(e) => handleUpdateStage(stage.id, { triggerEvent: e.target.value })}
                        className="w-full bg-slate-100 border border-slate-200 text-[10px] text-slate-700 p-1 rounded-lg focus:ring-1 focus:ring-slate-400 outline-none italic"
                        placeholder="Ex: Aluno preenche formulário"
                      />
                    </div>
                  </div>

                  {/* Actions & Documents Attached to this Stage */}
                  <div className="space-y-1.5 min-h-[90px] bg-white border border-dashed border-slate-300 p-2 rounded-xl flex-grow">
                    <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Documentos e Ações ({stage.actions.length})</span>
                      <span className="text-[8px] text-slate-700 font-bold">Arraste para cá</span>
                    </div>

                    {stage.actions.length === 0 ? (
                      <div className="text-[10px] text-slate-400 italic text-center py-4">
                        Nenhum e-mail ou documento vinculado. Selecione ou arraste do painel.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {stage.actions.map((act, actIdx) => (
                          <div
                            key={act.id}
                            className="p-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 text-[10px] flex items-start justify-between gap-1 shadow-2xs"
                          >
                            <div className="space-y-0.5 leading-tight">
                              <div className="font-bold flex items-center gap-1">
                                {act.type === 'doc' && <FileText className="w-3 h-3 text-slate-700 shrink-0" />}
                                {act.type === 'email' && <Mail className="w-3 h-3 text-slate-700 shrink-0" />}
                                {act.type === 'form' && <ClipboardList className="w-3 h-3 text-slate-700 shrink-0" />}
                                {act.type === 'action' && <Zap className="w-3 h-3 text-slate-700 shrink-0" />}
                                <span>{act.title}</span>
                              </div>
                              {act.recipientOrDetail && (
                                <div className="text-[9px] opacity-80 font-mono">
                                  {act.recipientOrDetail}
                                </div>
                              )}
                            </div>

                            {/* Action Item Reorder & Delete */}
                            <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                              <button
                                type="button"
                                disabled={actIdx === 0}
                                onClick={() => handleMoveAction(stage.id, actIdx, 'up')}
                                className="text-slate-400 hover:text-slate-900 disabled:opacity-20 text-[9px] font-bold px-0.5 cursor-pointer"
                                title="Mover para cima"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={actIdx === stage.actions.length - 1}
                                onClick={() => handleMoveAction(stage.id, actIdx, 'down')}
                                className="text-slate-400 hover:text-slate-900 disabled:opacity-20 text-[9px] font-bold px-0.5 cursor-pointer"
                                title="Mover para baixo"
                              >
                                ▼
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveAction(stage.id, act.id)}
                                className="text-rose-500 hover:text-rose-800 text-[10px] font-bold pl-1 cursor-pointer"
                                title="Remover"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Item Quick Button */}
                  <div>
                    {addingToStageId === stage.id ? (
                      <div className="bg-white border border-slate-300 p-2 rounded-xl space-y-1.5 text-xs shadow-xs">
                        <div className="text-[10px] font-bold text-slate-800">Selecione o que deseja adicionar:</div>
                        
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          <div className="text-[9px] font-black text-slate-700 uppercase">📋 Formulários do Processo:</div>
                          {formTemplates.map(f => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => handleAddItemToStage(stage.id, 'form', f)}
                              className="w-full text-left text-[10px] p-1 bg-slate-50 hover:bg-slate-100 rounded-md text-slate-900 font-medium truncate block cursor-pointer border border-slate-200"
                            >
                              + {f.title}
                            </button>
                          ))}

                          <div className="text-[9px] font-black text-slate-700 uppercase pt-1">📄 Documentos (.docx):</div>
                          {docTemplates.map(d => (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => handleAddItemToStage(stage.id, 'doc', d)}
                              className="w-full text-left text-[10px] p-1 bg-slate-50 hover:bg-slate-100 rounded-md text-slate-900 font-medium truncate block cursor-pointer border border-slate-200"
                            >
                              + {d.label}
                            </button>
                          ))}

                          <div className="text-[9px] font-black text-slate-700 uppercase pt-1">✉️ E-mails:</div>
                          {emailTemplates.map(em => (
                            <button
                              key={em.id}
                              type="button"
                              onClick={() => handleAddItemToStage(stage.id, 'email', em)}
                              className="w-full text-left text-[10px] p-1 bg-slate-50 hover:bg-slate-100 rounded-md text-slate-900 font-medium truncate block cursor-pointer border border-slate-200"
                            >
                              + {em.name}
                            </button>
                          ))}

                          <div className="text-[9px] font-black text-slate-700 uppercase pt-1">⚙️ Ações e Atividades:</div>
                          <button
                            type="button"
                            onClick={() => handleAddItemToStage(stage.id, 'action', undefined, 'Dispara E-mail para Destinatários X, Y e Z')}
                            className="w-full text-left text-[10px] p-1 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-800 font-medium truncate block cursor-pointer border border-slate-200"
                          >
                            + Disparar E-mail Personalizado
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddItemToStage(stage.id, 'action', undefined, 'Coleta de Assinatura via Asten')}
                            className="w-full text-left text-[10px] p-1 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-800 font-medium truncate block cursor-pointer border border-slate-200"
                          >
                            + Solicitar Assinatura Eletrônica
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setAddingToStageId(null)}
                          className="w-full text-center text-[10px] text-slate-500 font-bold pt-1 hover:underline cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingToStageId(stage.id)}
                        className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-bold p-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Adicionar Documento / E-mail</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>}
      </>
      )}

      {personalizationHubOpen && (
        <PortalPersonalizationHubModal
          isOpen={personalizationHubOpen}
          onClose={() => setPersonalizationHubOpen(false)}
          onOpenAppearance={(target) => openUnifiedEditor(target as UnifiedEditorTab)}
          settings={settings}
          onSettingsUpdated={() => { void refreshAuth(); showNotification('Configurações de personalização atualizadas.'); }}
          showNotification={showNotification}
        />
      )}

      {/* Global Site Layout & Table Formatting Editor Modal */}
      {unifiedEditorOpen && (
        <UnifiedPortalEditorModal
          isOpen={unifiedEditorOpen}
          onClose={() => setUnifiedEditorOpen(false)}
          scope={unifiedEditorScope}
          initialTab={unifiedEditorTab}
          storageKey={unifiedStorageKey}
          defaultTableTitle={unifiedTableTitle}
          allColumns={unifiedAllColumns}
          visibleColumns={unifiedVisibleColumns}
          columnOrder={unifiedColumnOrder}
          setColumnOrder={(order) => {
            setUnifiedColumnOrder(order);
            if (!unifiedStorageKey) return;
            try {
              const existing = localStorage.getItem(`default_table_config_${unifiedStorageKey}`) || '{}';
              localStorage.setItem(
                `default_table_config_${unifiedStorageKey}`,
                JSON.stringify({ ...JSON.parse(existing), columnOrder: order })
              );
            } catch (error) {
              console.error('Falha ao salvar ordem das colunas:', error);
            }
          }}
          setVisibleColumns={(cols) => {
            setUnifiedVisibleColumns(cols);
            if (unifiedStorageKey) {
              try {
                const existing = localStorage.getItem(`default_table_config_${unifiedStorageKey}`) || '{}';
                const parsed = JSON.parse(existing);
                localStorage.setItem(
                  `default_table_config_${unifiedStorageKey}`,
                  JSON.stringify({ ...parsed, visibleColumns: cols })
                );
              } catch (e) {
                console.error(e);
              }
            }
          }}
          recordsLimit={unifiedRecordsLimit}
          setRecordsLimit={(limit) => {
            setUnifiedRecordsLimit(limit);
            if (unifiedStorageKey) {
              try {
                const existing = localStorage.getItem(`default_table_config_${unifiedStorageKey}`) || '{}';
                const parsed = JSON.parse(existing);
                localStorage.setItem(
                  `default_table_config_${unifiedStorageKey}`,
                  JSON.stringify({ ...parsed, recordsLimit: limit })
                );
              } catch (e) {
                console.error(e);
              }
            }
          }}
        />
      )}

      {/* Calendar Popup Visual Editor Modal */}
      {calendarPopupEditorOpen && (
        <CalendarPopupEditorModal
          isOpen={calendarPopupEditorOpen}
          onClose={() => setCalendarPopupEditorOpen(false)}
          initialFormat={calendarPopupFormat}
          onSave={(saved) => {
            setCalendarPopupFormat(saved);
            saveCalendarPopupConfig(saved);
            setSuccessMsg('✓ Configurações do Popup do Calendário salvas com sucesso!');
            setTimeout(() => setSuccessMsg(null), 4000);
          }}
        />
      )}

      {/* TCC Detail Popup Visual Editor Modal */}
      {tccDetailPopupEditorOpen && (
        <TccDetailPopupEditorModal
          isOpen={tccDetailPopupEditorOpen}
          onClose={() => setTccDetailPopupEditorOpen(false)}
          format={tccDetailPopupFormat}
          onSave={(saved) => {
            setTccDetailPopupFormat(saved);
            saveTccDetailPopupFormat(saved);
            setSuccessMsg('✓ Configurações do Popup de Detalhes do TCC salvas com sucesso!');
            setTimeout(() => setSuccessMsg(null), 4000);
          }}
        />
      )}

      {/* Devolução / Correção Modal Settings */}
      {devolucaoConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-900">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900">
                    Popup de Devolução / Correção
                  </h3>
                  <p className="text-xs text-slate-500">Regras e modelos de mensagens institucionais</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDevolucaoConfigModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <p>
                As notificações e justificativas de devolução são enviadas automaticamente aos discentes e orientadores com o histórico registrado no log de auditoria.
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 block">Notificação por E-mail ao Solicitante</span>
                <p className="text-[11px] text-slate-600">
                  Inclui o parecer técnico da comissão de TCC e o prazo regimental de 5 dias úteis para reenvio.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setDevolucaoConfigModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer Config Modal */}
      {pdfViewerConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-900">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900">
                    Visualizador de PDFs & Documentos
                  </h3>
                  <p className="text-xs text-slate-500">Ferramentas de auditoria e leitura de ata</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPdfViewerConfigModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <p>
                O visualizador integrado suporta renderização direta no navegador de atas de defesa, termos de compromisso e relatórios de estágio com alta fidelidade visual.
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 block">Recursos Ativos</span>
                <ul className="list-disc pl-4 text-[11px] text-slate-600 space-y-1">
                  <li>Zoom dinâmico (50% a 200%)</li>
                  <li>Rotação de página em 90 graus</li>
                  <li>Download direto e impressão de segurança com código hash</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setPdfViewerConfigModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Popup Visual Editor Modal */}
      <LoginPopupEditorModal
        isOpen={loginPopupEditorOpen}
        onClose={() => setLoginPopupEditorOpen(false)}
        initialConfig={loginPopupConfig}
        onSave={(newConfig) => setLoginPopupConfig(newConfig)}
      />

      {/* AI Modal Config */}
      {aiModalConfigOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-900">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900">
                    Popup de Análise por IA
                  </h3>
                  <p className="text-xs text-slate-500">Parâmetros de conferência de documentos</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiModalConfigOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <p>
                O módulo de IA analisa automaticamente as assinaturas de orientador e membros de banca em atas de defesa de TCC antes da homologação final.
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 block">Critérios de Validação</span>
                <ul className="list-disc pl-4 text-[11px] text-slate-600 space-y-1">
                  <li>Validação de quórum de banca examinadora (mínimo 3 examinadores)</li>
                  <li>Conferência da nota e parecer final (Aprovado / Reprovado)</li>
                  <li>Validação de assinatura Asten, signatários e integridade do PDF</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setAiModalConfigOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload PDF Assinado Config Modal */}
      {uploadPdfConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-900">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900">
                    Popup de Upload de PDF Assinado
                  </h3>
                  <p className="text-xs text-slate-500">Parâmetros de OCR e Associação em Lote</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUploadPdfConfigModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <p>
                O modal de upload inteligente lê o conteúdo dos PDFs de atas assinadas, detecta nomes dos discentes e localiza automaticamente o processo no Google Drive e no banco de dados.
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 block">Recursos Ativos</span>
                <ul className="list-disc pl-4 text-[11px] text-slate-600 space-y-1">
                  <li>Extração de texto via PDF.js em alta velocidade</li>
                  <li>Reconhecimento fuzzy do nome do aluno e número do processo</li>
                  <li>Mapeamento em lote de múltiplos arquivos de uma só vez</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setUploadPdfConfigModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Confirm Config Modal */}
      {downloadConfirmConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-900">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900">
                    Popup de Confirmação de Download
                  </h3>
                  <p className="text-xs text-slate-500">Parâmetros de Segurança na Exportação</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDownloadConfirmConfigModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <p>
                Proteção e confirmação com contagem de registros antes de gerar relatórios em CSV, planilhas Excel ou pacotes compactados ZIP de documentos do acervo.
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 block">Recursos Ativos</span>
                <ul className="list-disc pl-4 text-[11px] text-slate-600 space-y-1">
                  <li>Resumo da quantidade total de linhas e tamanho estimado</li>
                  <li>Compatibilidade com UTF-8 BOM para abertura perfeita no Microsoft Excel</li>
                  <li>Inclusão de metadados e data/hora de exportação</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setDownloadConfirmConfigModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Config Modal */}
      {tutorialConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-900">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900">
                    Configuração da Tela de Guia & Tutorial
                  </h3>
                  <p className="text-xs text-slate-500">Instruções Interativas para Alunos e Docentes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTutorialConfigModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <p>
                A página de Guia & Tutorial (`/tutorial`) oferece orientações passo a passo para submissão de TCC, cronograma de bancas, modelo de atas e contatos da comissão.
              </p>
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 block">Recursos de Orientação</span>
                <ul className="list-disc pl-4 text-[11px] text-slate-600 space-y-1">
                  <li>Passo a passo com abas divididas por perfil (Discente, Orientador, Banca)</li>
                  <li>Links definidos pelo curso para normas e documentos de referência</li>
                  <li>Perguntas frequentes (FAQ) com expansão sanfonada</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setTutorialConfigModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
