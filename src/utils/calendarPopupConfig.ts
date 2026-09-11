// Configurations for the Calendar Day Defenses Popup Modal
export interface CalendarPopupFormat {
  // === 1. CORES E TEMA VISUAL DO POPUP ===
  headerThemeMode?: 'inherit' | 'custom'; // 'inherit' (usa cor da tabela) ou 'custom'
  headerBgColor?: string; // e.g. '#435649', '#1e293b', etc.
  headerTextColor?: string; // e.g. '#ffffff'
  headerCustomTitle?: string; // e.g. "AGENDA DE DEFESAS DE TCC"
  headerEmoji?: string; // e.g. '📅', '🎓', '🏥', '📑'
  modalBgColor?: string; // e.g. '#f1f5f9'
  cardBgColor?: string; // e.g. '#ffffff'
  cardInnerBgColor?: string; // e.g. '#f8fafc'
  cardBorderColor?: string; // e.g. '#cbd5e1'
  cardBorderWidth?: 'none' | 'thin' | 'medium' | 'thick'; // 0, 1px, 2px, 3px
  cardShadow?: 'none' | 'subtle' | 'medium' | 'prominent'; // shadow-none, shadow-xs, shadow-md, shadow-lg
  cardHoverEffect?: 'lift' | 'border-highlight' | 'glow' | 'none';
  cardTitleColor?: string; // e.g. '#0f172a'
  badgeBgColor?: string; // e.g. '#f1f5f9'
  badgeTextColor?: string; // e.g. '#334155'
  
  // === 2. BARRA DE PROGRESSO ===
  showProgressBar?: boolean; // Exibir ou ocultar a barra inteira
  showProgressPercent?: boolean; // Exibir rótulo "ETAPA X/5: NOME" e "XX%"
  progressBarLabelFormat?: 'stage_and_percent' | 'percent_only' | 'stage_only';
  progressBarColorMode?: 'dynamic' | 'custom' | 'gradient'; // 'dynamic' (padrão por etapa), 'custom' (cor fixa) ou 'gradient'
  progressBarCustomColor?: string; // e.g. '#10b981' (verde esmeralda), '#2563eb' (azul), '#8b5cf6' (roxo), etc.
  progressBarSecondaryColor?: string; // para modo gradiente
  progressBarTrackColor?: string; // e.g. '#e2e8f0'
  progressBarHeight?: 'thin' | 'normal' | 'thick' | 'extra'; // 'h-1' | 'h-1.5' | 'h-2.5' | 'h-3.5'
  progressBarShape?: 'pill' | 'rounded' | 'square';
  progressBarGlow?: boolean; // efeito de brilho suave

  // === 3. DECIDIR O QUE APARECE EM CADA CARD (VISIBILIDADE DOS CAMPOS) ===
  showTime?: boolean; // Horário da defesa (⏰ 06:00 às 07:30)
  timeBadgeStyle?: 'pill' | 'outlined' | 'clean';
  timeTextColor?: string;
  showLocation?: boolean; // Local (📍 Auditório / Sala)
  locationBadgeBg?: string;
  showProtocol?: boolean; // Protocolo (📓 TCC-2026-0002)
  protocolBadgeBg?: string;
  protocolBadgeText?: string;
  showTitle?: boolean; // Título do trabalho
  showStudents?: boolean; // Discentes Apresentadores
  showStudentRegistration?: boolean; // Matrícula dos discentes
  showAdvisor?: boolean; // Orientador(a)
  showAdvisorInstitution?: boolean; // Instituição do orientador (ex: UFES)
  showCoAdvisor?: boolean; // Coorientador(a)
  showCommittee?: boolean; // Banca Examinadora
  showCommitteeInstitution?: boolean; // Instituição da banca

  // Custom Labels
  studentLabel?: string;
  advisorLabel?: string;
  coAdvisorLabel?: string;
  committeeLabel?: string;

  // === 4. TIPOGRAFIA E LAYOUT DOS CARDS ===
  cardTitleSize?: 'xs' | 'sm' | 'base' | 'lg'; // 11px, 13px, 15px, 17px
  cardTitleWeight?: 'normal' | 'semibold' | 'bold' | 'black';
  cardTitleUppercase?: boolean; // TRUE = MAIÚSCULAS, FALSE = Normal
  columnsLayout?: 'auto' | '1' | '2'; // Auto (1 col mobile, 2 cols desktop), 1 col ou 2 cols
  cardPadding?: 'compact' | 'normal' | 'spacious';
  cardBorderRadius?: 'rounded-none' | 'rounded-lg' | 'rounded-xl' | 'rounded-2xl' | 'rounded-3xl';
  cardContentAlignment?: 'left' | 'center';
  fontSize?: 'xs' | 'sm' | 'normal';
}

export const DEFAULT_CALENDAR_POPUP_FORMAT: CalendarPopupFormat = {
  headerThemeMode: 'inherit',
  headerBgColor: '#435649',
  headerTextColor: '#ffffff',
  headerCustomTitle: 'AGENDA DE DEFESAS DE TCC',
  headerEmoji: '📅',
  modalBgColor: '#f1f5f9',
  cardBgColor: '#ffffff',
  cardInnerBgColor: '#f8fafc',
  cardBorderColor: '#cbd5e1',
  cardBorderWidth: 'thin',
  cardShadow: 'subtle',
  cardHoverEffect: 'lift',
  cardTitleColor: '#0f172a',
  badgeBgColor: '#f1f5f9',
  badgeTextColor: '#334155',

  showProgressBar: true,
  showProgressPercent: true,
  progressBarLabelFormat: 'stage_and_percent',
  progressBarColorMode: 'dynamic',
  progressBarCustomColor: '#10b981',
  progressBarSecondaryColor: '#059669',
  progressBarTrackColor: '#e2e8f0',
  progressBarHeight: 'normal',
  progressBarShape: 'pill',
  progressBarGlow: false,

  showTime: true,
  timeBadgeStyle: 'clean',
  timeTextColor: '#065f46',
  showLocation: true,
  locationBadgeBg: '#f1f5f9',
  showProtocol: true,
  protocolBadgeBg: '#f1f5f9',
  protocolBadgeText: '#1e293b',
  showTitle: true,
  showStudents: true,
  showStudentRegistration: true,
  showAdvisor: true,
  showAdvisorInstitution: true,
  showCoAdvisor: true,
  showCommittee: true,
  showCommitteeInstitution: true,

  studentLabel: 'Discentes Apresentadores:',
  advisorLabel: 'Orientador(a):',
  coAdvisorLabel: 'Coorientador(a):',
  committeeLabel: 'Banca Examinadora:',

  cardTitleSize: 'sm',
  cardTitleWeight: 'black',
  cardTitleUppercase: true,
  columnsLayout: 'auto',
  cardPadding: 'normal',
  cardBorderRadius: 'rounded-xl',
  cardContentAlignment: 'left',
  fontSize: 'xs',
};

export const CALENDAR_POPUP_PRESETS = [
  {
    id: 'ufes_militar',
    name: 'Verde',
    description: '',
    format: {
      ...DEFAULT_CALENDAR_POPUP_FORMAT,
      headerThemeMode: 'custom' as const,
      headerBgColor: '#435649',
      headerTextColor: '#ffffff',
      modalBgColor: '#f1f5f9',
      cardBgColor: '#ffffff',
      cardInnerBgColor: '#f8fafc',
      cardBorderColor: '#cbd5e1',
      progressBarColorMode: 'dynamic' as const,
      progressBarCustomColor: '#435649',
      progressBarHeight: 'normal' as const,
      cardBorderRadius: 'rounded-xl' as const,
      cardShadow: 'subtle' as const,
    },
  },
  {
    id: 'emerald_modern',
    name: 'Esmeralda Moderno (Vibrante)',
    description: 'Verde esmeralda com contraste elegante e barra luminosa',
    format: {
      ...DEFAULT_CALENDAR_POPUP_FORMAT,
      headerThemeMode: 'custom' as const,
      headerBgColor: '#065f46',
      headerTextColor: '#ffffff',
      modalBgColor: '#ecfdf5',
      cardBgColor: '#ffffff',
      cardInnerBgColor: '#f0fdf4',
      cardBorderColor: '#a7f3d0',
      progressBarColorMode: 'custom' as const,
      progressBarCustomColor: '#10b981',
      progressBarGlow: true,
      progressBarHeight: 'thick' as const,
      cardBorderRadius: 'rounded-2xl' as const,
      cardShadow: 'medium' as const,
    },
  },
  {
    id: 'clean_minimal',
    name: 'Clean & Minimalista (Branco)',
    description: 'Foco no texto, tons suaves de cinza e linhas finas',
    format: {
      ...DEFAULT_CALENDAR_POPUP_FORMAT,
      headerThemeMode: 'custom' as const,
      headerBgColor: '#ffffff',
      headerTextColor: '#0f172a',
      modalBgColor: '#f8fafc',
      cardBgColor: '#ffffff',
      cardInnerBgColor: '#f8fafc',
      cardBorderColor: '#e2e8f0',
      progressBarColorMode: 'custom' as const,
      progressBarCustomColor: '#0284c7',
      progressBarHeight: 'thin' as const,
      cardBorderRadius: 'rounded-lg' as const,
      cardShadow: 'subtle' as const,
    },
  },
  {
    id: 'executive_dark',
    name: 'Executivo Dark (Grafite / Slate)',
    description: 'Cabeçalho grafite escuro com cards nítidos e sofisticados',
    format: {
      ...DEFAULT_CALENDAR_POPUP_FORMAT,
      headerThemeMode: 'custom' as const,
      headerBgColor: '#0f172a',
      headerTextColor: '#ffffff',
      modalBgColor: '#e2e8f0',
      cardBgColor: '#ffffff',
      cardInnerBgColor: '#f1f5f9',
      cardBorderColor: '#94a3b8',
      progressBarColorMode: 'custom' as const,
      progressBarCustomColor: '#3b82f6',
      progressBarHeight: 'normal' as const,
      cardBorderRadius: 'rounded-xl' as const,
      cardShadow: 'medium' as const,
    },
  },
  {
    id: 'royal_blue',
    name: 'Azul Universitário (Royal Navy)',
    description: 'Tom azul real tradicional e harmônico',
    format: {
      ...DEFAULT_CALENDAR_POPUP_FORMAT,
      headerThemeMode: 'custom' as const,
      headerBgColor: '#1e3a8a',
      headerTextColor: '#ffffff',
      modalBgColor: '#eff6ff',
      cardBgColor: '#ffffff',
      cardInnerBgColor: '#f0f9ff',
      cardBorderColor: '#bfdbfe',
      progressBarColorMode: 'custom' as const,
      progressBarCustomColor: '#2563eb',
      progressBarHeight: 'normal' as const,
      cardBorderRadius: 'rounded-xl' as const,
      cardShadow: 'subtle' as const,
    },
  },
  {
    id: 'wine_solene',
    name: 'Vinho Solene / Marsala',
    description: 'Tom bordô formal acadêmico',
    format: {
      ...DEFAULT_CALENDAR_POPUP_FORMAT,
      headerThemeMode: 'custom' as const,
      headerBgColor: '#7f1d1d',
      headerTextColor: '#ffffff',
      modalBgColor: '#fef2f2',
      cardBgColor: '#ffffff',
      cardInnerBgColor: '#fff1f2',
      cardBorderColor: '#fecdd3',
      progressBarColorMode: 'custom' as const,
      progressBarCustomColor: '#e11d48',
      progressBarHeight: 'normal' as const,
      cardBorderRadius: 'rounded-xl' as const,
      cardShadow: 'subtle' as const,
    },
  },
];

export const CALENDAR_POPUP_CONFIG_KEY = 'calendar_popup_custom_config';
export const CALENDAR_POPUP_CONFIG_EVENT = 'calendar_popup_config_changed';

/**
 * Loads the Calendar Popup format from localStorage.
 */
export function loadCalendarPopupConfig(): CalendarPopupFormat {
  if (typeof window === 'undefined') return { ...DEFAULT_CALENDAR_POPUP_FORMAT };
  try {
    const raw = localStorage.getItem(CALENDAR_POPUP_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CALENDAR_POPUP_FORMAT, ...parsed };
    }
  } catch (e) {
    console.error('Error loading calendar popup config:', e);
  }
  return { ...DEFAULT_CALENDAR_POPUP_FORMAT };
}

/**
 * Saves the Calendar Popup format to localStorage and emits an event for instant UI update.
 */
export function saveCalendarPopupConfig(format: CalendarPopupFormat): void {
  try {
    localStorage.setItem(CALENDAR_POPUP_CONFIG_KEY, JSON.stringify(format));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CALENDAR_POPUP_CONFIG_EVENT, { detail: format }));
    }
  } catch (e) {
    console.error('Error saving calendar popup config:', e);
  }
}
