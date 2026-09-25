import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ProcessData } from '../types';
import { apiClient } from '../services/apiClient';
import { formatDatePt, formatDateNumeric, formatTimeExtenso, formatStudentsString, cleanPersonName, formatProfessorName, formatTccTitle } from '../utils/formatters';
import { OnlineSystemTutorial } from '../components/OnlineSystemTutorial';
import { TableScrollWrapper } from '../components/TableScrollWrapper';
import { loadTableConfig, ColumnDef, TableTextFormat, DEFAULT_TABLE_TEXT_FORMAT } from '../components/TableColumnSelectorPanel';
import { getTableStyles, getActionPillStyles, formatColumnLabel, formatCellText, getColWidthClass, getEditableTableText, getColumnWeightClass, GLOBAL_TABLE_EVENT, loadGlobalTableConfig, getFilterChipProps, inheritsGlobalTableAppearance } from '../utils/tableFormatters';
import { TABLE_LAYOUTS_EVENT } from '../utils/portalAppearanceLinks';
import { HeaderSettingsPopover } from '../components/HeaderSettingsPopover';
import { SearchPopover } from '../components/SearchPopover';
import { YinYangIcon } from '../components/YinYangIcon';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { ProcessoDetailPage } from './ProcessoDetailPage';
import { StudentNames, GcalStudentNames } from '../components/StudentNames';
import { ColorfulHeaderIcon } from '../components/ColorfulHeaderIcon';
import { useAuth } from '../context/AuthContext';
import {
  Calendar as CalendarIcon,
  Search,
  Clock,
  MapPin,
  ArrowRight,
  Mail,
  PlusCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  List,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Navigation,
  Building2,
  User,
  Lightbulb,
  Info,
  Car,
  BookOpen,
  HelpCircle,
  GraduationCap,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Award,
  Check,
  Shield,
  FileCheck,
  RotateCcw,
  Pencil,
  X
} from 'lucide-react';
import {
  CalendarPopupFormat,
  DEFAULT_CALENDAR_POPUP_FORMAT,
  loadCalendarPopupConfig,
  CALENDAR_POPUP_CONFIG_EVENT,
} from '../utils/calendarPopupConfig';
import {
  LoginPopupConfig,
  DEFAULT_LOGIN_POPUP_CONFIG,
  loadLoginPopupConfig,
  LOGIN_POPUP_CONFIG_EVENT
} from '../utils/loginPopupConfig';
import { resolveInstallationProfile } from '../utils/installationProfile';

interface HomePageProps {
  onNavigate: (tab: string) => void;
  initialPublicTab?: 'calendario' | 'biblioteca' | 'tutorial';
}

// Helper to parse Google Calendar events for presentations
const parseGcalEvent = (ev: any) => {
  const summary = ev.summary || '';
  const desc = ev.description || '';
  
  let aluno = summary
    .replace(/Defesa de TCC\s*-\s*Apresentação:\s*/i, '')
    .replace(/Defesa de TCC:\s*/i, '')
    .replace(/Defesa de TCC\s*/i, '')
    .trim();
  if (!aluno) aluno = "Discente não identificado";
  
  let trabalho = "Trabalho de Conclusão de Curso";
  const trabalhoMatch = desc.match(/Trabalho:\s*([^\n]+)/i);
  if (trabalhoMatch && trabalhoMatch[1]) {
    trabalho = trabalhoMatch[1].trim();
  } else if (desc && !desc.includes('Orientador:')) {
    trabalho = desc.trim();
  }
  
  let time = 'A definir';
  if (ev.start) {
    const dStart = new Date(ev.start);
    const dEnd = ev.end ? new Date(ev.end) : new Date(dStart.getTime() + 90 * 60 * 1000);
    const startStr = dStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const endStr = dEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    time = `${startStr} às ${endStr}`;
  }
  
  let orientador = "Comissão de TCC";
  const orientadorMatch = desc.match(/Orientador:\s*([^\n]+)/i);
  if (orientadorMatch && orientadorMatch[1]) {
    orientador = orientadorMatch[1].trim();
  }

  let coorientador = "";
  const coorientadorMatch = desc.match(/Coorientador:\s*([^\n]+)/i);
  if (coorientadorMatch && coorientadorMatch[1]) {
    coorientador = coorientadorMatch[1].trim();
  }

  let banca = "";
  const bancaMatch = desc.match(/Banca:\s*([^\n]+)/i);
  if (bancaMatch && bancaMatch[1]) {
    banca = bancaMatch[1].trim();
  }
  
  return { aluno, trabalho, time, orientador, coorientador, banca };
};

// Helper to get formatted start and end time (1:30 duration)
const getStartAndEndTime = (startIso: string, endIso?: string) => {
  if (!startIso) return 'A definir';
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : new Date(start.getTime() + 90 * 60 * 1000);
  const startStr = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const endStr = end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${startStr} às ${endStr}`;
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

// Helper to render process number stacked on multiple lines
const renderProtocoloMultiLine = (protocolo: string) => {
  if (!protocolo) return <span className="font-mono text-slate-400">—</span>;
  // Split on hyphens, slashes, dots, or spaces
  const parts = protocolo.split(/[-/\s]+/);
  if (parts.length > 1) {
    return (
      <div className="flex flex-col items-center justify-center font-mono font-extrabold text-[10.5px] leading-tight text-slate-900">
        {parts.map((p, idx) => (
          <span key={idx} className="block">{p}</span>
        ))}
      </div>
    );
  }
  return <span className="font-mono font-extrabold text-[10.5px] text-slate-900 leading-tight block break-all">{protocolo}</span>;
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

const getFriendlyEtapaLabel = (etapa: string): string => {
  switch (etapa) {
    case 'CADASTRO': return 'Cadastro';
    case 'AGENDAMENTO': return 'Agendamento';
    case 'CONVITE': return 'Banca';
    case 'DEFESA': return 'Defesa';
    case 'AVALIACAO': return 'Avaliação';
    case 'ASSINATURA': return 'Assinatura';
    case 'DOCUMENTOS': return 'Documentos';
    case 'CONCLUIDO': return 'Concluído';
    default: return etapa;
  }
};

const getStepNumberLabel = (label: string): string => {
  const match = label.match(/Etapa\s+([\d.]+)\/(\d+)/i);
  if (match) {
    const current = match[1].replace('.', ',');
    return `Fase ${current}`;
  }
  return '';
};

interface DayDatePickerPopoverProps {
  value: string; // 'YYYY-MM-DD'
  onChange: (val: string) => void;
  placeholder: string;
}

const DayDatePickerPopover: React.FC<DayDatePickerPopoverProps> = ({
  value,
  onChange,
  placeholder,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const getInitialDate = () => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  };

  const [viewYear, setViewYear] = useState(() => getInitialDate().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => getInitialDate().getMonth());

  const handleToggle = () => {
    if (!isOpen) {
      const d = getInitialDate();
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const popupWidth = 260;
        let left = rect.left;
        if (left + popupWidth > window.innerWidth - 10) {
          left = Math.max(10, window.innerWidth - popupWidth - 10);
        }
        if (left < 10) left = 10;
        setPopoverPos({
          top: rect.bottom + 6,
          left,
        });
      }
    }
    setIsOpen(!isOpen);
  };

  const monthNamesPt = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const daysOfWeek = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  const handleSelectDay = (day: number) => {
    const formatted = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const today = new Date();
    const formatted = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  const formattedDisplay = value
    ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
    : placeholder;

  return (
    <div className="relative inline-block text-left shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`flex items-center gap-1.5 px-3 py-1 text-[10px] sm:text-[11px] font-extrabold uppercase rounded-full border outline-none cursor-pointer h-7.5 shadow-2xs transition-all shrink-0 bg-emerald-950 hover:bg-black text-white ${
          value ? 'border-emerald-400' : 'border-emerald-500'
        }`}
        title={`Selecionar ${placeholder}`}
      >
        <CalendarIcon className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
        <span className="font-extrabold">{formattedDisplay}</span>
        <ChevronDown className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />

          <div
            className="fixed z-[9999] bg-white border border-slate-300 rounded-xl shadow-2xl p-3 w-64 text-slate-800 animate-in fade-in zoom-in-95 duration-150"
            style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => {
                  if (viewMonth === 0) {
                    setViewMonth(11);
                    setViewYear(prev => prev - 1);
                  } else {
                    setViewMonth(prev => prev - 1);
                  }
                }}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                title="Mês Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="font-extrabold text-xs text-slate-900 tracking-tight">
                {monthNamesPt[viewMonth]} {viewYear}
              </span>

              <button
                type="button"
                onClick={() => {
                  if (viewMonth === 11) {
                    setViewMonth(0);
                    setViewYear(prev => prev + 1);
                  } else {
                    setViewMonth(prev => prev + 1);
                  }
                }}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                title="Próximo Mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {daysOfWeek.map((dow, idx) => (
                <span key={idx} className="text-[10px] font-bold text-slate-400 uppercase">
                  {dow}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {Array.from({ length: startDayOfWeek }).map((_, idx) => (
                <div key={`empty-${idx}`} className="w-7 h-7" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const dateIso = `${viewYear}-${pad(viewMonth + 1)}-${pad(dayNum)}`;
                const isSelected = value === dateIso;

                const todayObj = new Date();
                const isToday =
                  todayObj.getFullYear() === viewYear &&
                  todayObj.getMonth() === viewMonth &&
                  todayObj.getDate() === dayNum;

                return (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={() => handleSelectDay(dayNum)}
                    className={`w-7 h-7 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center cursor-pointer mx-auto ${
                      isSelected
                        ? 'bg-emerald-600 text-white font-black shadow-xs'
                        : isToday
                        ? 'bg-emerald-100 text-emerald-900 font-extrabold border border-emerald-400'
                        : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-[10px]">
              <button
                type="button"
                onClick={handleSelectToday}
                className="font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer px-1 py-0.5"
              >
                Hoje
              </button>
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="font-bold text-slate-500 hover:text-rose-600 hover:underline cursor-pointer px-1 py-0.5"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const ALL_DEFENSES_COLUMNS: ColumnDef[] = [
  { key: 'protocolo', label: 'Nº do Processo' },
  { key: 'defesaDataHora', label: 'Data e Hora' },
  { key: 'progresso', label: 'Progresso' },
  { key: 'titulo', label: 'Título do Trabalho' },
  { key: 'aluno1', label: 'Aluno 1' },
  { key: 'aluno2', label: 'Aluno 2' },
  { key: 'orientador', label: 'Orientador(a)' },
  { key: 'membro1', label: '1º Membro da Banca' },
  { key: 'membro2', label: '2º Membro da Banca' },
  { key: 'coorientador', label: 'Coorientador(a)' },
  { key: 'resumo', label: 'Resumo do TCC' },
  { key: 'palavrasChave', label: '5 Palavras-Chave' },
  { key: 'defesaLocal', label: 'Local da Defesa' },
];

const DEFAULT_DEFENSES_ORDER = [
  'protocolo',
  'defesaDataHora',
  'progresso',
  'titulo',
  'aluno1',
  'aluno2',
  'orientador',
  'membro1',
  'membro2',
  'coorientador',
  'resumo',
  'palavrasChave',
  'defesaLocal',
];

const DEFAULT_DEFENSES_VISIBLE: Record<string, boolean> = {
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
  resumo: false,
  palavrasChave: false,
  defesaLocal: true,
};

const ALL_ACERVO_COLUMNS: ColumnDef[] = [
  { key: 'protocolo', label: 'Nº do Processo' },
  { key: 'defesaDataHora', label: 'Data e Hora' },
  { key: 'progresso', label: 'Progresso' },
  { key: 'titulo', label: 'Título do Trabalho' },
  { key: 'aluno1', label: 'Aluno 1' },
  { key: 'aluno2', label: 'Aluno 2' },
  { key: 'orientador', label: 'Orientador(a)' },
  { key: 'membro1', label: '1º Membro da Banca' },
  { key: 'membro2', label: '2º Membro da Banca' },
  { key: 'coorientador', label: 'Coorientador(a)' },
  { key: 'resumo', label: 'Resumo do TCC' },
  { key: 'palavrasChave', label: 'Palavras-Chave' },
  { key: 'defesaLocal', label: 'Local da Defesa' },
];

const DEFAULT_ACERVO_ORDER = [
  'protocolo',
  'progresso',
  'titulo',
  'aluno1',
  'aluno2',
  'orientador',
  'membro1',
  'membro2',
  'coorientador',
  'resumo',
  'palavrasChave',
  'defesaDataHora',
  'defesaLocal',
];

const DEFAULT_ACERVO_VISIBLE: Record<string, boolean> = {
  protocolo: true,
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
  defesaDataHora: true,
  defesaLocal: true,
};

// Helper for column width classes
const getColWidth = (colKey: string, widthsMap?: Record<string, string | number>, defaultClass: string = '') => {
  if (!widthsMap) return defaultClass;
  const setting = widthsMap[colKey];
  if (!setting || setting === 'auto') return defaultClass;
  if (setting === 'compact') return 'w-20 min-w-[75px] max-w-[95px]';
  if (setting === 'normal') return 'w-32 min-w-[120px] max-w-[160px]';
  if (setting === 'wide') return 'w-48 min-w-[180px] max-w-[240px]';
  if (setting === 'extrawide') return 'w-72 min-w-[280px] max-w-[380px]';
  return defaultClass;
};

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, initialPublicTab }) => {
  const { userEmail, switchUser, settings, isMasterAdmin, isAuthenticated } = useAuth();
  const installationProfile = resolveInstallationProfile(settings);
  const isVisitor = !isAuthenticated;

  const [publicTab, setPublicTab] = useState<'calendario' | 'biblioteca' | 'tutorial'>(initialPublicTab || 'calendario');

  useEffect(() => {
    if (initialPublicTab) {
      setPublicTab(initialPublicTab);
    }
  }, [initialPublicTab]);

  const [processes, setProcesses] = useState<ProcessData[]>([]);
  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'calendar' | 'cards'>('calendar');
  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginCodeInput,setLoginCodeInput]=useState('');
  const [loginStep,setLoginStep]=useState<'email'|'code'>('email');
  const [loginWorking,setLoginWorking]=useState(false);
  const [loginMessage,setLoginMessage]=useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [bootstrapStatus,setBootstrapStatus]=useState<{google:{oauthConfigured:boolean;connected:boolean};bootstrapMasterConfigured:boolean}|null>(null);

  useEffect(()=>{if(!showLoginModal)return;void apiClient.getAuthStatus().then(status=>setBootstrapStatus(status)).catch(()=>setBootstrapStatus(null));},[showLoginModal]);
  const [showDirections, setShowDirections] = useState(false);
  const [showMonthPickerPopup, setShowMonthPickerPopup] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(2026);

  // Library specific state
  const [libSearch, setLibSearch] = useState('');
  const [selectedLibDoc, setSelectedLibDoc] = useState<ProcessData | null>(null);
  const [selectedProcessDetails, setSelectedProcessDetails] = useState<ProcessData | null>(null);
  const [selectedProcessDocs, setSelectedProcessDocs] = useState<any[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [libSortColumn, setLibSortColumn] = useState<string | null>(null);
  const [libSortDirection, setLibSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);

  // Column selection state for Biblioteca (Acervo)
  const initialAcervoConfig = loadTableConfig('acervo', DEFAULT_ACERVO_ORDER, DEFAULT_ACERVO_VISIBLE, 25);
  const [acervoColumnOrder, setAcervoColumnOrder] = useState<string[]>(initialAcervoConfig.columnOrder);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(initialAcervoConfig.visibleColumns);
  const [acervoCustomLabels, setAcervoCustomLabels] = useState<Record<string, string>>(initialAcervoConfig.customLabels || {});
  const [acervoColumnWidths, setAcervoColumnWidths] = useState<Record<string, string | number>>(initialAcervoConfig.columnWidths || {});
  const [acervoTextFormat, setAcervoTextFormat] = useState<TableTextFormat>(initialAcervoConfig.textFormat || DEFAULT_TABLE_TEXT_FORMAT);
  const [libRecordsLimit, setLibRecordsLimit] = useState<number | 'all'>(initialAcervoConfig.recordsLimit !== undefined ? initialAcervoConfig.recordsLimit : 25);
  const [libStartDate, setLibStartDate] = useState(initialAcervoConfig.startDate || '');
  const [libEndDate, setLibEndDate] = useState(initialAcervoConfig.endDate || '');

  // States and sorting for the List of Defenses (below the calendar)
  const [defensesSearch, setDefensesSearch] = useState('');
  const [defensesStartDate, setDefensesStartDate] = useState('');
  const [defensesEndDate, setDefensesEndDate] = useState('');
  const [defenseStatusFilter, setDefenseStatusFilter] = useState<'all' | 'pending' | 'concluded'>('all');
  const [defensesSortColumn, setDefensesSortColumn] = useState<string | null>('date');
  const [defensesSortDirection, setDefensesSortDirection] = useState<'asc' | 'desc'>('asc');

  const initialDefensesConfig = loadTableConfig('defenses', DEFAULT_DEFENSES_ORDER, DEFAULT_DEFENSES_VISIBLE, 'all');
  const [defensesColumnOrder, setDefensesColumnOrder] = useState<string[]>(initialDefensesConfig.columnOrder);
  const [defensesVisibleColumns, setDefensesVisibleColumns] = useState<Record<string, boolean>>(initialDefensesConfig.visibleColumns);
  const [defensesCustomLabels, setDefensesCustomLabels] = useState<Record<string, string>>(initialDefensesConfig.customLabels || {});
  const [defensesColumnWidths, setDefensesColumnWidths] = useState<Record<string, string | number>>(initialDefensesConfig.columnWidths || {});
  const [defensesTextFormat, setDefensesTextFormat] = useState<TableTextFormat>(initialDefensesConfig.textFormat || DEFAULT_TABLE_TEXT_FORMAT);
  const [defensesRecordsLimit, setDefensesRecordsLimit] = useState<number | 'all'>(initialDefensesConfig.recordsLimit !== undefined ? initialDefensesConfig.recordsLimit : 'all');

  // Calendar Popup Customization State
  const [calendarPopupFormat, setCalendarPopupFormat] = useState<CalendarPopupFormat>(() => loadCalendarPopupConfig());

  // Login Popup Customization State
  const [loginPopupConfig, setLoginPopupConfig] = useState<LoginPopupConfig>(() => loadLoginPopupConfig());

  // Synchronize formats when Master changes global formatting or popup formatting
  useEffect(() => {
    const handleGlobalFormatChange = (e?: any) => {
      const newFormat = (e && e.detail) ? e.detail : loadGlobalTableConfig();
      if (inheritsGlobalTableAppearance('acervo')) setAcervoTextFormat(prev => ({ ...prev, ...newFormat }));
      if (inheritsGlobalTableAppearance('defenses')) setDefensesTextFormat(prev => ({ ...prev, ...newFormat }));
    };
    const handlePopupFormatChange = (e?: any) => {
      const newPopupFormat = (e && e.detail) ? e.detail : loadCalendarPopupConfig();
      setCalendarPopupFormat(newPopupFormat);
    };
    const handleLoginPopupConfigChange = (e?: any) => {
      const newConfig = (e && e.detail) ? e.detail : loadLoginPopupConfig();
      setLoginPopupConfig(newConfig);
    };
    const handlePublishedLayouts = () => {
      const acervo = loadTableConfig('acervo', DEFAULT_ACERVO_ORDER, DEFAULT_ACERVO_VISIBLE, 25);
      setAcervoColumnOrder(acervo.columnOrder);
      setVisibleColumns(acervo.visibleColumns);
      setAcervoCustomLabels(acervo.customLabels || {});
      setAcervoColumnWidths(acervo.columnWidths || {});
      setLibRecordsLimit(acervo.recordsLimit ?? 25);
      setAcervoTextFormat(acervo.textFormat || loadGlobalTableConfig());

      const defenses = loadTableConfig('defenses', DEFAULT_DEFENSES_ORDER, DEFAULT_DEFENSES_VISIBLE, 'all');
      setDefensesColumnOrder(defenses.columnOrder);
      setDefensesVisibleColumns(defenses.visibleColumns);
      setDefensesCustomLabels(defenses.customLabels || {});
      setDefensesColumnWidths(defenses.columnWidths || {});
      setDefensesRecordsLimit(defenses.recordsLimit ?? 'all');
      setDefensesTextFormat(defenses.textFormat || loadGlobalTableConfig());
    };

    handleGlobalFormatChange();
    window.addEventListener(GLOBAL_TABLE_EVENT, handleGlobalFormatChange);
    window.addEventListener(CALENDAR_POPUP_CONFIG_EVENT, handlePopupFormatChange);
    window.addEventListener(LOGIN_POPUP_CONFIG_EVENT, handleLoginPopupConfigChange);
    window.addEventListener(TABLE_LAYOUTS_EVENT, handlePublishedLayouts);
    return () => {
      window.removeEventListener(GLOBAL_TABLE_EVENT, handleGlobalFormatChange);
      window.removeEventListener(CALENDAR_POPUP_CONFIG_EVENT, handlePopupFormatChange);
      window.removeEventListener(LOGIN_POPUP_CONFIG_EVENT, handleLoginPopupConfigChange);
      window.removeEventListener(TABLE_LAYOUTS_EVENT, handlePublishedLayouts);
    };
  }, []);

  const handleDefensesSort = (column: string) => {
    if (defensesSortColumn === column) {
      setDefensesSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setDefensesSortColumn(column);
      setDefensesSortDirection('asc');
    }
  };

  const renderDefensesSortArrow = (column: string, isDarkHeader: boolean = true) => {
    // Treat 'date' the same as 'defesaDataHora' if needed, though they are mapped consistently
    const isSorted = defensesSortColumn === column || (column === 'defesaDataHora' && defensesSortColumn === 'date');
    if (isSorted) {
      return defensesSortDirection === 'asc' ? (
        <ChevronUp className={`w-4 h-4 ${isDarkHeader ? 'text-white' : 'text-slate-900'} font-extrabold flex-shrink-0`} style={{ strokeWidth: 3 }} />
      ) : (
        <ChevronDown className={`w-4 h-4 ${isDarkHeader ? 'text-white' : 'text-slate-900'} font-extrabold flex-shrink-0`} style={{ strokeWidth: 3 }} />
      );
    }
    return <ArrowUpDown className={`w-3.5 h-3.5 ${isDarkHeader ? 'text-white/60 group-hover:text-white' : 'text-slate-500 group-hover:text-slate-900'} opacity-70 group-hover:opacity-100 flex-shrink-0`} />;
  };

  const renderLibSortArrow = (column: string, isDarkHeader: boolean = true) => {
    const isSorted = libSortColumn === column;
    if (isSorted) {
      return libSortDirection === 'asc' ? (
        <ChevronUp className={`w-4 h-4 ${isDarkHeader ? 'text-white' : 'text-slate-900'} font-extrabold flex-shrink-0`} style={{ strokeWidth: 3 }} />
      ) : (
        <ChevronDown className={`w-4 h-4 ${isDarkHeader ? 'text-white' : 'text-slate-900'} font-extrabold flex-shrink-0`} style={{ strokeWidth: 3 }} />
      );
    }
    return <ArrowUpDown className={`w-3.5 h-3.5 ${isDarkHeader ? 'text-white/60 group-hover:text-white' : 'text-slate-500 group-hover:text-slate-900'} opacity-70 group-hover:opacity-100 flex-shrink-0`} />;
  };

  const handleExportDefensesExcel = (dataToExport: ProcessData[]) => {
    const activeCols = defensesColumnOrder.filter((k) => defensesVisibleColumns[k]);
    const labelMap: Record<string, string> = {
      protocolo: 'Nº do Processo',
      defesaDataHora: 'Data e Hora',
      progresso: 'Progresso',
      titulo: 'Título do Trabalho',
      aluno1: 'Aluno 1',
      aluno2: 'Aluno 2',
      orientador: 'Orientador(a)',
      membro1: '1º Membro da Banca',
      membro2: '2º Membro da Banca',
      coorientador: 'Coorientador(a)',
      resumo: 'Resumo do TCC',
      palavrasChave: '5 Palavras-Chave',
      defesaLocal: 'Local da Defesa',
    };

    const colHeaders = activeCols.map((k) => labelMap[k] || k);

    const csvRows = dataToExport.map((proc) => {
      const progress = getProcessProgress(proc);
      const evalMembers = (proc.banca || []).filter(b => b.funcao !== 'ORIENTADOR');

      const getCellVal = (colKey: string): string => {
        switch (colKey) {
          case 'protocolo': return `${proc.protocolo || proc.id}`;
          case 'progresso': return `${progress.percent}% - ${getStepNumberLabel(progress.label)}`;
          case 'titulo': return proc.titulo || '';
          case 'aluno1': {
            const name = proc.aluno1?.nome ? cleanPersonName(proc.aluno1.nome) : '';
            return name ? name : '';
          }
          case 'aluno2': {
            const name = proc.aluno2?.nome ? cleanPersonName(proc.aluno2.nome) : '';
            return name ? name : '';
          }
          case 'orientador': return proc.orientador?.nome ? `${formatProfessorName(proc.orientador.nome)} (${proc.orientador.instituicao || installationProfile.defaultInstitutionName})` : 'A definir';
          case 'membro1': return evalMembers[0] ? `${formatProfessorName(evalMembers[0].nome)} (${evalMembers[0].instituicao || installationProfile.defaultInstitutionName})` : 'A definir';
          case 'membro2': return evalMembers[1] ? `${formatProfessorName(evalMembers[1].nome)} (${evalMembers[1].instituicao || 'Instituição Externa'})` : 'A definir';
          case 'coorientador': return proc.coorientador?.nome ? `${formatProfessorName(proc.coorientador.nome)} (${proc.coorientador.instituicao || 'Instituição Externa'})` : '';
          case 'resumo': return proc.acervo?.resumoSintese || (proc.titulo ? `TCC: ${proc.titulo}` : 'Sem resumo');
          case 'palavrasChave': return (proc.acervo?.palavrasChave || []).slice(0, 5).join('; ');
          case 'defesaDataHora': return proc.defesa?.startAt ? `${formatDateNumeric(proc.defesa.startAt)} ${formatTimeExtenso(proc.defesa.startAt)}` : 'A definir';
          case 'defesaLocal': return proc.defesa?.local || installationProfile.defaultDefenseLocation || 'Local a confirmar';
          default: return '';
        }
      };

      return activeCols.map((k) => `"${getCellVal(k).replace(/"/g, '""')}"`).join(';');
    });

    const csvContent = '\uFEFF' + [colHeaders.join(';'), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Lista_Defesas_TCCs_${installationProfile.courseAcronym}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  const handleLibSort = (column: string) => {
    if (libSortColumn === column) {
      setLibSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setLibSortColumn(column);
      setLibSortDirection('asc');
    }
  };

  const handleExportExcel = (dataToExport: ProcessData[]) => {
    const colHeaders: string[] = [];
    if (visibleColumns.protocolo) colHeaders.push('Nº do Processo');
    if (visibleColumns.progresso) colHeaders.push('Progresso');
    if (visibleColumns.titulo) colHeaders.push('Título do Trabalho');
    if (visibleColumns.aluno1) colHeaders.push('Aluno 1');
    if (visibleColumns.aluno2) colHeaders.push('Aluno 2');
    if (visibleColumns.orientador) colHeaders.push('Orientador(a)');
    if (visibleColumns.membro1) colHeaders.push('1º Membro da Banca');
    if (visibleColumns.membro2) colHeaders.push('2º Membro da Banca');
    if (visibleColumns.coorientador) colHeaders.push('Coorientador(a)');
    if (visibleColumns.resumo) colHeaders.push('Resumo do TCC');
    if (visibleColumns.palavrasChave) colHeaders.push('5 Palavras-Chave');
    if (visibleColumns.defesaDataHora) colHeaders.push('Data e Hora');
    if (visibleColumns.defesaLocal) colHeaders.push('Local da Defesa');

    const csvRows = dataToExport.map((proc) => {
      const row: string[] = [];
      const progress = getProcessProgress(proc);
      const evalMembers = (proc.banca || []).filter(b => b.funcao !== 'ORIENTADOR');

      if (visibleColumns.protocolo) row.push(`"${proc.protocolo || proc.id}"`);
      if (visibleColumns.progresso) row.push(`"${progress.percent}% - ${getStepNumberLabel(progress.label)}"`);
      if (visibleColumns.titulo) row.push(`"${(proc.titulo || '').replace(/"/g, '""')}"`);
      if (visibleColumns.aluno1) {
        const name = proc.aluno1?.nome ? cleanPersonName(proc.aluno1.nome) : '';
        row.push(`"${(name).replace(/"/g, '""')}"`);
      }
      if (visibleColumns.aluno2) {
        const name = proc.aluno2?.nome ? cleanPersonName(proc.aluno2.nome) : '';
        row.push(`"${name ? (name).replace(/"/g, '""') : ''}"`);
      }
      if (visibleColumns.orientador) {
        const orient = proc.orientador?.nome ? `${formatProfessorName(proc.orientador.nome)} (${proc.orientador.instituicao || installationProfile.defaultInstitutionName})` : 'A definir';
        row.push(`"${orient.replace(/"/g, '""')}"`);
      }
      if (visibleColumns.membro1) {
        const ev1 = evalMembers[0] ? `${formatProfessorName(evalMembers[0].nome)} (${evalMembers[0].instituicao || installationProfile.defaultInstitutionName})` : 'A definir';
        row.push(`"${ev1.replace(/"/g, '""')}"`);
      }
      if (visibleColumns.membro2) {
        const ev2 = evalMembers[1] ? `${formatProfessorName(evalMembers[1].nome)} (${evalMembers[1].instituicao || 'Instituição Externa'})` : 'A definir';
        row.push(`"${ev2.replace(/"/g, '""')}"`);
      }
      if (visibleColumns.coorientador) {
        const coorient = proc.coorientador?.nome ? `${formatProfessorName(proc.coorientador.nome)} (${proc.coorientador.instituicao || 'Instituição Externa'})` : '';
        row.push(`"${coorient.replace(/"/g, '""')}"`);
      }
      if (visibleColumns.resumo) {
        const res = proc.acervo?.resumoSintese || (proc.titulo ? `TCC: ${proc.titulo}` : 'Sem resumo');
        row.push(`"${res.replace(/"/g, '""')}"`);
      }
      if (visibleColumns.palavrasChave) {
        const kw = (proc.acervo?.palavrasChave || []).slice(0, 5).join('; ');
        row.push(`"${kw.replace(/"/g, '""')}"`);
      }
      if (visibleColumns.defesaDataHora) {
        const dt = proc.defesa?.startAt ? `${formatDateNumeric(proc.defesa.startAt)} ${formatTimeExtenso(proc.defesa.startAt)}` : 'A definir';
        row.push(`"${dt}"`);
      }
      if (visibleColumns.defesaLocal) row.push(`"${(proc.defesa?.local || installationProfile.defaultDefenseLocation || 'Local a confirmar').replace(/"/g, '""')}"`);

      return row.join(';');
    });

    const csvContent = '\uFEFF' + [colHeaders.join(';'), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Acervo_Repositorio_TCCs_${installationProfile.courseAcronym}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({});

  const toggleExpandItem = (id: string) => {
    setExpandedItemIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Tutorial specific state
  const [tutorialRoleTab, setTutorialRoleTab] = useState<'discente' | 'orientador' | 'banca' | 'coordenacao'>('discente');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Collapsible states for main sections (calendar always open, other lists default to collapsed/false)
  const [isCalendarExpanded, setIsCalendarExpanded] = useState<boolean>(true);
  const [isListExpanded, setIsListExpanded] = useState<boolean>(false);

  // Month navigation for formal calendar grid
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); }); // Always open on the user's current month
  const [selectedFilterMonth, setSelectedFilterMonth] = useState<number | 'all'>('all'); // Show all months by default in lists
  const [selectedFilterYear, setSelectedFilterYear] = useState<number | 'all'>('all'); // Show all years by default in lists
  const [selectedDayDefenses, setSelectedDayDefenses] = useState<ProcessData[] | null>(null);
  const [selectedDayGcalEvents, setSelectedDayGcalEvents] = useState<any[] | null>(null);
  // Excel-style column sorting and filtering states
  const [sortColumn, setSortColumn] = useState<'date' | 'title' | 'student' | 'orientador' | 'progress' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: 'date' | 'title' | 'student' | 'orientador' | 'progress') => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isRefreshingData, setIsRefreshingData] = useState(false);

  const refreshData = async () => {
    setIsRefreshingData(true);
    try {
      const [procData, gcalData] = await Promise.all([
        apiClient.getProcesses(),
        apiClient.getGoogleCalendarEvents().catch(() => [])
      ]);
      setProcesses(procData);
      setGoogleEvents(gcalData || []);
    } catch (err) {
      console.error('Erro ao atualizar dados:', err);
    } finally {
      setTimeout(() => {
        setIsRefreshingData(false);
      }, 500);
    }
  };

  const handleCloseDetails = () => {
    setSelectedProcessDetails(null);
    refreshData();
  };

  useEffect(() => {
    Promise.all([
      apiClient.getProcesses(),
      apiClient.getGoogleCalendarEvents().catch(() => [])
    ]).then(([procData, gcalData]) => {
      setProcesses(procData);
      setGoogleEvents(gcalData || []);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedProcessDetails) {
      setIsLoadingDocs(true);
      apiClient.getProcessDocuments(selectedProcessDetails.id)
        .then((docs) => {
          setSelectedProcessDocs(docs);
        })
        .catch((err) => {
          console.error('Error fetching process documents', err);
          setSelectedProcessDocs([]);
        })
        .finally(() => {
          setIsLoadingDocs(false);
        });
    } else {
      setSelectedProcessDocs([]);
    }
  }, [selectedProcessDetails]);

  const filteredProcesses = processes.filter((proc) => {
    const term = searchTerm.toLowerCase();
    const students = formatStudentsString(proc.aluno1, proc.aluno2).toLowerCase();
    const orientador = (proc.orientador?.nome || '').toLowerCase();
    const title = (proc.titulo || '').toLowerCase();
    const protocol = (proc.protocolo || '').toLowerCase();
    return (
      title.includes(term) ||
      students.includes(term) ||
      orientador.includes(term) ||
      protocol.includes(term)
    );
  });

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginWorking(true);setLoginMessage('');
    try {
      const emailToUse=loginEmailInput.trim().toLowerCase();
      if(loginStep==='email'){
        await apiClient.requestLoginCode(emailToUse);
        setLoginStep('code');setLoginMessage('Código enviado. Consulte seu e-mail; ele expira em 10 minutos.');
        return;
      }
      const session=await apiClient.verifyLoginCode(emailToUse,loginCodeInput);
      await switchUser(emailToUse);
      setShowLoginModal(false);
      setLoginStep('email');setLoginCodeInput('');setLoginMessage('');
      if (session.globalRoles?.length) {
        onNavigate('coordenador');
      } else {
        onNavigate('meus-processos');
      }
    } catch (error) {
      setLoginMessage(error instanceof Error?error.message:'Não foi possível concluir o acesso.');
    } finally {setLoginWorking(false);}
  };

  // Calendar Grid Generation Logic
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNamesPt = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handlePrevMonth = () => {
    const currentYear = selectedFilterYear === 'all' ? currentCalendarDate.getFullYear() : selectedFilterYear;
    const currentMonth = selectedFilterMonth === 'all' ? currentCalendarDate.getMonth() : selectedFilterMonth;
    const prevDate = new Date(currentYear, currentMonth - 1, 1);
    setCurrentCalendarDate(prevDate);
    setSelectedFilterYear(prevDate.getFullYear());
    setSelectedFilterMonth(prevDate.getMonth());
    setSelectedDayDefenses(null);
    setSelectedDayGcalEvents(null);
  };

  const handleNextMonth = () => {
    const currentYear = selectedFilterYear === 'all' ? currentCalendarDate.getFullYear() : selectedFilterYear;
    const currentMonth = selectedFilterMonth === 'all' ? currentCalendarDate.getMonth() : selectedFilterMonth;
    const nextDate = new Date(currentYear, currentMonth + 1, 1);
    setCurrentCalendarDate(nextDate);
    setSelectedFilterYear(nextDate.getFullYear());
    setSelectedFilterMonth(nextDate.getMonth());
    setSelectedDayDefenses(null);
    setSelectedDayGcalEvents(null);
  };

  const handleGoToToday = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), 1);
    setCurrentCalendarDate(today);
    setSelectedFilterYear(today.getFullYear());
    setSelectedFilterMonth(today.getMonth());
    setSelectedDayDefenses(null);
    setSelectedDayGcalEvents(null);
  };

  // For a given day, find both processes (defenses) AND google calendar events
  const getEventsForDate = (dayNum: number) => {
    const dayDefenses = filteredProcesses.filter((proc) => {
      if (!proc.defesa?.startAt) return false;
      const d = new Date(proc.defesa.startAt);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === dayNum;
    });

    const dayGcal = googleEvents.filter((ev) => {
      if (!ev.start) return false;
      const d = new Date(ev.start);
      if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== dayNum) return false;

      // Exclude if it duplicates a defense already in dayDefenses
      const isDuplicate = dayDefenses.some((proc) => {
        const student = formatStudentsString(proc.aluno1, proc.aluno2).toLowerCase();
        const title = (proc.titulo || '').toLowerCase();
        const evSum = (ev.summary || '').toLowerCase();
        const evDesc = (ev.description || '').toLowerCase();
        return (
          ev.id === `gcal-${proc.id}` ||
          (student && evSum.includes(student)) ||
          (title && (evSum.includes(title) || evDesc.includes(title)))
        );
      });
      return !isDuplicate;
    });

    return {
      defenses: dayDefenses,
      gcal: dayGcal,
      total: dayDefenses.length + dayGcal.length
    };
  };

  const handleGoogleCalendarSync = async () => {
    setIsSyncingCalendar(true);
    setSyncStatus('Sincronizando pelo servidor seguro...');
    try {
      const result=await apiClient.syncGoogleWorkspaceCalendar();setGoogleEvents(result.events);
      setSyncStatus(`Sincronizado: ${result.events.length} evento(s), ${result.created} novo(s).`);
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (error: any) {
      console.error(error);
      setSyncStatus(`Erro: ${error.message || 'Falha na sincronização'}`);
      setTimeout(() => setSyncStatus(null), 5000);
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  return (
    <div id="home-page-container" className="space-y-4 max-w-7xl mx-auto py-1 sm:py-2">
      
      {/* PUBLIC TAB 1: CALENDÁRIO */}
      {publicTab === 'calendario' && (
        <>
          {/* View Mode 1: FORMAL MONTHLY CALENDAR GRID */}
      {viewMode === 'calendar' && (
        <section id="formal-monthly-calendar-section" className="relative">
          {/* UNIFIED HEADER CARD FOR CALENDAR - SYNCHRONIZED WITH DEFENSES PALETTE */}
          {(() => {
            const defStyles = getTableStyles(defensesTextFormat);
            return (
              <div className={`bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden ${defStyles.fontFamilyClass}`} style={defStyles.rootStyle}>
                {/* TOP HEADER BAR (Synchronized palette) */}
                <div className={`${defStyles.calendarBannerClass} px-3 sm:px-4 py-2 sm:py-2.5 border-b transition-colors`} style={defStyles.bannerHeaderStyle}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <ColorfulHeaderIcon type="calendar" textFormat={defensesTextFormat} />
                          <h1 className="text-base sm:text-lg font-black uppercase tracking-tight leading-snug">
                            Calendário de Defesas — {monthNamesPt[month]} de {year}
                          </h1>
                        </div>
                      </div>

                      {/* Month Navigation: Popup Calendar / Seta Esquerda / Hoje / Seta Direita */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {/* Month & Year Popup Selector Button */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setPickerYear(year);
                              setShowMonthPickerPopup(!showMonthPickerPopup);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1 ${defStyles.calendarNavBtnClass} text-[10px] sm:text-[11px] font-extrabold uppercase rounded-full outline-none cursor-pointer h-7.5 shadow-2xs transition-all shrink-0`}
                            title="Selecionar Mês e Ano"
                          >
                            <CalendarIcon className="w-3.5 h-3.5 opacity-80 shrink-0" />
                            <span>{monthNamesPt[month]} de {year}</span>
                            <ChevronDown className="w-3.5 h-3.5 opacity-80 shrink-0" />
                          </button>

                          {showMonthPickerPopup && (
                            <>
                              {/* Click outside backdrop */}
                              <div 
                                className="fixed inset-0 z-40" 
                                onClick={() => setShowMonthPickerPopup(false)} 
                              />
                              {/* Popover Card */}
                              <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 z-50 bg-white border border-slate-300 rounded-xl shadow-2xl p-3.5 w-64 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                                {/* Year Navigator Header */}
                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                                  <button
                                    type="button"
                                    onClick={() => setPickerYear(prev => prev - 1)}
                                    className="p-1 rounded hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                                    title="Ano Anterior"
                                  >
                                    <ChevronLeft className="w-4 h-4" />
                                  </button>
                                  <span className="font-black text-sm text-slate-900 tracking-tight">
                                    {pickerYear}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setPickerYear(prev => prev + 1)}
                                    className="p-1 rounded hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                                    title="Próximo Ano"
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* 12 Months Grid */}
                                <div className="grid grid-cols-3 gap-1.5">
                                  {monthNamesPt.map((mName, mIdx) => {
                                    const isSelected = year === pickerYear && month === mIdx;
                                    return (
                                      <button
                                        key={mIdx}
                                        type="button"
                                        onClick={() => {
                                          const newD = new Date(pickerYear, mIdx, 1);
                                          setCurrentCalendarDate(newD);
                                          setSelectedFilterMonth(mIdx);
                                          setSelectedFilterYear(pickerYear);
                                          setShowMonthPickerPopup(false);
                                        }}
                                        className={`px-2 py-2 rounded-lg text-[11px] font-black transition-all text-center cursor-pointer ${
                                          isSelected
                                            ? 'bg-slate-200 text-slate-900 border-slate-400 ring-2 ring-slate-400 font-black shadow-xs'
                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold'
                                        }`}
                                      >
                                        {mName.slice(0, 3)}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Previous Month */}
                        <button
                          type="button"
                          onClick={handlePrevMonth}
                          className={`flex items-center justify-center ${defStyles.calendarNavBtnClass} rounded-full cursor-pointer transition-all shadow-2xs h-7.5 w-7.5 shrink-0`}
                          title="Mês Anterior"
                        >
                          <ChevronLeft className="w-4 h-4 opacity-80" />
                        </button>

                        {/* Today Button */}
                        <button
                          type="button"
                          onClick={handleGoToToday}
                          className={`px-3 ${defStyles.calendarNavBtnClass} text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider rounded-full cursor-pointer transition-all h-7.5 shadow-2xs shrink-0`}
                          title="Ir para o mês atual"
                        >
                          Hoje
                        </button>

                        {/* Next Month */}
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className={`flex items-center justify-center ${defStyles.calendarNavBtnClass} rounded-full cursor-pointer transition-all shadow-2xs h-7.5 w-7.5 shrink-0`}
                          title="Próximo Mês"
                        >
                          <ChevronRight className="w-4 h-4 opacity-80" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {isCalendarExpanded && (
                    <div>
                      <div className="overflow-x-auto">
                        <div className="min-w-[720px] md:min-w-0">
                          {/* Calendar Days Header with synchronized palette */}
                          <div className={`${defStyles.calendarDaysHeaderClass} py-2.5 px-4 sm:px-6 select-none`} style={defStyles.bannerHeaderStyle}>
                            <div className="grid grid-cols-[0.5fr_1.1fr_1.1fr_1.1fr_1.1fr_1.1fr_0.5fr] text-center font-black text-[11px] uppercase tracking-wider">
                              <div>DOM</div>
                              <div>SEG</div>
                              <div>TER</div>
                              <div>QUA</div>
                              <div>QUI</div>
                              <div>SEX</div>
                              <div>SÁB</div>
                            </div>
                          </div>

                          <div className="px-4 pb-4 pt-2.5 sm:px-6 sm:pb-6 sm:pt-3.5 space-y-6">
            {/* Calendar Days Cells Grid */}
            <div className="grid grid-cols-[0.5fr_1.1fr_1.1fr_1.1fr_1.1fr_1.1fr_0.5fr] border-l border-t border-slate-200 min-h-[300px]">
              {/* Empty cells before first day */}
              {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
                <div key={`empty-lead-${idx}`} className="portal-calendar-empty-cell border-r border-b border-slate-200 bg-slate-50/20 h-16 sm:h-20" />
              ))}

              {/* Days of current month */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const { defenses: dayDefenses, gcal: dayGcal, total: totalEvents } = getEventsForDate(dayNum);
                const hasEvents = totalEvents > 0;

                const dateObj = new Date(year, month, dayNum);
                const cellIndex = firstDayOfMonth + idx;
                const rowIndex = Math.floor(cellIndex / 7);
                const colIndex = cellIndex % 7;
                const isWeekend = colIndex === 0 || colIndex === 6;
                const isTopHalf = rowIndex <= 2;

                const today = new Date();
                const isToday = today.getDate() === dayNum && today.getMonth() === month && today.getFullYear() === year;

                const todayMidnight = new Date();
                todayMidnight.setHours(0, 0, 0, 0);
                const isPastDay = dateObj.getTime() < todayMidnight.getTime();

                return (
                  <div
                    key={`day-${dayNum}`}
                    onClick={() => {
                      if (hasEvents && !isWeekend) {
                        setSelectedDayDefenses(dayDefenses.length > 0 ? dayDefenses : null);
                        setSelectedDayGcalEvents(dayGcal.length > 0 ? dayGcal : null);
                      }
                    }}
                    aria-disabled={isWeekend ? true : undefined}
                    className={`portal-calendar-day-cell border-r border-b border-slate-200 p-2 flex flex-col justify-between transition-all duration-150 relative group select-none ${
                      isWeekend
                        ? 'portal-core-calendar-weekend bg-slate-100/75 border-slate-200 cursor-default h-16 sm:h-20 text-slate-400'
                        : hasEvents
                          ? 'bg-slate-100/80 border-slate-300 cursor-pointer h-16 sm:h-20 shadow-2xs active:scale-[0.98]'
                          : 'bg-white border-slate-200 cursor-default h-16 sm:h-20'
                    }`}
                    title={isWeekend ? 'Fim de semana — indisponível para defesas' : hasEvents ? `Clique para abrir as ${totalEvents} defesas do dia ${dayNum}` : undefined}
                  >
                    {/* Day Number and State */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded-2xs ${
                          isToday
                            ? 'bg-slate-800 text-white shadow-2xs'
                            : hasEvents
                              ? isPastDay
                                ? 'text-slate-500 bg-slate-200 font-extrabold'
                                : 'text-slate-900 bg-slate-200/80 font-extrabold'
                              : 'text-slate-700 font-bold'
                        }`}
                      >
                        {dayNum}
                      </span>
                    </div>

                    {/* Small Count Indicator centered in the cell */}
                    {hasEvents && (
                      <div className="flex-1 flex items-center justify-center w-full">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-xs text-center shadow-xs border ${
                          isPastDay
                            ? 'text-slate-500 bg-slate-200/80 border-slate-300'
                            : 'text-slate-900 bg-slate-200 border-slate-300'
                        }`}>
                          {totalEvents} {totalEvents === 1 ? 'DEFESA' : 'DEFESAS'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Empty cells after last day to complete week grid */}
              {Array.from({ length: (7 - ((firstDayOfMonth + daysInMonth) % 7)) % 7 }).map((_, idx) => (
                <div key={`empty-trail-${idx}`} className="portal-calendar-empty-cell border-r border-b border-slate-200 bg-slate-50/20 h-16 sm:h-20" />
              ))}
            </div>

            {/* Modal Popup for Selected Day Defenses (Opens on Day Click: synchronized with site theme, standard header, colors & formatting) */}
            {(selectedDayDefenses || selectedDayGcalEvents) && (() => {
              const totalSelectedEvents = (selectedDayDefenses?.length || 0) + (selectedDayGcalEvents?.length || 0);
              
              // Max width adjusted for 2 columns max side-by-side
              const modalMaxWidthClass = totalSelectedEvents >= 2
                ? 'max-w-4xl w-full' 
                : 'max-w-xl w-full';

              const popupIsCustomHeader = calendarPopupFormat.headerThemeMode === 'custom';
              const popupHeaderBg = popupIsCustomHeader && calendarPopupFormat.headerBgColor ? calendarPopupFormat.headerBgColor : undefined;
              const popupHeaderTextColor = popupIsCustomHeader && calendarPopupFormat.headerTextColor ? calendarPopupFormat.headerTextColor : undefined;
              const isDarkHeader = popupIsCustomHeader ? (popupHeaderTextColor === '#ffffff' || !popupHeaderTextColor) : (defStyles.isDark !== false);

              const gridColsClass =
                calendarPopupFormat.columnsLayout === '1'
                  ? 'grid-cols-1 gap-4'
                  : calendarPopupFormat.columnsLayout === '2'
                  ? 'grid-cols-1 md:grid-cols-2 gap-4'
                  : totalSelectedEvents >= 2
                  ? 'grid-cols-1 md:grid-cols-2 gap-4'
                  : 'grid-cols-1 gap-4';

              const cardPaddingClass =
                calendarPopupFormat.cardPadding === 'compact'
                  ? 'p-3'
                  : calendarPopupFormat.cardPadding === 'spacious'
                  ? 'p-6'
                  : 'p-4 sm:p-5';
              const cardRadiusClass = calendarPopupFormat.cardBorderRadius || 'rounded-xl';
              const cardGapClass = 'space-y-3.5';

              const cardShadowClass =
                calendarPopupFormat.cardShadow === 'none'
                  ? 'shadow-none'
                  : calendarPopupFormat.cardShadow === 'medium'
                  ? 'shadow-md'
                  : calendarPopupFormat.cardShadow === 'prominent'
                  ? 'shadow-lg'
                  : 'shadow-xs';

              const cardBorderClass =
                calendarPopupFormat.cardBorderWidth === 'none'
                  ? 'border-0'
                  : calendarPopupFormat.cardBorderWidth === 'medium'
                  ? 'border-2'
                  : calendarPopupFormat.cardBorderWidth === 'thick'
                  ? 'border-3'
                  : 'border';

              const cardTitleSizeClass =
                calendarPopupFormat.cardTitleSize === 'xs'
                  ? 'text-xs'
                  : calendarPopupFormat.cardTitleSize === 'base'
                  ? 'text-sm sm:text-base'
                  : calendarPopupFormat.cardTitleSize === 'lg'
                  ? 'text-base sm:text-lg'
                  : 'text-xs sm:text-sm';

              const cardTitleWeightClass =
                calendarPopupFormat.cardTitleWeight === 'normal'
                  ? 'font-normal'
                  : calendarPopupFormat.cardTitleWeight === 'semibold'
                  ? 'font-semibold'
                  : calendarPopupFormat.cardTitleWeight === 'bold'
                  ? 'font-bold'
                  : 'font-black';

              const progressHeightClass =
                calendarPopupFormat.progressBarHeight === 'thin'
                  ? 'h-1'
                  : calendarPopupFormat.progressBarHeight === 'thick'
                  ? 'h-2.5'
                  : calendarPopupFormat.progressBarHeight === 'extra'
                  ? 'h-3.5'
                  : 'h-1.5';

              const headerCustomStyle = popupIsCustomHeader
                ? {
                    backgroundColor: popupHeaderBg,
                    color: popupHeaderTextColor,
                    borderColor: 'rgba(0,0,0,0.15)',
                  }
                : defStyles.bannerHeaderStyle;

              return (
                <div
                  id="day-defenses-modal"
                  className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-[999999] p-3 sm:p-5 animate-in fade-in duration-150"
                  onClick={() => {
                    setSelectedDayDefenses(null);
                    setSelectedDayGcalEvents(null);
                  }}
                >
                  <div
                    className={`bg-white rounded-2xl border border-slate-300 ${modalMaxWidthClass} max-h-[88vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 ${defStyles.fontFamilyClass}`}
                    style={defStyles.rootStyle}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Modal Header synchronized with the table/calendar theme */}
                    <div 
                      className={`${popupIsCustomHeader ? '' : defStyles.bannerHeaderClass} p-3.5 sm:p-4.5 flex items-center justify-between border-b transition-colors shrink-0`}
                      style={headerCustomStyle}
                    >
                      <div className="flex items-center gap-3">
                        <ColorfulHeaderIcon type="calendar" textFormat={defensesTextFormat} />
                        <div>
                          <span className={`text-[10px] font-black uppercase tracking-widest block opacity-85 ${isDarkHeader ? 'text-white/80' : 'text-slate-700'}`}>
                            {calendarPopupFormat.headerCustomTitle || 'Agenda de Defesas de TCC'}
                          </span>
                          <h3 className={`font-black text-sm sm:text-base uppercase tracking-tight flex items-center gap-2 mt-0.5 ${isDarkHeader ? 'text-white' : 'text-slate-900'}`}>
                            <span>
                              {selectedDayDefenses && selectedDayDefenses.length > 0
                                ? `Defesas em ${formatDatePt(selectedDayDefenses[0].defesa?.startAt)}`
                                : selectedDayGcalEvents && selectedDayGcalEvents.length > 0
                                  ? `Defesas em ${formatDatePt(selectedDayGcalEvents[0].start)}`
                                  : 'Defesas do Dia'}
                            </span>
                            <span className={`text-[10px] sm:text-[10.5px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wide border ${
                              isDarkHeader 
                                ? 'bg-black/30 text-white border-white/20' 
                                : 'bg-slate-200 text-slate-800 border-slate-300'
                            }`}>
                              {totalSelectedEvents} {totalSelectedEvents === 1 ? 'APRESENTAÇÃO' : 'APRESENTAÇÕES'}
                            </span>
                          </h3>
                        </div>
                      </div>

                      {/* Header Actions: Close button */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDayDefenses(null);
                            setSelectedDayGcalEvents(null);
                          }}
                          className={`p-2 rounded-xl transition-all cursor-pointer border ${
                            isDarkHeader 
                              ? 'text-white/80 hover:text-white bg-black/25 hover:bg-black/45 border-white/15' 
                              : 'text-slate-700 hover:text-slate-950 bg-white/70 hover:bg-white border-slate-300'
                          }`}
                          title="Fechar visualização"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Modal Body with vertical scroll */}
                    <div 
                      className="p-4 sm:p-5 overflow-y-auto custom-scrollbar space-y-4 flex-1 max-h-[calc(88vh-80px)] transition-colors"
                      style={{ backgroundColor: calendarPopupFormat.modalBgColor || '#f1f5f9' }}
                    >
                      {selectedDayDefenses && selectedDayDefenses.length > 0 && (
                        <div className="space-y-3">
                          <div className={`grid ${gridColsClass}`}>
                            {selectedDayDefenses.map((proc) => {
                              const progress = getProcessProgress(proc);
                              const showTopRow = calendarPopupFormat.showTime !== false || (calendarPopupFormat.showLocation !== false && proc.defesa?.local) || calendarPopupFormat.showProtocol !== false;
                              const showDetails = calendarPopupFormat.showStudents !== false || calendarPopupFormat.showAdvisor !== false || (calendarPopupFormat.showCoAdvisor !== false && proc.coorientador) || (calendarPopupFormat.showCommittee !== false && proc.banca && proc.banca.length > 0);

                              return (
                                <div
                                  key={proc.id}
                                  onClick={() => {
                                    setSelectedDayDefenses(null);
                                    setSelectedDayGcalEvents(null);
                                    setSelectedProcessDetails(proc);
                                  }}
                                  className={`text-slate-900 ${cardPaddingClass} ${cardRadiusClass} ${cardBorderClass} ${cardGapClass} ${cardShadowClass} hover:shadow-md cursor-pointer transition-all group flex flex-col`}
                                  style={{
                                    backgroundColor: calendarPopupFormat.cardBgColor || '#ffffff',
                                    borderColor: calendarPopupFormat.cardBorderColor || '#cbd5e1',
                                  }}
                                  title="Clique para abrir todas as configurações e ficha do TCC"
                                >
                                  {/* Header: Time & Protocol */}
                                  {showTopRow && (
                                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 text-xs">
                                      {calendarPopupFormat.showTime !== false ? (
                                        <div 
                                          className="flex items-center gap-1.5 font-black"
                                          style={{ color: calendarPopupFormat.timeTextColor || '#065f46' }}
                                        >
                                          <Clock className="w-4 h-4 shrink-0" />
                                          <span>{getStartAndEndTime(proc.defesa?.startAt)}</span>
                                        </div>
                                      ) : <div />}
                                      <div className="flex items-center gap-2">
                                        {calendarPopupFormat.showLocation !== false && proc.defesa?.local && (
                                          <span className="text-[10.5px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[140px]" title={proc.defesa.local}>
                                            📍 {proc.defesa.local}
                                          </span>
                                        )}
                                        {calendarPopupFormat.showProtocol !== false && (
                                          <span 
                                            className="font-mono font-bold px-2 py-0.5 rounded-md border border-slate-250 text-[10px]"
                                            style={{
                                              backgroundColor: calendarPopupFormat.protocolBadgeBg || '#f1f5f9',
                                              color: calendarPopupFormat.protocolBadgeText || '#1e293b'
                                            }}
                                          >
                                            {proc.protocolo}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Card Title */}
                                  {calendarPopupFormat.showTitle !== false && (
                                    <h4 
                                      className={`${cardTitleWeightClass} leading-snug ${cardTitleSizeClass} ${
                                        calendarPopupFormat.cardTitleUppercase !== false ? 'uppercase' : ''
                                      }`}
                                      style={{ color: calendarPopupFormat.cardTitleColor || '#0f172a' }}
                                    >
                                      {formatTccTitle(proc.titulo)}
                                    </h4>
                                  )}

                                  {/* Students & Professors Details */}
                                  {showDetails && (
                                    <div 
                                      className="text-xs text-slate-700 space-y-2 p-3 rounded-lg border border-slate-200 flex-1 flex flex-col justify-center"
                                      style={{ backgroundColor: calendarPopupFormat.cardInnerBgColor || '#f8fafc' }}
                                    >
                                      {calendarPopupFormat.showStudents !== false && (
                                        <div>
                                          <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block mb-0.5">
                                            {calendarPopupFormat.studentLabel || (proc.aluno2 ? 'Discentes Apresentadores:' : 'Discente Apresentador:')}
                                          </span>
                                          <StudentNames 
                                            aluno1={proc.aluno1} 
                                            aluno2={proc.aluno2} 
                                            align="left" 
                                            itemClassName="text-xs font-black text-slate-900" 
                                            showMatricula={calendarPopupFormat.showStudentRegistration !== false}
                                          />
                                        </div>
                                      )}
                                      {calendarPopupFormat.showAdvisor !== false && (
                                        <div>
                                          <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block">
                                            {calendarPopupFormat.advisorLabel || 'Orientador(a):'}
                                          </span>
                                          <span className="font-bold text-slate-900">{formatProfessorName(proc.orientador?.nome)}</span>
                                          {calendarPopupFormat.showAdvisorInstitution !== false && (
                                            <span className="text-[10px] text-slate-500 font-mono font-normal ml-1">({proc.orientador?.instituicao || installationProfile.defaultInstitutionName})</span>
                                          )}
                                        </div>
                                      )}
                                      {calendarPopupFormat.showCoAdvisor !== false && proc.coorientador && (
                                        <div>
                                          <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block">
                                            {calendarPopupFormat.coAdvisorLabel || 'Coorientador(a):'}
                                          </span>
                                          <span className="font-bold text-slate-900">{formatProfessorName(proc.coorientador.nome)}</span>
                                          {calendarPopupFormat.showAdvisorInstitution !== false && (
                                            <span className="text-[10px] text-slate-500 font-mono font-normal ml-1">({proc.coorientador.instituicao || installationProfile.defaultInstitutionName})</span>
                                          )}
                                        </div>
                                      )}
                                      {calendarPopupFormat.showCommittee !== false && proc.banca && proc.banca.filter(b => b.funcao !== 'ORIENTADOR').length > 0 && (
                                        <div>
                                          <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block">
                                            {calendarPopupFormat.committeeLabel || 'Banca Examinadora:'}
                                          </span>
                                          <div className="space-y-0.5 mt-0.5">
                                            {proc.banca.filter(b => b.funcao !== 'ORIENTADOR').map((b, idx) => (
                                              <div key={idx} className="text-[11px] text-slate-800">
                                                • {formatProfessorName(b.nome)} {calendarPopupFormat.showCommitteeInstitution !== false && (
                                                  <span className="text-[10px] text-slate-500 font-mono">({b.instituicao || (b.membroTipo === 'EXTERNO' ? 'Instituição externa' : installationProfile.defaultInstitutionName)})</span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Progress Indicator */}
                                  {calendarPopupFormat.showProgressBar !== false && (
                                    <div className="space-y-1 pt-2 border-t border-slate-100">
                                      {calendarPopupFormat.showProgressPercent !== false && (
                                        <div className="flex items-center justify-between text-[9.5px] font-semibold text-slate-600 uppercase">
                                          <span>{progress.label}</span>
                                          <span className="text-slate-900 font-mono font-bold">{progress.percent}%</span>
                                        </div>
                                      )}
                                      <div 
                                        className={`w-full ${progressHeightClass} rounded-full overflow-hidden`}
                                        style={{ backgroundColor: calendarPopupFormat.progressBarTrackColor || '#e2e8f0' }}
                                      >
                                        <div 
                                          className={`${progressHeightClass} rounded-full transition-all duration-300 ${
                                            calendarPopupFormat.progressBarColorMode === 'custom' ? '' : progress.color
                                          } ${calendarPopupFormat.progressBarGlow ? 'shadow-[0_0_8px_rgba(16,185,129,0.7)]' : ''}`} 
                                          style={{ 
                                            width: `${progress.percent}%`,
                                            backgroundColor: calendarPopupFormat.progressBarColorMode === 'custom' ? (calendarPopupFormat.progressBarCustomColor || '#10b981') : undefined
                                          }} 
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {selectedDayGcalEvents && selectedDayGcalEvents.length > 0 && (
                        <div className="space-y-3 pt-4 border-t border-slate-300">
                          <div className={`grid ${gridColsClass}`}>
                            {selectedDayGcalEvents.map((ev) => {
                              const parsed = parseGcalEvent(ev);
                              const matchedProc = processes.find(p => p.id === ev.id.replace('gcal-', '') || p.protocolo === ev.id || (p.titulo && parsed.trabalho && p.titulo.toLowerCase().includes(parsed.trabalho.toLowerCase().slice(0, 15))));
                              return (
                                <div
                                  key={ev.id}
                                  onClick={() => {
                                    if (matchedProc) {
                                      setSelectedDayDefenses(null);
                                      setSelectedDayGcalEvents(null);
                                      setSelectedProcessDetails(matchedProc);
                                    }
                                  }}
                                  className={`text-slate-900 ${cardPaddingClass} ${cardRadiusClass} border ${cardGapClass} shadow-xs ${matchedProc ? 'hover:border-slate-500 hover:shadow-md cursor-pointer transition-all group' : ''} flex flex-col`}
                                  style={{
                                    backgroundColor: calendarPopupFormat.cardBgColor || '#ffffff',
                                    borderColor: calendarPopupFormat.cardBorderColor || '#cbd5e1',
                                  }}
                                  title={matchedProc ? 'Clique para abrir todas as configurações e ficha do TCC' : 'Evento do Google Calendar'}
                                >
                                  {/* Header: Time & Google Calendar */}
                                  {(calendarPopupFormat.showTime !== false || calendarPopupFormat.showLocation !== false || calendarPopupFormat.showProtocol !== false) && (
                                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 text-xs">
                                      {calendarPopupFormat.showTime !== false ? (
                                        <div className="flex items-center gap-1.5 font-black text-slate-900">
                                          <Clock className="w-4 h-4 text-slate-600 shrink-0" />
                                          <span>{parsed.time}</span>
                                        </div>
                                      ) : <div />}
                                      <div className="flex items-center gap-2">
                                        {calendarPopupFormat.showLocation !== false && (ev.location || ev.local) && (
                                          <span className="text-[10.5px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[140px]" title={ev.location || ev.local}>
                                            📍 {ev.location || ev.local}
                                          </span>
                                        )}
                                        {calendarPopupFormat.showProtocol !== false && (
                                          <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-250 text-[10px]">
                                            Google Calendar
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Card Title */}
                                  {calendarPopupFormat.showTitle !== false && (
                                    <h4 
                                      className={`font-extrabold leading-snug ${
                                        calendarPopupFormat.cardTitleSize === 'xs'
                                          ? 'text-xs'
                                          : calendarPopupFormat.cardTitleSize === 'base'
                                          ? 'text-sm sm:text-base'
                                          : 'text-xs sm:text-sm'
                                      } ${calendarPopupFormat.cardTitleUppercase ? 'uppercase' : ''}`}
                                      style={{ color: calendarPopupFormat.cardTitleColor || '#0f172a' }}
                                    >
                                      {formatTccTitle(parsed.trabalho)}
                                    </h4>
                                  )}

                                  {/* Card Body */}
                                  {(calendarPopupFormat.showStudents !== false || calendarPopupFormat.showAdvisor !== false || calendarPopupFormat.showCoAdvisor !== false) && (
                                    <div 
                                      className="text-xs text-slate-700 space-y-2 p-3 rounded-lg border border-slate-200 flex-1 flex flex-col justify-center"
                                      style={{ backgroundColor: calendarPopupFormat.cardInnerBgColor || '#f8fafc' }}
                                    >
                                      {calendarPopupFormat.showStudents !== false && (
                                        <div>
                                          <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block mb-0.5">Discente(s) Apresentador(es):</span>
                                          <GcalStudentNames alunoStr={parsed.aluno} align="left" itemClassName="text-xs font-black text-slate-900" />
                                        </div>
                                      )}
                                      {calendarPopupFormat.showAdvisor !== false && (
                                        <div>
                                          <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block">Orientador(a):</span>
                                          <span className="font-bold text-slate-900">{formatProfessorName(parsed.orientador)}</span>
                                        </div>
                                      )}
                                      {calendarPopupFormat.showCoAdvisor !== false && parsed.coorientador && (
                                        <div>
                                          <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider block">Coorientador(a):</span>
                                          <span className="font-bold text-slate-900">{formatProfessorName(parsed.coorientador)}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  })()}
</section>
)}

      {/* LIST OF DEFENSES TABLE (Always visible right below calendar) */}
      <section id="public-calendar-cards-section" className="space-y-3 mt-6">
        {/* UNIFIED GRAY HEADER + SPREADSHEET CARD */}
        <div className={`bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden ${getTableStyles(defensesTextFormat).fontFamilyClass}`} style={getTableStyles(defensesTextFormat).rootStyle}>
          {(() => {
            const defStyles = getTableStyles(defensesTextFormat);
            return (
              <div className={`${defStyles.bannerHeaderClass} border-b transition-colors`} style={defStyles.bannerHeaderStyle}>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-2 text-center sm:flex-row sm:px-4 sm:py-2.5 sm:text-left">
                  <div className="flex items-center gap-2">
                    <ColorfulHeaderIcon type="list" textFormat={defensesTextFormat} />
                    <h2 className="text-base sm:text-lg font-black uppercase tracking-tight">
                      {getEditableTableText(defensesCustomLabels, '__tableTitle', `Lista de Defesas — ${monthNamesPt[month]} de ${year}`)}
                    </h2>
                  </div>

                    {/* Right Group: Lupa, Refresh, Editar Popup and Engrenagem Controls */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {/* Lupa (Search) */}
                    <SearchPopover
                      value={defensesSearch}
                      onChange={setDefensesSearch}
                      placeholder={defensesTextFormat?.searchButtonText || "Buscar defesas..."}
                      textFormat={defensesTextFormat}
                    />

                    {/* Refresh Button (Customizable Emoji / YinYang) */}
                    <button
                      type="button"
                      onClick={refreshData}
                      disabled={isRefreshingData}
                      className={`${defStyles.toolbarButtonClass} disabled:opacity-70`}
                      style={defStyles.toolbarButtonStyle}
                      title="Atualizar dados da tabela"
                    >
                      {defensesTextFormat?.refreshButtonEmoji && defensesTextFormat.refreshButtonEmoji !== '🔄' && defensesTextFormat.refreshButtonEmoji !== '☯️' ? (
                        <span className={`text-xs ${isRefreshingData ? 'animate-spin' : ''}`}>
                          {defensesTextFormat.refreshButtonEmoji}
                        </span>
                      ) : (
                        <YinYangIcon className={`w-3.5 h-3.5 text-current ${isRefreshingData ? 'animate-spin' : ''}`} />
                      )}
                    </button>

                    {/* Engrenagem (Settings) */}
                    <HeaderSettingsPopover
                      recordsLimit={defensesRecordsLimit}
                      setRecordsLimit={setDefensesRecordsLimit}
                      allowedLimits={[25, 50, 100, 'all']}
                      allColumns={ALL_DEFENSES_COLUMNS}
                      visibleColumns={defensesVisibleColumns}
                      setVisibleColumns={setDefensesVisibleColumns}
                      columnOrder={defensesColumnOrder}
                      setColumnOrder={setDefensesColumnOrder}
                      storageKey="defenses"
                      customLabels={defensesCustomLabels}
                      setCustomLabels={setDefensesCustomLabels}
                      columnWidths={defensesColumnWidths}
                      setColumnWidths={setDefensesColumnWidths}
                      textFormat={defensesTextFormat}
                      setTextFormat={setDefensesTextFormat}
                      defaultColumnOrder={DEFAULT_DEFENSES_ORDER}
                      defaultVisibleColumns={DEFAULT_DEFENSES_VISIBLE}
                      defaultRecordsLimit="all"
                      startDate={defensesStartDate}
                      setStartDate={setDefensesStartDate}
                      endDate={defensesEndDate}
                      setEndDate={setDefensesEndDate}
                      defaultTableTitle="Lista de Defesas"
                      defaultFilterTitle="Filtrar por situação"
                    />
                  </div>
                </div>

                {/* INTEGRATED TOOLBAR BAR FOR STATUS & FILTERS */}
                <div className="portal-defense-filter-row flex w-full min-w-0 flex-wrap items-center gap-2 border-t-2 border-white px-3 py-2.5 text-xs sm:px-4">
                  <span className="text-[10px] opacity-80 font-black uppercase tracking-wider shrink-0">
                    {defensesTextFormat?.customFilterTitle || getEditableTableText(defensesCustomLabels, '__filterTitle', 'FILTRAR:')}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(['all', 'pending', 'concluded'] as const).map((statusKey) => {
                      const isSelected = defenseStatusFilter === statusKey;
                      const fallbackLabel = statusKey === 'all' ? 'TODAS' : statusKey === 'pending' ? 'A DEFENDER' : 'JÁ DEFENDIDAS';
                      const fallbackEmoji = statusKey === 'all' ? '📋' : statusKey === 'pending' ? '⏳' : '✅';
                      const chip = getFilterChipProps(statusKey, isSelected, defensesTextFormat, fallbackLabel, fallbackEmoji);

                      return (
                        <button
                          key={statusKey}
                          type="button"
                          onClick={() => setDefenseStatusFilter(statusKey)}
                          data-selected={isSelected ? 'true' : 'false'}
                          style={chip.buttonStyle}
                          className={`portal-table-filter-chip inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide cursor-pointer transition-all border select-none ${
                            isSelected ? 'shadow-xs scale-[1.02]' : 'opacity-85 hover:opacity-100'
                          }`}
                        >
                          {chip.emoji && <span>{chip.emoji}</span>}
                          <span>{chip.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

        {isLoading ? (
          <div className="bg-white p-12 text-center text-xs font-semibold text-slate-500">
            Carregando agenda de defesas...
          </div>
        ) : (() => {
            const listProcesses = filteredProcesses.filter((proc) => {
              if (!proc.defesa?.startAt) return false;
              const d = new Date(proc.defesa.startAt);
              const matchYear = d.getFullYear() === year;
              const matchMonth = d.getMonth() === month;

              // If search or date filters are actively configured, bypass monthly focus
              if (!defensesSearch && !defensesStartDate && !defensesEndDate) {
                if (!matchYear || !matchMonth) return false;
              }

              // Text Search Filter
              if (defensesSearch) {
                const term = defensesSearch.toLowerCase();
                const titleMatch = (proc.titulo || '').toLowerCase().includes(term);
                const studentMatch = formatStudentsString(proc.aluno1, proc.aluno2).toLowerCase().includes(term);
                const advisorMatch = (proc.orientador?.nome || '').toLowerCase().includes(term);
                const protocolMatch = (proc.protocolo || '').toLowerCase().includes(term);
                if (!titleMatch && !studentMatch && !advisorMatch && !protocolMatch) return false;
              }

              // Date Filters
              if (defensesStartDate) {
                if (new Date(proc.defesa.startAt) < new Date(defensesStartDate + 'T00:00:00')) return false;
              }
              if (defensesEndDate) {
                if (new Date(proc.defesa.startAt) > new Date(defensesEndDate + 'T23:59:59')) return false;
              }

              // Defense Status Filter
              const isPast = new Date(proc.defesa.startAt).getTime() < Date.now();
              if (defenseStatusFilter === 'pending' && isPast) return false;
              if (defenseStatusFilter === 'concluded' && !isPast) return false;

              return true;
            });

            if (listProcesses.length === 0) {
              const periodStr = `${monthNamesPt[month]} de ${year}`;
              return (
                <div className="bg-white p-12 text-center text-xs text-slate-500 space-y-3">
                  <p className="font-bold text-slate-700 text-sm">
                    Nenhuma defesa de TCC localizada para os filtros definidos.
                  </p>
                  <p className="text-slate-500 max-w-md mx-auto">
                    Navegue pelos meses utilizando o calendário acima, altere as datas ou redefina os filtros selecionados.
                  </p>
                </div>
              );
            }

            const sortedProcesses = [...listProcesses];
            if (defensesSortColumn) {
              sortedProcesses.sort((a, b) => {
                let valA: any = '';
                let valB: any = '';

                if (defensesSortColumn === 'date' || defensesSortColumn === 'defesaDataHora') {
                  valA = a.defesa?.startAt ? new Date(a.defesa.startAt).getTime() : 0;
                  valB = b.defesa?.startAt ? new Date(b.defesa.startAt).getTime() : 0;
                } else if (defensesSortColumn === 'title') {
                  valA = formatTccTitle(a.titulo || '').toLowerCase();
                  valB = formatTccTitle(b.titulo || '').toLowerCase();
                } else if (defensesSortColumn === 'student' || defensesSortColumn === 'aluno1') {
                  valA = cleanPersonName(a.aluno1?.nome || '').toLowerCase();
                  valB = cleanPersonName(b.aluno1?.nome || '').toLowerCase();
                } else if (defensesSortColumn === 'aluno2') {
                  valA = cleanPersonName(a.aluno2?.nome || '').toLowerCase();
                  valB = cleanPersonName(b.aluno2?.nome || '').toLowerCase();
                } else if (defensesSortColumn === 'orientador') {
                  valA = cleanPersonName(a.orientador?.nome || '').toLowerCase();
                  valB = cleanPersonName(b.orientador?.nome || '').toLowerCase();
                } else if (defensesSortColumn === 'membro1') {
                  valA = cleanPersonName(a.banca?.filter(b => b.funcao !== 'ORIENTADOR')[0]?.nome || '').toLowerCase();
                  valB = cleanPersonName(b.banca?.filter(b => b.funcao !== 'ORIENTADOR')[0]?.nome || '').toLowerCase();
                } else if (defensesSortColumn === 'membro2') {
                  valA = cleanPersonName(a.banca?.filter(b => b.funcao !== 'ORIENTADOR')[1]?.nome || '').toLowerCase();
                  valB = cleanPersonName(b.banca?.filter(b => b.funcao !== 'ORIENTADOR')[1]?.nome || '').toLowerCase();
                } else if (defensesSortColumn === 'coorientador') {
                  valA = cleanPersonName(a.coorientador?.nome || '').toLowerCase();
                  valB = cleanPersonName(b.coorientador?.nome || '').toLowerCase();
                } else if (defensesSortColumn === 'defesaLocal') {
                  valA = (a.defesa?.local || '').toLowerCase();
                  valB = (b.defesa?.local || '').toLowerCase();
                } else if (defensesSortColumn === 'protocolo') {
                  valA = (a.protocolo || '').toLowerCase();
                  valB = (b.protocolo || '').toLowerCase();
                } else if (defensesSortColumn === 'progress' || defensesSortColumn === 'progresso') {
                  valA = getProcessProgress(a).percent;
                  valB = getProcessProgress(b).percent;
                }

                if (valA < valB) return defensesSortDirection === 'asc' ? -1 : 1;
                if (valA > valB) return defensesSortDirection === 'asc' ? 1 : -1;
                return 0;
              });
            }

            // Slice according to records limit
            const limitedProcesses = defensesRecordsLimit === 'all' ? sortedProcesses : sortedProcesses.slice(0, defensesRecordsLimit);

            const defStyles = getTableStyles(defensesTextFormat);

            const isDefDark = (defensesTextFormat.headerTheme || 'militar') !== 'clean' && (defensesTextFormat.headerTheme || 'militar') !== 'slate' && (defensesTextFormat.headerTheme || 'militar') !== 'light';

            const renderDefensesHeaderCell = (colKey: string) => {
              if (!defensesVisibleColumns[colKey]) return null;
              const colDef = ALL_DEFENSES_COLUMNS.find(c => c.key === colKey);
              const rawLabel = colDef?.label || colKey;
              const formattedLabel = formatColumnLabel(colKey, rawLabel, defensesTextFormat, defensesCustomLabels);
              const widthClass = `${getColWidthClass(colKey, defensesColumnWidths, 'min-w-[95px]')} ${getColumnWeightClass(colKey, defensesTextFormat)}`;
              const isSortCol = colKey === 'titulo' ? 'title' : colKey;

              return (
                <th 
                  key={colKey}
                  onClick={() => handleDefensesSort(isSortCol)}
                  className={`${defStyles.headerThClass} ${defStyles.cellPadClass} ${widthClass} ${defStyles.headerWeightClass} ${defStyles.headerTextColorClass} ${defStyles.headerFontSizeClass} ${defStyles.headerCasingClass} ${defStyles.headerBorderClass} ${defStyles.headerAlignClass} align-middle cursor-pointer ${defStyles.headerThHoverClass} select-none transition-colors group`}
                  style={defStyles.theadStyle}
                >
                  <div className={`flex items-center justify-center gap-1 ${defStyles.headerWrapClass}`}>
                    <span>{formattedLabel}</span>
                    {renderDefensesSortArrow(isSortCol, isDefDark)}
                  </div>
                </th>
              );
            };

            const renderDefensesBodyCell = (colKey: string, proc: any, progress: any, isPast: boolean, ev1: any, ev2: any, cleanInst: (s?: string) => string) => {
              if (!defensesVisibleColumns[colKey]) return null;
              const widthClass = `${getColWidthClass(colKey, defensesColumnWidths, 'min-w-[95px]')} ${getColumnWeightClass(colKey, defensesTextFormat)}`;
              const alignClass = defStyles.cellAlignClass;

              switch (colKey) {
                case 'protocolo':
                  return (
                    <td 
                      key="protocolo"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProcessDetails(proc);
                      }}
                      className={`${defStyles.cellPadClass} ${widthClass} ${defStyles.borderClass} align-middle ${alignClass} cursor-pointer ${defStyles.firstColCellHoverClass} group/col0 transition-colors`}
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
                        } else if (proc.anoLectivo) {
                          line1 = `TCC - ${proc.anoLectivo}`;
                          line2 = clean;
                        }
                        const tagLabel = formatCellText('protocolo', line1, defensesTextFormat, '📓');
                        return (
                          <div className={defStyles.firstColBtnClass}>
                            <div className={defStyles.firstColTagClass}>
                              {tagLabel}
                            </div>
                            <div className={`${defStyles.cellTextColorClass} group-hover/col0:text-emerald-950 text-xs tracking-wide ${defStyles.cellWeightClass}`}>
                              {line2}
                            </div>
                            <span className={defStyles.firstColSubtextClass}>
                              Abrir TCC ↗
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                  );
                case 'defesaDataHora':
                  return (
                    <td key="defesaDataHora" className={`${defStyles.cellPadClass} ${widthClass} ${defStyles.cellWeightClass} align-middle ${alignClass} ${defStyles.borderClass} cursor-grab`}>
                      <div className={`flex items-center justify-center gap-1 ${defStyles.cellFontSizeClass}`}>
                        <span>{formatCellText('defesaDataHora', formatDateNumeric(proc.defesa?.startAt), defensesTextFormat, '⏰')}</span>
                      </div>
                      <div className="text-[9.5px] text-slate-500 font-mono font-normal">{formatTimeExtenso(proc.defesa?.startAt)}</div>
                    </td>
                  );
                case 'progresso':
                  return (
                    <td key="progresso" className={`${defStyles.cellPadClass} ${widthClass} ${alignClass} align-middle ${defStyles.borderClass} cursor-grab`}>
                      <ProgressIndicator percent={progress.percent} label={progress.label} textFormat={defensesTextFormat} />
                    </td>
                  );
                case 'titulo':
                  return (
                    <td key="titulo" className={`${defStyles.cellPadClass} ${widthClass} ${defStyles.cellWeightClass} ${defStyles.cellTextColorClass} ${alignClass} ${defStyles.borderClass} align-middle cursor-grab`}>
                      <div className={`${defStyles.cellWrapClass} ${alignClass} ${defStyles.cellFontSizeClass}`} title={formatTccTitle(proc.titulo)}>
                        {formatCellText('titulo', formatTccTitle(proc.titulo), defensesTextFormat, '📖')}
                      </div>
                    </td>
                  );
                case 'aluno1':
                  return (
                    <td key="aluno1" className={`${defStyles.cellPadClass} ${widthClass} ${alignClass} ${defStyles.borderClass} align-middle cursor-grab`}>
                      <div className="w-full mx-auto">
                        <div className={`${defStyles.cellFontSizeClass} ${defStyles.cellWeightClass} ${defStyles.cellTextColorClass} leading-tight ${defStyles.cellWrapClass}`}>
                          {formatCellText('aluno1', cleanPersonName(proc.aluno1?.nome || '—'), defensesTextFormat, '🎓')}
                        </div>
                      </div>
                    </td>
                  );
                case 'aluno2':
                  return (
                    <td key="aluno2" className={`${defStyles.cellPadClass} ${widthClass} ${alignClass} ${defStyles.borderClass} align-middle cursor-grab`}>
                      <div className="w-full mx-auto">
                        {proc.aluno2?.nome ? (
                          <>
                            <div className={`${defStyles.cellFontSizeClass} ${defStyles.cellWeightClass} ${defStyles.cellTextColorClass} leading-tight ${defStyles.cellWrapClass}`}>
                              {formatCellText('aluno2', cleanPersonName(proc.aluno2.nome), defensesTextFormat, '🎓')}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-300 font-mono text-[11px]">—</span>
                        )}
                      </div>
                    </td>
                  );
                case 'orientador':
                  return (
                    <td key="orientador" className={`${defStyles.cellPadClass} ${widthClass} ${alignClass} ${defStyles.borderClass} align-middle cursor-grab`}>
                      <div className="w-full mx-auto">
                        <div className={`${defStyles.cellWeightClass} ${defStyles.cellTextColorClass} ${defStyles.cellFontSizeClass} leading-tight ${defStyles.cellWrapClass}`}>
                          {formatCellText('orientador', formatProfessorName(proc.orientador?.nome), defensesTextFormat, '👨‍🏫')}
                        </div>
                        <div className="text-[9px] text-slate-600 font-mono font-normal mt-1 leading-tight break-words">
                          {formatCellText('orientador', cleanInst(proc.orientador?.instituicao || installationProfile.defaultInstitutionName), defensesTextFormat, '📍')}
                        </div>
                      </div>
                    </td>
                  );
                case 'membro1':
                  return (
                    <td key="membro1" className={`${defStyles.cellPadClass} ${widthClass} ${alignClass} ${defStyles.borderClass} align-middle cursor-grab`}>
                      <div className="w-full mx-auto">
                        {ev1 ? (
                          <div>
                            <div className={`font-normal ${defStyles.cellTextColorClass} ${defStyles.cellFontSizeClass} leading-tight ${defStyles.cellWrapClass}`}>
                              {formatCellText('membro1', formatProfessorName(ev1.nome), defensesTextFormat, '👥')}
                            </div>
                            <div className="text-[9px] text-slate-600 font-mono mt-1 leading-tight break-words">
                              {formatCellText('membro1', cleanInst(ev1.instituicao || installationProfile.defaultInstitutionName), defensesTextFormat, '📍')}
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
                    <td key="membro2" className={`${defStyles.cellPadClass} ${widthClass} ${alignClass} ${defStyles.borderClass} align-middle cursor-grab`}>
                      <div className="w-full mx-auto">
                        {ev2 ? (
                          <div>
                            <div className={`font-normal ${defStyles.cellTextColorClass} ${defStyles.cellFontSizeClass} leading-tight ${defStyles.cellWrapClass}`}>
                              {formatCellText('membro2', formatProfessorName(ev2.nome), defensesTextFormat, '👥')}
                            </div>
                            <div className="text-[9px] text-slate-600 font-mono mt-1 leading-tight break-words">
                              {formatCellText('membro2', cleanInst(ev2.instituicao || 'Instituição Externa'), defensesTextFormat, '📍')}
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
                    <td key="coorientador" className={`${defStyles.cellPadClass} ${widthClass} ${alignClass} ${defStyles.borderClass} align-middle cursor-grab`}>
                      <div className="w-full mx-auto">
                        {proc.coorientador?.nome ? (
                          <div>
                            <div className={`${defStyles.cellWeightClass} ${defStyles.cellTextColorClass} ${defStyles.cellFontSizeClass} leading-tight ${defStyles.cellWrapClass}`}>
                              {formatCellText('coorientador', formatProfessorName(proc.coorientador.nome), defensesTextFormat, '👨‍🏫')}
                            </div>
                            <div className="text-[9px] text-slate-600 font-mono font-normal mt-1 leading-tight break-words">
                              {formatCellText('coorientador', cleanInst(proc.coorientador.instituicao || 'Instituição Externa'), defensesTextFormat, '📍')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono text-[11px]">—</span>
                        )}
                      </div>
                    </td>
                  );
                case 'resumo':
                  return (
                    <td key="resumo" className={`${defStyles.cellPadClass} ${widthClass} ${defStyles.cellTextColorClass} ${alignClass} ${defStyles.cellFontSizeClass} ${defStyles.borderClass} leading-relaxed ${defStyles.cellWrapClass} align-middle cursor-grab`}>
                      {proc.acervo?.resumoSintese ? (
                        proc.acervo.resumoSintese
                      ) : (
                        `Trabalho de Conclusão de Curso intitulado "${formatTccTitle(proc.titulo)}", submetido a ${installationProfile.courseName} — ${installationProfile.institutionName}.`
                      )}
                    </td>
                  );
                case 'palavrasChave':
                  return (
                    <td key="palavrasChave" className={`${defStyles.cellPadClass} ${widthClass} ${defStyles.cellTextColorClass} ${alignClass} ${defStyles.cellFontSizeClass} ${defStyles.borderClass} leading-tight ${defStyles.cellWrapClass} align-middle cursor-grab`}>
                      {(proc.acervo?.palavrasChave && proc.acervo.palavrasChave.length > 0
                        ? proc.acervo.palavrasChave
                        : []
                      ).slice(0, 5).join('; ')}
                    </td>
                  );
                case 'defesaLocal':
                  return (
                    <td key="defesaLocal" className={`${defStyles.cellPadClass} ${widthClass} ${defStyles.cellTextColorClass} ${alignClass} ${defStyles.cellFontSizeClass} leading-normal ${defStyles.cellWrapClass} align-middle cursor-grab`}>
                      <span>{formatCellText('defesaLocal', proc.defesa?.local || installationProfile.defaultDefenseLocation || 'Local a confirmar', defensesTextFormat, '📍')}</span>
                    </td>
                  );
                default:
                  return null;
              }
            };

            return (
              <div className="w-full">
                <TableScrollWrapper>
                  <table className={`w-full ${defStyles.cellAlignClass} border-collapse text-xs`}>
                    <thead className={`${defStyles.headerTheadClass} ${defStyles.headerWeightClass} ${defStyles.headerFontSizeClass} tracking-normal`} style={defStyles.theadStyle}>
                      <tr>
                        {defensesColumnOrder.map((colKey) => renderDefensesHeaderCell(colKey))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                    {limitedProcesses.map((proc) => {
                      const progress = getProcessProgress(proc);
                      const isPast = proc.defesa?.startAt ? new Date(proc.defesa.startAt).getTime() < Date.now() : false;
                      const evalMembers = (proc.banca || []).filter(b => b.funcao !== 'ORIENTADOR');
                      const ev1 = evalMembers[0];
                      const ev2 = evalMembers[1];

                      const cleanInst = (str?: string) => {
                        if (!str) return '';
                        return str.replace(/^\s*\(\s*/, '').replace(/\s*\)\s*$/, '').trim();
                      };

                      return (
                        <tr
                          key={proc.id}
                          className={`transition-all duration-200 ${defStyles.rowZebraClass} ${defStyles.cellTextColorClass}`}
                        >
                          {defensesColumnOrder.map((colKey) => renderDefensesBodyCell(colKey, proc, progress, isPast, ev1, ev2, cleanInst))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScrollWrapper>
            </div>
          );
          })()}
        </div>
      </section>
    </>
  )}

      {/* PUBLIC TAB 2: REPOSITÓRIO DE TCCS & ACERVO DIGITAL */}
      {publicTab === 'biblioteca' && (
        <>
          {/* Botão no Topo (Acima do Cabeçalho) */}
          {acervoTextFormat.showDownloadDadosButton !== false && (() => {
            const acervoActionStyles = getActionPillStyles(acervoTextFormat);
            return (
              <div className="flex justify-end mb-3">
                <button
                  type="button"
                  onClick={() => setShowDownloadConfirm(true)}
                  style={acervoActionStyles.actionPillStyle}
                  className={acervoActionStyles.actionPillClass}
                  title="Exportar todo o banco de dados de TCCs para Excel (.csv)"
                >
                  <span>{acervoTextFormat.downloadDadosButtonEmoji || '📥'}</span>
                  <span>{acervoTextFormat.downloadDadosButtonText || 'Download dos dados'}</span>
                </button>
              </div>
            );
          })()}

          <section id="biblioteca-tccs-section" className="space-y-3">
            {/* UNIFIED GRAY HEADER BANNER & SPREADSHEET CARD */}
            <div className={`bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden ${getTableStyles(acervoTextFormat).fontFamilyClass}`} style={getTableStyles(acervoTextFormat).rootStyle}>
              {(() => {
                const acervoBannerStyles = getTableStyles(acervoTextFormat);
                return (
                  <div className={`${acervoBannerStyles.bannerHeaderClass} p-3.5 sm:p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors`} style={acervoBannerStyles.bannerHeaderStyle}>
                    <div className="flex items-center gap-2">
                      <ColorfulHeaderIcon type="repository" textFormat={acervoTextFormat} />
                      <h1 className="text-base sm:text-lg font-black uppercase tracking-tight">
                        {getEditableTableText(acervoCustomLabels, '__tableTitle', 'Repositório & Acervo Digital')}
                      </h1>
                    </div>

                    {/* Right Group: Lupa and Engrenagem Controls */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      {/* Lupa (Search) */}
                      <SearchPopover
                        value={libSearch}
                        onChange={setLibSearch}
                        placeholder="Buscar no acervo..."
                        textFormat={acervoTextFormat}
                      />

                      {/* Refresh Button (Yin-Yang) */}
                      <button
                        type="button"
                        onClick={refreshData}
                        disabled={isRefreshingData}
                        className={`${acervoBannerStyles.toolbarButtonClass} disabled:opacity-70`}
                        style={acervoBannerStyles.toolbarButtonStyle}
                        title="Atualizar dados da tabela"
                      >
                        <YinYangIcon className={`w-3.5 h-3.5 text-current ${isRefreshingData ? 'animate-spin' : ''}`} />
                      </button>

                      {/* Engrenagem (Settings) */}
                      <HeaderSettingsPopover
                        recordsLimit={libRecordsLimit}
                        setRecordsLimit={setLibRecordsLimit}
                        allowedLimits={[25, 50, 100, 'all']}
                        allColumns={ALL_ACERVO_COLUMNS}
                        visibleColumns={visibleColumns}
                        setVisibleColumns={setVisibleColumns}
                        columnOrder={acervoColumnOrder}
                        setColumnOrder={setAcervoColumnOrder}
                        storageKey="acervo"
                        customLabels={acervoCustomLabels}
                        setCustomLabels={setAcervoCustomLabels}
                        columnWidths={acervoColumnWidths}
                        setColumnWidths={setAcervoColumnWidths}
                        textFormat={acervoTextFormat}
                        setTextFormat={setAcervoTextFormat}
                        defaultColumnOrder={DEFAULT_ACERVO_ORDER}
                        defaultVisibleColumns={DEFAULT_ACERVO_VISIBLE}
                        defaultRecordsLimit={25}
                        startDate={libStartDate}
                        setStartDate={setLibStartDate}
                        endDate={libEndDate}
                        setEndDate={setLibEndDate}
                        defaultTableTitle="Repositório & Acervo Digital"
                        defaultFilterTitle="Filtrar acervo"
                      />
                    </div>
                  </div>
                );
              })()}

              {/* SPREADSHEET TABLE FOR BIBLIOTECA */}
              {(() => {
              const filteredLibProcesses = processes.filter((p) => {
                const term = libSearch.toLowerCase();
                const students = formatStudentsString(p.aluno1, p.aluno2).toLowerCase();
                const orientador = (p.orientador?.nome || '').toLowerCase();
                const coorientador = (p.coorientador?.nome || '').toLowerCase();
                const local = (p.defesa?.local || '').toLowerCase();
                const title = (p.titulo || '').toLowerCase();
                const protocol = (p.protocolo || '').toLowerCase();
                const keywords = (p.acervo?.palavrasChave || []).join(' ').toLowerCase();
                const banca = (p.banca || []).map(b => b.nome).join(' ').toLowerCase();
                const matchText = !term || title.includes(term) || students.includes(term) || orientador.includes(term) || coorientador.includes(term) || local.includes(term) || protocol.includes(term) || keywords.includes(term) || banca.includes(term);

                if (!p.defesa?.startAt) return matchText;
                const dStr = p.defesa.startAt.slice(0, 10);
                if (libStartDate && dStr < libStartDate) return false;
                if (libEndDate && dStr > libEndDate) return false;

                return matchText;
              });

              const sortedLibProcesses = [...filteredLibProcesses];
              if (libSortColumn) {
                sortedLibProcesses.sort((a, b) => {
                  let valA: any = '';
                  let valB: any = '';

                  if (libSortColumn === 'protocolo') {
                    valA = (a.protocolo || '').toLowerCase();
                    valB = (b.protocolo || '').toLowerCase();
                  } else if (libSortColumn === 'defesaDataHora') {
                    valA = a.defesa?.startAt ? new Date(a.defesa.startAt).getTime() : 0;
                    valB = b.defesa?.startAt ? new Date(b.defesa.startAt).getTime() : 0;
                  } else if (libSortColumn === 'titulo') {
                    valA = formatTccTitle(a.titulo || '').toLowerCase();
                    valB = formatTccTitle(b.titulo || '').toLowerCase();
                  } else if (libSortColumn === 'aluno1') {
                    valA = cleanPersonName(a.aluno1?.nome || '').toLowerCase();
                    valB = cleanPersonName(b.aluno1?.nome || '').toLowerCase();
                  } else if (libSortColumn === 'aluno2') {
                    valA = cleanPersonName(a.aluno2?.nome || '').toLowerCase();
                    valB = cleanPersonName(b.aluno2?.nome || '').toLowerCase();
                  } else if (libSortColumn === 'orientador') {
                    valA = cleanPersonName(a.orientador?.nome || '').toLowerCase();
                    valB = cleanPersonName(b.orientador?.nome || '').toLowerCase();
                  } else if (libSortColumn === 'coorientador') {
                    valA = cleanPersonName(a.coorientador?.nome || '').toLowerCase();
                    valB = cleanPersonName(b.coorientador?.nome || '').toLowerCase();
                  } else if (libSortColumn === 'membro1') {
                    const evalA = (a.banca || []).filter(b => b.funcao !== 'ORIENTADOR');
                    const evalB = (b.banca || []).filter(b => b.funcao !== 'ORIENTADOR');
                    valA = cleanPersonName(evalA[0]?.nome || '').toLowerCase();
                    valB = cleanPersonName(evalB[0]?.nome || '').toLowerCase();
                  } else if (libSortColumn === 'membro2') {
                    const evalA = (a.banca || []).filter(b => b.funcao !== 'ORIENTADOR');
                    const evalB = (b.banca || []).filter(b => b.funcao !== 'ORIENTADOR');
                    valA = cleanPersonName(evalA[1]?.nome || '').toLowerCase();
                    valB = cleanPersonName(evalB[1]?.nome || '').toLowerCase();
                  } else if (libSortColumn === 'defesaLocal') {
                    valA = (a.defesa?.local || '').toLowerCase();
                    valB = (b.defesa?.local || '').toLowerCase();
                  } else if (libSortColumn === 'progresso') {
                    valA = getProcessProgress(a).percent;
                    valB = getProcessProgress(b).percent;
                  }

                  if (valA < valB) return libSortDirection === 'asc' ? -1 : 1;
                  if (valA > valB) return libSortDirection === 'asc' ? 1 : -1;
                  return 0;
                });
              }

              // If date filters are active, show ALL matching records. Otherwise slice to records limit (100, 150, 200, todos).
              const isDateFiltered = !!(libStartDate || libEndDate);
              const displayedLibProcesses = isDateFiltered || libRecordsLimit === 'all'
                ? sortedLibProcesses
                : sortedLibProcesses.slice(0, libRecordsLimit);

              if (displayedLibProcesses.length === 0) {
                return (
                  <div className="p-12 text-center text-xs text-slate-500 space-y-2 bg-white border border-slate-200 shadow-2xs rounded-lg">
                    <p className="font-bold text-slate-700 text-sm">Nenhum TCC encontrado para os filtros selecionados.</p>
                    <p className="text-slate-500">Tente redefinir os termos de pesquisa ou período de data.</p>
                  </div>
                );
              }

              const acervoStyles = getTableStyles(acervoTextFormat);
              const isAcervoDark = (acervoTextFormat.headerTheme || 'militar') !== 'clean' && (acervoTextFormat.headerTheme || 'militar') !== 'slate' && (acervoTextFormat.headerTheme || 'militar') !== 'light';

              const renderAcervoHeaderCell = (colKey: string) => {
                if (!visibleColumns[colKey]) return null;
                const colDef = ALL_ACERVO_COLUMNS.find(c => c.key === colKey);
                const rawLabel = colDef?.label || colKey;
                const formattedLabel = formatColumnLabel(colKey, rawLabel, acervoTextFormat, acervoCustomLabels);
                const widthClass = `${getColWidthClass(colKey, acervoColumnWidths, 'min-w-[95px]')} ${getColumnWeightClass(colKey, acervoTextFormat)}`;

                return (
                  <th 
                    key={colKey}
                    onClick={() => handleLibSort(colKey)}
                    className={`${acervoStyles.headerThClass} ${acervoStyles.cellPadClass} ${widthClass} ${acervoStyles.headerWeightClass} ${acervoStyles.headerTextColorClass} ${acervoStyles.headerFontSizeClass} ${acervoStyles.headerCasingClass} ${acervoStyles.headerBorderClass} ${acervoStyles.headerAlignClass} align-middle cursor-pointer ${acervoStyles.headerThHoverClass} select-none transition-colors group`}
                  >
                    <div className={`flex items-center justify-center gap-1 ${acervoStyles.headerWrapClass}`}>
                      <span>{formattedLabel}</span>
                      {renderLibSortArrow(colKey, isAcervoDark)}
                    </div>
                  </th>
                );
              };

              const renderAcervoBodyCell = (colKey: string, proc: any, progress: any, ev1: any, ev2: any, cleanInst: (s?: string) => string) => {
                if (!visibleColumns[colKey]) return null;
                const widthClass = `${getColWidthClass(colKey, acervoColumnWidths, 'min-w-[95px]')} ${getColumnWeightClass(colKey, acervoTextFormat)}`;
                const alignClass = acervoStyles.cellAlignClass;

                switch (colKey) {
                  case 'protocolo':
                    return (
                      <td 
                        key="protocolo"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProcessDetails(proc);
                        }}
                        className={`${acervoStyles.cellPadClass} ${widthClass} ${acervoStyles.borderClass} align-middle ${alignClass} cursor-pointer ${acervoStyles.firstColCellHoverClass} group/col0 transition-colors`}
                        title="Clique aqui no Nº do Processo para abrir o TCC"
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
                          } else if (proc.anoLectivo) {
                            line1 = `TCC - ${proc.anoLectivo}`;
                            line2 = clean;
                          }
                          const tagLabel = formatCellText('protocolo', line1, acervoTextFormat, '📓');
                          return (
                            <div className={acervoStyles.firstColBtnClass}>
                              <div className={acervoStyles.firstColTagClass}>
                                {tagLabel}
                              </div>
                              <div className={`${acervoStyles.cellTextColorClass} group-hover/col0:text-emerald-950 text-xs tracking-wide ${acervoStyles.cellWeightClass}`}>
                                {line2}
                              </div>
                              <span className={acervoStyles.firstColSubtextClass}>
                                Abrir TCC ↗
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                    );
                  case 'progresso':
                    return (
                      <td key="progresso" className={`${acervoStyles.cellPadClass} ${widthClass} ${alignClass} align-middle ${acervoStyles.borderClass}`}>
                        <ProgressIndicator percent={progress.percent} label={progress.label} textFormat={acervoTextFormat} />
                      </td>
                    );
                  case 'titulo':
                    return (
                      <td key="titulo" className={`${acervoStyles.cellPadClass} ${widthClass} ${acervoStyles.cellWeightClass} ${acervoStyles.cellTextColorClass} ${alignClass} ${acervoStyles.borderClass} align-middle`}>
                        <div className={`${acervoStyles.cellWrapClass} ${alignClass} ${acervoStyles.cellFontSizeClass}`} title={formatTccTitle(proc.titulo)}>
                          {formatCellText('titulo', formatTccTitle(proc.titulo), acervoTextFormat, '📖')}
                        </div>
                      </td>
                    );
                  case 'aluno1':
                    return (
                      <td key="aluno1" className={`${acervoStyles.cellPadClass} ${widthClass} ${alignClass} ${acervoStyles.borderClass} align-middle`}>
                        <div className="w-full mx-auto">
                          <div className={`${acervoStyles.cellFontSizeClass} ${acervoStyles.cellWeightClass} ${acervoStyles.cellTextColorClass} leading-tight ${acervoStyles.cellWrapClass}`}>
                            {formatCellText('aluno1', cleanPersonName(proc.aluno1?.nome || '—'), acervoTextFormat, '🎓')}
                          </div>
                        </div>
                      </td>
                    );
                  case 'aluno2':
                    return (
                      <td key="aluno2" className={`${acervoStyles.cellPadClass} ${widthClass} ${alignClass} ${acervoStyles.borderClass} align-middle`}>
                        <div className="w-full mx-auto">
                          {proc.aluno2?.nome ? (
                            <>
                              <div className={`${acervoStyles.cellFontSizeClass} ${acervoStyles.cellWeightClass} ${acervoStyles.cellTextColorClass} leading-tight ${acervoStyles.cellWrapClass}`}>
                                {formatCellText('aluno2', cleanPersonName(proc.aluno2.nome), acervoTextFormat, '🎓')}
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px]">—</span>
                          )}
                        </div>
                      </td>
                    );
                  case 'orientador':
                    return (
                      <td key="orientador" className={`${acervoStyles.cellPadClass} ${widthClass} ${alignClass} ${acervoStyles.borderClass} align-middle`}>
                        <div className="w-full mx-auto">
                          <div className={`${acervoStyles.cellWeightClass} ${acervoStyles.cellTextColorClass} ${acervoStyles.cellFontSizeClass} leading-tight ${acervoStyles.cellWrapClass}`}>
                            {formatCellText('orientador', formatProfessorName(proc.orientador?.nome), acervoTextFormat, '👨‍🏫')}
                          </div>
                          <div className="text-[9px] text-slate-600 font-mono font-normal mt-1 leading-tight break-words">
                            {formatCellText('orientador', cleanInst(proc.orientador?.instituicao || installationProfile.defaultInstitutionName), acervoTextFormat, '📍')}
                          </div>
                        </div>
                      </td>
                    );
                  case 'membro1':
                    return (
                      <td key="membro1" className={`${acervoStyles.cellPadClass} ${widthClass} ${alignClass} ${acervoStyles.borderClass} align-middle`}>
                        <div className="w-full mx-auto">
                          {ev1 ? (
                            <div>
                              <div className={`font-normal ${acervoStyles.cellTextColorClass} ${acervoStyles.cellFontSizeClass} leading-tight ${acervoStyles.cellWrapClass}`}>
                                {formatCellText('membro1', formatProfessorName(ev1.nome), acervoTextFormat, '👥')}
                              </div>
                              <div className="text-[9px] text-slate-600 font-mono mt-1 leading-tight break-words">
                                {formatCellText('membro1', cleanInst(ev1.instituicao || installationProfile.defaultInstitutionName), acervoTextFormat, '📍')}
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
                      <td key="membro2" className={`${acervoStyles.cellPadClass} ${widthClass} ${alignClass} ${acervoStyles.borderClass} align-middle`}>
                        <div className="w-full mx-auto">
                          {ev2 ? (
                            <div>
                              <div className={`font-normal ${acervoStyles.cellTextColorClass} ${acervoStyles.cellFontSizeClass} leading-tight ${acervoStyles.cellWrapClass}`}>
                                {formatCellText('membro2', formatProfessorName(ev2.nome), acervoTextFormat, '👥')}
                              </div>
                              <div className="text-[9px] text-slate-600 font-mono mt-1 leading-tight break-words">
                                {formatCellText('membro2', cleanInst(ev2.instituicao || 'Instituição Externa'), acervoTextFormat, '📍')}
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
                      <td key="coorientador" className={`${acervoStyles.cellPadClass} ${widthClass} ${alignClass} ${acervoStyles.borderClass} align-middle`}>
                        <div className="w-full mx-auto">
                          {proc.coorientador?.nome ? (
                            <div>
                              <div className={`${acervoStyles.cellWeightClass} ${acervoStyles.cellTextColorClass} ${acervoStyles.cellFontSizeClass} leading-tight ${acervoStyles.cellWrapClass}`}>
                                {formatCellText('coorientador', formatProfessorName(proc.coorientador.nome), acervoTextFormat, '👨‍🏫')}
                              </div>
                              <div className="text-[9px] text-slate-600 font-mono font-normal mt-1 leading-tight break-words">
                                {formatCellText('coorientador', cleanInst(proc.coorientador.instituicao || 'Instituição Externa'), acervoTextFormat, '📍')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px]">—</span>
                          )}
                        </div>
                      </td>
                    );
                  case 'resumo':
                    return (
                      <td key="resumo" className={`${acervoStyles.cellPadClass} ${widthClass} ${acervoStyles.cellTextColorClass} ${alignClass} ${acervoStyles.cellFontSizeClass} ${acervoStyles.borderClass} leading-relaxed ${acervoStyles.cellWrapClass} align-middle`}>
                        {proc.acervo?.resumoSintese ? (
                          proc.acervo.resumoSintese
                        ) : (
                          `Trabalho de Conclusão de Curso intitulado "${formatTccTitle(proc.titulo)}", submetido a ${installationProfile.courseName} — ${installationProfile.institutionName}.`
                        )}
                      </td>
                    );
                  case 'palavrasChave':
                    return (
                      <td key="palavrasChave" className={`${acervoStyles.cellPadClass} ${widthClass} ${acervoStyles.cellTextColorClass} ${alignClass} ${acervoStyles.cellFontSizeClass} ${acervoStyles.borderClass} leading-tight ${acervoStyles.cellWrapClass} align-middle`}>
                        {(proc.acervo?.palavrasChave && proc.acervo.palavrasChave.length > 0
                          ? proc.acervo.palavrasChave
                          : []
                        ).slice(0, 5).map((kw, idx) => `${idx + 1}. ${kw}`).join(' • ')}
                      </td>
                    );
                  case 'defesaDataHora':
                    return (
                      <td key="defesaDataHora" className={`${acervoStyles.cellPadClass} ${widthClass} ${acervoStyles.cellWeightClass} ${acervoStyles.cellTextColorClass} ${alignClass} ${acervoStyles.borderClass} align-middle`}>
                        <div className={`${acervoStyles.cellFontSizeClass} whitespace-nowrap`}>
                          {formatCellText('defesaDataHora', formatDateNumeric(proc.defesa?.startAt), acervoTextFormat, '⏰')}
                        </div>
                        <div className="text-[9.5px] text-slate-500 font-mono font-normal">{formatTimeExtenso(proc.defesa?.startAt)}</div>
                      </td>
                    );
                  case 'defesaLocal':
                    return (
                      <td key="defesaLocal" className={`${acervoStyles.cellPadClass} ${widthClass} ${acervoStyles.cellTextColorClass} ${alignClass} ${acervoStyles.borderClass} leading-normal ${acervoStyles.cellWrapClass} align-middle`}>
                        <div className="flex flex-col items-center justify-center gap-0.5 leading-tight">
                          <span>{formatCellText('defesaLocal', proc.defesa?.local || installationProfile.defaultDefenseLocation || 'Local a confirmar', acervoTextFormat, '📍')}</span>
                        </div>
                      </td>
                    );
                  default:
                    return null;
                }
              };

              return (
                <TableScrollWrapper>
                  <table className={`w-full ${acervoStyles.cellAlignClass} border-collapse text-xs`}>
                    <thead className={`${acervoStyles.headerTheadClass} ${acervoStyles.headerWeightClass} ${acervoStyles.headerFontSizeClass} tracking-normal`} style={acervoStyles.theadStyle}>
                      <tr>
                        {acervoColumnOrder.map((colKey) => renderAcervoHeaderCell(colKey))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {displayedLibProcesses.map((proc) => {
                        const progress = getProcessProgress(proc);
                        const evalMembers = (proc.banca || []).filter(b => b.funcao !== 'ORIENTADOR');
                        const ev1 = evalMembers[0];
                        const ev2 = evalMembers[1];

                        const cleanInst = (str?: string) => {
                          if (!str) return '';
                          return str.replace(/^\s*\(\s*/, '').replace(/\s*\)\s*$/, '').trim();
                        };

                        return (
                          <tr
                            key={proc.id}
                            className={`${acervoStyles.rowZebraClass} hover:bg-slate-100/60 transition-colors ${acervoStyles.cellTextColorClass}`}
                          >
                            {acervoColumnOrder.map((colKey) => renderAcervoBodyCell(colKey, proc, progress, ev1, ev2, cleanInst))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableScrollWrapper>
              );
            })()}
          </div>
        </section>
        </>
      )}

      {/* PUBLIC TAB 3: TUTORIAL DO SISTEMA & MANUAL PASSO A PASSO */}
      {publicTab === 'tutorial' && (
        <section id="tutorial-sistema-section" className="space-y-5">
          <OnlineSystemTutorial onNavigate={onNavigate} />
        </section>
      )}

      {/* MODAL ABSTRACT PREVIEW IN LIBRARY */}
      {selectedLibDoc && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-slate-300 rounded-sm max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-700" />
                <h3 className="font-extrabold text-sm uppercase text-slate-900">
                  Ficha Acadêmica & Resumo do TCC
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLibDoc(null)}
                className="text-slate-400 hover:text-slate-800 text-xs font-bold cursor-pointer"
              >
                ✖
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-800">
              <div className="bg-emerald-100 p-3 rounded border border-emerald-300 font-mono text-[11px] text-emerald-950">
                Protocolo: <strong>{selectedLibDoc.protocolo}</strong> • Data da Defesa: <strong>{formatDatePt(selectedLibDoc.defesa?.startAt)}</strong>
              </div>

              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px] block">Título do Trabalho:</span>
                <p className="font-extrabold text-sm text-slate-900 leading-snug">{formatTccTitle(selectedLibDoc.titulo)}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[10px] block mb-0.5">Discente(s):</span>
                  <StudentNames aluno1={selectedLibDoc.aluno1} aluno2={selectedLibDoc.aluno2} align="left" itemClassName="font-bold text-slate-900 text-xs" />
                </div>
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[10px] block">Orientador(a):</span>
                  <p className="font-bold text-slate-900">{formatProfessorName(selectedLibDoc.orientador?.nome)}</p>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">Resumo Expandido:</span>
                <p className="text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded border border-slate-200 font-sans text-xs">
                  {selectedLibDoc.acervo?.resumoSintese || 'Resumo não cadastrado.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedLibDoc(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase rounded-2xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden button trigger for opening login modal programmatically from sidebar */}
      <button
        type="button"
        id="open-login-modal-btn"
        className="hidden"
        onClick={() => setShowLoginModal(true)}
        aria-hidden="true"
      />



      {/* FULL PROCESS DETAILS & CONFIGURATIONS POP-UP FORM */}
      {selectedProcessDetails && (
        <div
          className="fixed inset-0 bg-slate-900/80 z-50 overflow-y-auto p-2 sm:p-4 md:p-6 backdrop-blur-xs animate-fadeIn flex justify-center items-start"
          onClick={handleCloseDetails}
        >
          <div
            className="max-w-6xl w-full bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 overflow-hidden relative my-2 sm:my-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Body with Unified ProcessoDetailPage */}
            <div className="p-3 sm:p-5 bg-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <ProcessoDetailPage
                processId={selectedProcessDetails.id}
                onBack={handleCloseDetails}
                readOnly={!userEmail}
                isModal={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* LOGIN MODAL FOR STUDENTS AND PROFESSORS */}
      {showLoginModal && (() => {
        const themeMap: Record<string, { headerBg: string; accentText: string; btnBg: string }> = {
          emerald: { headerBg: 'bg-emerald-50/90 border-emerald-200', accentText: 'text-emerald-800', btnBg: 'bg-[#005830] hover:bg-[#004827]' },
          slate: { headerBg: 'bg-slate-100 border-slate-300', accentText: 'text-slate-900', btnBg: 'bg-slate-900 hover:bg-slate-800' },
          blue: { headerBg: 'bg-blue-50/90 border-blue-200', accentText: 'text-blue-800', btnBg: 'bg-blue-700 hover:bg-blue-800' },
          purple: { headerBg: 'bg-purple-50/90 border-purple-200', accentText: 'text-purple-800', btnBg: 'bg-purple-700 hover:bg-purple-800' },
          indigo: { headerBg: 'bg-indigo-50/90 border-indigo-200', accentText: 'text-indigo-800', btnBg: 'bg-indigo-700 hover:bg-indigo-800' },
          amber: { headerBg: 'bg-amber-50/90 border-amber-200', accentText: 'text-amber-800', btnBg: 'bg-amber-700 hover:bg-amber-800' },
          rose: { headerBg: 'bg-rose-50/90 border-rose-200', accentText: 'text-rose-800', btnBg: 'bg-rose-700 hover:bg-rose-800' }
        };
        const currentTheme = themeMap[loginPopupConfig.headerTheme] || themeMap.emerald;

        return (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
            <div className={`bg-white ${loginPopupConfig.borderRadius || 'rounded-2xl'} border border-slate-200/90 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150`}>
              {/* Header with Institutional Identity */}
              <div className={`${currentTheme.headerBg} border-b px-5 py-3.5 flex items-center justify-between`} style={loginPopupConfig.cardBgColor ? { backgroundColor: loginPopupConfig.cardBgColor, color: loginPopupConfig.cardTextColor || '#0f172a' } : undefined}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0 text-xl" aria-hidden="true">🎓</div>
                  <div>
                    <h3 className="font-black text-lg sm:text-xl leading-tight" style={{ color: loginPopupConfig.cardTextColor || '#0f172a' }}>
                      {loginPopupConfig.title || 'Acesso ao Portal do TCC'}
                    </h3>
                    <p className={`mt-0.5 text-xs ${currentTheme.accentText} font-semibold`}>
                      {loginPopupConfig.subtitle || `${installationProfile.courseName} • ${installationProfile.institutionAcronym}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Fechar acesso ao portal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {loginPopupConfig.description}
                </p>

                {/* Informative helper box */}
                {loginPopupConfig.showTipsBox && (
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-1.5 text-[11.5px] text-slate-700">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Orientações para identificação:</span>
                    </div>
                    <ul className="space-y-1 pl-5 list-disc text-slate-600 text-[11px]">
                      <li><strong>Discentes:</strong> {loginPopupConfig.discenteTip}</li>
                      <li><strong>Docentes e Banca:</strong> {loginPopupConfig.docenteTip}</li>
                    </ul>
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-4 pt-1">
                  {loginStep==='email'&&bootstrapStatus?.bootstrapMasterConfigured&&bootstrapStatus.google.oauthConfigured&&!bootstrapStatus.google.connected&&<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900"><strong>Primeira ativação do portal</strong><p className="mt-1 leading-5">Antes do primeiro código, o Master definido na implantação precisa autorizar a conta Google que enviará os e-mails.</p><button type="button" onClick={()=>{window.location.href='/api/integrations/google/oauth/start?returnTo=/?google=connected';}} className="mt-2 rounded-lg bg-slate-700 px-3 py-2 font-black text-white hover:bg-slate-800">Autorizar Google e continuar</button></div>}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-start gap-3">
                    <Shield className="w-5 h-5 text-slate-600 shrink-0" />
                    <div><div className="text-xs font-black text-slate-900">Acesso sem senha</div><p className="mt-1 text-[11px] text-slate-600">Informe o e-mail cadastrado. Enviaremos um código de uso único pela conta institucional do portal.</p></div>
                  </div>

                  <label className="block text-xs font-bold text-slate-800">E-mail
                    <input type="email" required disabled={loginStep==='code'} value={loginEmailInput} onChange={event=>setLoginEmailInput(event.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100" placeholder="nome@edu.ufes.br"/>
                  </label>
                  {loginStep==='code'&&<label className="block text-xs font-bold text-slate-800">Código de confirmação
                    <input type="text" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={loginCodeInput} onChange={event=>setLoginCodeInput(event.target.value.replace(/\D/g,'').slice(0,6))} autoComplete="one-time-code" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-3 text-center text-xl font-black tracking-[0.35em]" placeholder="000000"/>
                  </label>}
                  {loginMessage&&<p role="status" className={`rounded-lg border px-3 py-2 text-xs ${loginMessage.startsWith('Código enviado')?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-amber-200 bg-amber-50 text-amber-900'}`}>{loginMessage}</p>}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {if(loginStep==='code'){setLoginStep('email');setLoginCodeInput('');setLoginMessage('');}else setShowLoginModal(false);}}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
                    >
                      {loginStep==='code'?'Trocar e-mail':'Cancelar'}
                    </button>
                    <button
                      type="submit"
                      className={`px-5 py-2 ${currentTheme.btnBg} text-xs font-bold uppercase tracking-wide rounded-xl flex items-center gap-2 cursor-pointer shadow-2xs transition-colors`}
                      style={{ backgroundColor: loginPopupConfig.primaryBtnBg || undefined, color: loginPopupConfig.primaryBtnTextColor || '#ffffff' }}
                    >
                      <span>{loginWorking?'Aguarde…':loginStep==='email'?'Enviar código':'Entrar'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CONFIRMAÇÃO DE DOWNLOAD DO ACERVO */}
      {showDownloadConfirm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-300 rounded-xl max-w-md w-full shadow-2xl overflow-hidden space-y-0 text-left animate-in zoom-in-95 duration-200">
            <div className="bg-slate-800 text-white p-4 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-slate-300 shrink-0" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Confirmar Download dos Dados
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDownloadConfirm(false)}
                className="text-slate-400 hover:text-white font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Deseja baixar a planilha com todos os dados do Repositório de TCCs? O arquivo será exportado em formato Excel (.csv).
              </p>
            </div>

            <div className="flex justify-end gap-2 p-4 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowDownloadConfirm(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold uppercase rounded-lg border border-slate-300 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleExportExcel(processes);
                  setShowDownloadConfirm(false);
                }}
                className="px-5 py-2 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold uppercase rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm border border-slate-500 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-200" />
                <span>Confirmar Download</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
