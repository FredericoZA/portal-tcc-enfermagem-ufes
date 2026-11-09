import {withNativeWorkflowActivities} from '../utils/nativeWorkflowActivities';
import type {EmailRecipientRole,SignatureRecipientRole} from '../types/integrationStudio';
import { reservationRecipientField } from '../utils/reservationRecipientField';
import { withOperationalCatalog } from '../utils/studioOperationalCatalog';
import { syncCatalogTemplates, syncCatalogColumns } from '../utils/documentCatalogSync';
import { loadLocalStudio } from '../services/integrationStudioService';
import { uniqueEmailTemplates } from '../utils/emailTemplateIdentity';
import { registrationFirst } from '../utils/workflowStageOrder';
import { consolidateProcessForms } from '../utils/processFormConsolidation';
import { upgradeOperationalEmailTemplate } from '../utils/operationalEmails';

import { REGISTRATION_QUESTIONS } from '../utils/operationalConfig';
import React, { useState, useEffect, useCallback } from 'react';
import { readSettingsLocalMirror, writeSettingsLocalMirror } from '../utils/settingsLocalMirror';
import { useAuth } from '../context/AuthContext';
import { getApiAuthHeaders } from '../services/apiClient';

import { IntegrationStudioPanel } from '../components/IntegrationStudioPanel';
import { InfrastructureIntegrationsPanel } from '../components/InfrastructureIntegrationsPanel';
import { AuthorizedStudentsPanel } from '../components/AuthorizedStudentsPanel';
import { MasterDocumentModelsPanel } from '../components/MasterDocumentModelsPanel';
import { updateRuntimeDocumentTemplates, BASE_DOCUMENT_TEMPLATES } from '../utils/documentTemplateEngine';

import { CommissionIdentityPanel } from '../components/CommissionIdentityPanel';
import { AuditLogsPage } from './AuditLogsPage';
import { AstenLogsPage } from './AstenLogsPage';
import { SettingsWorkspaceModal } from '../components/SettingsWorkspaceModal';
import { FeedbackInboxPanel } from '../components/FeedbackInboxPanel';
import { Lightbulb, FileText, Mail, CheckCircle2, FileCheck2, Layers, Sliders, ChevronRight, ClipboardList, Globe, Building2, Lock } from 'lucide-react';

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
  { id: 'CAMPO_09', name: 'AVALIACAO_RESULTADO', label: 'Conceito deliberado pela banca', dataType: 'text' },
  { id: 'CAMPO_11', name: 'AVALIACAO_PARECER', label: 'Parecer da banca', dataType: 'text' },
  { id: 'CAMPO_12', name: 'PROTOCOLO', label: 'Nº do processo', dataType: 'text' },
  { id: 'CAMPO_13', name: 'DRIVE_PASTA_URL', label: 'Pasta do processo no Drive', dataType: 'url' },
  { id: 'CAMPO_COORIENTADOR', name: 'COORIENTADOR_NOME', label: 'Coorientador(a)', dataType: 'text' },
  { id: 'ALUNO_EMAIL', name: 'ALUNO_EMAIL', label: 'E-mail do aluno', dataType: 'email', aliases: ['EMAIL_ALUNO'] },
  { id: 'ALUNO_2_NOME', name: 'ALUNO_2_NOME', label: 'Segundo aluno', dataType: 'text' },
  { id: 'ALUNO_2_EMAIL', name: 'ALUNO_2_EMAIL', label: 'E-mail do segundo aluno', dataType: 'email' },
  { id: 'ORIENTADOR_EMAIL', name: 'ORIENTADOR_EMAIL', label: 'E-mail do orientador', dataType: 'email' },
  { id: 'COORIENTADOR_EMAIL', name: 'COORIENTADOR_EMAIL', label: 'E-mail do coorientador', dataType: 'email' },
  { id: 'BANCA_EMAILS', name: 'BANCA_EMAILS', label: 'E-mails da banca', dataType: 'email' },
  {id:'LINK_PROCESSO',name:'LINK_PROCESSO',label:'Link individual do TCC',dataType:'text'},
  {id:'DESTINATARIO_NOME',name:'DESTINATARIO_NOME',label:'Nome do destinatário do e-mail',dataType:'text'},
  {id:'DESTINATARIO_EMAIL',name:'DESTINATARIO_EMAIL',label:'Endereço do destinatário do e-mail',dataType:'email'},
  {id:'ORIENTADOR_TRATAMENTO',name:'ORIENTADOR_TRATAMENTO',label:'Orientador com tratamento formal',dataType:'text'},
  {id:'ORIENTACOES_ACESSO',name:'ORIENTACOES_ACESSO',label:'Passo a passo de acesso por destinatário',dataType:'text'},
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
  type: 'doc' | 'email' | 'form' | 'action' | 'interaction';
  refId?: string;
  title: string;
  recipientOrDetail?: string;
  executionEvent?: string;
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
  availableToTemplates?: boolean;
  helpText?: string;
  placeholder?: string;
  options?: string[];
  visibleWhen?: import('../types/integrationStudio').StudioCondition;
  validation?: import('../types/integrationStudio').StudioValidationRule;
}

export interface FormTemplateItem {
  recipientRoles?: EmailRecipientRole[];
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
  hiddenCatalogItems?: string[];
}

export interface DocFieldItem {
  key: string;
  label: string;
  description: string;
}

export interface DocTemplateItem {
  signatureRecipientRoles?: SignatureRecipientRole[];
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
  recipientRoles?: EmailRecipientRole[];
  ccRoles?: EmailRecipientRole[];
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

const SETTINGS_GROUPS = [
  {
    id: 'institution',
    label: 'Institucional e Plataforma',
    panels: [
      { id: 'identity', title: 'Rodapé e Identidade', text: 'Responsáveis, contatos, rodapé e identidade operacional.', icon: Building2 },
      { id: 'integrations', title: 'Integrações e Plataforma', text: 'Asten, Google, Supabase, Vercel e serviços operacionais do Portal.', icon: Globe },
    ],
  },
  {
    id: 'models',
    label: 'Modelos e Variáveis',
    panels: [
      { id: 'models-documents', title: 'Documentos e Variáveis', text: 'Modelos oficiais, versões, variáveis detectadas, mescla e propagação em um único espaço.', icon: FileText },
      { id: 'emails', title: 'E-mails', text: 'Mensagens institucionais, destinatários, variáveis, anexos e prévia final.', icon: Mail },
      { id: 'forms', title: 'Formulários', text: 'Formulários, campos, regras, variáveis e prévia.', icon: ClipboardList },
      { id: 'workflow', title: 'Fluxos', text: 'Etapas, eventos e ações do processo de TCC.', icon: Layers },
    ],
  },
  {
    id: 'records',
    label: 'Acesso e Registros',
    panels: [
      { id: 'access', title: 'Acesso', text: 'Autorizações e pessoas com acesso ao Portal.', icon: Lock },
      { id: 'signatures', title: 'Registros de Assinatura', text: 'Fila, método, situação e histórico de assinatura.', icon: FileCheck2 },
      { id: 'logs', title: 'Registro de Logs', text: 'Auditoria, histórico técnico e rastreabilidade.', icon: ClipboardList },
      { id: 'feedback', title: 'Sugestões', text: 'Sugestões recebidas, imagens e histórico de revisão.', icon: Lightbulb },
    ],
  },
] as const;

type SettingsPanelId = typeof SETTINGS_GROUPS[number]['panels'][number]['id'];

export const ConfiguracoesPage: React.FC = () => {
  const { userEmail, settings, refreshAuth, isMasterAdmin } = useAuth();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [localMirrorUnavailable, setLocalMirrorUnavailable] = useState(false);
  const persistLocalMirror = useCallback((key: string, value: string) => {
    const saved = writeSettingsLocalMirror(key, value);
    if (!saved) setLocalMirrorUnavailable(true);
    return saved;
  }, []);

  const [activeSettingsPanel, setActiveSettingsPanel] = useState<SettingsPanelId | 'variables' | null>(null);

  // Google Calendar & Workspace Sync State
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncError, setSyncError] = useState(false);
  const [isWorkspaceSynced, setIsWorkspaceSynced] = useState<boolean>(() => {
    return readSettingsLocalMirror('google_workspace_synced') === 'true';
  });

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
      if (settings.calendarId || readSettingsLocalMirror('google_workspace_synced') === 'true') {
        setIsWorkspaceSynced(true);
      }
    }
  }, [settings]);

  // Planilha / Matriz de Mapeamento de Modelos (Linhas) x Campos (Colunas)
  const [matrixColumns, setMatrixColumns] = useState<MatrixColumn[]>(() => {
    const saved = readSettingsLocalMirror('portal_doc_matrix_columns');
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
    const saved = readSettingsLocalMirror('portal_doc_matrix_rows');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { console.error(e); }
    }
    return DEFAULT_MATRIX_ROWS;
  });

  useEffect(() => {
    persistLocalMirror('portal_doc_matrix_columns', JSON.stringify(matrixColumns));
  }, [matrixColumns]);

  useEffect(() => {
    persistLocalMirror('portal_doc_matrix_rows', JSON.stringify(matrixRows));
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

  // Extrair tags no formato <<CAMPO>>, <CAMPO>, «CAMPO» ou lista por vírgula

  // Varrer arquivo/URL do Google Drive e extrair as tags reais do documento

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

  const syncMasterModelCatalog = (catalog: Record<string, any>) => {
    setDocTemplates(previous=>syncCatalogTemplates(previous,catalog));
    setMatrixColumns(previous=>syncCatalogColumns(previous,catalog));
  };

  // Keep runtime document template engine synchronized with docTemplates state & localStorage
  useEffect(() => {
    persistLocalMirror('portal_doc_templates', JSON.stringify(docTemplates));
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
    return readSettingsLocalMirror('portal_drive_folder_url') || '';
  });
  const [driveModelosFolderUrl, setDriveModelosFolderUrl] = useState<string>(() => {
    return readSettingsLocalMirror('portal_drive_modelos_folder_url') || '';
  });

  useEffect(() => {
    persistLocalMirror('portal_drive_folder_url', driveFolderUrl);
  }, [driveFolderUrl]);

  useEffect(() => {
    persistLocalMirror('portal_drive_modelos_folder_url', driveModelosFolderUrl);
  }, [driveModelosFolderUrl]);

  const [showSampleData, setShowSampleData] = useState(true);

  // Email Templates State with localStorage persistence
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateItem[]>(() => {
    const saved = readSettingsLocalMirror('portal_email_templates');
    if (saved) {
      try { return JSON.parse(saved).map(upgradeOperationalEmailTemplate); } catch (e) { console.error(e); }
    }
    return [
      {
        id: 'email-reserva', name: 'Solicitação de reserva ao departamento', triggerStage: 'Cadastro inicial',
        recipient: String(settings?.emailConfig?.roomReservationDepartmentEmail || ''), subject: 'Solicitação de reserva de sala para apresentação de TCC - Curso de Enfermagem [<<PROTOCOLO>>]',
        body: 'Prezados,\n\nSolicitamos a reserva de sala ou auditório para a defesa de <<CAMPO_01>>.\nTítulo: <<TITULO>>\nData e hora: <<DEFESA_DATA_HORA>>\nLocal: <<DEFESA_LOCAL>>\nCaso indisponível, solicitamos o local alternativo: <<LOCAL_ALTERNATIVO>>.\n\nPor favor, respondam a este e-mail indicando expressamente qual dos locais foi reservado e confirmando a data e o horário solicitados. Caso nenhum dos locais esteja disponível, informem a indisponibilidade.\n\nOrientador: <<ORIENTADOR_NOME>>.\n\nAtenciosamente, Comissão de Trabalho de Conclusão de Curso do Departamento de Enfermagem', attachments: []
      },
      {
        id: 'email-convite',
        name: 'E-mail de Convite para Membros da Banca',
        triggerStage: 'Etapa 2 - Confirmação da Banca pelo Aluno/Orientador',
        recipient: '<<BANCA_EMAILS>>, <<ORIENTADOR_EMAIL>>',
        subject: '[Portal TCC] Convite para Banca Examinadora — <<CAMPO_01>>',
        body: 'Prezado(a),\n\nConvidamos V. Sa. para compor a Comissão Examinadora da defesa de TCC do discente <<CAMPO_01>>, sob orientação de <<CAMPO_03>>.\n\nTítulo: <<CAMPO_02>>\nData/Horário: <<CAMPO_04>>\nLocal: <<CAMPO_07_LOCAL>>\n\nAcesse o portal: <<LINK_PORTAL>>\n\nAtenciosamente,\nComissão de Trabalho de Conclusão de Curso do Departamento de Enfermagem',
        attachments: ['tmpl-convite']
      },
      {
        id: 'email-confirmacao',
        name: 'E-mail de Confirmação de Agendamento',
        triggerStage: 'Etapa 3 - Agendamento Confirmado',
        recipient: '<<ALUNO_EMAIL>>, <<ALUNO_2_EMAIL>>, <<ORIENTADOR_EMAIL>>',
        subject: '[Portal TCC] Agendamento confirmado — <<CAMPO_12>>',
        body: 'Prezado(a) <<CAMPO_01>>,\n\nSua defesa de TCC foi agendada e confirmada.\n\nTítulo: <<CAMPO_02>>\nData/Horário: <<CAMPO_04>>\nLocal: <<CAMPO_07_LOCAL>>\n\nAcompanhe o status em seu painel: <<LINK_PORTAL>>\n\nAtenciosamente,\nComissão de Trabalho de Conclusão de Curso do Departamento de Enfermagem',
        attachments: []
      },
      {
        id: 'email-conclusao',
        name: 'E-mail de Envio de Ata e Certificados Assinados',
        triggerStage: 'Etapa 5 - Conclusão e Assinatura do Presidente',
        recipient: '<<PARTICIPANTES_EMAILS>>',
        subject: '[Portal TCC] Documentos da defesa disponíveis — <<CAMPO_01>>',
        body: 'Prezado(a) <<CAMPO_01>>,\n\nA ata e as declarações concluídas estão disponíveis no seu painel: <<LINK_PORTAL>>\n\nAtenciosamente,\nComissão de Trabalho de Conclusão de Curso do Departamento de Enfermagem',
        attachments: ['tmpl-ata', 'tmpl-declaracao', 'tmpl-termo']
      }
    ].map(upgradeOperationalEmailTemplate);
  });

  useEffect(() => {
    const unique=uniqueEmailTemplates(emailTemplates);
    if(unique.length===emailTemplates.length)return;
    // Preserve the pre-repair contents before removing records with repeated IDs.
    const key='portal_email_template_recovery_v1';
    let previous:unknown[]=[];
    try{const raw=JSON.parse(readSettingsLocalMirror(key)||'[]');if(Array.isArray(raw))previous=raw;}catch{}
    const snapshot=JSON.stringify(emailTemplates);
    if(!previous.some(entry=>JSON.stringify(entry)===snapshot) && !persistLocalMirror(key,JSON.stringify([...previous,emailTemplates])))return;
    setEmailTemplates(unique);
  },[emailTemplates]);

  useEffect(() => {
    const configuredDepartmentEmail = String(settings?.emailConfig?.roomReservationDepartmentEmail || '').trim().toLowerCase();
    setEmailTemplates(previous => previous.map(email => {
      const next = { ...email };
      const normalizeMarkers = (value?: string) => String(value || '')
        .replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/gi, '<<$1>>')
        .replace(/-((?:CAMPO|FIELD)_[A-Z0-9_]+)-/gi, '<<$1>>');
      next.subject = normalizeMarkers(next.subject);
      next.body = normalizeMarkers(next.body);
      next.htmlBody = next.htmlBody ? normalizeMarkers(next.htmlBody) : next.htmlBody;
      next.cc = next.cc ? normalizeMarkers(next.cc) : next.cc;
      next.bcc = next.bcc ? normalizeMarkers(next.bcc) : next.bcc;
      next.replyTo = next.replyTo ? normalizeMarkers(next.replyTo) : next.replyTo;
      const recipient = String(next.recipient || '');
      if (email.id === 'email-reserva') {
        next.recipient = reservationRecipientField(recipient,configuredDepartmentEmail);
      } else {
        next.recipient = normalizeMarkers(recipient);
      }
      return upgradeOperationalEmailTemplate(next);
    }));
  }, [settings?.emailConfig?.roomReservationDepartmentEmail]);

  useEffect(() => {
    persistLocalMirror('portal_email_templates', JSON.stringify(emailTemplates));
  }, [emailTemplates]);

  const [selectedEmailId, setSelectedEmailId] = useState<string>('email-convite');

  // Process Forms & Questions State (Formulários do Processo)
  const defaultFormTemplates: FormTemplateItem[] = [
    {
      id: 'form-reserva-aluno',
      title: 'Cadastro inicial do TCC e participantes',
      stage: 'Etapa 1 - Cadastro inicial pelo aluno',
      targetRole: 'Aluno',
      description: 'O aluno autor informa os dados do trabalho, do segundo autor, se houver, do orientador, coorientador e banca. Os e-mails informados passam a ter acesso somente a este processo.',
      questions: REGISTRATION_QUESTIONS.map(q => ({ ...q, expectedAnswer: q.helpText || '' })) as FormQuestionItem[]
    },

  ];

  const [formTemplates, setFormTemplates] = useState<FormTemplateItem[]>(() => {
    const saved = readSettingsLocalMirror('portal_form_templates');
    if (saved) {
      try { return consolidateProcessForms({formTemplates:JSON.parse(saved)}).formTemplates as unknown as FormTemplateItem[]; } catch (e) { console.error(e); }
    }
    return defaultFormTemplates;
  });

  useEffect(()=>{
    setEmailTemplates(previous=>withOperationalCatalog({emailTemplates:previous} as any).emailTemplates as EmailTemplateItem[]);
    setFormTemplates(previous=>withOperationalCatalog({formTemplates:previous} as any).formTemplates as FormTemplateItem[]);
  },[]);

  const [selectedFormId, setSelectedFormId] = useState<string>('form-reserva-aluno');

  // Save forms to localStorage
  useEffect(() => {
    persistLocalMirror('portal_form_templates', JSON.stringify(formTemplates));
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
        { id: 'act-102', type: 'email', refId: 'email-reserva', title: 'Solicita confirmação ao responsável pelo local', recipientOrDetail: 'Departamento para auditório e sala de reuniões; orientador para outro local' }
      ]
    },
    {
      id: 'stg-2',
      stageNumber: 2,
      title: 'Confirmação do local e convite',
      triggerEvent: 'LOCATION_CONFIRMED',
      description: 'Depois da comprovação do local, gera o convite oficial e envia o e-mail aos participantes.',
      actions: [
        { id: 'act-201', type: 'doc', refId: 'tmpl-convite', title: 'Prepara a carta-convite da banca', recipientOrDetail: 'Arquivado na pasta do TCC no Google Drive' },
        { id: 'act-202', type: 'email', refId: 'email-convite', title: 'Dispara E-mail com Convite para Examinadores', recipientOrDetail: 'Dois examinadores como destinatários; autores, orientador e coorientador, quando houver, em cópia' }
      ]
    },
    {
      id: 'stg-3',
      stageNumber: 3,
      title: 'Preparação e realização da defesa',
      triggerEvent: 'INVITATION_SENT',
      description: 'Mantém os participantes informados e orienta o acesso do orientador no dia da defesa.',
      actions: [
        { id: 'act-302', type: 'email', refId: 'email-confirmacao', title: 'Lembrete da defesa e acesso a Conceito e Ata', recipientOrDetail: 'Destinatários: aluno, orientador e banca' }
      ]
    },
    {
      id: 'stg-4',
      stageNumber: 4,
      title: 'Apresentação & Preenchimento da Ata',
      triggerEvent: 'EVALUATION_SUBMITTED',
      description: 'O orientador registra conceito e parecer e confere a ata. O ASTEN encaminha automaticamente os links de assinatura ao orientador, aos dois examinadores, aos autores e ao coorientador que participou da sessão, quando o documento estiver disponível.',
      actions: [
        { id: 'act-401', type: 'doc', refId: 'tmpl-ata', title: 'Prepara Ata de Defesa para assinatura', recipientOrDetail: 'Orientador, dois examinadores, autores e coorientador participante · simultaneamente' },
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
      description: 'Somente depois que todos os documentos aplicáveis estiverem assinados e arquivados no Drive.',
      actions: [
        { id: 'act-601', type: 'email', refId: 'email-conclusao', title: 'Envia documentos assinados aos participantes', recipientOrDetail: 'Destinatários: todos os participantes do processo' }
      ]
    }
  ];

  const [workflowStages, setWorkflowStages] = useState<WorkflowStageItem[]>(() => {
    const saved = readSettingsLocalMirror('workflow_pipeline_stages');
    if (saved) {
      try { return withNativeWorkflowActivities(withOperationalCatalog({workflowStages:JSON.parse(saved)})).workflowStages as unknown as WorkflowStageItem[]; } catch (e) { console.error(e); }
    }
    return withNativeWorkflowActivities({workflowStages:registrationFirst(initialPipelineStages) as unknown as Record<string,unknown>[]}).workflowStages as unknown as WorkflowStageItem[];
  });

  const [draggedPayload, setDraggedPayload] = useState<{ type: 'doc' | 'email' | 'form' | 'action' | 'interaction'; id: string; title: string; recipientOrDetail?: string } | null>(null);
  const [addingToStageId, setAddingToStageId] = useState<string | null>(null);

  useEffect(()=>{
    const remote=settings?.integrationStudioDraft||settings?.integrationStudio;
    const local=loadLocalStudio();
    const storedSource=(Date.parse(local?.savedAt||'')||0)>(Date.parse(remote?.savedAt||'')||0)?local:remote;
    if(!storedSource)return;
    const source=withOperationalCatalog(storedSource);
    if(source.matrixColumns)setMatrixColumns(source.matrixColumns as unknown as MatrixColumn[]);
    if(source.matrixRows)setMatrixRows(source.matrixRows as unknown as MatrixRow[]);
    if(source.docTemplates)setDocTemplates(source.docTemplates as unknown as DocTemplateItem[]);
    if(source.emailTemplates)setEmailTemplates(source.emailTemplates.map(email=>email.id==='email-reserva'?{...email,recipient:reservationRecipientField(email.recipient,settings?.emailConfig?.roomReservationDepartmentEmail)}:email) as unknown as EmailTemplateItem[]);
    if(source.formTemplates)setFormTemplates(source.formTemplates as unknown as FormTemplateItem[]);
    if(source.workflowStages)setWorkflowStages(source.workflowStages as unknown as WorkflowStageItem[]);
  // Contact-only saves must not reload the entire editor and discard unsaved role selections.
  // The dedicated contact effect above updates email references without replacing the draft.
  },[settings?.integrationStudioDraft?.savedAt,settings?.integrationStudio?.savedAt]);

  useEffect(() => {
    const ordered=registrationFirst<WorkflowStageItem>(workflowStages);
    if(ordered.some((stage,index)=>stage.id!==workflowStages[index]?.id||stage.stageNumber!==workflowStages[index]?.stageNumber))setWorkflowStages(ordered);
  },[workflowStages]);

  // Save workflow pipeline to localStorage on changes
  useEffect(() => {
    persistLocalMirror('workflow_pipeline_stages', JSON.stringify(workflowStages));
  }, [workflowStages]);

  // Process Forms Management Handlers
  const currentForm = formTemplates.find((f) => f.id === selectedFormId) || formTemplates[0];

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Helper to construct highly accurate URLs based on configured Google Drive models folder

  // Helper to extract File ID and generate Google Drive File Preview Link

  // Helper for current selected document
  const currentDoc = docTemplates.find((d) => d.id === selectedDocId) || docTemplates[0];

  // Helper for current selected email
  const currentEmail = emailTemplates.find((e) => e.id === selectedEmailId) || emailTemplates[0];

  // Toggle Attachment on Selected Email Template

  // Find which form(s) and specific question(s) correspond to a field tag/label

  // Helper to check if a field already exists in other documents for duplicate warning

  // Add field to current document

  // Remove field from current document

  // Add dynamic variable tag to current document

  // Delete variable tag from current document

  // Rename variable tag and update all occurrences in document text

  // Insert tag into document text and ensure it's registered

  // Render Live PDF/Doc Preview evaluating conditional logic & scenario variables

  // Helper to insert conditional tag blocks into document text

  // Google Drive Models Synchronizer & Mirror
  const [isSyncingModels, setIsSyncingModels] = useState(false);

  // Cria apenas o slot de metadados. O programa nunca fabrica conteúdo de
  // modelo: o Master precisa vincular ou enviar seu próprio DOCX.

  // Save document template changes and mirror to Google Drive

  // Delete current document template

  // Add new email template

  // Delete current email template

  return (
    <div id="configuracoes-page-container" className="space-y-3.5 max-w-7xl mx-auto py-1.5">
      {isMasterAdmin && localMirrorUnavailable && <aside role="status" className="portal-instruction rounded-lg p-3 text-xs">
        Não foi possível guardar a cópia local neste navegador. As configurações confirmadas no Portal continuam no servidor. Confira a confirmação de salvamento antes de sair; alterações ainda não enviadas podem ser perdidas ao fechar a página.
      </aside>}
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
          <section id="portal-settings-hub" className="portal-settings-list space-y-2 bg-transparent" aria-labelledby="portal-settings-heading">
            <div className="portal-layer-card rounded-xl border border-slate-300 px-3.5 py-3">
              <h1 id="portal-settings-heading" className="text-sm font-black text-slate-950">Configurações do Portal</h1>

            </div>

            {SETTINGS_GROUPS.map(({ id: groupId, label, panels }) => (
              <section key={groupId} className="space-y-2" aria-labelledby={`portal-settings-${groupId}`}>
                <div className="flex items-center gap-2 py-1 pt-3">
                  <span className="portal-settings-group-line h-px flex-1" aria-hidden="true" />
                  <h2 id={`portal-settings-${groupId}`} className="portal-settings-group-label text-[10px] font-black normal-case tracking-[0.16em]">{label}</h2>
                  <span className="portal-settings-group-line h-px flex-1" aria-hidden="true" />
                </div>
                {panels.map(({ id, title, text, icon: Icon }) => (
                  <button key={id} type="button" aria-haspopup="dialog" onClick={() => setActiveSettingsPanel(id)} className="portal-settings-launcher flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left shadow-sm">
                    <Icon className="portal-settings-launcher-icon h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1"><strong className="block text-xs font-black normal-case tracking-wide text-black">{title}</strong><span className="mt-0.5 block text-[11px] leading-4 text-slate-600">{text}</span></span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                  </button>
                ))}
              </section>
            ))}
          </section>

          {activeSettingsPanel && (
            <SettingsWorkspaceModal
              open
              title={
                activeSettingsPanel === 'identity' ? 'Rodapé e Identidade'
                : activeSettingsPanel === 'integrations' ? 'Integrações e Plataforma'
                : activeSettingsPanel === 'models-documents' ? 'Documentos e Variáveis'
                : activeSettingsPanel === 'emails' ? 'E-mails'
                : activeSettingsPanel === 'forms' ? 'Formulários'
                : activeSettingsPanel === 'workflow' ? 'Fluxos'
                : activeSettingsPanel === 'variables' ? 'Variáveis'
                : activeSettingsPanel === 'access' ? 'Acesso'
                : activeSettingsPanel === 'signatures' ? 'Registros de Assinatura'
                : activeSettingsPanel === 'feedback' ? 'Sugestões'
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
                : activeSettingsPanel === 'feedback' ? Lightbulb
                : ClipboardList
              }
              onClose={() => setActiveSettingsPanel(null)}
              sections={
                activeSettingsPanel === 'identity' ? [
                  { id: 'identity', label: 'Rodapé e identidade', description: 'Responsáveis, contatos e identidade operacional.', icon: Building2, fullBleed: true, content: settings ? <CommissionIdentityPanel isMaster /> : null },
                ] : activeSettingsPanel === 'integrations' ? [
                  { id: 'integrations', label: 'Integrações e plataformas', description: 'Asten, Google, Supabase, Vercel e serviços externos.', icon: Globe, fullBleed: true, content: <InfrastructureIntegrationsPanel isMaster /> },
                ] : activeSettingsPanel === 'models-documents' ? [
                  { id: 'documents', label: 'Documentos e variáveis', description: 'Modelos oficiais, versões, variáveis, mescla e prévia no mesmo contexto.', icon: FileText, fullBleed: true, content: <MasterDocumentModelsPanel receiptEditor={hasPublishedReceiptModel=><div id="portal-models-workspace"><IntegrationStudioPanel key="studio-receipts" initialTab="receipts" hasPublishedReceiptModel={hasPublishedReceiptModel} hideTabs actorEmail={userEmail || ''} initialStudio={settings?.integrationStudioDraft||settings?.integrationStudio} reservationDepartmentEmail={settings?.emailConfig?.roomReservationDepartmentEmail} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification} /></div>} onCatalogChanged={syncMasterModelCatalog} actorEmail={userEmail || ''} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} docTemplates={docTemplates} setDocTemplates={setDocTemplates} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} /> },
                ] : activeSettingsPanel === 'emails' ? [
                  { id: 'emails', fullBleed: true, label: 'E-mails', description: 'Modelos, variáveis, anexos e pré-visualização.', icon: Mail, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-emails" initialTab="emails" hideTabs actorEmail={userEmail || ''} initialStudio={settings?.integrationStudioDraft||settings?.integrationStudio} reservationDepartmentEmail={settings?.emailConfig?.roomReservationDepartmentEmail} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification} /></div> },
                ] : activeSettingsPanel === 'forms' ? [
                  { id: 'forms', fullBleed: true, label: 'Formulários', description: 'Criação, exclusão, campos e regras dos formulários.', icon: ClipboardList, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-forms" initialTab="forms" hideTabs actorEmail={userEmail || ''} initialStudio={settings?.integrationStudioDraft||settings?.integrationStudio} reservationDepartmentEmail={settings?.emailConfig?.roomReservationDepartmentEmail} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification} /></div> },
                ] : activeSettingsPanel === 'workflow' ? [
                  { id: 'workflow', fullBleed: true, label: 'Fluxos', description: 'Etapas e ações do fluxo operacional.', icon: Layers, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-workflow" initialTab="workflow" hideTabs actorEmail={userEmail || ''} initialStudio={settings?.integrationStudioDraft||settings?.integrationStudio} reservationDepartmentEmail={settings?.emailConfig?.roomReservationDepartmentEmail} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification} /></div> },
                ] : activeSettingsPanel === 'variables' ? [
                  { id: 'variables', fullBleed: true, label: 'Variáveis', description: 'Definições canônicas, usos, mescla e propagação.', icon: Sliders, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-variables" initialTab="variables" hideTabs actorEmail={userEmail || ''} initialStudio={settings?.integrationStudioDraft||settings?.integrationStudio} reservationDepartmentEmail={settings?.emailConfig?.roomReservationDepartmentEmail} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification} /></div> },
                ] : activeSettingsPanel === 'access' ? [
                  { id: 'authorizations', label: 'Autorizações de acesso', description: 'Gerencie discentes e demais perfis autorizados.', icon: Lock, content: <AuthorizedStudentsPanel canManage embedded /> },
                ] : activeSettingsPanel === 'signatures' ? [
                  { id: 'signature-ledger', label: 'Registros de assinatura', description: 'Documentos enviados, método e situação.', icon: FileCheck2, content: <AstenLogsPage embedded /> },
                ] : activeSettingsPanel === 'feedback' ? [
                  { id: 'feedback-ledger', label: 'Sugestões', description: 'Mensagens recebidas e revisão pelo Master.', icon: Lightbulb, content: <FeedbackInboxPanel embedded /> },
                ] : [
                  { id: 'audit-ledger', label: 'Registro de logs', description: 'Auditoria e histórico técnico do Portal.', icon: ClipboardList, content: <AuditLogsPage embedded /> },
                ]
              }
            />
          )}
        </>
      )}

    </div>
  );
};
