import { portalConfirm, portalNotice, portalPrompt } from '../services/portalDialogs';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ColorfulHeaderIcon } from './ColorfulHeaderIcon';
import { YinYangIcon } from './YinYangIcon';
import { getTableStyles, getEditableTableText, getColWidthClass, formatColumnLabel, GLOBAL_TABLE_EVENT, loadGlobalTableConfig, getFilterChipProps } from '../utils/tableFormatters';
import { ColumnDef, loadTableConfig, TableTextFormat } from './TableColumnSelectorPanel';
import { HeaderSettingsPopover } from './HeaderSettingsPopover';
import { ModalPortal } from './ModalPortal';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Mail,
  ClipboardList,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowUpDown,
  Search,
  Settings,
  Upload,
  Link as LinkIcon,
  Check,
  X,
  RefreshCw,
  GitMerge,
  Undo2,
  Sliders,
  Pencil,
  Copy
} from 'lucide-react';
import {
  MatrixColumn,
  MatrixRow,
  EmailTemplateItem,
  FormTemplateItem,
  FormQuestionItem,
  DocTemplateItem,
  WorkflowStageItem,
  WorkflowActionItem
} from '../pages/ConfiguracoesPage';
import { SearchPopover } from './SearchPopover';

interface UnifiedFlowSystemProps {
  matrixColumns: MatrixColumn[];
  setMatrixColumns: React.Dispatch<React.SetStateAction<MatrixColumn[]>>;
  matrixRows: MatrixRow[];
  setMatrixRows: React.Dispatch<React.SetStateAction<MatrixRow[]>>;
  emailTemplates: EmailTemplateItem[];
  setEmailTemplates: React.Dispatch<React.SetStateAction<EmailTemplateItem[]>>;
  formTemplates: FormTemplateItem[];
  setFormTemplates: React.Dispatch<React.SetStateAction<FormTemplateItem[]>>;
  docTemplates: DocTemplateItem[];
  setDocTemplates?: React.Dispatch<React.SetStateAction<DocTemplateItem[]>>;
  workflowStages: WorkflowStageItem[];
  setWorkflowStages: React.Dispatch<React.SetStateAction<WorkflowStageItem[]>>;
  driveModelosFolderUrl: string;
  setDriveModelosFolderUrl: (url: string) => void;
  googleToken: string;
  handleConnectGoogleDrive: () => void;
  handleUpdateAllDocumentsAndFields: () => Promise<void>;
  isUpdatingAllDocs: boolean;
  showNotification: (msg: string) => void;
  onImportTextOrUrl: (text: string) => Promise<void>;
}

// Helper check if element uses matrix column tag
const isTagUsedByEmail = (email: EmailTemplateItem, col: MatrixColumn) => {
  const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const textToSearch = normalize(`${email.subject} ${email.body}`);
  return [col.name, col.id, ...(col.aliases || [])].some((candidate) => textToSearch.includes(normalize(candidate)));
};

const isTagUsedByForm = (form: FormTemplateItem, col: MatrixColumn) => {
  const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const candidates = [col.name, col.id, ...(col.aliases || [])].map(normalize);
  return form.questions.some(q =>
    candidates.some((candidate) => normalize(`${q.fieldKey} ${q.label}`).includes(candidate))
  );
};

export const UnifiedFlowSystem: React.FC<UnifiedFlowSystemProps> = ({
  matrixColumns,
  setMatrixColumns,
  matrixRows,
  setMatrixRows,
  emailTemplates,
  setEmailTemplates,
  formTemplates,
  setFormTemplates,
  docTemplates,
  setDocTemplates,
  workflowStages,
  setWorkflowStages,
  driveModelosFolderUrl,
  googleToken,
  handleUpdateAllDocumentsAndFields,
  showNotification,
  onImportTextOrUrl,
}) => {
  const { isMasterAdmin } = useAuth();
  // Sub-systems toggle selection states (Modelos, E-mails, Formulários)
  const [selectedSubSystems, setSelectedSubSystems] = useState({
    modelos: true,
    emails: true,
    formularios: true,
  });

  // Selection states inside sub-item editors
  const [selectedEmailId, setSelectedEmailId] = useState<string>(emailTemplates[0]?.id || '1');
  const [selectedFormId, setSelectedFormId] = useState<string>(formTemplates[0]?.id || 'form_1');

  // Modals state
  const [isAddRowOpen, setIsAddRowOpen] = useState(false);
  const [newRowName, setNewRowName] = useState('');
  const [newRowUrl, setNewRowUrl] = useState('');

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importInputText, setImportInputText] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const [addingToStageId, setAddingToStageId] = useState<string | null>(null);

  // Sorting state for spreadsheet
  const [sortConfig, setSortConfig] = useState<{ colId: string; direction: 'asc' | 'desc' } | null>(null);

  // Editing Modals state for row popups
  const [editingModelRow, setEditingModelRow] = useState<MatrixRow | null>(null);
  const [editingEmail, setEditingEmail] = useState<EmailTemplateItem | null>(null);
  const [editingForm, setEditingForm] = useState<FormTemplateItem | null>(null);

  // New Creation Popups state (Criar E-mail & Criar Formulário)
  const [isCreateEmailModalOpen, setIsCreateEmailModalOpen] = useState(false);
  const [newEmailName, setNewEmailName] = useState('');
  const [newEmailTrigger, setNewEmailTrigger] = useState('Etapa 1 - Inscrição do TCC');
  const [newEmailRecipient, setNewEmailRecipient] = useState('{{ALUNO_EMAIL}}');
  const [newEmailSubject, setNewEmailSubject] = useState('Notificação do Sistema de TCC');
  const [newEmailBody, setNewEmailBody] = useState('Prezado(a),\n\nSegue notificação oficial do processo de TCC.\n\nAtenciosamente,\nComissão de TCC');
  const [newEmailAttachments, setNewEmailAttachments] = useState<string[]>([]);

  const [isCreateFormModalOpen, setIsCreateFormModalOpen] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState('');
  const [newFormTargetRole, setNewFormTargetRole] = useState<'Aluno' | 'Orientador' | 'Banca' | 'Presidente da Comissão'>('Aluno');
  const [newFormDescription, setNewFormDescription] = useState('Formulário dinâmico de coleta de dados de TCC');
  const [newFormQuestions, setNewFormQuestions] = useState<FormQuestionItem[]>([]);

  // Table styling state connected to Global Master Settings (Forced to clean white/light-gray in Config)
  const [textFormat, setTextFormat] = useState<TableTextFormat>(() => loadGlobalTableConfig());
  const fixedConfigFormat: TableTextFormat = useMemo(() => ({
    ...textFormat,
    headerTheme: 'slate',
    isDark: false,
    firstColHighlight: 'slate',
    filterStyle: 'slate',
    filterColorMode: 'number_only',
    filterColorScheme: 'theme',
  }), [textFormat]);

  const styles = getTableStyles(fixedConfigFormat);

  const [initialVariableConfig] = useState(() => loadTableConfig(
    'variables_matrix',
    ['element_name', ...matrixColumns.map((column) => column.id)],
    Object.fromEntries(['element_name', ...matrixColumns.map((column) => column.id)].map((key) => [key, true])),
    25
  ));
  const [variableColumnOrder, setVariableColumnOrder] = useState<string[]>(initialVariableConfig.columnOrder);
  const [variableVisibleColumns, setVariableVisibleColumns] = useState<Record<string, boolean>>(initialVariableConfig.visibleColumns);
  const [variableLabels, setVariableLabels] = useState<Record<string, string>>(initialVariableConfig.customLabels || {});
  const [variableWidths, setVariableWidths] = useState<Record<string, string | number>>(initialVariableConfig.columnWidths || {});
  const [variableRecordsLimit, setVariableRecordsLimit] = useState<number | 'all'>(initialVariableConfig.recordsLimit || 25);
  const [variableStartDate, setVariableStartDate] = useState(initialVariableConfig.startDate || '');
  const [variableEndDate, setVariableEndDate] = useState(initialVariableConfig.endDate || '');
  const [editingVariable, setEditingVariable] = useState<MatrixColumn | null>(null);

  useEffect(() => {
    const rawKeys = ['element_name', ...matrixColumns.map((column) => column.id)];
    const uniqueKeys = Array.from(new Set(rawKeys));
    setVariableColumnOrder((previous) => {
      const filtered = Array.from(new Set(previous.filter((key) => uniqueKeys.includes(key))));
      const newItems = uniqueKeys.filter((key) => !filtered.includes(key));
      return [...filtered, ...newItems];
    });
    setVariableVisibleColumns((previous) => ({ ...Object.fromEntries(uniqueKeys.map((key) => [key, true])), ...previous, element_name: true }));
  }, [matrixColumns]);

  useEffect(() => {
    const handleGlobalChange = (e: any) => {
      const newFormat = e.detail || loadGlobalTableConfig();
      setTextFormat(newFormat);
    };
    window.addEventListener(GLOBAL_TABLE_EVENT, handleGlobalChange);
    return () => window.removeEventListener(GLOBAL_TABLE_EVENT, handleGlobalChange);
  }, []);


  const driveSyncRef = useRef(handleUpdateAllDocumentsAndFields);

  useEffect(() => {
    driveSyncRef.current = handleUpdateAllDocumentsAndFields;
  }, [handleUpdateAllDocumentsAndFields]);

  useEffect(() => {
    if (!googleToken || !driveModelosFolderUrl) return;
    const syncFromDrive = () => {
      driveSyncRef.current().catch((error) => console.error('Falha na sincronização automática com o Google Drive:', error));
    };
    syncFromDrive();
    window.addEventListener('focus', syncFromDrive);
    return () => window.removeEventListener('focus', syncFromDrive);
  }, [googleToken, driveModelosFolderUrl]);

  // Drag to scroll table ref & state
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  // Drag handlers for mouse panning on the spreadsheet
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('thead, th, .sticky, button, input, select, a, textarea')) return;
    if (!tableContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - tableContainerRef.current.offsetLeft);
    setStartY(e.pageY - tableContainerRef.current.offsetTop);
    setScrollLeft(tableContainerRef.current.scrollLeft);
    setScrollTop(tableContainerRef.current.scrollTop);
  };

  // Search filter state
  const [searchTerm, setSearchTerm] = useState('');

  // Gear menu & Consolidation Modals state
  const [isGearMenuOpen, setIsGearMenuOpen] = useState(false);
  const [isMergeHistoryModalOpen, setIsMergeHistoryModalOpen] = useState(false);
  const [isConsolidateModalOpen, setIsConsolidateModalOpen] = useState(false);

  // Central de Mesclagens Modal tab state & manual selection
  const [mergeModalTab, setMergeModalTab] = useState<'scan' | 'manual' | 'history'>('scan');
  const [manualMergeSourceId, setManualMergeSourceId] = useState<string>('');
  const [manualMergeTargetId, setManualMergeTargetId] = useState<string>('');

  // Merge history state
  const [mergeHistory, setMergeHistory] = useState<Array<{
    id: string;
    primaryColId: string;
    primaryColName: string;
    secondaryColId: string;
    secondaryColName: string;
    date: string;
  }>>([]);

  // Suggested merges
  const [suggestedMerges, setSuggestedMerges] = useState<Array<{
    id: string;
    colA: MatrixColumn;
    colB: MatrixColumn;
    reason: string;
    similarityScore: number;
  }>>([]);

  // Import Model Modal state (File upload or Drive URL)
  const [isImportModelOpen, setIsImportModelOpen] = useState(false);
  const [importModelMode, setImportModelMode] = useState<'drive' | 'file'>('drive');
  const [importModelName, setImportModelName] = useState('');
  const [importModelUrl, setImportModelUrl] = useState('');

  // Helper to extract tags from text/templates
  const extractTagsFromText = (text: string): string[] => {
    if (!text) return [];
    const regex = /(?:\{\{|\<\<|\[\[|\«)([^\}]+?)(?:\}\}|\>\>|\]\]|\»)/g;
    const tags = new Set<string>();
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[1]) {
        const clean = match[1].trim();
        if (clean.length > 1) tags.add(clean);
      }
    }
    return Array.from(tags);
  };

  // Scan & Update Variables ("Atualizar Variáveis") with AI Duplicate/Similarity Matching
  const handleScanAndUpdateVariables = async () => {
    setIsScanning(true);
    if (googleToken && driveModelosFolderUrl) {
      try {
        await handleUpdateAllDocumentsAndFields();
      } catch (error) {
        console.error('Falha ao sincronizar modelos do Drive antes da varredura:', error);
      }
    }
    const discoveredTags = new Set<string>();

    docTemplates.forEach(doc => doc.variables.forEach(v => discoveredTags.add(v)));
    emailTemplates.forEach(email => {
      extractTagsFromText(`${email.subject} ${email.body}`).forEach(tag => discoveredTags.add(tag));
    });
    formTemplates.forEach(form => {
      form.questions.forEach(q => { if (q.fieldKey) discoveredTags.add(q.fieldKey); });
    });

    const normalizeVariable = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const currentColNames = new Set(matrixColumns.flatMap(c => [c.name, ...(c.aliases || [])]).map(normalizeVariable));
    const newCols: MatrixColumn[] = [...matrixColumns];

    discoveredTags.forEach(tag => {
      if (!currentColNames.has(normalizeVariable(tag))) {
        newCols.push({
          id: 'col_' + tag.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name: tag,
          label: tag.replace(/_/g, ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase()),
          dataType: 'text',
          aliases: [],
          format: { bold: false, italic: false, color: '#0f172a' }
        });
        currentColNames.add(normalizeVariable(tag));
      }
    });

    setMatrixColumns(newCols);

    // AI similarity detection
    const candidates: Array<{
      id: string;
      colA: MatrixColumn;
      colB: MatrixColumn;
      reason: string;
      similarityScore: number;
    }> = [];

    for (let i = 0; i < newCols.length; i++) {
      for (let j = i + 1; j < newCols.length; j++) {
        const colA = newCols[i];
        const colB = newCols[j];
        const normA = colA.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        const normB = colB.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

        if (normA === normB) {
          candidates.push({
            id: `merge_${colA.id}_${colB.id}`,
            colA, colB,
            reason: 'Nomes idênticos (variação apenas de maiúsculas/acentuação)',
            similarityScore: 1.0
          });
          continue;
        }

        const synonymGroups = [
          ['aluno', 'discente', 'estudante'],
          ['orientador', 'professor', 'tutor'],
          ['defesa', 'banca', 'tcc', 'apresentacao'],
          ['titulo', 'nome_trabalho', 'tema'],
          ['data', 'data_defesa', 'data_banca'],
          ['cpf', 'documento_cpf', 'cpf_aluno'],
          ['email', 'e_mail', 'correio_eletronico'],
          ['membro', 'examinador', 'avaliador']
        ];

        let matchedSynonym = false;
        for (const group of synonymGroups) {
          const hasA = group.some(g => normA.includes(g));
          const hasB = group.some(g => normB.includes(g));
          if (hasA && hasB) {
            matchedSynonym = true;
            candidates.push({
              id: `merge_${colA.id}_${colB.id}`,
              colA, colB,
              reason: `Conceitos equivalentes detectados no contexto acadêmico (${group[0]})`,
              similarityScore: 0.88
            });
            break;
          }
        }

        if (!matchedSynonym && (normA.includes(normB) || normB.includes(normA)) && normA.length > 3 && normB.length > 3) {
          candidates.push({
            id: `merge_${colA.id}_${colB.id}`,
            colA, colB,
            reason: 'Nomes e radicais muito parecidos',
            similarityScore: 0.75
          });
        }
      }
    }

    setIsScanning(false);

    if (candidates.length > 0) {
      setSuggestedMerges(candidates);
      setIsConsolidateModalOpen(true);
      showNotification(`Foram encontradas ${candidates.length} variáveis semelhantes para consolidação!`);
    } else {
      showNotification('Sincronização concluída! Todas as variáveis estão atualizadas e sem duplicidades.');
    }
  };

  const handleApplyMerge = (colA: MatrixColumn, colB: MatrixColumn) => {
    setMatrixRows(prev => prev.map(row => {
      const hasB = !!row.fields[colB.id];
      if (hasB) {
        return {
          ...row,
          fields: {
            ...row.fields,
            [colA.id]: true
          }
        };
      }
      return row;
    }));

    setMatrixColumns(prev => prev.filter(c => c.id !== colB.id));

    setMergeHistory(prev => [
      {
        id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        primaryColId: colA.id,
        primaryColName: colA.name,
        secondaryColId: colB.id,
        secondaryColName: colB.name,
        date: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      },
      ...prev
    ]);

    setSuggestedMerges(prev => prev.filter(m => m.colA.id !== colB.id && m.colB.id !== colB.id));
    showNotification(`Variável "${colB.name}" mesclada com sucesso em "${colA.name}"!`);
  };

  const handleUndoMerge = (item: typeof mergeHistory[0]) => {
    setMatrixColumns(prev => {
      if (prev.some(c => c.id === item.secondaryColId)) return prev;
      return [...prev, { id: item.secondaryColId, name: item.secondaryColName }];
    });
    setMergeHistory(prev => prev.filter(h => h.id !== item.id));
    showNotification(`Consolidação desfeita. Variável "${item.secondaryColName}" restaurada!`);
  };

  const handleResetAllMerges = async () => {
    if ((await portalConfirm('Deseja desfazer todas as consolidações de variáveis realizadas?'))) {
      mergeHistory.forEach(item => {
        setMatrixColumns(prev => {
          if (prev.some(c => c.id === item.secondaryColId)) return prev;
          return [...prev, { id: item.secondaryColId, name: item.secondaryColName }];
        });
      });
      setMergeHistory([]);
      showNotification('Todas as consolidações foram resetadas com sucesso.');
    }
  };

  const handleProcessImportModel = () => {
    if (!importModelName.trim()) {
      portalNotice('Informe o nome do modelo.');
      return;
    }
    const newDocId = 'doc_' + Date.now();
    const driveUrl = importModelMode === 'drive' ? importModelUrl.trim() : '';

    const newRow: MatrixRow = {
      id: newDocId,
      name: importModelName.trim(),
      driveFileUrl: driveUrl,
      fields: {}
    };

    if (setDocTemplates) {
      setDocTemplates(prev => [
        ...prev,
        {
          id: newDocId,
          label: importModelName.trim(),
          description: importModelMode === 'drive' ? 'Modelo importado do Google Drive' : 'Modelo importado por anexo de arquivo',
          variables: ['aluno_nome', 'data_defesa', 'orientador_nome'],
          driveFileUrl: driveUrl
        }
      ]);
    }

    setMatrixRows(prev => [...prev, newRow]);
    handleScanAndUpdateVariables();

    setIsImportModelOpen(false);
    setImportModelName('');
    setImportModelUrl('');
    showNotification(`Modelo "${importModelName}" importado com sucesso!`);
  };

  // Handlers for creating new Email and Form via Pop-up Modals
  const handleSaveNewEmailModal = () => {
    if (!newEmailName.trim()) {
      portalNotice('Por favor, informe o nome do modelo de e-mail.');
      return;
    }
    const newEmailItem: EmailTemplateItem = {
      id: 'email_' + Date.now(),
      name: newEmailName.trim().toUpperCase(),
      triggerStage: newEmailTrigger || 'Etapa 1 - Inscrição do TCC',
      recipient: newEmailRecipient || '{{ALUNO_EMAIL}}',
      subject: newEmailSubject || 'Notificação do Sistema de TCC',
      body: newEmailBody || 'Prezado(a),\n\nSegue notificação oficial referente ao processo de TCC.\n\nAtenciosamente,\nComissão de TCC',
      attachments: newEmailAttachments || []
    };
    setEmailTemplates(prev => [...prev, newEmailItem]);
    setIsCreateEmailModalOpen(false);
    setNewEmailName('');
    showNotification(`E-mail "${newEmailItem.name}" criado e adicionado à planilha!`);
  };

  const handleSaveNewFormModal = () => {
    if (!newFormTitle.trim()) {
      portalNotice('Por favor, informe o título do formulário.');
      return;
    }
    const newFormItem: FormTemplateItem = {
      id: 'form_' + Date.now(),
      title: newFormTitle.trim().toUpperCase(),
      stage: 'Etapa 1 - Inscrição',
      targetRole: newFormTargetRole,
      description: newFormDescription || 'Formulário dinâmico de coleta de dados de TCC',
      questions: newFormQuestions.length > 0 ? newFormQuestions : [
        {
          id: 'q_' + Date.now(),
          label: 'Campo Inicial de Coleta',
          fieldType: 'text',
          expectedAnswer: '',
          required: true,
          fieldKey: 'CAMPO_INICIAL'
        }
      ]
    };
    setFormTemplates(prev => [...prev, newFormItem]);
    setIsCreateFormModalOpen(false);
    setNewFormTitle('');
    showNotification(`Formulário "${newFormItem.title}" criado e adicionado à planilha!`);
  };

  const handleMouseLeaveOrUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const y = e.pageY - tableContainerRef.current.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    tableContainerRef.current.scrollLeft = scrollLeft - walkX;
    tableContainerRef.current.scrollTop = scrollTop - walkY;
  };

  // Helper getters for current selected template objects
  const currentEmail = emailTemplates.find(e => e.id === selectedEmailId) || emailTemplates[0] || {
    id: '1', name: 'Novo E-mail', triggerStage: 'Etapa 2 - Confirmação da Banca', subject: '', body: '', recipient: '{{ALUNO_EMAIL}}', attachments: []
  };

  const currentForm = formTemplates.find(f => f.id === selectedFormId) || formTemplates[0] || {
    id: 'form_1', title: 'Novo Formulário', stage: 'Etapa 1', targetRole: 'Aluno', description: '', questions: []
  };

  // Sort Handler
  const handleSort = (colId: string) => {
    setSortConfig(prev => {
      if (prev?.colId === colId) {
        if (prev.direction === 'asc') return { colId, direction: 'desc' };
        return null;
      }
      return { colId, direction: 'asc' };
    });
  };

  // Sorting getters for matrix rows
  const getSortedMatrixRows = () => {
    if (!sortConfig) return matrixRows;
    const { colId, direction } = sortConfig;
    return [...matrixRows].sort((a, b) => {
      if (colId === 'element_name') {
        const cmp = a.name.localeCompare(b.name, 'pt-BR');
        return direction === 'asc' ? cmp : -cmp;
      }
      const valA = a.fields[colId] ? 1 : 0;
      const valB = b.fields[colId] ? 1 : 0;
      return direction === 'asc' ? valA - valB : valB - valA;
    });
  };

  const getSortedEmailTemplates = () => {
    if (!sortConfig) return emailTemplates;
    const { colId, direction } = sortConfig;
    return [...emailTemplates].sort((a, b) => {
      if (colId === 'element_name') {
        const cmp = a.name.localeCompare(b.name, 'pt-BR');
        return direction === 'asc' ? cmp : -cmp;
      }
      const targetCol = matrixColumns.find(c => c.id === colId);
      if (!targetCol) return 0;
      const valA = isTagUsedByEmail(a, targetCol) ? 1 : 0;
      const valB = isTagUsedByEmail(b, targetCol) ? 1 : 0;
      return direction === 'asc' ? valA - valB : valB - valA;
    });
  };

  const getSortedFormTemplates = () => {
    if (!sortConfig) return formTemplates;
    const { colId, direction } = sortConfig;
    return [...formTemplates].sort((a, b) => {
      if (colId === 'element_name') {
        const cmp = a.title.localeCompare(b.title, 'pt-BR');
        return direction === 'asc' ? cmp : -cmp;
      }
      const targetCol = matrixColumns.find(c => c.id === colId);
      if (!targetCol) return 0;
      const valA = isTagUsedByForm(a, targetCol) ? 1 : 0;
      const valB = isTagUsedByForm(b, targetCol) ? 1 : 0;
      return direction === 'asc' ? valA - valB : valB - valA;
    });
  };

  const sortedMatrixColumns = useMemo(() => {
    const seen = new Set<string>();
    const result: MatrixColumn[] = [];
    const orderedKeys = Array.from(new Set(variableColumnOrder));

    for (const key of orderedKeys) {
      if (key === 'element_name' || !variableVisibleColumns[key]) continue;
      const col = matrixColumns.find((column) => column.id === key);
      if (col && !seen.has(col.id)) {
        seen.add(col.id);
        result.push(col);
      }
    }
    return result;
  }, [variableColumnOrder, variableVisibleColumns, matrixColumns]);

  // Matrix handlers
  const handleMoveColumn = (colIndex: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? colIndex - 1 : colIndex + 1;
    if (targetIndex < 0 || targetIndex >= matrixColumns.length) return;
    const newCols = [...matrixColumns];
    const temp = newCols[colIndex];
    newCols[colIndex] = newCols[targetIndex];
    newCols[targetIndex] = temp;
    setMatrixColumns(newCols);
  };

  const handleMoveRow = (rowIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? rowIndex - 1 : rowIndex + 1;
    if (targetIndex < 0 || targetIndex >= matrixRows.length) return;
    const newRows = [...matrixRows];
    const temp = newRows[rowIndex];
    newRows[rowIndex] = newRows[targetIndex];
    newRows[targetIndex] = temp;
    setMatrixRows(newRows);
  };

  const handleDeleteMatrixRow = async (rowId: string) => {
    if ((await portalConfirm('Deseja excluir este modelo da planilha?'))) {
      setMatrixRows(prev => prev.filter(r => r.id !== rowId));
    }
  };

  const handleCreateNewDocRow = () => {
    if (!newRowName.trim()) {
      portalNotice('Informe o nome do documento.');
      return;
    }
    const newRow: MatrixRow = {
      id: 'row_' + Date.now(),
      name: newRowName.trim(),
      driveFileUrl: newRowUrl.trim(),
      fields: {}
    };
    setMatrixRows(prev => [...prev, newRow]);
    setNewRowName('');
    setNewRowUrl('');
    setIsAddRowOpen(false);
    showNotification('Novo modelo adicionado à planilha!');
  };

  // Email Handlers
  const handleAddNewEmail = () => {
    const newId = 'email_' + Date.now();
    const newItem: EmailTemplateItem = {
      id: newId,
      name: `Modelo de E-mail #${emailTemplates.length + 1}`,
      triggerStage: 'Etapa 2 - Confirmação da Banca pelo Aluno/Orientador',
      recipient: '{{ALUNO_EMAIL}}',
      subject: 'Notificação do Portal de TCC',
      body: 'Prezado(a) discente,\n\nSeus dados de TCC foram recebidos com sucesso.\n\nAtenciosamente,\nComissão de TCC',
      attachments: []
    };
    setEmailTemplates(prev => [...prev, newItem]);
    setSelectedEmailId(newId);
    showNotification('Novo modelo de e-mail criado!');
  };

  const handleDeleteEmail = async (id: string) => {
    if (emailTemplates.length <= 1) {
      portalNotice('É necessário ter ao menos um modelo de e-mail cadastrado.');
      return;
    }
    if ((await portalConfirm('Excluir este modelo de e-mail?'))) {
      setEmailTemplates(prev => prev.filter(item => item.id !== id));
      setSelectedEmailId(emailTemplates.find(item => item.id !== id)?.id || '');
    }
  };

  const handleToggleEmailAttachment = (docId: string) => {
    setEmailTemplates(prev =>
      prev.map(item => {
        if (item.id === currentEmail.id) {
          const currentAtts = item.attachments || [];
          const exists = currentAtts.includes(docId);
          const nextAtts = exists ? currentAtts.filter(a => a !== docId) : [...currentAtts, docId];
          return { ...item, attachments: nextAtts };
        }
        return item;
      })
    );
  };

  // Form Handlers
  const handleAddNewForm = () => {
    const newId = 'form_' + Date.now();
    const newItem: FormTemplateItem = {
      id: newId,
      title: `Formulário de Coleta #${formTemplates.length + 1}`,
      stage: 'Etapa 1 - Inscrição e Cadastro do TCC',
      targetRole: 'Aluno',
      description: 'Coleta inicial de dados do aluno, orientador e projeto de TCC.',
      questions: [
        {
          id: 'q_1',
          fieldKey: 'nome_aluno',
          label: 'Nome Completo do Discente',
          fieldType: 'text',
          expectedAnswer: '',
          required: true
        },
        {
          id: 'q_2',
          fieldKey: 'titulo_trabalho',
          label: 'Título Definitivo do TCC',
          fieldType: 'text',
          expectedAnswer: '',
          required: true
        }
      ]
    };
    setFormTemplates(prev => [...prev, newItem]);
    setSelectedFormId(newId);
    showNotification('Novo formulário criado!');
  };

  const handleDeleteForm = async (id: string) => {
    if (formTemplates.length <= 1) {
      portalNotice('É necessário ter ao menos um formulário de processo cadastrado.');
      return;
    }
    if ((await portalConfirm('Excluir este formulário?'))) {
      setFormTemplates(prev => prev.filter(f => f.id !== id));
      setSelectedFormId(formTemplates.find(f => f.id !== id)?.id || '');
    }
  };

  const handleAddQuestionToForm = () => {
    const newQ = {
      id: 'q_' + Date.now(),
      fieldKey: 'novo_campo_' + (currentForm.questions.length + 1),
      label: 'Novo Campo de Coleta',
      fieldType: 'text' as const,
      expectedAnswer: '',
      required: true
    };
    setFormTemplates(prev =>
      prev.map(f => (f.id === currentForm.id ? { ...f, questions: [...f.questions, newQ] } : f))
    );
  };

  const handleDeleteQuestionFromForm = (qId: string) => {
    setFormTemplates(prev =>
      prev.map(f => (f.id === currentForm.id ? { ...f, questions: f.questions.filter(q => q.id !== qId) } : f))
    );
  };

  // Workflow Pipeline Handlers
  const handleAddStage = () => {
    const newNum = workflowStages.length + 1;
    const newStage: WorkflowStageItem = {
      id: 'stage_' + Date.now(),
      stageNumber: newNum,
      title: `Nova Etapa ${newNum}`,
      triggerEvent: 'Ação manual ou envio de formulário',
      description: 'Descrição da etapa',
      actions: []
    };
    setWorkflowStages(prev => [...prev, newStage]);
    showNotification(`Etapa ${newNum} criada no fluxo!`);
  };

  const handleMoveStage = (idx: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= workflowStages.length) return;
    const list = [...workflowStages];
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;

    const renumbered = list.map((stg, i) => ({ ...stg, stageNumber: i + 1 }));
    setWorkflowStages(renumbered);
  };

  const handleDeleteStage = async (id: string) => {
    if (workflowStages.length <= 1) {
      portalNotice('O fluxo deve conter ao menos 1 etapa.');
      return;
    }
    if ((await portalConfirm('Remover esta etapa do fluxo de processo?'))) {
      const list = workflowStages.filter(s => s.id !== id);
      const renumbered = list.map((stg, i) => ({ ...stg, stageNumber: i + 1 }));
      setWorkflowStages(renumbered);
    }
  };

  const handleAddItemToStage = (stageId: string, type: 'doc' | 'email' | 'form' | 'action', itemObj?: any, customTitle?: string) => {
    const newAction: WorkflowActionItem = {
      id: 'act_' + Date.now(),
      type,
      title: customTitle || itemObj?.title || itemObj?.name || itemObj?.label || 'Item sem nome',
      refId: itemObj?.id,
      recipientOrDetail: type === 'email' ? (itemObj?.triggerStage || 'Servidor Oficial') : (type === 'form' ? `Destinado: ${itemObj?.targetRole || 'Discente'}` : undefined)
    };

    setWorkflowStages(prev =>
      prev.map(stg => (stg.id === stageId ? { ...stg, actions: [...stg.actions, newAction] } : stg))
    );
    setAddingToStageId(null);
  };

  const handleRemoveActionFromStage = (stageId: string, actionId: string) => {
    setWorkflowStages(prev =>
      prev.map(stg => (stg.id === stageId ? { ...stg, actions: stg.actions.filter(a => a.id !== actionId) } : stg))
    );
  };

  const rawMatrixRows = getSortedMatrixRows();
  const rawEmailTemplates = getSortedEmailTemplates();
  const rawFormTemplates = getSortedFormTemplates();

  const sortedMatrixRows: MatrixRow[] = (rawMatrixRows.filter(r =>
    !searchTerm || r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    Object.keys(r.fields).some(k => k.toLowerCase().includes(searchTerm.toLowerCase()))
  ) as MatrixRow[]).slice(0, variableRecordsLimit === 'all' ? undefined : variableRecordsLimit);

  const sortedEmailTemplates: EmailTemplateItem[] = (rawEmailTemplates.filter(e =>
    !searchTerm || e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.subject.toLowerCase().includes(searchTerm.toLowerCase())
  ) as EmailTemplateItem[]).slice(0, variableRecordsLimit === 'all' ? undefined : variableRecordsLimit);

  const sortedFormTemplates: FormTemplateItem[] = (rawFormTemplates.filter(f =>
    !searchTerm || f.title.toLowerCase().includes(searchTerm.toLowerCase())
  ) as FormTemplateItem[]).slice(0, variableRecordsLimit === 'all' ? undefined : variableRecordsLimit);

  return (
    <div className="space-y-3">

      {/* UNIFIED LIGHT GRAY HEADER & SPREADSHEET CARD */}
      <div className={`bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden ${styles.fontFamilyClass}`} style={styles.rootStyle}>
        {/* CABEÇALHO DA PLANILHA DE VARIÁVEIS (BRANCO E CINZA CLARO FIXO) */}
        <div className="bg-slate-100 p-3.5 sm:p-4 space-y-3 border-b border-slate-300 text-slate-800">
        
        {/* Linha 1 do Cabeçalho: Título + Atualizar Variáveis + Engrenagem */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ColorfulHeaderIcon type="variables" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900">
                {getEditableTableText(variableLabels, '__tableTitle', 'PLANILHA DE VARIÁVEIS')}
              </h3>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsMergeHistoryModalOpen(true)}
                className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl px-3.5 py-1.5 text-xs font-black uppercase tracking-wide flex items-center gap-2 cursor-pointer shadow-2xs active:scale-95 transition-all"
                title="Central de Mesclagens: Procurar novas mesclas, fazer mescla manual e ver histórico"
              >
                <GitMerge className="h-4 w-4 text-slate-700" />
                <span>MESCLAGENS ({mergeHistory.length})</span>
              </button>
            </div>
          </div>

          {/* Linha 2 do Cabeçalho: Filtro Padronizado de ponta a ponta */}
          <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-2 text-xs min-w-0 w-full">
            <span className="text-[10px] font-black uppercase tracking-wider shrink-0 text-slate-700">
              {getEditableTableText(variableLabels, '__filterTitle', 'FILTRAR:')}
            </span>

            {/* Pílulas de Filtro de Sub-sistemas em tons neutros (Branco e Cinza Claro) */}
            {[
              { key: 'modelos', label: 'MODELOS', count: sortedMatrixRows.length, isSel: selectedSubSystems.modelos, toggle: () => setSelectedSubSystems(prev => ({ ...prev, modelos: !prev.modelos })) },
              { key: 'formularios', label: 'FORMULÁRIOS', count: sortedFormTemplates.length, isSel: selectedSubSystems.formularios, toggle: () => setSelectedSubSystems(prev => ({ ...prev, formularios: !prev.formularios })) },
              { key: 'emails', label: 'E-MAILS', count: sortedEmailTemplates.length, isSel: selectedSubSystems.emails, toggle: () => setSelectedSubSystems(prev => ({ ...prev, emails: !prev.emails })) },
            ].map((sub) => {
              return (
                <button
                  key={sub.key}
                  type="button"
                  onClick={sub.toggle}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide cursor-pointer transition-all border select-none ${
                    sub.isSel
                      ? 'bg-slate-200 text-slate-900 border-slate-400 shadow-2xs font-extrabold'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 opacity-80'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${sub.isSel ? 'bg-slate-700' : 'bg-slate-400'}`} />
                  <span>{sub.label}</span>
                  <span className={`px-1.5 py-0.1 rounded-full text-[9px] font-black min-w-[16px] text-center ${
                    sub.isSel ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {sub.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TABELA DA PLANILHA UNIFICADA COM TRAVAMENTO RIGOROSO DE CABEÇALHO E 1ª COLUNA */}
          <div
            ref={tableContainerRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeaveOrUp}
            onMouseUp={handleMouseLeaveOrUp}
            onMouseMove={handleMouseMove}
            className={`overflow-x-auto bg-white max-h-[480px] overflow-y-auto select-none transition-colors relative border-t border-slate-300 table-sticky-container ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
          <table className="w-full text-left border-separate border-spacing-0 min-w-[900px]">
            <thead>
              <tr className="bg-slate-100 text-slate-800 text-[11px] font-semibold uppercase tracking-wider border-b-2 border-slate-300 cursor-pointer">
                
                {/* Coluna Fixa da Esquerda (Elemento) com Parede Sólida Opaque Sticky Wall no Topo e Esquerda (z-50) */}
                <th
                  onClick={() => handleSort('element_name')}
                  style={{
                    position: 'sticky',
                    left: 0,
                    top: 0,
                    zIndex: 50,
                    backgroundColor: '#f1f5f9',
                  }}
                  className="sticky left-0 top-0 z-50 bg-slate-100 text-slate-800 px-3 py-2.5 min-w-[280px] w-[280px] max-w-[280px] border-b-2 border-r-2 border-slate-300 shadow-[4px_0_10px_rgba(0,0,0,0.08)] select-none cursor-pointer group transition-colors hover:bg-slate-200"
                  title="Clique para ordenar elementos por nome"
                >
                  <div className="flex items-center justify-between gap-1.5 whitespace-normal break-words text-[11px] font-semibold uppercase tracking-wider text-slate-800">
                    <span className="break-words font-semibold text-slate-800">
                      {formatColumnLabel('element_name', 'ELEMENTO (MODELO / E-MAIL / FORMULÁRIO)', fixedConfigFormat, variableLabels)}
                    </span>
                    {sortConfig?.colId === 'element_name' ? (
                      <span className="font-bold text-xs shrink-0 text-slate-900">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 shrink-0" />
                    )}
                  </div>
                </th>

                {/* Colunas das Variáveis: z-20 para passarem rigidamente por baixo da coluna 1 (z-50) ao rolar */}
                {sortedMatrixColumns.map((col) => (
                  <th
                    key={col.id}
                    onClick={() => handleSort(col.id)}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 20,
                      backgroundColor: '#f1f5f9',
                    }}
                    className={`px-3 py-2.5 w-[140px] min-w-[140px] max-w-[140px] ${getColWidthClass(col.id, variableWidths)} border-b-2 border-r border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200 sticky top-0 z-20 select-none cursor-pointer group transition-colors`}
                    title={`Clique para ver configurações funcionais da variável ${col.name}`}
                  >
                    <div className="flex items-start justify-between gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-800">
                      <div className="flex items-center gap-1 min-w-0 flex-1 whitespace-normal break-words leading-tight">
                        <span
                          className="break-words font-semibold text-slate-800"
                          style={{
                            fontWeight: col.format?.bold ? 700 : undefined,
                            fontStyle: col.format?.italic ? 'italic' : undefined,
                            color: col.format?.color && col.format.color !== '#0f172a' ? col.format.color : undefined,
                          }}
                        >
                          {formatColumnLabel(col.id, variableLabels[col.id] || col.label || col.name, fixedConfigFormat, variableLabels)}
                        </span>
                        {sortConfig?.colId === col.id ? (
                          <span className="font-bold text-xs shrink-0 text-slate-900">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40 group-hover:opacity-100 shrink-0" />
                        )}
                      </div>
                      {isMasterAdmin && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingVariable({ ...col, aliases: [...(col.aliases || [])], format: { bold: false, italic: false, color: '#0f172a', ...(col.format || {}) } });
                          }}
                          className="shrink-0 p-1 opacity-60 hover:opacity-100 text-slate-700 hover:text-slate-900 transition-all rounded hover:bg-slate-200 cursor-pointer"
                          title="Configurar funcionamento da variável no sistema (Modelos, Formulários, E-mails e Código)"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* MODELOS DE DOCUMENTOS (.DOCX) - BRANCO / CINZA */}
              {selectedSubSystems.modelos && sortedMatrixRows.map((row) => (
                <tr
                  key={row.id}
                  className="bg-white border-b border-slate-200 text-xs transition-none hover:bg-slate-50/50"
                >
                  {/* COLUNA 1 FIXA: z-30 com fundo 100% branco opaco e largura controlada */}
                  <td 
                    onClick={() => setEditingModelRow(row)}
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 30,
                      backgroundColor: '#ffffff',
                    }}
                    className="sticky left-0 bg-white z-30 p-1.5 min-w-[280px] w-[280px] max-w-[280px] border-r-2 border-slate-300 shadow-[4px_0_10px_rgba(0,0,0,0.08)] align-middle group/mcell cursor-pointer"
                    title="Clique para editar este modelo"
                  >
                    <div className="flex items-center justify-between gap-1.5 p-2 rounded-lg bg-slate-100 group-hover/mcell:bg-slate-200/90 text-slate-900 border border-slate-300 group-hover/mcell:border-slate-400 shadow-2xs group-hover/mcell:shadow-sm transition-all w-full max-w-full overflow-hidden">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="bg-slate-200 text-slate-800 border border-slate-300 px-1.5 py-0.2 rounded-full text-[8.5px] font-black uppercase shrink-0">
                            📄 MODELO
                          </span>
                          <span className="font-bold text-slate-900 text-[11px] truncate block max-w-[170px]" title={row.name}>
                            {row.name}
                          </span>
                        </div>
                        {row.driveFileUrl && (
                          <a
                            href={row.driveFileUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[9.5px] font-mono text-slate-600 hover:underline inline-flex items-center gap-1 truncate max-w-[170px] cursor-pointer"
                          >
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{row.driveFileUrl.replace('https://', '')}</span>
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMatrixRow(row.id);
                          }}
                          className="p-1 text-slate-500 hover:text-rose-700 cursor-pointer"
                          title="Excluir linha do modelo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* COLUNAS 2+: Células de dados com z-1 que passam por baixo da coluna 1 (z-30) */}
                  {sortedMatrixColumns.map(col => {
                    const isChecked = !!row.fields[col.id];
                    return (
                      <td 
                        key={col.id} 
                        style={{ position: 'relative', zIndex: 1, backgroundColor: '#ffffff' }}
                        className="p-1 w-[140px] min-w-[140px] max-w-[140px] border-r border-b border-slate-200 text-center align-middle cursor-grab bg-white"
                      >
                        {isChecked ? (
                          <span className="font-black text-slate-900 text-sm select-none">
                            ✓
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[10px] select-none">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* FORMULÁRIOS DINÂMICOS - BRANCO / CINZA */}
              {selectedSubSystems.formularios && sortedFormTemplates.map(form => (
                <tr
                  key={form.id}
                  className="bg-white border-b border-slate-200 text-xs transition-none hover:bg-slate-50/50"
                >
                  {/* COLUNA 1 FIXA: z-30 com fundo 100% branco opaco e largura controlada */}
                  <td 
                    onClick={() => setEditingForm(form)}
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 30,
                      backgroundColor: '#ffffff',
                    }}
                    className="sticky left-0 bg-white z-30 p-1.5 min-w-[280px] w-[280px] max-w-[280px] border-r-2 border-slate-300 shadow-[4px_0_10px_rgba(0,0,0,0.08)] align-middle group/fcell cursor-pointer"
                    title="Clique para editar este formulário"
                  >
                    <div className="flex items-center justify-between gap-1.5 p-2 rounded-lg bg-slate-100 group-hover/fcell:bg-slate-200/90 text-slate-900 border border-slate-300 group-hover/fcell:border-slate-400 shadow-2xs group-hover/fcell:shadow-sm transition-all w-full max-w-full overflow-hidden">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="bg-slate-200 text-slate-800 border border-slate-300 px-1.5 py-0.2 rounded-full text-[8.5px] font-black uppercase shrink-0">
                            📋 FORMULÁRIO
                          </span>
                          <span className="font-bold text-slate-900 text-[11px] truncate block max-w-[170px]" title={form.title}>
                            {form.title}
                          </span>
                        </div>
                        <span className="text-[9.5px] text-slate-600 font-mono block truncate max-w-[170px]">
                          👤 Papel: {form.targetRole} | {form.questions.length} campos
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteForm(form.id);
                        }}
                        className="p-1 text-slate-500 hover:text-rose-700 shrink-0 cursor-pointer"
                        title="Excluir linha do formulário"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>

                  {/* COLUNAS 2+: Visualização de uso da tag que passa por baixo da coluna 1 */}
                  {sortedMatrixColumns.map(col => {
                    const isUsed = isTagUsedByForm(form, col);
                    return (
                      <td 
                        key={col.id} 
                        style={{ position: 'relative', zIndex: 1, backgroundColor: '#ffffff' }}
                        className="p-1 w-[140px] min-w-[140px] max-w-[140px] border-r border-b border-slate-200 text-center align-middle cursor-grab bg-white"
                      >
                        {isUsed ? (
                          <span className="font-black text-slate-900 text-sm select-none">
                            ✓
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[10px] select-none">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* MODELOS DE E-MAILS AUTOMÁTICOS - BRANCO / CINZA */}
              {selectedSubSystems.emails && sortedEmailTemplates.map(email => (
                <tr
                  key={email.id}
                  className="bg-white border-b border-slate-200 text-xs transition-none hover:bg-slate-50/50"
                >
                  {/* COLUNA 1 FIXA: z-30 com fundo 100% branco opaco e largura controlada */}
                  <td 
                    onClick={() => setEditingEmail(email)}
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 30,
                      backgroundColor: '#ffffff',
                    }}
                    className="sticky left-0 bg-white z-30 p-1.5 min-w-[280px] w-[280px] max-w-[280px] border-r-2 border-slate-300 shadow-[4px_0_10px_rgba(0,0,0,0.08)] align-middle group/ecell cursor-pointer"
                    title="Clique para editar este modelo de e-mail"
                  >
                    <div className="flex items-center justify-between gap-1.5 p-2 rounded-lg bg-slate-100 group-hover/ecell:bg-slate-200/90 text-slate-900 border border-slate-300 group-hover/ecell:border-slate-400 shadow-2xs group-hover/ecell:shadow-sm transition-all w-full max-w-full overflow-hidden">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="bg-slate-200 text-slate-800 border border-slate-300 px-1.5 py-0.2 rounded-full text-[8.5px] font-black uppercase shrink-0">
                            ✉️ E-MAIL
                          </span>
                          <span className="font-bold text-slate-900 text-[11px] truncate block max-w-[170px]" title={email.name}>
                            {email.name}
                          </span>
                        </div>
                        <span className="text-[9.5px] text-slate-600 font-mono block truncate max-w-[170px]">
                          📌 Gatilho: {email.triggerStage}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEmail(email.id);
                        }}
                        className="p-1 text-slate-500 hover:text-rose-700 shrink-0 cursor-pointer"
                        title="Excluir linha do e-mail"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>

                  {/* COLUNAS 2+: Visualização de uso da tag que passa por baixo da coluna 1 */}
                  {sortedMatrixColumns.map(col => {
                    const isUsed = isTagUsedByEmail(email, col);
                    return (
                      <td 
                        key={col.id} 
                        style={{ position: 'relative', zIndex: 1, backgroundColor: '#ffffff' }}
                        className="p-1 w-[140px] min-w-[140px] max-w-[140px] border-r border-b border-slate-200 text-center align-middle cursor-grab bg-white"
                      >
                        {isUsed ? (
                          <span className="font-black text-slate-900 text-sm select-none">
                            ✓
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[10px] select-none">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE IMPORTAÇÃO / VARREDURA INTELIGENTE (IA) DE MARCADORES */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-xl w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-700" />
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                  IMPORTAÇÃO INTELIGENTE DE MODELO / FORMULÁRIO (IA)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 font-bold text-sm px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Insira o <strong>Link do Google Drive (.docx/Docs)</strong> ou cole o <strong>Texto do Formulário/E-mail</strong> com os marcadores (<code className="bg-slate-100 border border-slate-300 px-1 py-0.5 rounded text-slate-800 font-mono font-bold">&lt;&lt;campo&gt;&gt;</code>, <code className="bg-slate-100 border border-slate-300 px-1 py-0.5 rounded text-slate-800 font-mono font-bold">&#123;&#123;campo&#125;&#125;</code>, <code className="bg-slate-100 border border-slate-300 px-1 py-0.5 rounded text-slate-800 font-mono font-bold font-mono">[[campo]]</code>, <code className="bg-slate-100 border border-slate-300 px-1 py-0.5 rounded text-slate-800 font-mono font-bold font-mono">«campo»</code>). O sistema varre o conteúdo e mapeia os campos automaticamente na planilha sem duplicar informações já existentes.
            </p>

            <div className="space-y-2">
              <label className="block text-[10.5px] font-extrabold uppercase text-slate-800">
                Link do Google Drive ou Conteúdo do Texto:
              </label>
              <textarea
                rows={5}
                value={importInputText}
                onChange={(e) => setImportInputText(e.target.value)}
                placeholder="Cole aqui a URL do arquivo no Google Drive ou o modelo de texto com marcadores..."
                className="w-full bg-slate-50 border border-slate-300 p-3 rounded text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3.5 py-2 border border-slate-300 rounded text-xs font-bold uppercase text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsScanning(true);
                  await onImportTextOrUrl(importInputText);
                  setIsScanning(false);
                  setIsImportModalOpen(false);
                  setImportInputText('');
                }}
                disabled={isScanning || !importInputText.trim()}
                className="inline-flex items-center gap-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs uppercase px-4 py-2 rounded shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-purple-200" />
                <span>{isScanning ? 'Analisando...' : 'Analisar e Mapear Campos'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INSERIR MODELO .DOCX NA PLANILHA */}
      {isAddRowOpen && (
        <div className="bg-slate-50 border border-slate-300 p-4 rounded-md space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h4 className="text-xs font-black uppercase text-slate-900 flex items-center gap-2">
              <span>📄</span> INSERIR NOVO MODELO DE ARQUIVO .DOCX
            </h4>
            <button
              type="button"
              onClick={() => setIsAddRowOpen(false)}
              className="text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer"
            >
              ✕ Cancelar
            </button>
          </div>
          <div>
            <label className="block text-[10.5px] font-bold uppercase text-slate-700 mb-1">
              Nome do Modelo:
            </label>
            <input
              type="text"
              value={newRowName}
              onChange={(e) => setNewRowName(e.target.value)}
              placeholder="Ex: Ata de Defesa de TCC 2026"
              className="w-full bg-white border border-slate-300 px-3 py-1.5 rounded text-xs font-semibold text-slate-900"
            />
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleCreateNewDocRow}
              className="bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs uppercase px-4 py-2 rounded shadow-2xs cursor-pointer border border-slate-300 active:scale-95"
            >
              Adicionar Modelo
            </button>
          </div>
        </div>
      )}

      {/* MODAL POPUP PARA EDITAR MODELO (.DOCX) AO CLICAR NA LINHA DA PLANILHA */}
      {editingModelRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-600" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
                  EDITAR MODELO DE DOCUMENTO (.DOCX)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingModelRow(null)}
                className="text-slate-400 hover:text-slate-800 font-bold text-sm px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-800 mb-1">
                  Nome do Modelo:
                </label>
                <input
                  type="text"
                  value={editingModelRow.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingModelRow(prev => prev ? { ...prev, name: val } : null);
                    setMatrixRows(prev => prev.map(r => r.id === editingModelRow.id ? { ...r, name: val } : r));
                    if (setDocTemplates) {
                      setDocTemplates(prev => prev.map(d => d.id === editingModelRow.id ? { ...d, label: val } : d));
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-300 p-2 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-800 mb-1">
                  Link do Google Drive (.docx):
                </label>
                <input
                  type="text"
                  value={editingModelRow.driveFileUrl || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingModelRow(prev => prev ? { ...prev, driveFileUrl: val } : null);
                    setMatrixRows(prev => prev.map(r => r.id === editingModelRow.id ? { ...r, driveFileUrl: val } : r));
                    if (setDocTemplates) {
                      setDocTemplates(prev => prev.map(d => d.id === editingModelRow.id ? { ...d, driveFileUrl: val } : d));
                    }
                  }}
                  placeholder="https://docs.google.com/document/d/..."
                  className="w-full bg-slate-50 border border-slate-300 p-2 rounded-xl text-xs font-mono text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={async () => {
                  if ((await portalConfirm(`Excluir o modelo "${editingModelRow.name}"?`))) {
                    handleDeleteMatrixRow(editingModelRow.id);
                    if (setDocTemplates) setDocTemplates(prev => prev.filter(d => d.id !== editingModelRow.id));
                    setEditingModelRow(null);
                  }
                }}
                className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3.5 py-1.5 rounded-full cursor-pointer hover:bg-rose-100 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Modelo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingModelRow(null);
                  showNotification(`Modelo "${editingModelRow.name}" atualizado!`);
                }}
                className="bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs uppercase px-4 py-2 rounded-xl shadow-2xs transition-all cursor-pointer border border-slate-300 active:scale-95"
              >
                Salvar e Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL POPUP PARA EDITAR E-MAIL AUTOMÁTICO AO CLICAR NA LINHA DA PLANILHA */}
      {editingEmail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-2xl w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-amber-600" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
                  EDITAR MODELO DE E-MAIL AUTOMÁTICO
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingEmail(null)}
                className="text-slate-400 hover:text-slate-800 font-bold text-sm px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-800 mb-1">
                  Nome do Modelo de E-mail:
                </label>
                <input
                  type="text"
                  value={editingEmail.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingEmail(prev => prev ? { ...prev, name: val } : null);
                    setEmailTemplates(prev => prev.map(em => em.id === editingEmail.id ? { ...em, name: val } : em));
                  }}
                  className="w-full bg-slate-50 border border-slate-300 p-2 rounded text-xs font-bold text-slate-900 uppercase"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-800 mb-1">
                    Gatilho (Momento do Disparo):
                  </label>
                  <select
                    value={editingEmail.triggerStage}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingEmail(prev => prev ? { ...prev, triggerStage: val } : null);
                      setEmailTemplates(prev => prev.map(em => em.id === editingEmail.id ? { ...em, triggerStage: val } : em));
                    }}
                    className="w-full bg-slate-50 p-2 text-xs font-bold text-slate-900 border border-slate-300 rounded"
                  >
                    <option value="Etapa 1 - Inscrição do TCC">Etapa 1 - Inscrição e Envio pelo Discente</option>
                    <option value="Etapa 2 - Confirmação da Banca pelo Aluno/Orientador">Etapa 2 - Confirmação da Banca (Convite)</option>
                    <option value="Etapa 3 - Agendamento Confirmado">Etapa 3 - Confirmação de Data e Local</option>
                    <option value="Etapa 3 - Lembrete Automático 48h Antes">Etapa 3 - Lembrete Automático 48h Antes</option>
                    <option value="Etapa 5 - Conclusão e Assinatura do Presidente">Etapa 5 - Conclusão do processo e declaração assinada</option>
                    <option value="Envio Manual">Envio Manual pelo Painel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-800 mb-1">
                    Destinatário Oficial:
                  </label>
                  <input
                    type="text"
                    value={editingEmail.recipient || '{{ALUNO_EMAIL}}'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingEmail(prev => prev ? { ...prev, recipient: val } : null);
                      setEmailTemplates(prev => prev.map(em => em.id === editingEmail.id ? { ...em, recipient: val } : em));
                    }}
                    className="w-full bg-slate-50 p-2 text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-800 mb-1">
                  Assunto do E-mail:
                </label>
                <input
                  type="text"
                  value={editingEmail.subject}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingEmail(prev => prev ? { ...prev, subject: val } : null);
                    setEmailTemplates(prev => prev.map(em => em.id === editingEmail.id ? { ...em, subject: val } : em));
                  }}
                  className="w-full bg-slate-50 p-2 text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-800 mb-1">
                  Corpo da Mensagem (Com Marcadores):
                </label>
                <textarea
                  rows={5}
                  value={editingEmail.body}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingEmail(prev => prev ? { ...prev, body: val } : null);
                    setEmailTemplates(prev => prev.map(em => em.id === editingEmail.id ? { ...em, body: val } : em));
                  }}
                  className="w-full bg-slate-50 p-2.5 text-xs font-mono text-slate-800 border border-slate-300 rounded leading-relaxed"
                />
              </div>

              <div className="bg-slate-50 p-3 border border-slate-300 rounded space-y-2">
                <label className="block text-[11px] font-bold uppercase text-slate-900">
                  📎 Anexos Automáticos Vinculados:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {docTemplates.map(doc => {
                    const isAttached = (editingEmail.attachments || []).includes(doc.id);
                    return (
                      <label key={doc.id} className={`p-1.5 border rounded flex items-center gap-2 cursor-pointer ${isAttached ? 'bg-sky-50 border-sky-400 font-bold' : 'bg-white border-slate-200'}`}>
                        <input
                          type="checkbox"
                          checked={isAttached}
                          onChange={() => {
                            const cur = editingEmail.attachments || [];
                            const updated = isAttached ? cur.filter(a => a !== doc.id) : [...cur, doc.id];
                            setEditingEmail(prev => prev ? { ...prev, attachments: updated } : null);
                            setEmailTemplates(prev => prev.map(em => em.id === editingEmail.id ? { ...em, attachments: updated } : em));
                          }}
                          className="accent-sky-700"
                        />
                        <span className="text-[11px] truncate">{doc.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={async () => {
                  if ((await portalConfirm(`Excluir o modelo de e-mail "${editingEmail.name}"?`))) {
                    handleDeleteEmail(editingEmail.id);
                    setEditingEmail(null);
                  }
                }}
                className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3.5 py-1.5 rounded-full cursor-pointer hover:bg-rose-100 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir E-mail</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingEmail(null);
                  showNotification(`E-mail "${editingEmail.name}" atualizado!`);
                }}
                className="bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs uppercase px-4 py-2 rounded-xl shadow-2xs transition-all cursor-pointer border border-slate-300 active:scale-95"
              >
                Salvar e Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL POPUP PARA EDITAR FORMULÁRIO DINÂMICO AO CLICAR NA LINHA DA PLANILHA */}
      {editingForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-2xl w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-sky-600" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
                  EDITAR FORMULÁRIO DINÂMICO
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingForm(null)}
                className="text-slate-400 hover:text-slate-800 font-bold text-sm px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-800 mb-1">
                  Título do Formulário:
                </label>
                <input
                  type="text"
                  value={editingForm.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingForm(prev => prev ? { ...prev, title: val } : null);
                    setFormTemplates(prev => prev.map(f => f.id === editingForm.id ? { ...f, title: val } : f));
                  }}
                  className="w-full bg-slate-50 border border-slate-300 p-2 rounded text-xs font-bold text-slate-900 uppercase"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-800 mb-1">
                    Quem Preenche (Público-Alvo):
                  </label>
                  <select
                    value={editingForm.targetRole}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setEditingForm(prev => prev ? { ...prev, targetRole: val } : null);
                      setFormTemplates(prev => prev.map(f => f.id === editingForm.id ? { ...f, targetRole: val } : f));
                    }}
                    className="w-full bg-slate-50 p-2 text-xs font-bold text-slate-900 border border-slate-300 rounded"
                  >
                    <option value="Aluno">Discente (Aluno)</option>
                    <option value="Orientador">Docente Orientador</option>
                    <option value="Banca">Membro Avaliador da Banca</option>
                    <option value="Presidente da Comissão">Presidente da Comissão</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-800 mb-1">
                    Descrição:
                  </label>
                  <input
                    type="text"
                    value={editingForm.description}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingForm(prev => prev ? { ...prev, description: val } : null);
                      setFormTemplates(prev => prev.map(f => f.id === editingForm.id ? { ...f, description: val } : f));
                    }}
                    className="w-full bg-slate-50 p-2 text-xs font-bold text-slate-900 border border-slate-300 rounded"
                  />
                </div>
              </div>

              {/* Lista de Campos do Formulário */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-xs font-black uppercase text-slate-900">
                    Campos de Coleta do Formulário ({editingForm.questions.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const newQ = {
                        id: 'q_' + Date.now(),
                        label: 'Novo Campo',
                        fieldType: 'text' as const,
                        expectedAnswer: '',
                        required: true,
                        fieldKey: 'NOVO_CAMPO'
                      };
                      const updatedQuestions = [...editingForm.questions, newQ];
                      setEditingForm(prev => prev ? { ...prev, questions: updatedQuestions } : null);
                      setFormTemplates(prev => prev.map(f => f.id === editingForm.id ? { ...f, questions: updatedQuestions } : f));
                    }}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-[11px] uppercase px-3 py-1 rounded-full cursor-pointer transition-all"
                  >
                    + Adicionar Campo
                  </button>
                </div>

                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {editingForm.questions.map((q, qIdx) => (
                    <div key={q.id} className="bg-slate-50 p-3 border border-slate-300 rounded space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-[10px] bg-slate-200 px-2 py-0.5 rounded uppercase">
                          Campo #{qIdx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const updatedQuestions = editingForm.questions.filter(item => item.id !== q.id);
                            setEditingForm(prev => prev ? { ...prev, questions: updatedQuestions } : null);
                            setFormTemplates(prev => prev.map(f => f.id === editingForm.id ? { ...f, questions: updatedQuestions } : f));
                          }}
                          className="text-rose-600 hover:text-rose-800 p-0.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-600">Rótulo:</label>
                          <input
                            type="text"
                            value={q.label}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updatedQuestions = editingForm.questions.map(item => item.id === q.id ? { ...item, label: val } : item);
                              setEditingForm(prev => prev ? { ...prev, questions: updatedQuestions } : null);
                              setFormTemplates(prev => prev.map(f => f.id === editingForm.id ? { ...f, questions: updatedQuestions } : f));
                            }}
                            className="w-full bg-white border border-slate-300 p-1.5 rounded font-bold text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-600">Tag Matriz:</label>
                          <input
                            type="text"
                            value={q.fieldKey}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updatedQuestions = editingForm.questions.map(item => item.id === q.id ? { ...item, fieldKey: val } : item);
                              setEditingForm(prev => prev ? { ...prev, questions: updatedQuestions } : null);
                              setFormTemplates(prev => prev.map(f => f.id === editingForm.id ? { ...f, questions: updatedQuestions } : f));
                            }}
                            className="w-full bg-white border border-slate-300 p-1.5 rounded font-mono text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-600">Tipo do Campo:</label>
                          <select
                            value={q.type}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              const updatedQuestions = editingForm.questions.map(item => item.id === q.id ? { ...item, type: val } : item);
                              setEditingForm(prev => prev ? { ...prev, questions: updatedQuestions } : null);
                              setFormTemplates(prev => prev.map(f => f.id === editingForm.id ? { ...f, questions: updatedQuestions } : f));
                            }}
                            className="w-full bg-white border border-slate-300 p-1.5 rounded font-bold text-xs"
                          >
                            <option value="text">Texto Curto</option>
                            <option value="textarea">Texto Longo</option>
                            <option value="date">Data</option>
                            <option value="file">Anexo de Arquivo</option>
                            <option value="select">Seleção (Dropdown)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={async () => {
                  if ((await portalConfirm(`Excluir o formulário "${editingForm.title}"?`))) {
                    handleDeleteForm(editingForm.id);
                    setEditingForm(null);
                  }
                }}
                className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3.5 py-1.5 rounded-full cursor-pointer hover:bg-rose-100 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Formulário</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingForm(null);
                  showNotification(`Formulário "${editingForm.title}" atualizado!`);
                }}
                className="bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs uppercase px-4 py-2 rounded-xl shadow-2xs transition-all cursor-pointer border border-slate-300 active:scale-95"
              >
                Salvar e Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO: CRIAR NOVO E-MAIL */}
      {isCreateEmailModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-xl max-w-xl w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">✉️</span>
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-900">
                  Criar Novo Modelo de E-mail
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateEmailModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 font-bold text-sm px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-800 mb-1">
                  Nome do Modelo de E-mail:
                </label>
                <input
                  type="text"
                  placeholder="Ex: NOTIFICAÇÃO DE AGENDAMENTO DE BANCA"
                  value={newEmailName}
                  onChange={(e) => setNewEmailName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 p-2.5 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 uppercase"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-extrabold uppercase text-slate-800 mb-1">
                    Gatilho / Momento do Disparo:
                  </label>
                  <select
                    value={newEmailTrigger}
                    onChange={(e) => setNewEmailTrigger(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 p-2 rounded-lg text-xs font-bold text-slate-900"
                  >
                    <option value="Etapa 1 - Inscrição do TCC">Etapa 1 - Inscrição e Envio pelo Discente</option>
                    <option value="Etapa 2 - Confirmação da Banca">Etapa 2 - Confirmação da Banca (Convite)</option>
                    <option value="Etapa 3 - Agendamento Confirmado">Etapa 3 - Confirmação de Data e Local</option>
                    <option value="Etapa 4 - Ata de Defesa Gerada">Etapa 4 - Ata de Defesa Gerada</option>
                    <option value="Etapa 5 - Conclusão do Processo">Etapa 5 - Conclusão do Processo e Ata Assinada</option>
                    <option value="Disparo Manual">Disparo Manual pelo Painel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-extrabold uppercase text-slate-800 mb-1">
                    Destinatário:
                  </label>
                  <input
                    type="text"
                    value={newEmailRecipient}
                    onChange={(e) => setNewEmailRecipient(e.target.value)}
                    placeholder="Ex: {{ALUNO_EMAIL}}, {{ORIENTADOR_EMAIL}}"
                    className="w-full bg-slate-50 border border-slate-300 p-2 rounded-lg text-xs font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-800 mb-1">
                  Assunto do E-mail:
                </label>
                <input
                  type="text"
                  value={newEmailSubject}
                  onChange={(e) => setNewEmailSubject(e.target.value)}
                  placeholder="Assunto da mensagem"
                  className="w-full bg-slate-50 border border-slate-300 p-2 rounded-lg text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-800 mb-1">
                  Corpo da Mensagem (Suporta variáveis {"{{ALUNO}}"}, {"{{TITULO}}"}):
                </label>
                <textarea
                  rows={5}
                  value={newEmailBody}
                  onChange={(e) => setNewEmailBody(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 p-2 text-xs font-mono text-slate-800 rounded-lg leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsCreateEmailModalOpen(false)}
                className="px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-bold uppercase text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveNewEmailModal}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 rounded-lg text-xs font-black uppercase tracking-wide cursor-pointer shadow-2xs transition-colors"
              >
                Salvar Modelo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO: CRIAR NOVO FORMULÁRIO */}
      {isCreateFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📝</span>
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-900">
                  Criar Novo Formulário
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 font-bold text-sm px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div>
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-800 mb-1">
                  Título do Formulário:
                </label>
                <input
                  type="text"
                  placeholder="Ex: FORMULÁRIO DE CADASTRO DE BANCA AVALIADORA"
                  value={newFormTitle}
                  onChange={(e) => setNewFormTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 p-2.5 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 uppercase"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-extrabold uppercase text-slate-800 mb-1">
                    Quem Preenche? (Papel Alvo):
                  </label>
                  <select
                    value={newFormTargetRole}
                    onChange={(e) => setNewFormTargetRole(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 p-2 rounded-lg text-xs font-bold text-slate-900"
                  >
                    <option value="Aluno">Discente (Aluno)</option>
                    <option value="Orientador">Docente Orientador</option>
                    <option value="Banca">Membro Avaliador da Banca</option>
                    <option value="Presidente da Comissão">Presidente da Comissão</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-extrabold uppercase text-slate-800 mb-1">
                    Descrição do Formulário:
                  </label>
                  <input
                    type="text"
                    value={newFormDescription}
                    onChange={(e) => setNewFormDescription(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 p-2 rounded-lg text-xs font-semibold text-slate-900"
                  />
                </div>
              </div>

              {/* Adicionar Perguntas ao Novo Formulário */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-900">
                    Campos de Coleta ({newFormQuestions.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const newQ: FormQuestionItem = {
                        id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                        label: `Campo #${newFormQuestions.length + 1}`,
                        fieldType: 'text',
                        expectedAnswer: '',
                        required: true,
                        fieldKey: `CAMPO_${newFormQuestions.length + 1}`
                      };
                      setNewFormQuestions(prev => [...prev, newQ]);
                    }}
                    className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-[11px] uppercase px-2.5 py-1 rounded-lg cursor-pointer"
                  >
                    + Adicionar Campo
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {newFormQuestions.map((q, idx) => (
                    <div key={q.id} className="bg-slate-50 p-2.5 border border-slate-300 rounded-lg space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[10px] uppercase text-slate-800 bg-slate-200 px-1.5 py-0.5 rounded">
                          Campo #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setNewFormQuestions(prev => prev.filter(item => item.id !== q.id))}
                          className="text-rose-600 hover:text-rose-800 text-xs font-bold cursor-pointer"
                        >
                          ✕ Excluir
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[9.5px] font-bold text-slate-600 uppercase">Rótulo:</label>
                          <input
                            type="text"
                            value={q.label}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewFormQuestions(prev => prev.map(item => item.id === q.id ? { ...item, label: val } : item));
                            }}
                            className="w-full bg-white border border-slate-300 p-1 rounded text-xs font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[9.5px] font-bold text-slate-600 uppercase">Tag Matriz:</label>
                          <input
                            type="text"
                            value={q.fieldKey}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewFormQuestions(prev => prev.map(item => item.id === q.id ? { ...item, fieldKey: val } : item));
                            }}
                            className="w-full bg-white border border-slate-300 p-1 rounded text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[9.5px] font-bold text-slate-600 uppercase">Tipo:</label>
                          <select
                            value={q.fieldType}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              setNewFormQuestions(prev => prev.map(item => item.id === q.id ? { ...item, fieldType: val } : item));
                            }}
                            className="w-full bg-white border border-slate-300 p-1 rounded text-xs font-bold"
                          >
                            <option value="text">Texto Curto</option>
                            <option value="textarea">Texto Longo</option>
                            <option value="date">Data</option>
                            <option value="file">Anexo de Arquivo</option>
                            <option value="select">Dropdown</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsCreateFormModalOpen(false)}
                className="px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-bold uppercase text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveNewFormModal}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 rounded-lg text-xs font-black uppercase tracking-wide cursor-pointer shadow-2xs transition-colors"
              >
                Salvar Formulário
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. CONSTRUTOR DE FLUXO DO PROCESSO (PIPELINE DE ETAPAS) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 shadow-sm space-y-4">
        <div className="border-b border-slate-200 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 flex items-center gap-2">
              <span>CONSTRUTOR E PIPELINE DO FLUXO DO PROCESSO DE TCC</span>
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddStage}
              className="bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer border border-slate-300 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-slate-700" />
              <span>Criar Nova Etapa</span>
            </button>
          </div>
        </div>

        {/* Pipeline Grid de Etapas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 pt-1">
          {workflowStages.map((stage, stgIdx) => (
            <div key={stage.id} className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 space-y-2 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-[10px] font-black text-slate-900 bg-slate-200 border border-slate-300 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    Etapa {stage.stageNumber}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={stgIdx === 0}
                      onClick={() => handleMoveStage(stgIdx, 'left')}
                      className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-20 hover:bg-slate-200 rounded-md cursor-pointer"
                      title="Mover para esquerda"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={stgIdx === workflowStages.length - 1}
                      onClick={() => handleMoveStage(stgIdx, 'right')}
                      className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-20 hover:bg-slate-200 rounded-md cursor-pointer"
                      title="Mover para direita"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteStage(stage.id)}
                      className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md cursor-pointer"
                      title="Excluir etapa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={stage.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWorkflowStages(prev => prev.map(s => s.id === stage.id ? { ...s, title: val } : s));
                  }}
                  className="w-full bg-white border border-slate-300 font-extrabold text-xs text-slate-900 p-1.5 rounded-lg focus:ring-1 focus:ring-slate-400 outline-none uppercase tracking-tight"
                />

                <div className="space-y-0.5">
                  <label className="block text-[8px] font-black text-slate-500 uppercase">⚡ Evento Gatilho:</label>
                  <input
                    type="text"
                    value={stage.triggerEvent}
                    onChange={(e) => {
                      const val = e.target.value;
                      setWorkflowStages(prev => prev.map(s => s.id === stage.id ? { ...s, triggerEvent: val } : s));
                    }}
                    className="w-full bg-slate-100 border border-slate-200 text-[10px] text-slate-700 p-1.5 rounded-lg focus:ring-1 focus:ring-slate-400 outline-none italic"
                  />
                </div>
              </div>

              {/* Lista de Ações Vinculadas à Etapa */}
              <div className="space-y-1.5 min-h-[90px] bg-white border border-dashed border-slate-300 p-2 rounded-xl flex-grow">
                <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Ações & Elementos ({stage.actions.length})</span>
                </div>

                {stage.actions.length === 0 ? (
                  <div className="text-[10px] text-slate-400 italic text-center py-4">
                    Nenhum elemento vinculado. Clique no botão abaixo para adicionar.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {stage.actions.map(act => (
                      <div key={act.id} className="p-1.5 rounded-lg border border-slate-300 bg-slate-50 text-[10px] flex items-center justify-between gap-1 shadow-2xs">
                        <div className="truncate font-bold text-slate-900 flex items-center gap-1">
                          {act.type === 'doc' && <span>📄</span>}
                          {act.type === 'email' && <span>✉️</span>}
                          {act.type === 'form' && <span>📝</span>}
                          <span className="truncate">{act.title}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveActionFromStage(stage.id, act.id)}
                          className="text-rose-500 hover:text-rose-800 text-[10px] font-bold px-0.5 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botão de Inserção de Elemento na Etapa */}
              <div>
                {addingToStageId === stage.id ? (
                  <div className="bg-white border border-slate-300 p-2 rounded-xl space-y-1.5 text-xs shadow-xs">
                    <div className="text-[9px] font-bold uppercase text-slate-700">Selecione para vincular:</div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      <div className="text-[8px] font-black uppercase text-amber-800 pt-0.5">📝 Formulários:</div>
                      {formTemplates.map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleAddItemToStage(stage.id, 'form', f)}
                          className="w-full text-left text-[9.5px] p-1 bg-amber-50 hover:bg-amber-100 rounded-md text-amber-900 truncate block border border-amber-200 cursor-pointer"
                        >
                          + {f.title}
                        </button>
                      ))}

                      <div className="text-[8px] font-black uppercase text-slate-700 pt-1">📄 Modelos (.docx):</div>
                      {docTemplates.map(d => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => handleAddItemToStage(stage.id, 'doc', d)}
                          className="w-full text-left text-[9.5px] p-1 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-900 truncate block border border-slate-300 cursor-pointer"
                        >
                          + {d.label}
                        </button>
                      ))}

                      <div className="text-[8px] font-black uppercase text-sky-800 pt-1">✉️ E-mails:</div>
                      {emailTemplates.map(em => (
                        <button
                          key={em.id}
                          type="button"
                          onClick={() => handleAddItemToStage(stage.id, 'email', em)}
                          className="w-full text-left text-[9.5px] p-1 bg-sky-50 hover:bg-sky-100 rounded-md text-sky-900 truncate block border border-sky-200 cursor-pointer"
                        >
                          + {em.name}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddingToStageId(null)}
                      className="w-full text-center text-[9px] text-slate-500 font-bold pt-1 hover:underline cursor-pointer"
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
                    <span>Adicionar Elemento</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL 1: IMPORTAR MODELO (.DOCX / DRIVE / ARQUIVO) */}
      {isImportModelOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📄</span>
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                  IMPORTAR NOVO MODELO DE DOCUMENTO (.DOCX)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModelOpen(false)}
                className="text-slate-400 hover:text-slate-800 font-bold text-sm px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Alternar modo de Importação: Link do Google Drive ou Anexo de Arquivo */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setImportModelMode('drive')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  importModelMode === 'drive'
                    ? 'bg-white text-slate-900 border border-slate-300 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Link do Google Drive</span>
              </button>
              <button
                type="button"
                onClick={() => setImportModelMode('file')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  importModelMode === 'file'
                    ? 'bg-white text-slate-900 border border-slate-300 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Anexar Arquivo Local</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-800 mb-1">
                  Nome do Modelo / Documento:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Ata de Defesa de Mestrado, Certificado de Conclusão..."
                  value={importModelName}
                  onChange={(e) => setImportModelName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 p-2.5 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              {importModelMode === 'drive' ? (
                <div>
                  <label className="block text-[10.5px] font-extrabold uppercase text-slate-800 mb-1">
                    URL / Link Compartilhável do Google Drive / Docs:
                  </label>
                  <input
                    type="url"
                    placeholder="https://docs.google.com/document/d/... ou https://drive.google.com/file/d/..."
                    value={importModelUrl}
                    onChange={(e) => setImportModelUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 p-2.5 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    💡 O sistema varrerá o documento do Google Drive e extrairá automaticamente todos os marcadores (<code className="font-mono bg-slate-100 px-1 py-0.5 border rounded">&lt;&lt;variavel&gt;&gt;</code>) para a planilha.
                  </p>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 bg-slate-50 p-6 rounded-2xl text-center space-y-2">
                  <Upload className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-800">
                    Arraste o arquivo .docx aqui ou clique para selecionar
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Suporta arquivos do Microsoft Word (.docx, .doc, .rtf)
                  </p>
                  <input
                    type="file"
                    accept=".docx,.doc,.rtf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && !importModelName) {
                        setImportModelName(file.name.replace(/\.[^/.]+$/, ''));
                      }
                    }}
                    className="hidden"
                    id="docx-file-input"
                  />
                  <label
                    htmlFor="docx-file-input"
                    className="inline-block bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs uppercase px-3.5 py-1.5 rounded-xl cursor-pointer transition-all border border-slate-300 active:scale-95 shadow-2xs"
                  >
                    Selecionar Arquivo
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsImportModelOpen(false)}
                className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-bold uppercase text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleProcessImportModel}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold uppercase tracking-wide cursor-pointer shadow-2xs transition-all border border-slate-300 active:scale-95"
              >
                Importar e Mapear Marcadores
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: AI CONSOLIDAÇÃO / MESCLAGEM DE VARIÁVEIS SEMELHANTES (ESTILO CONTATOS DO GOOGLE) */}
      {isConsolidateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-2xl w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600 animate-pulse" />
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                  CONSOLIDAÇÃO DE VARIÁVEIS SEMELHANTES (IA)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConsolidateModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 font-bold text-sm px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              O sistema de IA analisou todos os modelos, e-mails e formulários e identificou potenciais <strong>duplicidades e variáveis semelhantes</strong> (estilo mesclagem do Google Contacts). Deseja unificá-las em um único campo padrão?
            </p>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {suggestedMerges.length === 0 ? (
                <div className="p-8 text-center bg-slate-100 border border-slate-300 rounded-md space-y-2">
                  <Check className="w-8 h-8 text-slate-700 mx-auto" />
                  <p className="text-xs font-black text-slate-900 uppercase">
                    Todas as variáveis estão perfeitamente unificadas!
                  </p>
                  <p className="text-[11px] text-slate-700">
                    Nenhuma duplicidade detectada na planilha.
                  </p>
                </div>
              ) : (
                suggestedMerges.map(item => (
                  <div key={item.id} className="bg-slate-50 border border-amber-300 rounded-md p-3.5 space-y-3 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <span className="text-[9.5px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded">
                          {item.reason}
                        </span>
                        <div className="text-xs text-slate-800 font-bold pt-1">
                          Consolidar a variável <code className="bg-rose-100 text-rose-900 font-mono px-1 py-0.5 rounded border border-rose-200">{item.colB.name}</code> dentro da variável oficial <code className="bg-slate-200 text-slate-900 font-mono px-1 py-0.5 rounded border border-slate-300">{item.colA.name}</code>?
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 shrink-0">
                        {Math.round(item.similarityScore * 100)}% similar
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleApplyMerge(item.colA, item.colB)}
                        className="bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs px-3 py-1.5 rounded border border-slate-300 inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                        <span>Mesclar Variáveis</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSuggestedMerges(prev => prev.filter(m => m.id !== item.id))}
                        className="bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs px-3 py-1.5 rounded border border-slate-300 cursor-pointer transition-colors"
                      >
                        Manter Separadas
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const newName = (await portalPrompt(`Qual o nome desejado para a variável "${item.colA.name}"?`, item.colA.name));
                          if (newName && newName.trim()) {
                            setMatrixColumns(prev => prev.map(c => c.id === item.colA.id ? { ...c, name: newName.trim() } : c));
                            handleApplyMerge({ ...item.colA, name: newName.trim() }, item.colB);
                          }
                        }}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs px-3 py-1.5 rounded cursor-pointer transition-colors"
                      >
                        Alterar Nome e Mesclar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              {suggestedMerges.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    suggestedMerges.forEach(item => handleApplyMerge(item.colA, item.colB));
                    setIsConsolidateModalOpen(false);
                  }}
                  className="bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 font-black text-xs uppercase px-4 py-2 rounded shadow-2xs cursor-pointer"
                >
                  Mesclar Todas Automaticamente
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsConsolidateModalOpen(false)}
                className="ml-auto px-4 py-2 border border-slate-300 rounded text-xs font-bold uppercase text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIGURAÇÃO FUNCIONAL DA VARIÁVEL NO SISTEMA */}
      {editingVariable && (
        <VariableConfigModalContent
          initialVariable={editingVariable}
          matrixRows={matrixRows}
          formTemplates={formTemplates}
          emailTemplates={emailTemplates}
          onClose={() => setEditingVariable(null)}
          onSave={(updatedVar, updatedModelIds) => {
            // Atualiza colunas em tempo real
            setMatrixColumns((prev) =>
              prev.map((col) => (col.id === updatedVar.id ? updatedVar : col))
            );
            // Atualiza os modelos (.docx) onde a variável está ativa em tempo real
            setMatrixRows((prev) =>
              prev.map((row) => ({
                ...row,
                fields: {
                  ...row.fields,
                  [updatedVar.id]: updatedModelIds.includes(row.id),
                },
              }))
            );
          }}
        />
      )}

      {/* MODAL: CENTRAL DE MESCLAGENS DE VARIÁVEIS */}
      {isMergeHistoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-3.5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-700">
                  <GitMerge className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-wide text-slate-900">
                    CENTRAL DE MESCLAGENS DE VARIÁVEIS
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Procure novas mesclas nos modelos, faça unificação manual ou gerencie o histórico.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMergeHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 font-bold text-base px-2 py-1 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setMergeModalTab('scan')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide cursor-pointer transition-all flex items-center gap-1.5 border ${
                  mergeModalTab === 'scan'
                    ? 'bg-white text-slate-900 border-slate-400 font-black shadow-2xs'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <YinYangIcon className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                <span>1. Procurar Novas Mesclas</span>
                {suggestedMerges.length > 0 && (
                  <span className="bg-slate-200 text-slate-900 font-extrabold text-[10px] px-1.5 py-0.2 rounded-full border border-slate-300">
                    {suggestedMerges.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMergeModalTab('manual')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide cursor-pointer transition-all flex items-center gap-1.5 border ${
                  mergeModalTab === 'manual'
                    ? 'bg-white text-slate-900 border-slate-400 font-black shadow-2xs'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>2. Mescla Manual</span>
              </button>

              <button
                type="button"
                onClick={() => setMergeModalTab('history')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide cursor-pointer transition-all flex items-center gap-1.5 border ${
                  mergeModalTab === 'history'
                    ? 'bg-white text-slate-900 border-slate-400 font-black shadow-2xs'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>3. Histórico ({mergeHistory.length})</span>
              </button>
            </div>

            {/* Tab Body Content */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* TAB 1: PROCURAR NOVAS MESCLAS & VARRER DRIVE */}
              {mergeModalTab === 'scan' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-extrabold uppercase text-slate-900">
                          Varredura e Análise do Google Drive
                        </h4>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Verifica modelos (.docx), formulários e e-mails do sistema em busca de variáveis semelhantes ou duplicadas para mesclar.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleScanAndUpdateVariables}
                        disabled={isScanning}
                        className="bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 font-black text-xs uppercase px-4 py-2.5 rounded-xl shadow-2xs transition-all cursor-pointer inline-flex items-center gap-2 shrink-0 disabled:opacity-50 active:scale-95"
                      >
                        <YinYangIcon className={`w-4 h-4 text-slate-700 ${isScanning ? 'animate-spin' : ''}`} />
                        <span>{isScanning ? 'Analisando...' : 'Procurar Novas Mesclas'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Sugestões encontradas */}
                  <div className="space-y-2">
                    <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                      Mesclas Sugeridas pela IA ({suggestedMerges.length})
                    </h5>

                    {suggestedMerges.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-1">
                        <Check className="w-7 h-7 text-slate-600 mx-auto" />
                        <p className="text-xs font-black text-slate-800 uppercase">
                          Nenhuma nova mescla pendente
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Todas as variáveis da planilha estão unificadas e organizadas.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {suggestedMerges.map(item => (
                          <div key={item.id} className="bg-slate-50 border border-amber-300 rounded-xl p-3.5 space-y-3 shadow-2xs">
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <span className="text-[9.5px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded">
                                  {item.reason}
                                </span>
                                <div className="text-xs text-slate-800 font-bold pt-1">
                                  Consolidar a variável <code className="bg-rose-100 text-rose-900 font-mono px-1 py-0.5 rounded border border-rose-200">{item.colB.name}</code> dentro da variável oficial <code className="bg-slate-200 text-slate-900 font-mono px-1 py-0.5 rounded border border-slate-300">{item.colA.name}</code>?
                                </div>
                              </div>
                              <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 shrink-0">
                                {Math.round(item.similarityScore * 100)}% similar
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                              <button
                                type="button"
                                onClick={() => handleApplyMerge(item.colA, item.colB)}
                                className="bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 font-extrabold text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              >
                                <GitMerge className="w-3.5 h-3.5" />
                                <span>Mesclar Variáveis</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setSuggestedMerges(prev => prev.filter(m => m.id !== item.id))}
                                className="bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-lg border border-slate-300 cursor-pointer transition-colors"
                              >
                                Manter Separadas
                              </button>
                            </div>
                          </div>
                        ))}

                        {suggestedMerges.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              suggestedMerges.forEach(item => handleApplyMerge(item.colA, item.colB));
                            }}
                            className="w-full bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 font-black text-xs uppercase py-2.5 rounded-xl shadow-2xs cursor-pointer"
                          >
                            Mesclar Todas as Sugestões Automaticamente
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: MESCLA MANUAL */}
              {mergeModalTab === 'manual' && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-4">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase text-slate-900">
                      Unificar Duas Variáveis Manualmente
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Escolha uma variável secundária para ser fundida/absorvida dentro da variável principal escolhida.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-700 block">
                        1. Variável a ser absorvida (Secundária):
                      </label>
                      <select
                        value={manualMergeSourceId}
                        onChange={(e) => setManualMergeSourceId(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-slate-400"
                      >
                        <option value="">-- Selecione a Variável Secundária --</option>
                        {matrixColumns.map(col => (
                          <option key={col.id} value={col.id}>
                            {col.name} ({col.label || col.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-700 block">
                        2. Variável Oficial que permanecerá (Principal):
                      </label>
                      <select
                        value={manualMergeTargetId}
                        onChange={(e) => setManualMergeTargetId(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-slate-400"
                      >
                        <option value="">-- Selecione a Variável Principal --</option>
                        {matrixColumns.map(col => (
                          <option key={col.id} value={col.id} disabled={col.id === manualMergeSourceId}>
                            {col.name} ({col.label || col.id})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      disabled={!manualMergeSourceId || !manualMergeTargetId || manualMergeSourceId === manualMergeTargetId}
                      onClick={() => {
                        const sourceCol = matrixColumns.find(c => c.id === manualMergeSourceId);
                        const targetCol = matrixColumns.find(c => c.id === manualMergeTargetId);
                        if (sourceCol && targetCol) {
                          handleApplyMerge(targetCol, sourceCol);
                          setManualMergeSourceId('');
                          setManualMergeTargetId('');
                          showNotification(`Variável "${sourceCol.name}" foi mesclada em "${targetCol.name}".`);
                        }
                      }}
                      className="bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 disabled:opacity-40 font-black text-xs uppercase px-4 py-2.5 rounded-xl shadow-2xs transition-all cursor-pointer inline-flex items-center gap-2 active:scale-95"
                    >
                      <GitMerge className="w-4 h-4 text-slate-700" />
                      <span>Confirmar e Mesclar Variáveis</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: HISTÓRICO & DESFAZER */}
              {mergeModalTab === 'history' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Histórico completo das mesclagens e unificações realizadas nesta sessão ou anteriormente:
                  </p>

                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {mergeHistory.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                        Nenhuma mesclagem realizada até o momento.
                      </div>
                    ) : (
                      mergeHistory.map(item => (
                        <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="font-bold text-slate-900">
                              Variável <code className="bg-slate-200 px-1.5 py-0.5 rounded text-rose-800 font-mono">{item.secondaryColName}</code> mesclada em <code className="bg-slate-200 text-slate-900 px-1.5 py-0.5 rounded font-mono">{item.primaryColName}</code>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block pt-0.5">
                              Horário: {item.date}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUndoMerge(item)}
                            className="bg-white hover:bg-rose-50 text-rose-700 font-bold text-xs px-3 py-1.5 rounded-lg border border-rose-200 inline-flex items-center gap-1 cursor-pointer transition-colors shrink-0 shadow-2xs"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            <span>Desfazer</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {mergeHistory.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 flex justify-start">
                      <button
                        type="button"
                        onClick={handleResetAllMerges}
                        className="text-rose-700 hover:text-rose-900 font-extrabold text-xs uppercase underline cursor-pointer"
                      >
                        Resetar Todas as Consolidações
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setIsMergeHistoryModalOpen(false)}
                className="px-5 py-2 bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 rounded-xl text-xs font-black uppercase cursor-pointer shadow-2xs transition-all active:scale-95"
              >
                Concluir e Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

/* =========================================================================
   COMPONENTE: CONFIGURAÇÃO FUNCIONAL DA VARIÁVEL NO SISTEMA
   Permite definir:
   - Em quais Modelos (.docx) ela está ativa (com checkboxes e selecionar todos)
   - Em quais Formulários e E-mails ela atua
   - Código exato / marcador especial no modelo (<<VAR>>, {{VAR}}, [VAR])
   - Formatação visual (negrito, itálico, maiúsculas, prefixo)
   ========================================================================= */
interface VariableConfigModalContentProps {
  initialVariable: MatrixColumn;
  matrixRows: MatrixRow[];
  formTemplates: FormTemplateItem[];
  emailTemplates: EmailTemplateItem[];
  onClose: () => void;
  onSave: (updatedVar: MatrixColumn, updatedModelIds: string[]) => void;
}

const VariableConfigModalContent: React.FC<VariableConfigModalContentProps> = ({
  initialVariable,
  matrixRows,
  formTemplates,
  emailTemplates,
  onClose,
  onSave,
}) => {
  const [variable, setVariable] = useState<MatrixColumn>(() => ({
    ...initialVariable,
    aliases: [...(initialVariable.aliases || [])],
    format: {
      bold: false,
      italic: false,
      color: '#0f172a',
      ...(initialVariable.format || {}),
    },
  }));

  const [delimiter, setDelimiter] = useState<'<<>>' | '{{}}' | '[]' | '<>'>('<<>>');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(() =>
    matrixRows.filter((r) => !!r.fields[initialVariable.id]).map((r) => r.id)
  );
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>(() =>
    formTemplates.filter((f) => isTagUsedByForm(f, initialVariable)).map((f) => f.id)
  );
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>(() =>
    emailTemplates
      .filter(
        (e) =>
          isTagUsedByEmail(e, initialVariable) ||
          (e.subject + e.body).toUpperCase().includes(initialVariable.name.toUpperCase())
      )
      .map((e) => e.id)
  );
  const [prefix, setPrefix] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Calcula o código do marcador com os delimitadores especiais
  const markerCode = useMemo(() => {
    const raw = variable.name.trim().toUpperCase();
    if (delimiter === '<<>>') return `<<${raw}>>`;
    if (delimiter === '{{}}') return `{{${raw}}}`;
    if (delimiter === '[]') return `[${raw}]`;
    if (delimiter === '<>') return `<${raw}>`;
    return `<<${raw}>>`;
  }, [variable.name, delimiter]);

  const handleCopyMarker = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(markerCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleToggleModel = (modelId: string) => {
    setSelectedModelIds((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  };

  const handleToggleAllModels = () => {
    if (selectedModelIds.length === matrixRows.length) {
      setSelectedModelIds([]);
    } else {
      setSelectedModelIds(matrixRows.map((r) => r.id));
    }
  };

  const handleToggleForm = (formId: string) => {
    setSelectedFormIds((prev) =>
      prev.includes(formId) ? prev.filter((id) => id !== formId) : [...prev, formId]
    );
  };

  const handleToggleAllForms = () => {
    if (selectedFormIds.length === formTemplates.length) {
      setSelectedFormIds([]);
    } else {
      setSelectedFormIds(formTemplates.map((f) => f.id));
    }
  };

  const handleToggleEmail = (emailId: string) => {
    setSelectedEmailIds((prev) =>
      prev.includes(emailId) ? prev.filter((id) => id !== emailId) : [...prev, emailId]
    );
  };

  const handleToggleAllEmails = () => {
    if (selectedEmailIds.length === emailTemplates.length) {
      setSelectedEmailIds([]);
    } else {
      setSelectedEmailIds(emailTemplates.map((e) => e.id));
    }
  };

  // Salva automaticamente qualquer alteração em tempo real sem necessidade de confirmação
  useEffect(() => {
    onSave(variable, selectedModelIds);
  }, [variable, selectedModelIds, onSave]);

  return (
    <ModalPortal onClose={onClose} labelledBy="variable-config-title">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-300 bg-white p-5 sm:p-6 shadow-2xl space-y-5">
        
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-slate-100 text-slate-800 rounded-xl border border-slate-300">
              <Pencil className="w-5 h-5 text-slate-700" />
            </span>
            <div>
              <h3 id="variable-config-title" className="text-sm sm:text-base font-black uppercase tracking-wide text-slate-900">
                CONFIGURAÇÕES DA VARIÁVEL NO SISTEMA
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Defina em quais modelos, formulários e e-mails esta variável atua, seu código e regras de formatação.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configuração da variável"
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* BLOCO 1: CÓDIGO DO MARCADOR NO MODELO (.DOCX / EMAIL) E IDENTIFICAÇÃO */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <span>🏷️</span> Identificação & Código de Invocação no Modelo
            </h4>
            <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-200 px-2 py-0.5 rounded">
              ID: {variable.id}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {/* Nome Técnico */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-700 block">
                Nome da Variável (Chave Técnica)
              </label>
              <input
                value={variable.name}
                onChange={(e) =>
                  setVariable({
                    ...variable,
                    name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
                  })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>

            {/* Nome Legível */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-700 block">
                Rótulo Amigável de Exibição
              </label>
              <input
                value={variable.label || ''}
                onChange={(e) => setVariable({ ...variable, label: e.target.value })}
                placeholder="Ex: Nome do Orientador(a)"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>

            {/* Delimitador Especial */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-700 block">
                Caractere Delimitador Especial
              </label>
              <select
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 bg-white"
              >
                <option value="<<>>">&lt;&lt; TAG &gt;&gt; (Sinal de Menor e Maior)</option>
                <option value="{{}}">{"{{ TAG }} (Chaves Duplas)"}</option>
                <option value="[]">[ TAG ] (Colchetes)</option>
                <option value="<>">&lt; TAG &gt; (Menor/Maior Simples)</option>
              </select>
            </div>
          </div>

          {/* CÓDIGO OFICIAL PRONTO PARA O WORD / MODELO */}
          <div className="bg-white border-2 border-slate-300 rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider block">
                📌 Código exato para usar nos modelos (.docx) e e-mails:
              </span>
              <div className="font-mono text-sm sm:text-base font-extrabold text-slate-900 tracking-wide">
                {markerCode}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyMarker}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 rounded-xl text-xs font-black uppercase transition-all cursor-pointer shrink-0 active:scale-95"
            >
              {copiedCode ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-700" />
                  <span>Copiar Marcador</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* BLOCO 2: ONDE ESTA VARIÁVEL OPERA NO SISTEMA (MODELOS .DOCX, FORMULÁRIOS E E-MAILS) */}
        <div className="space-y-4">
          
          {/* SEÇÃO 2.1: MODELOS DE DOCUMENTOS (.DOCX) COM CHECKBOXES */}
          <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-300 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-900">
                  📄 1. Modelos de Documentos (.docx)
                </span>
                <span className="text-[10.5px] font-bold bg-white text-slate-800 border border-slate-300 px-2 py-0.5 rounded-full">
                  {selectedModelIds.length} de {matrixRows.length} ativos
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleAllModels}
                  className="text-[10px] font-black uppercase text-slate-700 hover:text-slate-900 hover:bg-slate-200 px-2 py-1 rounded border border-slate-300 cursor-pointer transition-colors"
                >
                  {selectedModelIds.length === matrixRows.length ? 'Desmarcar Todos' : 'Marcar em Todos os Modelos'}
                </button>
              </div>
            </div>

            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {matrixRows.map((row) => {
                const isSelected = selectedModelIds.includes(row.id);
                return (
                  <label
                    key={row.id}
                    onClick={() => handleToggleModel(row.id)}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-slate-50 border-slate-400 font-bold text-slate-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded border-slate-300 text-slate-800 focus:ring-slate-400 w-4 h-4 cursor-pointer pointer-events-none"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="truncate block font-bold text-slate-900" title={row.name}>
                        {row.name}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* SEÇÃO 2.2: FORMULÁRIOS DINÂMICOS */}
          <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-300 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-900">
                  📋 2. Formulários Dinâmicos de Coleta
                </span>
                <span className="text-[10.5px] font-bold bg-white text-slate-800 border border-slate-300 px-2 py-0.5 rounded-full">
                  {selectedFormIds.length} vinculados
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleAllForms}
                  className="text-[10px] font-black uppercase text-slate-700 hover:text-slate-900 hover:bg-slate-200 px-2 py-1 rounded border border-slate-300 cursor-pointer transition-colors"
                >
                  {selectedFormIds.length === formTemplates.length ? 'Desmarcar Todos' : 'Marcar em Todos'}
                </button>
              </div>
            </div>

            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {formTemplates.map((form) => {
                const isSelected = selectedFormIds.includes(form.id);
                return (
                  <label
                    key={form.id}
                    onClick={() => handleToggleForm(form.id)}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-slate-50 border-slate-400 font-bold text-slate-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded border-slate-300 text-slate-800 focus:ring-slate-400 w-4 h-4 cursor-pointer pointer-events-none"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="truncate block font-bold text-slate-900" title={form.title}>
                        {form.title}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Papel: {form.targetRole}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* SEÇÃO 2.3: DISPAROS DE E-MAILS AUTOMÁTICOS */}
          <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-300 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-900">
                  ✉️ 3. E-mails Automáticos do Fluxo
                </span>
                <span className="text-[10.5px] font-bold bg-white text-slate-800 border border-slate-300 px-2 py-0.5 rounded-full">
                  {selectedEmailIds.length} vinculados
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleAllEmails}
                  className="text-[10px] font-black uppercase text-slate-700 hover:text-slate-900 hover:bg-slate-200 px-2 py-1 rounded border border-slate-300 cursor-pointer transition-colors"
                >
                  {selectedEmailIds.length === emailTemplates.length ? 'Desmarcar Todos' : 'Marcar em Todos'}
                </button>
              </div>
            </div>

            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {emailTemplates.map((email) => {
                const isSelected = selectedEmailIds.includes(email.id);
                return (
                  <label
                    key={email.id}
                    onClick={() => handleToggleEmail(email.id)}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-slate-50 border-slate-400 font-bold text-slate-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded border-slate-300 text-slate-800 focus:ring-slate-400 w-4 h-4 cursor-pointer pointer-events-none"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="truncate block font-bold text-slate-900" title={email.name}>
                        {email.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Gatilho: {email.triggerStage}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* BLOCO 3: FORMATAÇÃO DE SAÍDA NO DOCUMENTO (NEGRITO, ITÁLICO, TIPO, PREFIXO) */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-2">
            <span>✍️</span> Regras de Formatação no Documento Gerado
          </h4>

          <div className="grid gap-3 sm:grid-cols-3">
            {/* Tipo de Dado */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-700 block">
                Tipo de Dado
              </label>
              <select
                value={variable.dataType || 'text'}
                onChange={(e) =>
                  setVariable({ ...variable, dataType: e.target.value as MatrixColumn['dataType'] })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 bg-white"
              >
                <option value="text">Texto Simples</option>
                <option value="date">Data (DD/MM/AAAA)</option>
                <option value="email">E-mail</option>
                <option value="number">Número</option>
                <option value="url">Link / URL</option>
              </select>
            </div>

            {/* Prefixo opcional */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-700 block">
                Prefixo Opcional (Ex: Prof(a). Dr(a).)
              </label>
              <input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="Ex: Prof(a). Dr(a). "
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>

            {/* Cor de Destaque */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-700 block">
                Cor de Destaque
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={variable.format?.color || '#0f172a'}
                  onChange={(e) =>
                    setVariable({
                      ...variable,
                      format: { ...variable.format, color: e.target.value },
                    })
                  }
                  className="h-9 w-12 rounded-lg border border-slate-300 p-0.5 cursor-pointer bg-white"
                />
                <span className="font-mono text-xs font-semibold text-slate-700">
                  {variable.format?.color || '#0f172a'}
                </span>
              </div>
            </div>
          </div>

          {/* BOTÕES DE FORMATAÇÃO TIPOGRÁFICA */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] font-black uppercase text-slate-700 mr-2">Estilo do Texto:</span>
            <button
              type="button"
              onClick={() =>
                setVariable({
                  ...variable,
                  format: { ...variable.format, bold: !variable.format?.bold },
                })
              }
              className={`rounded-xl border px-4 py-2 text-xs font-black transition-all cursor-pointer ${
                variable.format?.bold
                  ? 'bg-slate-100 text-slate-900 border-slate-400 font-extrabold shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              Negrito (B)
            </button>

            <button
              type="button"
              onClick={() =>
                setVariable({
                  ...variable,
                  format: { ...variable.format, italic: !variable.format?.italic },
                })
              }
              className={`rounded-xl border px-4 py-2 text-xs font-black italic transition-all cursor-pointer ${
                variable.format?.italic
                  ? 'bg-slate-100 text-slate-900 border-slate-400 font-extrabold shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              Itálico (I)
            </button>
          </div>
        </div>

        {/* RODAPÉ DO MODAL COM SALVAMENTO EM TEMPO REAL */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/90 text-xs font-bold">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Alterações salvas automaticamente em tempo real</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 text-xs font-bold uppercase shadow-2xs cursor-pointer transition-all active:scale-95"
          >
            Concluir
          </button>
        </div>

      </div>
    </ModalPortal>
  );
};
