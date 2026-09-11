import { isPortalAppearanceLinked, loadGlobalPopupStyle } from '../utils/portalAppearanceLinks';

export interface TccDetailPopupFormat {
  // Theme & Presets (Esquema de Cores de Destaque)
  presetTheme?: string;
  primaryActionColor?: string;
  primaryActionTextColor?: string;
  badgeBgColor?: string;
  badgeTextColor?: string;
  badgeBorderColor?: string;
  buttonRadius?: 'rounded-none' | 'rounded-lg' | 'rounded-xl' | 'rounded-2xl' | 'rounded-full';

  // Layout View Mode
  viewMode?: 'tabs' | 'continuous';
  activeTabDefault?: 'cadastral' | 'defesa' | 'banca' | 'avaliacao' | 'documentos' | 'acervo' | 'todos';

  // Modal Container Styling
  modalBgColor?: string;
  modalBorderRadius?: 'none' | 'rounded-lg' | 'rounded-xl' | 'rounded-2xl';
  modalShadow?: 'none' | 'subtle' | 'medium' | 'prominent';
  modalMaxWidth?: '5xl' | '6xl' | '7xl' | 'full';

  // Header Styling
  headerBgColor?: string;
  headerTextColor?: string;
  headerTitleText?: string;
  headerSubtitleText?: string;
  showHeaderEmblem?: boolean;
  showHeaderRoleBadge?: boolean;
  showHeaderProtocolPill?: boolean;

  // Title Banner Card
  bannerStyle?: 'compact' | 'hero' | 'minimal' | 'card';
  bannerBgColor?: string;
  bannerTextColor?: string;
  bannerBorderColor?: string;
  titleFontSize?: 'sm' | 'base' | 'lg' | 'xl';
  titleFontWeight?: 'semibold' | 'bold' | 'black';
  titleUppercase?: boolean;

  // Content Cards & Density
  cardStyle?: 'flat' | 'bordered' | 'elevated' | 'subtle_tint';
  cardBorderRadius?: 'rounded-none' | 'rounded-lg' | 'rounded-xl' | 'rounded-2xl';
  cardBgColor?: string;
  cardBorderColor?: string;
  cardPadding?: 'compact' | 'comfortable' | 'spacious';
  fieldLabelStyle?: 'bold_uppercase' | 'subtle_mute' | 'pill_badge';

  // State Machine
  showStateMachine?: boolean;
  stateMachinePosition?: 'top_banner' | 'below_banner';
  stateMachineStyle?: 'classic_pills' | 'compact_bar' | 'stepper';
  stateMachineActiveColor?: string;

  // Section Visibilities
  showSectionCadastral?: boolean;
  showSectionDefesa?: boolean;
  showSectionBanca?: boolean;
  showSectionAvaliacao?: boolean;
  showSectionDocs?: boolean;
  showSectionAcervo?: boolean;
  showSectionAuditLog?: boolean;

  // Field Level Toggles
  showDriveButton?: boolean;
  showStudentMatricula?: boolean;
  showStudentEmail?: boolean;
  showAdvisorEmail?: boolean;
  showAdvisorInstitution?: boolean;
  showCargaHoraria?: boolean;
  showProtocolPillInCard?: boolean;
  showDefesaMapBadge?: boolean;
}

export const DEFAULT_TCC_DETAIL_POPUP_FORMAT: TccDetailPopupFormat = {
  presetTheme: 'militar',
  viewMode: 'tabs',
  activeTabDefault: 'todos',
  modalBgColor: '#f8fafc',
  modalBorderRadius: 'rounded-2xl',
  modalShadow: 'prominent',
  modalMaxWidth: '6xl',

  headerBgColor: '#005830',
  headerTextColor: '#ffffff',
  headerTitleText: 'Painel de Gestão e Detalhes do TCC',
  headerSubtitleText: 'Curso • Instituição',
  showHeaderEmblem: true,
  showHeaderRoleBadge: true,
  showHeaderProtocolPill: true,

  bannerStyle: 'card',
  bannerBgColor: '#0f172a',
  bannerTextColor: '#f8fafc',
  bannerBorderColor: '#334155',
  titleFontSize: 'base',
  titleFontWeight: 'black',
  titleUppercase: false,

  cardStyle: 'bordered',
  cardBorderRadius: 'rounded-xl',
  cardBgColor: '#ffffff',
  cardBorderColor: '#e2e8f0',
  cardPadding: 'comfortable',
  fieldLabelStyle: 'bold_uppercase',

  showStateMachine: true,
  stateMachinePosition: 'below_banner',
  stateMachineStyle: 'classic_pills',
  stateMachineActiveColor: '#005830',

  showSectionCadastral: true,
  showSectionDefesa: true,
  showSectionBanca: true,
  showSectionAvaliacao: true,
  showSectionDocs: true,
  showSectionAcervo: true,
  showSectionAuditLog: true,

  showDriveButton: true,
  showStudentMatricula: true,
  showStudentEmail: true,
  showAdvisorEmail: true,
  showAdvisorInstitution: true,
  showCargaHoraria: true,
  showProtocolPillInCard: true,
  showDefesaMapBadge: true,

  primaryActionColor: '#005830',
  primaryActionTextColor: '#ffffff',
  badgeBgColor: '#ecfdf5',
  badgeTextColor: '#005830',
  badgeBorderColor: '#a7f3d0',
  buttonRadius: 'rounded-xl',
};

export const TCC_DETAIL_POPUP_CONFIG_KEY = 'tcc_detail_popup_format_v1';
export const TCC_DETAIL_POPUP_CONFIG_EVENT = 'tcc_detail_popup_format_changed';

export function loadTccDetailPopupFormat(): TccDetailPopupFormat {
  if (typeof window === 'undefined') return { ...DEFAULT_TCC_DETAIL_POPUP_FORMAT };
  try {
    const raw = localStorage.getItem(TCC_DETAIL_POPUP_CONFIG_KEY);
    const local = raw
      ? { ...DEFAULT_TCC_DETAIL_POPUP_FORMAT, ...JSON.parse(raw) }
      : { ...DEFAULT_TCC_DETAIL_POPUP_FORMAT };
    if (!isPortalAppearanceLinked('popup_tcc_detail')) return local;
    const global = loadGlobalPopupStyle();
    return {
      ...local,
      modalBgColor: global.surfaceBgColor,
      headerBgColor: global.headerBgColor,
      headerTextColor: global.headerTextColor,
      primaryActionColor: global.actionBgColor,
      primaryActionTextColor: global.actionTextColor,
      modalBorderRadius: global.borderRadius === '0px'
        ? 'none'
        : global.borderRadius === '8px'
          ? 'rounded-lg'
          : global.borderRadius === '12px'
            ? 'rounded-xl'
            : 'rounded-2xl',
    };
  } catch (e) {
    console.warn('Error loading tcc detail format:', e);
  }
  return { ...DEFAULT_TCC_DETAIL_POPUP_FORMAT };
}

export function saveTccDetailPopupFormat(format: TccDetailPopupFormat): void {
  try {
    localStorage.setItem(TCC_DETAIL_POPUP_CONFIG_KEY, JSON.stringify(format));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(TCC_DETAIL_POPUP_CONFIG_EVENT, { detail: format }));
    }
  } catch (e) {
    console.error('Error saving tcc detail format:', e);
  }
}
