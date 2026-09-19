import React, { useState, useEffect, useRef } from 'react';
import { ProcessData, ProcessRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { 
  formatDatePt, 
  formatDateNumeric, 
  formatTimeExtenso, 
  cleanPersonName, 
  formatProfessorName, 
  formatTccTitle, 
  formatStudentsString, 
  normalizeEmail
} from '../utils/formatters';
import { TableScrollWrapper } from '../components/TableScrollWrapper';
import { StudentNames } from '../components/StudentNames';
import { ColorfulHeaderIcon } from '../components/ColorfulHeaderIcon';
import { loadTableConfig, ColumnDef } from '../components/TableColumnSelectorPanel';
import { HeaderSettingsPopover } from '../components/HeaderSettingsPopover';
import { SearchPopover } from '../components/SearchPopover';
import { YinYangIcon } from '../components/YinYangIcon';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { 
  TableTextFormat, 
  DEFAULT_TABLE_TEXT_FORMAT, 
  GLOBAL_TABLE_EVENT, 
  loadGlobalTableConfig,
  getTableStyles, 
  getActionPillStyles,
  getFilterChipProps,
  formatColumnLabel, 
  formatCellText, 
  getColWidthClass,
  getEditableTableText,
  getColumnWeightClass
  ,inheritsGlobalTableAppearance
} from '../utils/tableFormatters';
import { TABLE_LAYOUTS_EVENT } from '../utils/portalAppearanceLinks';
import {
  Search,
  PlusCircle,
  Eye,
  Calendar,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  List,
  FileSpreadsheet,
  GraduationCap,
  RotateCcw
} from 'lucide-react';
import { resolveInstallationProfile } from '../utils/installationProfile';

interface MeusProcessosPageProps {
  onSelectProcess: (processId: string) => void;
  onNavigateToWizard: () => void;
}

const ALL_MEUS_PROCESSOS_COLUMNS: ColumnDef[] = [
  { key: 'protocolo', label: 'Nº Processo', isFixed: true },
  { key: 'defesaDataHora', label: 'Data e Horário' },
  { key: 'progresso', label: 'Etapa' },
  { key: 'titulo', label: 'Título do Trabalho' },
  { key: 'aluno1', label: 'Aluno 1' },
  { key: 'aluno2', label: 'Aluno 2' },
  { key: 'orientador', label: 'Orientador(a)' },
  { key: 'membro1', label: '1º Membro' },
  { key: 'membro2', label: '2º Membro' },
  { key: 'coorientador', label: 'Coorientador(a)' },
  { key: 'resumo', label: 'Resumo do TCC' },
  { key: 'palavrasChave', label: 'Palavras-Chave' },
  { key: 'defesaLocal', label: 'Local' }
];

const DEFAULT_MEUS_PROCESSOS_ORDER = ALL_MEUS_PROCESSOS_COLUMNS.map((c) => c.key);
const DEFAULT_MEUS_PROCESSOS_VISIBLE: Record<string, boolean> = {
  protocolo: true,
  defesaDataHora: true,
  progresso: true,
  titulo: true,
  aluno1: true,
  aluno2: true,
  orientador: true,
  membro1: true,
  membro2: true,
  coorientador: true,
  resumo: true,
  palavrasChave: true,
  defesaLocal: true
};

export type ProcessRoleCategory = 'ALUNO' | 'BANCA' | 'AVALIADOR' | 'VISUALIZADOR';

export const getRoleCategoryForProcess = (roles: ProcessRole[]): ProcessRoleCategory => {
  if (roles.includes('STUDENT')) return 'ALUNO';
  if (roles.includes('ADVISOR') || roles.includes('CO_ADVISOR')) return 'BANCA';
  if (roles.includes('EXAMINER')) return 'AVALIADOR';
  return 'VISUALIZADOR';
};

export const ROLE_CONFIGS: Record<ProcessRoleCategory, {
  label: string;
  badgeLabel: string;
  bgColor: string;          // Background color for the full row <tr>
  borderColor: string;      // Accent left border color
  textHex: string;          // Badge text color
  dotColor: string;         // Accent dot color for badges & pills
}> = {
  ALUNO: {
    label: 'Aluno',
    badgeLabel: 'Aluno',
    bgColor: '#FEF9C3',       // Soft Matte Yellow 100
    borderColor: '#EAB308',   // Amber / Yellow 500
    textHex: '#713F12',       // Dark Gold / Yellow 900
    dotColor: '#EAB308',       
  },
  BANCA: {
    label: 'Banca',
    badgeLabel: 'Banca (Orientador / Coorientador)',
    bgColor: '#FFEDD5',       // Soft Matte Orange 100
    borderColor: '#F97316',   // Orange 500
    textHex: '#7C2D12',       // Dark Rust / Orange 900
    dotColor: '#F97316',       
  },
  AVALIADOR: {
    label: 'Avaliador',
    badgeLabel: 'Avaliador (Membro da Banca)',
    bgColor: '#E0F2FE',       // Soft Matte Sky Blue 100
    borderColor: '#0EA5E9',   // Sky Blue 500
    textHex: '#0C4A6E',       // Sky Blue 900
    dotColor: '#0EA5E9',       
  },
  VISUALIZADOR: {
    label: 'Visualizador',
    badgeLabel: 'Visualizador / Acompanhamento',
    bgColor: '#F1F5F9',       // Soft Matte Slate 100
    borderColor: '#64748B',   // Slate 500
    textHex: '#0F172A',       // Slate 900
    dotColor: '#64748B',       
  }
};

// Helper to get count of stages from master configuration
const getWorkflowStagesCount = (): number => {
  if (typeof window === 'undefined') return 5;
  try {
    const saved = localStorage.getItem('workflow_pipeline_stages');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.length;
      }
    }
  } catch (e) {
    console.error(e);
  }
  return 5;
};

// Helper to calculate progress percentage and stage label
const getProcessProgress = (proc: ProcessData) => {
  const totalStages = getWorkflowStagesCount();
  
  let stepNumber = 1;
  let percent = 20;
  let label = '';
  
  if (proc.status === 'CONCLUIDO') {
    stepNumber = totalStages;
    percent = 100;
    label = `Etapa ${stepNumber}/${totalStages}: Concluído & Ata Registrada`;
  } else if (proc.status === 'AGUARDANDO_ASSINATURA') {
    stepNumber = totalStages;
    percent = Math.round(((totalStages * 2 - 1) / (totalStages * 2)) * 100);
    label = `Etapa ${stepNumber}/${totalStages}: Aguardando Assinaturas`;
  } else if (proc.status === 'EM_AVALIACAO') {
    stepNumber = Math.max(1, totalStages - 1);
    percent = Math.round((stepNumber / totalStages) * 100);
    label = `Etapa ${stepNumber}/${totalStages}: Defesa Realizada & Em Avaliação`;
  } else if (proc.status === 'AGUARDANDO_DEFESA' || proc.etapaAtual === 'DEFESA' || proc.etapaAtual === 'AGENDAMENTO') {
    stepNumber = Math.max(1, totalStages - 2);
    percent = Math.round((stepNumber / totalStages) * 100);
    label = `Etapa ${stepNumber}/${totalStages}: Defesa Agendada`;
  } else if (proc.etapaAtual === 'CONVITE' || proc.etapaAtual === 'CADASTRO') {
    stepNumber = Math.min(2, totalStages);
    percent = Math.round((stepNumber / totalStages) * 100);
    label = `Etapa ${stepNumber}/${totalStages}: Banca Definida & Convites Enviados`;
  } else {
    stepNumber = 1;
    percent = Math.round((stepNumber / totalStages) * 100);
    label = `Etapa ${stepNumber}/${totalStages}: Inscrição Registrada`;
  }
  
  return { percent, label, color: 'bg-emerald-600' };
};

const getStepNumberLabel = (label: string): string => {
  const match = label.match(/Etapa\s+([\d.]+)\/(\d+)/i);
  if (match) {
    const current = match[1].replace('.', ',');
    return `Fase ${current}`;
  }
  return '';
};

export const MeusProcessosPage: React.FC<MeusProcessosPageProps> = ({
  onSelectProcess,
  onNavigateToWizard
}) => {
  const { userEmail, memberships, isMasterAdmin, settings } = useAuth();
  const installationProfile=resolveInstallationProfile(settings);
  const [processes, setProcesses] = useState<ProcessData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleCategories, setSelectedRoleCategories] = useState<ProcessRoleCategory[]>([
    'ALUNO',
    'BANCA',
    'AVALIADOR',
    'VISUALIZADOR'
  ]);

  // Column selection & order persistence
  const initialMeusProcessosConfig = loadTableConfig('meus_processos', DEFAULT_MEUS_PROCESSOS_ORDER, DEFAULT_MEUS_PROCESSOS_VISIBLE, 25);
  const [columnOrder, setColumnOrder] = useState<string[]>(initialMeusProcessosConfig.columnOrder);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(initialMeusProcessosConfig.visibleColumns);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>(initialMeusProcessosConfig.customLabels || {});
  const [columnWidths, setColumnWidths] = useState<Record<string, string | number>>(initialMeusProcessosConfig.columnWidths || {});
  const [recordsLimit, setRecordsLimit] = useState<number | 'all'>(initialMeusProcessosConfig.recordsLimit || 25);
  const [startDate, setStartDate] = useState(initialMeusProcessosConfig.startDate || '');
  const [endDate, setEndDate] = useState(initialMeusProcessosConfig.endDate || '');
  const [meusProcessosTextFormat, setMeusProcessosTextFormat] = useState<TableTextFormat>(() => ({
    ...loadGlobalTableConfig(),
    ...(initialMeusProcessosConfig.textFormat || {})
  }));

  useEffect(() => {
    const handler = (e: any) => {
      const newFormat = (e && e.detail) ? e.detail : loadGlobalTableConfig();
      if (inheritsGlobalTableAppearance('meus_processos')) setMeusProcessosTextFormat(prev => ({ ...prev, ...newFormat }));
    };
    if (inheritsGlobalTableAppearance('meus_processos')) setMeusProcessosTextFormat(prev => ({ ...prev, ...loadGlobalTableConfig() }));
    window.addEventListener(GLOBAL_TABLE_EVENT, handler);
    const handlePublishedLayout = () => {
      const loaded = loadTableConfig('meus_processos', DEFAULT_MEUS_PROCESSOS_ORDER, DEFAULT_MEUS_PROCESSOS_VISIBLE, 25);
      setColumnOrder(loaded.columnOrder);
      setVisibleColumns(loaded.visibleColumns);
      setCustomLabels(loaded.customLabels || {});
      setColumnWidths(loaded.columnWidths || {});
      setRecordsLimit(loaded.recordsLimit ?? 25);
      setStartDate(loaded.startDate || '');
      setEndDate(loaded.endDate || '');
      setMeusProcessosTextFormat(loaded.textFormat || loadGlobalTableConfig());
    };
    window.addEventListener(TABLE_LAYOUTS_EVENT, handlePublishedLayout);
    return () => {
      window.removeEventListener(GLOBAL_TABLE_EVENT, handler);
      window.removeEventListener(TABLE_LAYOUTS_EVENT, handlePublishedLayout);
    };
  }, []);

  const styles = getTableStyles(meusProcessosTextFormat);
  const isDarkTheme = (meusProcessosTextFormat.headerTheme || 'militar') !== 'clean' && (meusProcessosTextFormat.headerTheme || 'militar') !== 'slate' && (meusProcessosTextFormat.headerTheme || 'militar') !== 'light';

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string>('defesaDataHora');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const renderSortArrow = (column: string, isDark: boolean = isDarkTheme) => {
    const isSorted = sortColumn === column;
    if (isSorted) {
      return sortDirection === 'asc' ? (
        <ChevronUp className={`w-4 h-4 ${isDark ? 'text-white' : 'text-slate-900'} font-extrabold flex-shrink-0`} style={{ strokeWidth: 3 }} />
      ) : (
        <ChevronDown className={`w-4 h-4 ${isDark ? 'text-white' : 'text-slate-900'} font-extrabold flex-shrink-0`} style={{ strokeWidth: 3 }} />
      );
    }
    return <ArrowUpDown className={`w-3.5 h-3.5 ${isDark ? 'text-white/60 group-hover:text-white' : 'text-slate-500 group-hover:text-slate-900'} opacity-70 group-hover:opacity-100 flex-shrink-0`} />;
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadProcesses = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getProcesses();
      setProcesses(data);
    } catch (err) {
      console.error('Erro ao buscar processos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const data = await apiClient.getProcesses();
      setProcesses(data);
    } catch (err) {
      console.error('Erro ao atualizar processos:', err);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    }
  };

  useEffect(() => {
    loadProcesses();
  }, [userEmail]);

  // Determine roles of user for a given process
  const getUserRolesForProcess = (procId: string): ProcessRole[] => {
    const norm = normalizeEmail(userEmail);
    const roles: ProcessRole[] = [];

    memberships.forEach((m) => {
      if (m.processId === procId && normalizeEmail(m.email) === norm) {
        m.roles.forEach((r) => {
          if (!roles.includes(r)) roles.push(r);
        });
      }
    });

    // Fallback detection from process data itself
    const proc = processes.find((p) => p.id === procId);
    if (proc) {
      if (normalizeEmail(proc.aluno1.email) === norm || (proc.aluno2 && normalizeEmail(proc.aluno2.email) === norm)) {
        if (!roles.includes('STUDENT')) roles.push('STUDENT');
      }
      if (normalizeEmail(proc.orientador.email) === norm) {
        if (!roles.includes('ADVISOR')) roles.push('ADVISOR');
      }
      if (proc.coorientador && normalizeEmail(proc.coorientador.email) === norm) {
        if (!roles.includes('CO_ADVISOR')) roles.push('CO_ADVISOR');
      }
      if (proc.banca.some((b) => normalizeEmail(b.email) === norm)) {
        if (!roles.includes('EXAMINER')) roles.push('EXAMINER');
      }
    }

    return roles;
  };

  // Calculate process counts per role category for Legend
  const roleCounts = React.useMemo(() => {
    const counts: Record<ProcessRoleCategory, number> = {
      ALUNO: 0,
      BANCA: 0,
      AVALIADOR: 0,
      VISUALIZADOR: 0
    };
    processes.forEach((proc) => {
      const roles = getUserRolesForProcess(proc.id);
      const cat = getRoleCategoryForProcess(roles);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [processes, userEmail, memberships]);

  const canCreateStudentTcc = roleCounts.ALUNO === 0;

  // Available categories depending on user privileges (4 for Master/Presidente, 3 for standard users)
  const availableCategories: ProcessRoleCategory[] = React.useMemo(() => {
    if (isMasterAdmin || (roleCounts.VISUALIZADOR > 0)) {
      return ['ALUNO', 'BANCA', 'AVALIADOR', 'VISUALIZADOR'];
    }
    return ['ALUNO', 'BANCA', 'AVALIADOR'];
  }, [isMasterAdmin, roleCounts]);

  // Toggle role category filter in legend
  const toggleRoleCategory = (cat: ProcessRoleCategory) => {
    setSelectedRoleCategories((prev) => {
      // If all available are selected, clicking one isolates it
      const allSelected = availableCategories.every((c) => prev.includes(c));
      if (allSelected) {
        return [cat];
      }
      // If this was the only one selected, clicking it resets to all available
      if (prev.length === 1 && prev.includes(cat)) {
        return [...availableCategories];
      }
      // Toggle
      if (prev.includes(cat)) {
        const next = prev.filter((c) => c !== cat);
        return next.length > 0 ? next : [...availableCategories];
      }
      return [...prev, cat];
    });
  };

  // Contextual action button recommendation for row
  const getNextActionText = (proc: ProcessData, roles: ProcessRole[]) => {
    if (roles.includes('ADVISOR') && proc.avaliacao.status === 'PENDENTE') {
      return 'Realizar Avaliação';
    }
    if (roles.includes('STUDENT') && proc.avaliacao.status === 'PENDENTE') {
      return 'Acompanhar / Revisar';
    }
    if (isMasterAdmin && proc.etapaAtual === 'ASSINATURA') {
      return 'Assinar Documento';
    }
    return 'Visualizar Detalhes';
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filter processes by search, dropdown role, and selected role categories legend
  const getFilteredAndSortedProcesses = () => {
    let result = processes.filter((proc) => {
      const roles = getUserRolesForProcess(proc.id);
      const roleCat = getRoleCategoryForProcess(roles);

      const matchesSearch =
        proc.protocolo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        proc.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        proc.aluno1.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (proc.aluno2 && proc.aluno2.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
        proc.orientador.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (proc.acervo?.resumoSintese && proc.acervo.resumoSintese.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (proc.acervo?.palavrasChave && proc.acervo.palavrasChave.some(p => p.toLowerCase().includes(searchTerm.toLowerCase())));

      if (!matchesSearch) return false;

      const defenseDate = proc.defesa?.startAt?.slice(0, 10) || '';
      if (startDate && (!defenseDate || defenseDate < startDate)) return false;
      if (endDate && (!defenseDate || defenseDate > endDate)) return false;

      // Legend multi-select filter
      if (selectedRoleCategories.length === 0) return false;
      return selectedRoleCategories.includes(roleCat);
    });

    // Apply sorting
    result.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sortColumn === 'defesaDataHora') {
        valA = a.defesa?.startAt || '';
        valB = b.defesa?.startAt || '';
      } else if (sortColumn === 'protocolo') {
        valA = a.protocolo || '';
        valB = b.protocolo || '';
      } else if (sortColumn === 'progresso') {
        valA = getProcessProgress(a).percent;
        valB = getProcessProgress(b).percent;
      } else if (sortColumn === 'titulo') {
        valA = a.titulo || '';
        valB = b.titulo || '';
      } else if (sortColumn === 'aluno1') {
        valA = a.aluno1?.nome || '';
        valB = b.aluno1?.nome || '';
      } else if (sortColumn === 'aluno2') {
        valA = a.aluno2?.nome || '';
        valB = b.aluno2?.nome || '';
      } else if (sortColumn === 'orientador') {
        valA = a.orientador?.nome || '';
        valB = b.orientador?.nome || '';
      } else if (sortColumn === 'membro1') {
        const evA = (a.banca || []).filter(b => b.funcao !== 'ORIENTADOR')[0];
        const evB = (b.banca || []).filter(b => b.funcao !== 'ORIENTADOR')[0];
        valA = evA?.nome || '';
        valB = evB?.nome || '';
      } else if (sortColumn === 'membro2') {
        const evA = (a.banca || []).filter(b => b.funcao !== 'ORIENTADOR')[1];
        const evB = (b.banca || []).filter(b => b.funcao !== 'ORIENTADOR')[1];
        valA = evA?.nome || '';
        valB = evB?.nome || '';
      } else if (sortColumn === 'coorientador') {
        valA = a.coorientador?.nome || '';
        valB = b.coorientador?.nome || '';
      } else if (sortColumn === 'defesaLocal') {
        valA = a.defesa?.local || '';
        valB = b.defesa?.local || '';
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  };

  const allFilteredProcesses = getFilteredAndSortedProcesses();
  
  // Apply limit
  const displayedProcesses = recordsLimit === 'all' 
    ? allFilteredProcesses 
    : allFilteredProcesses.slice(0, recordsLimit);

  const handleExportExcel = (dataToExport: ProcessData[]) => {
    const activeCols = columnOrder.filter((k) => visibleColumns[k]);
    const headers = activeCols.map((k) => {
      const found = ALL_MEUS_PROCESSOS_COLUMNS.find((c) => c.key === k);
      return found ? found.label : k;
    });

    const csvContent = [
      headers.join(';'),
      ...dataToExport.map(p => {
        const progress = getProcessProgress(p);
        const evalMembers = (p.banca || []).filter(b => b.funcao !== 'ORIENTADOR');
        const ev1 = evalMembers[0];
        const ev2 = evalMembers[1];

        const row = activeCols.map((k) => {
          switch (k) {
            case 'protocolo': return `"${p.protocolo}"`;
            case 'defesaDataHora': return `"${p.defesa?.startAt ? `${formatDateNumeric(p.defesa.startAt)} ${formatTimeExtenso(p.defesa.startAt)}` : 'A definir'}"`;
            case 'progresso': return `"${getStepNumberLabel(progress.label).replace('Fase ', '')}"`;
            case 'titulo': return `"${(p.titulo || '').replace(/"/g, '""')}"`;
            case 'aluno1': return `"${cleanPersonName(p.aluno1?.nome || '').replace(/"/g, '""')}"`;
            case 'aluno2': return `"${cleanPersonName(p.aluno2?.nome || '').replace(/"/g, '""')}"`;
            case 'orientador': return `"${formatProfessorName(p.orientador?.nome || '').replace(/"/g, '""')}"`;
            case 'membro1': return `"${(ev1?.nome ? formatProfessorName(ev1.nome) : 'A definir').replace(/"/g, '""')}"`;
            case 'membro2': return `"${(ev2?.nome ? formatProfessorName(ev2.nome) : 'A definir').replace(/"/g, '""')}"`;
            case 'coorientador': return `"${(p.coorientador?.nome ? formatProfessorName(p.coorientador.nome) : 'Nenhum').replace(/"/g, '""')}"`;
            case 'resumo': return `"${(p.acervo?.resumoSintese || '').replace(/"/g, '""')}"`;
            case 'palavrasChave': return `"${(p.acervo?.palavrasChave?.join('; ') || '').replace(/"/g, '""')}"`;
            case 'defesaLocal': return `"${(p.defesa?.local || installationProfile.defaultDefenseLocation || 'Local a confirmar').replace(/"/g, '""')}"`;
            default: return '""';
          }
        });
        return row.join(';');
      })
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Meus_TCCs_${installationProfile.courseAcronym}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columnsList = [
    { key: 'protocolo', label: 'Nº Processo' },
    { key: 'defesaDataHora', label: 'Data e Horário' },
    { key: 'progresso', label: 'Progresso' },
    { key: 'titulo', label: 'Título do Trabalho' },
    { key: 'aluno1', label: 'Aluno 1' },
    { key: 'aluno2', label: 'Aluno 2' },
    { key: 'orientador', label: 'Orientador(a)' },
    { key: 'membro1', label: '1º Membro' },
    { key: 'membro2', label: '2º Membro' },
    { key: 'coorientador', label: 'Coorientador(a)' },
    { key: 'resumo', label: 'Resumo do TCC' },
    { key: 'palavrasChave', label: 'Palavras-Chave' },
    { key: 'defesaLocal', label: 'Local' }
  ];

  const cleanInst = (str?: string) => {
    if (!str) return '';
    return str.replace(/^\s*\(\s*/, '').replace(/\s*\)\s*$/, '').trim();
  };

  const activeColumns = columnOrder.filter((k) => visibleColumns[k]);

  const renderHeaderCell = (colKey: string) => {
    if (!visibleColumns[colKey]) return null;
    const colDef = ALL_MEUS_PROCESSOS_COLUMNS.find(c => c.key === colKey);
    const rawLabel = colDef?.label || colKey;
    const formattedLabel = formatColumnLabel(colKey, rawLabel, meusProcessosTextFormat, customLabels);
    const widthClass = `${getColWidthClass(colKey, columnWidths, 'min-w-[95px]')} ${getColumnWeightClass(colKey, meusProcessosTextFormat)}`;
    const isSortable = colKey !== 'resumo' && colKey !== 'palavrasChave';

    return (
      <th 
        key={colKey}
        onClick={isSortable ? () => handleSort(colKey) : undefined}
        className={`${styles.headerThClass} ${styles.cellPadClass} ${widthClass} ${styles.headerWeightClass} ${styles.headerTextColorClass} ${styles.headerFontSizeClass} ${styles.headerCasingClass} ${styles.headerBorderClass} ${styles.headerAlignClass} align-middle ${isSortable ? `cursor-pointer ${styles.headerThHoverClass}` : ''} select-none transition-colors group`}
      >
        <div className={`flex items-center justify-center gap-1 ${styles.headerWrapClass}`}>
          <span>{formattedLabel}</span>
          {isSortable && renderSortArrow(colKey, isDarkTheme)}
        </div>
      </th>
    );
  };

  const renderBodyCell = (colKey: string, proc: ProcessData) => {
    if (!visibleColumns[colKey]) return null;
    const isPast = proc.defesa?.startAt ? new Date(proc.defesa.startAt).getTime() < Date.now() : false;
    const evalMembers = (proc.banca || []).filter(b => b.funcao !== 'ORIENTADOR');
    const ev1 = evalMembers[0];
    const ev2 = evalMembers[1];
    const progress = getProcessProgress(proc);
    const roleConfig = ROLE_CONFIGS[getRoleCategoryForProcess(getUserRolesForProcess(proc.id))];
    const widthClass = `${getColWidthClass(colKey, columnWidths, 'min-w-[95px]')} ${getColumnWeightClass(colKey, meusProcessosTextFormat)}`;
    const alignClass = styles.cellAlignClass;

    switch (colKey) {
      case 'protocolo':
        return (
          <td 
            key="protocolo"
            onClick={(e) => {
              e.stopPropagation();
              onSelectProcess(proc.id);
            }}
            className={`${styles.cellPadClass} ${widthClass} ${styles.borderClass} align-middle ${alignClass} cursor-pointer ${styles.firstColCellHoverClass} group/col0 transition-colors`}
            title="Clique aqui para abrir os detalhes e documentos deste TCC"
          >
            {(() => {
              const rawStr = (proc.protocolo || proc.id || '').trim();
              const clean = rawStr.replace(/^TCC\s*[-/]?\s*/i, '').trim();
              const parts = clean.split(/[-/]/);
              let line1 = 'TCC';
              let line2 = rawStr;
              if (parts.length >= 2) {
                line1 = `TCC - ${parts[0]}`;
                line2 = parts.slice(1).join('-');
              } else if ((proc as any).anoLectivo) {
                line1 = `TCC - ${(proc as any).anoLectivo}`;
                line2 = clean;
              }
              const tagLabel = formatCellText('protocolo', line1, meusProcessosTextFormat, '📓');
              return (
                <div
                  className={styles.firstColBtnClass}
                  style={meusProcessosTextFormat.firstColHighlight === 'contextual' ? {
                    backgroundColor: roleConfig.bgColor,
                    borderColor: roleConfig.borderColor,
                    color: roleConfig.textHex,
                  } : undefined}
                >
                  <div className={styles.firstColTagClass}>
                    {tagLabel}
                  </div>
                  <div className={`${styles.cellFontSizeClass} ${styles.cellWeightClass} tracking-wide text-slate-900`}>
                    {line2}
                  </div>
                  <span className={styles.firstColSubtextClass}>
                    Abrir TCC ↗
                  </span>
                </div>
              );
            })()}
          </td>
        );
      case 'defesaDataHora':
        return (
          <td key="defesaDataHora" className={`${styles.cellPadClass} ${widthClass} ${styles.cellWeightClass} ${styles.cellTextColorClass} ${alignClass} ${styles.borderClass} align-middle`}>
            <div className={`flex items-center justify-center gap-1 ${styles.cellFontSizeClass}`}>
              <span>⏰</span>
              <span className={isPast ? 'text-slate-500' : 'text-emerald-900 font-bold'}>{formatDateNumeric(proc.defesa?.startAt)}</span>
            </div>
            <div className="text-[9.5px] text-slate-500 font-mono font-medium">{formatTimeExtenso(proc.defesa?.startAt)}</div>
          </td>
        );
      case 'progresso': {
        const stageNumber = getStepNumberLabel(progress.label).replace('Fase ', '') || '—';
        return (
          <td key="progresso" className={`${styles.cellPadClass} ${widthClass} text-center align-middle ${styles.borderClass}`}>
            <span className="portal-stage-number inline-flex min-w-[24px] items-center justify-center text-[11px] font-semibold tabular-nums text-slate-600" title={progress.label} aria-label={progress.label}>
              {stageNumber}
            </span>
          </td>
        );
      }
      case 'titulo':
        return (
          <td key="titulo" className={`${styles.cellPadClass} ${widthClass} ${styles.cellWeightClass} ${styles.cellTextColorClass} ${alignClass} ${styles.borderClass} align-middle`}>
            <div className={`${styles.cellWrapClass} ${alignClass} ${styles.cellFontSizeClass}`} title={formatTccTitle(proc.titulo)}>
              {formatCellText('titulo', formatTccTitle(proc.titulo), meusProcessosTextFormat, '📖')}
            </div>
          </td>
        );
      case 'aluno1':
        return (
          <td key="aluno1" className={`${styles.cellPadClass} ${widthClass} ${alignClass} ${styles.borderClass} align-middle`}>
            <div className="w-full mx-auto">
              <div className={`${styles.cellWeightClass} ${styles.cellTextColorClass} ${styles.cellFontSizeClass} ${styles.cellWrapClass} ${alignClass}`}>
                {formatCellText('aluno1', cleanPersonName(proc.aluno1?.nome || '—'), meusProcessosTextFormat, '🎓')}
              </div>
              <div className="text-[9px] text-slate-500 font-mono font-medium mt-0.5 uppercase tracking-tight">🪪 Matrícula</div>
              <div className="text-[9px] text-slate-500 font-mono font-medium leading-tight">{proc.aluno1?.matricula || '2026101890'}</div>
            </div>
          </td>
        );
      case 'aluno2':
        return (
          <td key="aluno2" className={`${styles.cellPadClass} ${widthClass} ${alignClass} ${styles.borderClass} align-middle`}>
            <div className="w-full mx-auto">
              {proc.aluno2?.nome ? (
                <>
                  <div className={`${styles.cellWeightClass} ${styles.cellTextColorClass} ${styles.cellFontSizeClass} ${styles.cellWrapClass} ${alignClass}`}>
                    {formatCellText('aluno2', cleanPersonName(proc.aluno2.nome), meusProcessosTextFormat, '🎓')}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono font-medium mt-0.5 uppercase tracking-tight">🪪 Matrícula</div>
                  <div className="text-[9px] text-slate-500 font-mono font-medium leading-tight">{proc.aluno2.matricula || '2026101891'}</div>
                </>
              ) : (
                <span className="text-slate-400 font-mono text-[11px]">—</span>
              )}
            </div>
          </td>
        );
      case 'orientador':
        return (
          <td key="orientador" className={`${styles.cellPadClass} ${widthClass} ${alignClass} ${styles.borderClass} align-middle`}>
            <div className="w-full mx-auto">
              <div className={`${styles.cellWeightClass} ${styles.cellTextColorClass} ${styles.cellFontSizeClass} ${styles.cellWrapClass} ${alignClass}`}>
                {formatCellText('orientador', formatProfessorName(proc.orientador?.nome), meusProcessosTextFormat, '👨‍🏫')}
              </div>
              <div className="text-[9px] text-slate-600 font-mono font-medium mt-0.5 leading-tight break-words">
                📍 {cleanInst(proc.orientador?.instituicao || installationProfile.defaultInstitutionName)}
              </div>
            </div>
          </td>
        );
      case 'membro1':
        return (
          <td key="membro1" className={`${styles.cellPadClass} ${widthClass} ${alignClass} ${styles.borderClass} align-middle`}>
            <div className="w-full mx-auto">
              {ev1 ? (
                <div>
                  <div className={`${styles.cellWeightClass} ${styles.cellTextColorClass} ${styles.cellFontSizeClass} ${styles.cellWrapClass} ${alignClass}`}>
                    {formatCellText('membro1', formatProfessorName(ev1.nome), meusProcessosTextFormat, '👥')}
                  </div>
                  <div className="text-[9px] text-slate-600 font-mono mt-0.5 leading-tight break-words">
                    📍 {cleanInst(ev1.instituicao || installationProfile.defaultInstitutionName)}
                  </div>
                </div>
              ) : (
                <span className="text-slate-400 italic text-[10px]">A definir</span>
              )}
            </div>
          </td>
        );
      case 'membro2':
        return (
          <td key="membro2" className={`${styles.cellPadClass} ${widthClass} ${alignClass} ${styles.borderClass} align-middle`}>
            <div className="w-full mx-auto">
              {ev2 ? (
                <div>
                  <div className={`${styles.cellWeightClass} ${styles.cellTextColorClass} ${styles.cellFontSizeClass} ${styles.cellWrapClass} ${alignClass}`}>
                    {formatCellText('membro2', formatProfessorName(ev2.nome), meusProcessosTextFormat, '👥')}
                  </div>
                  <div className="text-[9px] text-slate-600 font-mono mt-0.5 leading-tight break-words">
                    📍 {cleanInst(ev2.instituicao || 'Instituição Externa')}
                  </div>
                </div>
              ) : (
                <span className="text-slate-400 italic text-[10px]">A definir</span>
              )}
            </div>
          </td>
        );
      case 'coorientador':
        return (
          <td key="coorientador" className={`${styles.cellPadClass} ${widthClass} ${alignClass} ${styles.borderClass} align-middle`}>
            <div className="w-full mx-auto">
              {proc.coorientador?.nome ? (
                <div>
                  <div className={`${styles.cellWeightClass} ${styles.cellTextColorClass} ${styles.cellFontSizeClass} ${styles.cellWrapClass} ${alignClass}`}>
                    {formatCellText('coorientador', formatProfessorName(proc.coorientador.nome), meusProcessosTextFormat, '👨‍🏫')}
                  </div>
                  <div className="text-[9px] text-slate-600 font-mono font-medium mt-0.5 leading-tight break-words">
                    📍 {cleanInst(proc.coorientador.instituicao || 'Instituição Externa')}
                  </div>
                </div>
              ) : (
                <span className="text-slate-400 font-mono text-[11px]">—</span>
              )}
            </div>
          </td>
        );
      case 'resumo':
        return (
          <td key="resumo" className={`${styles.cellPadClass} ${widthClass} ${styles.cellTextColorClass} ${alignClass} ${styles.borderClass} align-middle leading-relaxed whitespace-pre-wrap break-words ${styles.cellFontSizeClass}`}>
            {proc.acervo?.resumoSintese ? (
              proc.acervo.resumoSintese
            ) : (
              `Trabalho de Conclusão de Curso intitulado "${formatTccTitle(proc.titulo)}", submetido a ${installationProfile.courseName} — ${installationProfile.institutionName}.`
            )}
          </td>
        );
      case 'palavrasChave':
        return (
          <td key="palavrasChave" className={`${styles.cellPadClass} ${widthClass} ${styles.cellTextColorClass} ${alignClass} ${styles.borderClass} align-middle leading-tight whitespace-normal break-words ${styles.cellFontSizeClass}`}>
            {(proc.acervo?.palavrasChave && proc.acervo.palavrasChave.length > 0
              ? proc.acervo.palavrasChave
              : []
            ).slice(0, 5).join('; ')}
          </td>
        );
      case 'defesaLocal':
        return (
          <td key="defesaLocal" className={`${styles.cellPadClass} ${widthClass} ${styles.cellTextColorClass} ${alignClass} ${styles.borderClass} align-middle leading-tight whitespace-normal break-words ${styles.cellFontSizeClass}`}>
            <span>📍 {proc.defesa?.local || installationProfile.defaultDefenseLocation || 'Local a confirmar'}</span>
          </td>
        );
      default:
        return null;
    }
  };

  const actionStyles = getActionPillStyles(meusProcessosTextFormat);

  return (
    <div id="meus-processos-page-container" className="max-w-7xl mx-auto py-1 space-y-3">

      {/* Section with Unified Gray Header & Table */}
      <section className="space-y-3">
        {/* UNIFIED GRAY HEADER + SPREADSHEET CARD */}
        <div className={`bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden ${styles.fontFamilyClass}`} style={styles.rootStyle}>
          {/* Gray Header Banner */}
          <div className={`${styles.bannerHeaderClass} border-b transition-colors`} style={styles.bannerHeaderStyle}>
            {/* Title */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-3.5 py-3 sm:px-4 sm:py-3.5">
              <div className="flex items-center gap-2">
                <ColorfulHeaderIcon type="graduation" textFormat={meusProcessosTextFormat} />
                <h1 className="text-sm sm:text-base font-black uppercase tracking-wide leading-tight">
                  {getEditableTableText(customLabels, '__tableTitle', 'Meus Trabalhos de Conclusão de Curso')}
                </h1>
              </div>

              {/* Ação principal separada dos três controles padrão */}
              <div className="flex items-center shrink-0">
                {canCreateStudentTcc && meusProcessosTextFormat.showCadastrarTrabalhoButton !== false && (
                  <button
                    id="meus-processos-btn-novo"
                    type="button"
                    onClick={onNavigateToWizard}
                    className={`${styles.toolbarButtonClass} portal-restricted-toolbar-wide portal-primary-register-btn`}
                    style={styles.toolbarButtonStyle}
                    title="Cadastrar novo trabalho de TCC"
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span>Cadastrar TCC</span>
                  </button>
                )}

                <div className={`flex items-center gap-1.5 sm:gap-2 ${canCreateStudentTcc && meusProcessosTextFormat.showCadastrarTrabalhoButton !== false ? 'ml-3 border-l border-white/35 pl-3' : ''}`}>
                  <SearchPopover
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Buscar TCCs..."
                    textFormat={meusProcessosTextFormat}
                  />
                  <button
                    id="meus-processos-refresh-btn"
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className={`${styles.toolbarButtonClass} disabled:opacity-70`}
                    style={styles.toolbarButtonStyle}
                    title="Atualizar dados da tabela"
                  >
                    <YinYangIcon className={`w-3.5 h-3.5 text-current ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                  <HeaderSettingsPopover
                    recordsLimit={recordsLimit}
                    setRecordsLimit={setRecordsLimit}
                    allowedLimits={[25, 50, 100, 'all']}
                    allColumns={ALL_MEUS_PROCESSOS_COLUMNS}
                    visibleColumns={visibleColumns}
                    setVisibleColumns={setVisibleColumns}
                    columnOrder={columnOrder}
                    setColumnOrder={setColumnOrder}
                    storageKey="meus_processos"
                    customLabels={customLabels}
                    setCustomLabels={setCustomLabels}
                    defaultColumnOrder={DEFAULT_MEUS_PROCESSOS_ORDER}
                    defaultVisibleColumns={DEFAULT_MEUS_PROCESSOS_VISIBLE}
                    defaultRecordsLimit={25}
                    columnWidths={columnWidths}
                    setColumnWidths={setColumnWidths}
                    textFormat={meusProcessosTextFormat}
                    setTextFormat={setMeusProcessosTextFormat}
                    startDate={startDate}
                    setStartDate={setStartDate}
                    endDate={endDate}
                    setEndDate={setEndDate}
                    defaultTableTitle="Meus Trabalhos de Conclusão de Curso"
                    defaultFilterTitle="Filtrar por vínculo"
                  />
                </div>
              </div>
            </div>

            {/* INTEGRATED TOOLBAR FOR FILTERS (Single clean dividing line) */}
            <div className="portal-meus-processos-filter-row flex w-full min-w-0 flex-wrap items-center gap-2 border-t-2 border-white px-3.5 py-2.5 text-xs sm:px-4">
              <span className="text-[10px] font-extrabold uppercase tracking-wider shrink-0 mr-1 opacity-80">
                {getEditableTableText(customLabels, '__filterTitle', 'FILTRAR:')}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {availableCategories.map((catKey) => {
                  const cfg = ROLE_CONFIGS[catKey];
                  const isSelected = selectedRoleCategories.includes(catKey);
                  const count = roleCounts[catKey] || 0;
                  const chip = getFilterChipProps(catKey.toLowerCase(), isSelected, meusProcessosTextFormat, cfg.label);

                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => toggleRoleCategory(catKey)}
                      style={chip.buttonStyle}
                      className={`portal-standard-filter-chip flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-wider cursor-pointer transition-colors h-7 shrink-0 border select-none ${
                        isSelected ? '' : 'opacity-85 hover:opacity-100'
                      }`}
                      title={`Clique para ${isSelected ? 'isolar ou alternar' : 'exibir'} TCCs com papel de ${chip.label}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: chip.dotColor }}
                      />
                      <span className="whitespace-nowrap font-extrabold">{chip.label}</span>
                      <span
                        className="text-[9px] px-1.5 py-0.2 rounded-full font-black shadow-2xs"
                        style={chip.badgeStyle}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Table Container Inside Unified Card */}
          <div className="w-full">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 text-xs font-semibold">
              Carregando trabalhos de TCC...
            </div>
          ) : displayedProcesses.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="font-bold text-slate-800 text-sm">Nenhum trabalho de TCC encontrado</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Não foram encontrados Trabalhos de Conclusão de Curso associados a esta busca ou ao e-mail ativo ({userEmail}).
              </p>
              <button
                type="button"
                onClick={onNavigateToWizard}
                className="mt-2 inline-flex items-center gap-1.5 bg-emerald-950 hover:bg-black text-white px-3.5 py-1.5 border border-emerald-500 rounded-full text-xs font-extrabold uppercase tracking-wider cursor-pointer transition-all shadow-2xs h-8"
              >
                <span>🎓 Cadastrar Novo Trabalho de TCC</span>
              </button>
            </div>
          ) : (
            <div>
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <TableScrollWrapper>
                  <table id="meus-processos-table" className="w-full text-center border-collapse text-xs">
                    <thead className={`${styles.headerTheadClass} ${styles.headerTextColorClass} ${styles.headerFontSizeClass} ${styles.headerWeightClass} ${styles.headerCasingClass} ${styles.headerBorderClass}`} style={styles.theadStyle}>
                      <tr>
                        {activeColumns.map((colKey) => renderHeaderCell(colKey))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {displayedProcesses.map((proc) => {
                        const roles = getUserRolesForProcess(proc.id);
                        const roleCat = getRoleCategoryForProcess(roles);
                        const roleConfig = ROLE_CONFIGS[roleCat];

                        return (
                          <tr
                            key={proc.id}
                            id={`process-row-${proc.id}`}
                            className="bg-white border-b border-slate-200 hover:bg-slate-50/70 transition-colors"
                          >
                            {activeColumns.map((colKey) => renderBodyCell(colKey, proc))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableScrollWrapper>
              </div>

              {/* Mobile Card Stack View */}
              <div className="lg:hidden divide-y divide-slate-200">
                {displayedProcesses.map((proc) => {
                  const roles = getUserRolesForProcess(proc.id);
                  const roleCat = getRoleCategoryForProcess(roles);
                  const roleConfig = ROLE_CONFIGS[roleCat];
                  const nextAction = getNextActionText(proc, roles);

                  return (
                    <div
                      key={proc.id}
                      onClick={() => onSelectProcess(proc.id)}
                      style={{
                        backgroundColor: roleConfig.bgColor,
                        borderLeftWidth: '10px',
                        borderLeftColor: roleConfig.borderColor
                      }}
                      className="p-2.5 space-y-1.5 cursor-pointer hover:opacity-90"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900 text-xs">
                          {proc.protocolo}
                        </span>
                        <span
                          className="text-[10px] font-black px-2 py-0.5 rounded uppercase border"
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderColor: roleConfig.borderColor,
                            color: roleConfig.textHex
                          }}
                        >
                          {roleConfig.label}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm leading-snug">
                        {proc.titulo}
                      </h4>

                      <div className="text-xs text-slate-700 space-y-1">
                        <div>
                          <strong>Aluno(s):</strong>
                          <StudentNames aluno1={proc.aluno1} aluno2={proc.aluno2} align="left" itemClassName="text-xs font-bold text-slate-900" />
                        </div>
                        <div><strong>Orientador:</strong> {proc.orientador?.nome || 'Não definido'}</div>
                        <div><strong>Data:</strong> {formatDatePt(proc.defesa?.startAt)}</div>
                      </div>

                      <div className="pt-2 flex items-center justify-between border-t border-slate-300/50">
                        <div className="flex gap-1">
                          <span
                            className="text-[10px] font-black px-2 py-0.5 rounded uppercase border"
                            style={{
                              backgroundColor: '#FFFFFF',
                              borderColor: roleConfig.borderColor,
                              color: roleConfig.textHex
                            }}
                          >
                            {roleConfig.label}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                          {nextAction} &rarr;
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

        </div>
        </div>
      </section>
    </div>
  );
};
