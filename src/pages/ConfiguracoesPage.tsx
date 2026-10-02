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
import { AuditAndSecuritySection, AuditLogsTable, MasterAndPresidentConfigForm } from '../components/AuditAndSecuritySection';
import { CommissionIdentityPanel } from '../components/CommissionIdentityPanel';
import { AuditLogsPage } from './AuditLogsPage';
import { AstenLogsPage } from './AstenLogsPage';
import { SettingsWorkspaceModal } from '../components/SettingsWorkspaceModal';
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
  attachmentModes?: Record<string, 'AVAILABLE' | 'SIGNED'>;
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

  const [activeSettingsPanel, setActiveSettingsPanel] = useState<'identity' | 'integrations' | 'models-documents' | 'emails' | 'forms' | 'workflow' | 'variables' | 'access' | 'signatures' | 'logs' | null>(null);

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

      {/* Configurações operacionais: aparência global removida; o visual do Portal é mantido pelo código. */}
      {isMasterAdmin && (
        <>
          <section id="portal-settings-hub" className="portal-settings-list space-y-2">
            <div className="flex items-center gap-2 py-1" aria-label="Grupo institucional e plataforma">
              <span className="h-px flex-1 bg-[#337959]" />
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#337959]">Institucional e Plataforma</span>
              <span className="h-px flex-1 bg-[#337959]" />
            </div>
            {[
              { id: 'identity', title: 'Rodapé e Identidade', text: 'Responsáveis, contatos, rodapé e identidade operacional.', icon: Building2 },
              { id: 'integrations', title: 'Integrações e Plataforma', text: 'Asten, Google, Supabase, Vercel e serviços operacionais do Portal.', icon: Globe },
            ].map(({ id, title, text, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setActiveSettingsPanel(id as any)} className="portal-settings-title-bar flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-[#d5dce0] px-3.5 py-3 text-left shadow-sm">
                <Icon className="h-5 w-5 shrink-0 text-[#337959]" />
                <span className="min-w-0 flex-1"><strong className="block text-xs font-black uppercase tracking-wide text-black">{title}</strong><span className="mt-0.5 block text-[11px] leading-4 text-slate-600">{text}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
              </button>
            ))}

            <div className="flex items-center gap-2 py-1 pt-3" aria-label="Grupo modelos e variáveis">
              <span className="h-px flex-1 bg-[#337959]" />
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#337959]">Modelos e Variáveis</span>
              <span className="h-px flex-1 bg-[#337959]" />
            </div>
            {[
              { id: 'models-documents', title: 'Modelos e Documentos', text: 'Cadastre modelos, confira as variáveis detectadas e visualize o arquivo.', icon: FileText },
              { id: 'emails', title: 'E-mails', text: 'Modelos de mensagem, destinatários, variáveis e anexos.', icon: Mail },
              { id: 'forms', title: 'Formulários', text: 'Campos, regras, respostas e variáveis dos formulários.', icon: ClipboardList },
              { id: 'workflow', title: 'Fluxos', text: 'Etapas, eventos e ações do processo de TCC.', icon: Layers },
              { id: 'variables', title: 'Variáveis', text: 'Definições canônicas, usos, mescla e propagação.', icon: Sliders },
            ].map(({ id, title, text, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setActiveSettingsPanel(id as any)} className="portal-settings-title-bar flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-[#d5dce0] px-3.5 py-3 text-left shadow-sm">
                <Icon className="h-5 w-5 shrink-0 text-[#337959]" />
                <span className="min-w-0 flex-1"><strong className="block text-xs font-black uppercase tracking-wide text-black">{title}</strong><span className="mt-0.5 block text-[11px] leading-4 text-slate-600">{text}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
              </button>
            ))}

            <div className="flex items-center gap-2 py-1 pt-3" aria-label="Grupo acesso e registros">
              <span className="h-px flex-1 bg-[#337959]" />
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#337959]">Acesso e Registros</span>
              <span className="h-px flex-1 bg-[#337959]" />
            </div>
            {[
              { id: 'access', title: 'Acesso', text: 'Autorizações e pessoas com acesso ao Portal.', icon: Lock },
              { id: 'signatures', title: 'Registros de Assinatura', text: 'Fila, método, situação e histórico de assinatura.', icon: FileCheck2 },
              { id: 'logs', title: 'Registro de Logs', text: 'Auditoria, histórico técnico e rastreabilidade.', icon: ClipboardList },
            ].map(({ id, title, text, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setActiveSettingsPanel(id as any)} className="portal-settings-title-bar flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-[#d5dce0] px-3.5 py-3 text-left shadow-sm">
                <Icon className="h-5 w-5 shrink-0 text-[#337959]" />
                <span className="min-w-0 flex-1"><strong className="block text-xs font-black uppercase tracking-wide text-black">{title}</strong><span className="mt-0.5 block text-[11px] leading-4 text-slate-600">{text}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
              </button>
            ))}
          </section>

          {activeSettingsPanel && (
            <SettingsWorkspaceModal
              open
              title={
                activeSettingsPanel === 'identity' ? 'Rodapé e Identidade'
                : activeSettingsPanel === 'integrations' ? 'Integrações e Plataforma'
                : activeSettingsPanel === 'models-documents' ? 'Modelos e Documentos'
                : activeSettingsPanel === 'emails' ? 'E-mails'
                : activeSettingsPanel === 'forms' ? 'Formulários'
                : activeSettingsPanel === 'workflow' ? 'Fluxos'
                : activeSettingsPanel === 'variables' ? 'Variáveis'
                : activeSettingsPanel === 'access' ? 'Acesso'
                : activeSettingsPanel === 'signatures' ? 'Registros de Assinatura'
                : 'Registro de Logs'
              }
              icon={
                activeSettingsPanel === 'identity' ? Building2
                : activeSettingsPanel === 'integrations' ? Globe
                : activeSettingsPanel === 'models-documents' ? FileText
                : activeSettingsPanel === 'emails' ? Mail
                : activeSettingsPanel === 'forms' ? ClipboardList
                : activeSettingsPanel === 'workflow' ? Layers
                : activeSettingsPanel === 'variables' ? Sliders
                : activeSettingsPanel === 'access' ? Lock
                : activeSettingsPanel === 'signatures' ? FileCheck2
                : ClipboardList
              }
              onClose={() => setActiveSettingsPanel(null)}
              sections={
                activeSettingsPanel === 'identity' ? [
                  { id: 'identity', label: 'Rodapé e identidade', description: 'Responsáveis, contatos e identidade operacional.', icon: Building2, content: settings ? <section className="rounded-xl border border-slate-300 bg-[#d5dce0] p-3"><MasterAndPresidentConfigForm settings={settings} onSettingsUpdated={() => { void refreshAuth(); showNotification('Configurações atualizadas.'); }} showNotification={showNotification} /><CommissionIdentityPanel isMaster /></section> : null },
                ] : activeSettingsPanel === 'integrations' ? [
                  { id: 'integrations', label: 'Integrações e plataformas', description: 'Asten, Google, Supabase, Vercel e serviços externos.', icon: Globe, fullBleed: true, content: <InfrastructureIntegrationsPanel isMaster /> },
                ] : activeSettingsPanel === 'models-documents' ? [
                  { id: 'models-documents', label: 'Modelos e documentos', description: 'Arquivo ativo, variáveis detectadas, visualização e histórico em um único lugar.', icon: FileText, fullBleed: true, content: <MasterDocumentModelsPanel /> },
                ] : activeSettingsPanel === 'emails' ? [
                  { id: 'emails', label: 'E-mails', description: 'Modelos, variáveis, anexos e pré-visualização.', icon: Mail, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-emails" initialTab="emails" hideTabs actorEmail={userEmail || ''} initialStudio={settings?.integrationStudio} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification} /></div> },
                ] : activeSettingsPanel === 'forms' ? [
                  { id: 'forms', label: 'Formulários', description: 'Campos, regras, variáveis e prévia no mesmo contexto.', icon: ClipboardList, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-forms" initialTab="forms" hideTabs actorEmail={userEmail || ''} initialStudio={settings?.integrationStudio} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification} /></div> },
                ] : activeSettingsPanel === 'workflow' ? [
                  { id: 'workflow', label: 'Fluxos', description: 'Etapas e ações do fluxo operacional.', icon: Layers, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-workflow" initialTab="workflow" hideTabs actorEmail={userEmail || ''} initialStudio={settings?.integrationStudio} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification} /></div> },
                ] : activeSettingsPanel === 'variables' ? [
                  { id: 'variables', label: 'Variáveis', description: 'Definições canônicas, usos, mescla e propagação.', icon: Sliders, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-variables" initialTab="variables" hideTabs actorEmail={userEmail || ''} initialStudio={settings?.integrationStudio} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification} /></div> },
                ] : activeSettingsPanel === 'access' ? [
                  { id: 'authorizations', label: 'Autorizações de acesso', description: 'Gerencie discentes e demais perfis autorizados.', icon: Lock, content: <AuthorizedStudentsPanel canManage /> },
                ] : activeSettingsPanel === 'signatures' ? [
                  { id: 'signature-ledger', label: 'Registros de assinatura', description: 'Documentos enviados, método e situação.', icon: FileCheck2, content: <AstenLogsPage /> },
                ] : [
                  { id: 'audit-ledger', label: 'Registro de logs', description: 'Auditoria e histórico técnico do Portal.', icon: ClipboardList, content: <AuditLogsPage /> },
                ]
              }
            />
          )}
        </>
      )}



    </div>
  );
};
