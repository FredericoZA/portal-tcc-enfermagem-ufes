import { normalizeUnifiedAppearance } from '../utils/unifiedAppearance';
import { portalFontFamily, portalFontKey } from '../utils/portalFonts';
import type { GlobalSettings } from '../types';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Palette,
  LayoutTemplate,
  Sliders,
  Columns,
  RotateCcw,
  CheckCircle2,
  X,
  Building2,
  Menu,
  Layers,
  Square,
  Eye,
  Plus,
  MessageCircle,
  Calendar,
  BookOpen,
  FileText,
  Award,
  Upload,
  Sparkles,
  Lock,
  FileCheck,
  SlidersHorizontal,
  FolderKanban,
  Wand2,
  Maximize2,
  HelpCircle,
  Image as ImageIcon,
  Link2,
  Unlink,
  Paperclip,
  TableProperties,
  Type,
  AlignLeft,
  AlignCenter
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { NursingEmblemLogo } from './NursingEmblemLogo';
import {
  DEFAULT_TABLE_TEXT_FORMAT,
  TableTextFormat,
  HeaderTheme,
} from './TableColumnSelectorPanel';
import {
  loadSiteLayoutConfig,
  saveSiteLayoutConfig,
  resetSiteLayoutConfig,
  SiteLayoutConfig,
} from '../utils/siteLayoutConfig';
import {
  loadGlobalTableConfig,
  saveGlobalTableConfig,
} from '../utils/tableFormatters';
import {
  CalendarPopupFormat,
  DEFAULT_CALENDAR_POPUP_FORMAT,
  loadCalendarPopupConfig,
  saveCalendarPopupConfig
} from '../utils/calendarPopupConfig';
import {
  TccDetailPopupFormat,
  DEFAULT_TCC_DETAIL_POPUP_FORMAT,
  loadTccDetailPopupFormat,
  saveTccDetailPopupFormat
} from '../types/tccDetailFormat';
import {
  LoginPopupConfig,
  DEFAULT_LOGIN_POPUP_CONFIG,
  loadLoginPopupConfig,
  saveLoginPopupConfig
} from '../utils/loginPopupConfig';
import { SpreadsheetPreviewSection } from './editor/SpreadsheetPreviewSection';
import { PopupPreviewSection } from './editor/PopupPreviewSection';
import { ImageUploadField } from './ImageUploadField';
import {
  DEFAULT_GLOBAL_POPUP_STYLE,
  DEFAULT_PORTAL_APPEARANCE_LINKS,
  GlobalPopupStyle,
  TABLE_STORAGE_BY_EDITOR_TAB,
  loadGlobalPopupStyle,
  loadPortalAppearanceLinks,
  saveGlobalPopupStyle,
  savePortalAppearanceLinks,
} from '../utils/portalAppearanceLinks';

export type UnifiedEditorTab =
  | 'quick_presets'
  | 'site_header'
  | 'site_sidebar'
  | 'site_footer'
  | 'global_table_buttons'
  | 'global_table_style'
  | 'table_columns'
  | 'global_popup_style'
  | 'sheet_calendar'
  | 'sheet_repository'
  | 'sheet_my_tccs'
  | 'sheet_coordinator'
  | 'popup_tcc_detail'
  | 'popup_new_defense'
  | 'popup_upload_ata'
  | 'popup_hipoar'
  | 'popup_pdf_viewer'
  | 'popup_login'
  | 'popup_correction';

export type UnifiedEditorScope =
  | 'all'
  | 'table'
  | 'site_header'
  | 'site_sidebar'
  | 'site_footer'
  | 'table_header'
  | 'table_first_col'
  | 'table_body'
  | 'buttons'
  | 'table_columns'
  | 'table_general';

export interface UnifiedPortalEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: UnifiedEditorTab;
  scope?: UnifiedEditorScope;

  // Table Props (Optional when opened from site-wide buttons)
  storageKey?: string;
  recordsLimit?: number | 'all';
  setRecordsLimit?: (limit: number | 'all') => void;
  allowedLimits?: (number | 'all')[];
  allColumns?: { key: string; label: string; isFixed?: boolean }[];
  visibleColumns?: Record<string, boolean>;
  setVisibleColumns?: (
    visible: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => void;
  columnOrder?: string[];
  setColumnOrder?: (order: string[]) => void;
  customLabels?: Record<string, string>;
  setCustomLabels?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  columnWidths?: Record<string, string | number>;
  setColumnWidths?: React.Dispatch<React.SetStateAction<Record<string, string | number>>>;
  textFormat?: TableTextFormat;
  setTextFormat?: React.Dispatch<React.SetStateAction<TableTextFormat>>;
  defaultColumnOrder?: string[];
  defaultVisibleColumns?: Record<string, boolean>;
  defaultRecordsLimit?: number | 'all';
  startDate?: string;
  setStartDate?: (val: string) => void;
  endDate?: string;
  setEndDate?: (val: string) => void;
  defaultTableTitle?: string;
  defaultFilterTitle?: string;
}

export interface GeneralPopupsConfig {
  fontFamily?: string;
  fontSize?: string;
  styleVariant?: 'solid' | 'minimal' | 'elevated';
  borderRadius?: string;
  borderColor?: string;
  newDefenseBg?: string;
  newDefenseHeaderBg?: string;
  newDefenseHeaderTextColor?: string;
  newDefenseBtnBg?: string;
  newDefenseBtnText?: string;
  newDefenseTitle?: string;
  newDefenseSubtitle?: string;
  uploadAtaBg: string;
  uploadAtaHeaderBg: string;
  uploadAtaHeaderTextColor: string;
  uploadAtaBtnBg: string;
  uploadAtaBtnText: string;
  uploadAtaTitle?: string;
  uploadAtaSubtitle?: string;

  hipoarBg: string;
  hipoarHeaderBg: string;
  hipoarHeaderTextColor: string;
  hipoarCardBg: string;
  hipoarAccentColor: string;
  hipoarTitle?: string;
  hipoarSubtitle?: string;

  pdfViewerBg: string;
  pdfViewerHeaderBg: string;
  pdfViewerHeaderTextColor: string;
  pdfViewerBtnBg: string;
  pdfViewerTitle?: string;

  correctionBg: string;
  correctionHeaderBg: string;
  correctionHeaderTextColor: string;
  correctionBtnBg: string;
  correctionTitle?: string;
  correctionSubtitle?: string;
}

const DEFAULT_GENERAL_POPUPS_CONFIG: GeneralPopupsConfig = {
  fontFamily: 'Inter, sans-serif',
  fontSize: '14px',
  styleVariant: 'solid',
  borderRadius: '16px',
  borderColor: '#cbd5e1',
  newDefenseBg: '#ffffff',
  newDefenseHeaderBg: '#005830',
  newDefenseHeaderTextColor: '#ffffff',
  newDefenseBtnBg: '#005830',
  newDefenseBtnText: '#ffffff',
  newDefenseTitle: 'Agendar Defesa de TCC',
  newDefenseSubtitle: 'Cadastro formal da banca examinadora',
  uploadAtaBg: '#ffffff',
  uploadAtaHeaderBg: '#005830',
  uploadAtaHeaderTextColor: '#ffffff',
  uploadAtaBtnBg: '#005830',
  uploadAtaBtnText: '#ffffff',
  uploadAtaTitle: 'Upload da Ata Assinada e Documentos',
  uploadAtaSubtitle: 'Envie o arquivo em formato PDF devidamente assinado pela banca examinadora.',

  hipoarBg: '#f8fafc',
  hipoarHeaderBg: '#0f172a',
  hipoarHeaderTextColor: '#ffffff',
  hipoarCardBg: '#ffffff',
  hipoarAccentColor: '#0284c7',
  hipoarTitle: 'Análise Hipoar e Ficha de Avaliação da Banca',
  hipoarSubtitle: 'Pontuação detalhada por critérios metodológicos e de apresentação.',

  pdfViewerBg: '#0f172a',
  pdfViewerHeaderBg: '#1e293b',
  pdfViewerHeaderTextColor: '#ffffff',
  pdfViewerBtnBg: '#2563eb',
  pdfViewerTitle: 'Visualização Completa do Documento PDF',

  correctionBg: '#ffffff',
  correctionHeaderBg: '#005830',
  correctionHeaderTextColor: '#ffffff',
  correctionBtnBg: '#005830',
  correctionTitle: 'Solicitação de Correção',
  correctionSubtitle: 'Descreva a correção necessária no documento para análise administrativa.'
};

const GENERAL_POPUPS_KEY = 'portal_general_popups_config_v1';
export const GENERAL_POPUPS_EVENT = 'general_popups_config_changed';

function applyGeneralPopupCssVariables(
  config: GeneralPopupsConfig,
  globalStyle: GlobalPopupStyle = loadGlobalPopupStyle(),
  links: Record<string, boolean> = loadPortalAppearanceLinks(),
) {
  if(typeof document==='undefined')return;
  const root=document.documentElement.style;
  const isLinked = (_key: string) => true;
  const shadow = globalStyle.styleVariant === 'minimal'
    ? '0 1px 2px rgba(15,23,42,.08)'
    : globalStyle.styleVariant === 'elevated'
      ? '0 24px 60px rgba(15,23,42,.28)'
      : '0 16px 40px rgba(15,23,42,.2)';
  const effective = (
    key: string,
    local: { bg: string; header: string; headerText: string; action: string; actionText?: string },
  ) => isLinked(key)
    ? {
        bg: globalStyle.surfaceBgColor,
        header: globalStyle.headerBgColor,
        headerText: globalStyle.headerTextColor,
        action: globalStyle.actionBgColor,
        actionText: globalStyle.actionTextColor,
      }
    : local;
  const newDefense = effective('popup_new_defense', {
    bg: config.newDefenseBg || '#ffffff', header: config.newDefenseHeaderBg || '#005830',
    headerText: config.newDefenseHeaderTextColor || '#ffffff', action: config.newDefenseBtnBg || '#005830',
    actionText: config.newDefenseBtnText || '#ffffff',
  });
  const upload = effective('popup_upload_ata', {
    bg: config.uploadAtaBg || '#ffffff', header: config.uploadAtaHeaderBg || '#005830',
    headerText: config.uploadAtaHeaderTextColor || '#ffffff', action: config.uploadAtaBtnBg || '#005830',
    actionText: config.uploadAtaBtnText || '#ffffff',
  });
  const hipoar = effective('popup_hipoar', {
    bg: config.hipoarBg || '#f8fafc', header: config.hipoarHeaderBg || '#0f172a',
    headerText: config.hipoarHeaderTextColor || '#ffffff', action: config.hipoarAccentColor || '#0284c7',
  });
  const pdf = effective('popup_pdf_viewer', {
    bg: config.pdfViewerBg || '#0f172a', header: config.pdfViewerHeaderBg || '#1e293b',
    headerText: config.pdfViewerHeaderTextColor || '#ffffff', action: config.pdfViewerBtnBg || '#2563eb',
  });
  const correction = effective('popup_correction', {
    bg: config.correctionBg || '#ffffff', header: config.correctionHeaderBg || '#005830',
    headerText: config.correctionHeaderTextColor || '#ffffff', action: config.correctionBtnBg || '#005830',
  });

  root.setProperty('--portal-popup-font', globalStyle.fontFamily);
  root.setProperty('--portal-popup-size', globalStyle.fontSize);
  root.setProperty('--portal-popup-bg', globalStyle.surfaceBgColor);
  root.setProperty('--portal-popup-header', globalStyle.headerBgColor);
  root.setProperty('--portal-popup-header-text', globalStyle.headerTextColor);
  root.setProperty('--portal-popup-action', globalStyle.actionBgColor);
  root.setProperty('--portal-popup-action-text', globalStyle.actionTextColor);
  root.setProperty('--portal-popup-radius', globalStyle.borderRadius);
  root.setProperty('--portal-popup-border', globalStyle.borderColor);
  root.setProperty('--portal-popup-shadow', shadow);
  root.setProperty('--portal-new-defense-bg', newDefense.bg);
  root.setProperty('--portal-new-defense-header', newDefense.header);
  root.setProperty('--portal-new-defense-header-text', newDefense.headerText);
  root.setProperty('--portal-new-defense-action', newDefense.action);
  root.setProperty('--portal-new-defense-action-text', newDefense.actionText || '#ffffff');
  root.setProperty('--portal-upload-bg', upload.bg);
  root.setProperty('--portal-upload-header', upload.header);
  root.setProperty('--portal-upload-header-text', upload.headerText);
  root.setProperty('--portal-upload-action', upload.action);
  root.setProperty('--portal-upload-action-text', upload.actionText || '#ffffff');
  root.setProperty('--portal-hipoar-bg', hipoar.bg);
  root.setProperty('--portal-hipoar-header', hipoar.header);
  root.setProperty('--portal-hipoar-header-text', hipoar.headerText);
  root.setProperty('--portal-hipoar-action', hipoar.action);
  root.setProperty('--portal-pdf-bg', pdf.bg);
  root.setProperty('--portal-pdf-header', pdf.header);
  root.setProperty('--portal-pdf-header-text', pdf.headerText);
  root.setProperty('--portal-pdf-action', pdf.action);
  root.setProperty('--portal-correction-bg', correction.bg);
  root.setProperty('--portal-correction-header', correction.header);
  root.setProperty('--portal-correction-header-text', correction.headerText);
  root.setProperty('--portal-correction-action', correction.action);
}

function contrastRatio(foreground:string,background:string):number{
  const luminance=(hex:string)=>{const clean=String(hex||'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(clean))return 0;const rgb=[0,2,4].map(index=>parseInt(clean.slice(index,index+2),16)/255).map(value=>value<=.03928?value/12.92:Math.pow((value+.055)/1.055,2.4));return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
  const a=luminance(foreground),b=luminance(background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

export function loadGeneralPopupsConfig(): GeneralPopupsConfig {
  if (typeof window === 'undefined') return DEFAULT_GENERAL_POPUPS_CONFIG;
  try {
    const raw = localStorage.getItem(GENERAL_POPUPS_KEY);
    const config=raw?{ ...DEFAULT_GENERAL_POPUPS_CONFIG, ...JSON.parse(raw) }:DEFAULT_GENERAL_POPUPS_CONFIG;
    applyGeneralPopupCssVariables(config);
    return config;
  } catch (e) {
    return DEFAULT_GENERAL_POPUPS_CONFIG;
  }
}

export function saveGeneralPopupsConfig(config: GeneralPopupsConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GENERAL_POPUPS_KEY, JSON.stringify(config));
    applyGeneralPopupCssVariables(config);
    window.dispatchEvent(new CustomEvent(GENERAL_POPUPS_EVENT, { detail: config }));
  } catch (e) {
    console.error('Erro ao salvar popups gerais:', e);
  }
}

// Preset Themes Mapping (Ordem do Arco-Íris / Espectro Cromático)
const PALETTE_THEMES: { id: HeaderTheme; label: string; primaryHex: string; textHex: string }[] = [
  // Vermelho / Vinho
  { id: 'red', label: 'Vermelho Nobre', primaryHex: '#b91c1c', textHex: '#ffffff' },
  { id: 'wine', label: 'Vinho', primaryHex: '#881337', textHex: '#ffffff' },
  // Laranja / Âmbar
  { id: 'orange', label: 'Laranja Quente', primaryHex: '#c2410c', textHex: '#ffffff' },
  { id: 'amber', label: 'Âmbar Dourado', primaryHex: '#b45309', textHex: '#ffffff' },
  // Verdes
  { id: 'militar', label: 'Verde Militar', primaryHex: '#005830', textHex: '#ffffff' },
  { id: 'emerald', label: 'Verde Esmeralda', primaryHex: '#059669', textHex: '#ffffff' },
  { id: 'forest', label: 'Verde Floresta', primaryHex: '#14532d', textHex: '#ffffff' },
  // Teal / Ciano
  { id: 'teal', label: 'Ciano Teal', primaryHex: '#0f766e', textHex: '#ffffff' },
  // Azuis
  { id: 'ocean', label: 'Azul Oceano', primaryHex: '#0284c7', textHex: '#ffffff' },
  { id: 'royal', label: 'Azul Real', primaryHex: '#1e3a8a', textHex: '#ffffff' },
  // Violeta / Púrpura
  { id: 'indigo', label: 'Índigo', primaryHex: '#3730a3', textHex: '#ffffff' },
  { id: 'purple', label: 'Púrpura Profundo', primaryHex: '#581c87', textHex: '#ffffff' },
  { id: 'marsala', label: 'Marsala', primaryHex: '#701a75', textHex: '#ffffff' },
  // Grafite / Escuro
  { id: 'steel', label: 'Grafite Aço', primaryHex: '#334155', textHex: '#ffffff' },
  { id: 'slate', label: 'Slate Noturno', primaryHex: '#1e293b', textHex: '#ffffff' },
  { id: 'dark', label: 'Preto Profundo', primaryHex: '#090d16', textHex: '#ffffff' },
  // Clean / Branco
  { id: 'clean', label: 'Branco Clean', primaryHex: '#ffffff', textHex: '#0f172a' },
];

const THEME_HARMONICS: Record<string, {
  sidebarBg: string;
  sidebarHeaderBg: string;
  sidebarActiveBg: string;
  sidebarActiveText: string;
  sidebarActiveBorder: string;
  footerBg: string;
  footerWhatsappBtnBg: string;
}> = {
  red: {
    sidebarBg: '#360c0c',
    sidebarHeaderBg: '#270606',
    sidebarActiveBg: '#7f1d1d',
    sidebarActiveText: '#fca5a5',
    sidebarActiveBorder: '#ef4444',
    footerBg: '#270606',
    footerWhatsappBtnBg: '#b91c1c',
  },
  wine: {
    sidebarBg: '#2d0612',
    sidebarHeaderBg: '#1f030a',
    sidebarActiveBg: '#4c0519',
    sidebarActiveText: '#fbcfe8',
    sidebarActiveBorder: '#f43f5e',
    footerBg: '#1f030a',
    footerWhatsappBtnBg: '#881337',
  },
  orange: {
    sidebarBg: '#3d1506',
    sidebarHeaderBg: '#290c03',
    sidebarActiveBg: '#7c2d12',
    sidebarActiveText: '#ffedd5',
    sidebarActiveBorder: '#fb923c',
    footerBg: '#290c03',
    footerWhatsappBtnBg: '#c2410c',
  },
  amber: {
    sidebarBg: '#381a04',
    sidebarHeaderBg: '#241002',
    sidebarActiveBg: '#78350f',
    sidebarActiveText: '#fde68a',
    sidebarActiveBorder: '#f59e0b',
    footerBg: '#241002',
    footerWhatsappBtnBg: '#b45309',
  },
  militar: {
    sidebarBg: '#011f17',
    sidebarHeaderBg: '#011812',
    sidebarActiveBg: '#033d2e',
    sidebarActiveText: '#a4ebd4',
    sidebarActiveBorder: '#7bc394',
    footerBg: '#011812',
    footerWhatsappBtnBg: '#005830',
  },
  emerald: {
    sidebarBg: '#022c22',
    sidebarHeaderBg: '#011c15',
    sidebarActiveBg: '#065f46',
    sidebarActiveText: '#a7f3d0',
    sidebarActiveBorder: '#34d399',
    footerBg: '#011c15',
    footerWhatsappBtnBg: '#059669',
  },
  forest: {
    sidebarBg: '#092e1a',
    sidebarHeaderBg: '#051f11',
    sidebarActiveBg: '#166534',
    sidebarActiveText: '#86efac',
    sidebarActiveBorder: '#4ade80',
    footerBg: '#051f11',
    footerWhatsappBtnBg: '#14532d',
  },
  teal: {
    sidebarBg: '#042f2e',
    sidebarHeaderBg: '#022120',
    sidebarActiveBg: '#115e59',
    sidebarActiveText: '#99f6e4',
    sidebarActiveBorder: '#2dd4bf',
    footerBg: '#022120',
    footerWhatsappBtnBg: '#0f766e',
  },
  ocean: {
    sidebarBg: '#072b42',
    sidebarHeaderBg: '#041c2c',
    sidebarActiveBg: '#0369a1',
    sidebarActiveText: '#bae6fd',
    sidebarActiveBorder: '#38bdf8',
    footerBg: '#041c2c',
    footerWhatsappBtnBg: '#0284c7',
  },
  royal: {
    sidebarBg: '#0f172a',
    sidebarHeaderBg: '#090d16',
    sidebarActiveBg: '#1e40af',
    sidebarActiveText: '#bfdbfe',
    sidebarActiveBorder: '#60a5fa',
    footerBg: '#090d16',
    footerWhatsappBtnBg: '#1e3a8a',
  },
  indigo: {
    sidebarBg: '#1e1b4b',
    sidebarHeaderBg: '#110e38',
    sidebarActiveBg: '#3730a3',
    sidebarActiveText: '#c7d2fe',
    sidebarActiveBorder: '#818cf8',
    footerBg: '#110e38',
    footerWhatsappBtnBg: '#3730a3',
  },
  purple: {
    sidebarBg: '#2e1065',
    sidebarHeaderBg: '#1f0a45',
    sidebarActiveBg: '#6b21a8',
    sidebarActiveText: '#e9d5ff',
    sidebarActiveBorder: '#c084fc',
    footerBg: '#1f0a45',
    footerWhatsappBtnBg: '#581c87',
  },
  marsala: {
    sidebarBg: '#2e0930',
    sidebarHeaderBg: '#1f0521',
    sidebarActiveBg: '#86198f',
    sidebarActiveText: '#f5d0fe',
    sidebarActiveBorder: '#e879f9',
    footerBg: '#1f0521',
    footerWhatsappBtnBg: '#701a75',
  },
  steel: {
    sidebarBg: '#0f172a',
    sidebarHeaderBg: '#090d16',
    sidebarActiveBg: '#1e293b',
    sidebarActiveText: '#e2e8f0',
    sidebarActiveBorder: '#94a3b8',
    footerBg: '#090d16',
    footerWhatsappBtnBg: '#334155',
  },
  slate: {
    sidebarBg: '#0f172a',
    sidebarHeaderBg: '#020617',
    sidebarActiveBg: '#334155',
    sidebarActiveText: '#e2e8f0',
    sidebarActiveBorder: '#94a3b8',
    footerBg: '#020617',
    footerWhatsappBtnBg: '#1e293b',
  },
  dark: {
    sidebarBg: '#000000',
    sidebarHeaderBg: '#090d16',
    sidebarActiveBg: '#1e293b',
    sidebarActiveText: '#ffffff',
    sidebarActiveBorder: '#475569',
    footerBg: '#000000',
    footerWhatsappBtnBg: '#1e293b',
  },
  clean: {
    sidebarBg: '#f8fafc',
    sidebarHeaderBg: '#f1f5f9',
    sidebarActiveBg: '#e2e8f0',
    sidebarActiveText: '#0f172a',
    sidebarActiveBorder: '#0f172a',
    footerBg: '#f1f5f9',
    footerWhatsappBtnBg: '#0f172a',
  },
};

const FONT_OPTIONS = [
  { value: 'Inter, sans-serif', label: 'Inter (Padrão Limpo)' },
  { value: 'Roboto, sans-serif', label: 'Roboto (Moderno)' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat (Elegante)' },
  { value: '"Playfair Display", serif', label: 'Playfair Display (Serifado Nobre)' },
  { value: 'Georgia, serif', label: 'Georgia (Acadêmico)' },
  { value: '"Open Sans", sans-serif', label: 'Open Sans' },
  { value: 'Lato, sans-serif', label: 'Lato' },
  { value: '"Courier New", monospace', label: 'Monospace (Técnico)' },
  { value: 'system-ui, sans-serif', label: 'Sistema Nativo' },
];

// Helper UI Components
const ColorField: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
}> = ({ label, value, onChange }) => (
  <label className="flex items-center justify-between gap-2 p-2.5 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800 cursor-pointer shadow-2xs hover:border-slate-300 transition-all">
    <span className="truncate text-slate-800 font-bold">{label}</span>
    <span className="flex items-center gap-2 shrink-0">
      <span className="text-[10px] font-mono font-extrabold text-slate-500 uppercase">{value || '#ffffff'}</span>
      <input
        type="color"
        value={value || '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-9 cursor-pointer rounded-md border border-slate-300 bg-white p-0.5 shadow-2xs"
      />
    </span>
  </label>
);

const TextField: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  onChange: (val: string) => void;
}> = ({ label, value, placeholder, onChange }) => (
  <div className="space-y-1">
    <label className="block text-[10.5px] font-black text-slate-700 uppercase tracking-wider">
      {label}
    </label>
    <input
      type="text"
      value={value || ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 shadow-2xs focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all"
    />
  </div>
);

const FontSelectorField: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="space-y-1">
    <label className="block text-[10.5px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
      <Type className="w-3.5 h-3.5 text-slate-600" />
      <span>{label}</span>
    </label>
    <select
      value={value || 'Inter, sans-serif'}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 shadow-2xs focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all cursor-pointer"
    >
      {FONT_OPTIONS.map((f) => (
        <option key={f.value} value={f.value}>
          {f.label}
        </option>
      ))}
    </select>
  </div>
);

const ImageField: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  onChange: (val: string) => void;
}> = ({ label, value, placeholder, onChange }) => (
  <div className="space-y-1.5">
    <label className="block text-[10.5px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
      <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
      <span>{label}</span>
    </label>
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value || ''}
        placeholder={placeholder || 'https://...'}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 text-xs font-bold bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 shadow-2xs focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all"
      />
      {value && (
        <div className="w-10 h-10 bg-slate-100 rounded-lg border border-slate-300 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
          <img src={value} alt="Preview" className="w-full h-full object-contain" />
        </div>
      )}
    </div>
  </div>
);

function synchronizeLinkedBarAccents(
  config: SiteLayoutConfig,
  links: Record<string, boolean>,
  source: 'site_header' | 'site_sidebar' | 'site_footer',
): SiteLayoutConfig {
  if (links[source] === false) return config;
  const accent = source === 'site_sidebar'
    ? config.sidebarActiveBgColor
    : source === 'site_footer'
      ? config.footerWhatsappBtnBg
      : config.headerBgColor;
  const accentText = source === 'site_sidebar'
    ? config.sidebarActiveTextColor
    : source === 'site_footer'
      ? config.footerWhatsappBtnText
      : config.headerTextColor;
  if (!accent) return config;

  return {
    ...config,
    ...(links.site_header !== false ? { headerBgColor: accent, headerTextColor: accentText || '#ffffff' } : {}),
    ...(links.site_sidebar !== false ? {
      sidebarActiveBgColor: accent,
      sidebarActiveBorderColor: accent,
      sidebarActiveTextColor: accentText || '#ffffff',
    } : {}),
    ...(links.site_footer !== false ? {
      footerWhatsappBtnBg: accent,
      footerWhatsappBtnText: accentText || '#ffffff',
    } : {}),
  };
}

export const UnifiedPortalEditorModal: React.FC<UnifiedPortalEditorModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'quick_presets',
  textFormat,
  setTextFormat,
  storageKey,
  recordsLimit,
  setRecordsLimit,
  allColumns = [],
  visibleColumns = {},
  setVisibleColumns,
  columnOrder,
  setColumnOrder,
}) => {
  const { userEmail, refreshAuth, settings } = useAuth();
  const [activeTab, setActiveTab] = useState<UnifiedEditorTab>(initialTab);

  // Unified Configurations State
  const [siteConfig, setSiteConfig] = useState<SiteLayoutConfig>(loadSiteLayoutConfig());
  const [localTableFormat, setLocalTableFormat] = useState<TableTextFormat>(
    textFormat || loadGlobalTableConfig()
  );
  const [calendarPopupFormat, setCalendarPopupFormat] = useState<CalendarPopupFormat>(
    loadCalendarPopupConfig()
  );
  const [tccDetailFormat, setTccDetailFormat] = useState<TccDetailPopupFormat>(
    loadTccDetailPopupFormat()
  );
  const [loginPopupConfig, setLoginPopupConfig] = useState<LoginPopupConfig>(
    loadLoginPopupConfig()
  );
  const [generalPopupsConfig, setGeneralPopupsConfig] = useState<GeneralPopupsConfig>(
    loadGeneralPopupsConfig()
  );
  const [globalPopupStyle, setGlobalPopupStyle] = useState<GlobalPopupStyle>(loadGlobalPopupStyle);

  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [layoutColumnOrder, setLayoutColumnOrder] = useState<string[]>(() => columnOrder?.length ? columnOrder : allColumns.map((column) => column.key));

  // Rainbow Theme, Theme Mode & Letter Combination State
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [rainbowThemeId, setRainbowThemeId] = useState<string>('militar');
  const [letterComboOption, setLetterComboOption] = useState<1 | 2 | 3>(1);
  const [fontPresetId, setFontPresetId] = useState<1 | 2 | 3>(1);
  const [buttonPresetId, setButtonPresetId] = useState<1 | 2 | 3>(2);
  const [popupPresetId, setPopupPresetId] = useState<1 | 2 | 3>(1);

  // LINKED ITEMS MAP STATE (PAPERCLIP ON LEFT SIDEBAR)
  const [linkedItems, setLinkedItems] = useState<Record<string, boolean>>(loadPortalAppearanceLinks);

  const applyGlobalPopupStyleToItem = (
    itemKey: string,
    style: GlobalPopupStyle,
    links: Record<string, boolean>,
  ) => {
    if (itemKey === 'popup_tcc_detail') {
      setTccDetailFormat((current) => {
        const next = {
          ...current,
          modalBgColor: style.surfaceBgColor,
          headerBgColor: style.headerBgColor,
          headerTextColor: style.headerTextColor,
          primaryActionColor: style.actionBgColor,
          primaryActionTextColor: style.actionTextColor,
        };
        saveTccDetailPopupFormat(next);
        return next;
      });
    } else if (itemKey === 'popup_login') {
      setLoginPopupConfig((current) => {
        const next = {
          ...current,
          cardBgColor: style.headerBgColor,
          cardTextColor: style.headerTextColor,
          primaryBtnBg: style.actionBgColor,
          primaryBtnTextColor: style.actionTextColor,
        };
        saveLoginPopupConfig(next);
        return next;
      });
    } else {
      setGeneralPopupsConfig((current) => {
        let next = current;
        if (itemKey === 'popup_new_defense') next = {
          ...current,
          newDefenseBg: style.surfaceBgColor,
          newDefenseHeaderBg: style.headerBgColor,
          newDefenseHeaderTextColor: style.headerTextColor,
          newDefenseBtnBg: style.actionBgColor,
          newDefenseBtnText: style.actionTextColor,
        };
        if (itemKey === 'popup_upload_ata') next = {
          ...current,
          uploadAtaBg: style.surfaceBgColor,
          uploadAtaHeaderBg: style.headerBgColor,
          uploadAtaHeaderTextColor: style.headerTextColor,
          uploadAtaBtnBg: style.actionBgColor,
          uploadAtaBtnText: style.actionTextColor,
        };
        if (itemKey === 'popup_hipoar') next = {
          ...current,
          hipoarBg: style.surfaceBgColor,
          hipoarHeaderBg: style.headerBgColor,
          hipoarHeaderTextColor: style.headerTextColor,
          hipoarAccentColor: style.actionBgColor,
        };
        if (itemKey === 'popup_pdf_viewer') next = {
          ...current,
          pdfViewerBg: style.surfaceBgColor,
          pdfViewerHeaderBg: style.headerBgColor,
          pdfViewerHeaderTextColor: style.headerTextColor,
          pdfViewerBtnBg: style.actionBgColor,
        };
        if (itemKey === 'popup_correction') next = {
          ...current,
          correctionBg: style.surfaceBgColor,
          correctionHeaderBg: style.headerBgColor,
          correctionHeaderTextColor: style.headerTextColor,
          correctionBtnBg: style.actionBgColor,
        };
        const withSharedShape = {
          ...next,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          borderRadius: style.borderRadius,
          borderColor: style.borderColor,
          styleVariant: style.styleVariant,
        };
        saveGeneralPopupsConfig(withSharedShape);
        applyGeneralPopupCssVariables(withSharedShape, style, links);
        return withSharedShape;
      });
    }
  };

  const toggleItemLink = (itemKey: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setLinkedItems((prev) => {
      const next = { ...prev, [itemKey]: !prev[itemKey] };
      savePortalAppearanceLinks(next, loadGlobalTableConfig() as Record<string, unknown>);
      if (TABLE_STORAGE_BY_EDITOR_TAB[itemKey] && next[itemKey]) {
        const inherited = loadGlobalTableConfig();
        setLocalTableFormat(inherited);
        setTextFormat?.(inherited);
      }
      if (itemKey.startsWith('popup_') && next[itemKey]) {
        applyGlobalPopupStyleToItem(itemKey, globalPopupStyle, next);
      }
      if ((itemKey === 'site_header' || itemKey === 'site_sidebar' || itemKey === 'site_footer') && next[itemKey]) {
        setSiteConfig((current) => {
          const synchronized = synchronizeLinkedBarAccents(current, next, 'site_header');
          saveSiteLayoutConfig(synchronized);
          return synchronized;
        });
      }
      return next;
    });
  };

  // Sync when props change or modal opens
  useEffect(() => {
    if (isOpen) {
      setSiteConfig(loadSiteLayoutConfig());
      setLocalTableFormat(textFormat || loadGlobalTableConfig());
      setCalendarPopupFormat(loadCalendarPopupConfig());
      setTccDetailFormat(loadTccDetailPopupFormat());
      setLoginPopupConfig(loadLoginPopupConfig());
      setGeneralPopupsConfig(loadGeneralPopupsConfig());
      setGlobalPopupStyle(loadGlobalPopupStyle());
      setLinkedItems(loadPortalAppearanceLinks());
      if (initialTab) setActiveTab(initialTab);
    }
  }, [isOpen, initialTab, textFormat]);

  useEffect(() => {
    if (columnOrder?.length) setLayoutColumnOrder(columnOrder);
    else if (allColumns.length) setLayoutColumnOrder(allColumns.map((column) => column.key));
  }, [columnOrder, allColumns]);

  const saveSpecificLayout = (updates: Record<string, unknown>) => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(`default_table_config_${storageKey}`);
      const parsed = raw ? JSON.parse(raw) : {};
      localStorage.setItem(`default_table_config_${storageKey}`, JSON.stringify({ ...parsed, ...updates, updatedAt: new Date().toISOString(), updatedBy: userEmail }));
    } catch (error) { console.error('Falha ao salvar layout da planilha:', error); }
  };

  const moveLayoutColumn = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= layoutColumnOrder.length) return;
    const next = [...layoutColumnOrder];
    [next[index], next[target]] = [next[target], next[index]];
    setLayoutColumnOrder(next);
    setColumnOrder?.(next);
    saveSpecificLayout({ columnOrder: next });
  };

  useEffect(() => {
    if (!isOpen) return;
    const tableKey = TABLE_STORAGE_BY_EDITOR_TAB[activeTab];
    if (!tableKey) {
      if (activeTab === 'global_table_buttons' || activeTab === 'global_table_style') setLocalTableFormat(loadGlobalTableConfig());
      return;
    }
    try {
      const raw = localStorage.getItem(`default_table_config_${tableKey}`);
      const parsed = raw ? JSON.parse(raw) : {};
      const inherited = linkedItems[activeTab] !== false;
      setLocalTableFormat(inherited
        ? loadGlobalTableConfig()
        : { ...DEFAULT_TABLE_TEXT_FORMAT, ...loadGlobalTableConfig(), ...(parsed.textFormat || {}) });
    } catch {
      setLocalTableFormat(loadGlobalTableConfig());
    }
  }, [activeTab, isOpen]);

  // Real-time updaters with auto-persist and cross-item propagation when linked
  const updateSiteConfigLive = (updater: (prev: SiteLayoutConfig) => SiteLayoutConfig) => {
    const updated = updater(siteConfig);
    const next = activeTab === 'site_header' || activeTab === 'site_sidebar' || activeTab === 'site_footer'
      ? synchronizeLinkedBarAccents(updated, linkedItems, activeTab) : updated;
    setSiteConfig(next); saveSiteLayoutConfig(next);
    syncAllLinkedItems({ headerBgColor: next.headerBgColor, headerTextColor: next.headerTextColor, primaryButtonBg: next.footerWhatsappBtnBg || next.headerBgColor });
  };

  const updateTableFormatBatch = (updates: Partial<TableTextFormat>) => {
    const next = { ...loadGlobalTableConfig(), ...updates };
    saveGlobalTableConfig(next);
    setLocalTableFormat(next);
    setTextFormat?.(next);
    if (updates.customHeaderColor || updates.toolbarButtonColor || updates.customHeaderTextColor || updates.fontFamily) {
      syncAllLinkedItems({ headerBgColor: updates.customHeaderColor, headerTextColor: updates.customHeaderTextColor, primaryButtonBg: updates.toolbarButtonColor, fontFamily: updates.fontFamily ? ({ inter: 'Inter, sans-serif', arial: 'Arial, sans-serif', roboto: 'Roboto, Arial, sans-serif', verdana: 'Verdana, sans-serif', georgia: 'Georgia, serif', serif: 'Georgia, serif', mono: 'ui-monospace, monospace', rounded: 'Nunito, sans-serif' } as Record<string, string>)[updates.fontFamily] || 'Inter, ui-sans-serif, system-ui, sans-serif' : undefined });
    }
  };

  const publishAppearance = async () => {
    const layoutKeys = ['defenses', 'acervo', 'meus_processos', 'coordinator', 'tutorial_main'];
    const tableLayouts: Record<string, unknown> = {};
    for (const key of layoutKeys) {
      try {
        const raw = localStorage.getItem(`default_table_config_${key}`);
        if (raw) tableLayouts[key] = JSON.parse(raw);
      } catch (error) { console.error(`Configuração inválida de ${key}:`, error); }
    }
    setSaveMessage('Publicando configurações…');
    const contrastChecks = [
      ['Cabeçalho', siteConfig.headerTextColor || '#0f172a', siteConfig.headerBgColor || '#ffffff'],
      ['Barra lateral', siteConfig.sidebarTextColor || '#e2e8f0', siteConfig.sidebarBgColor || '#011f17'],
      ['Rodapé', siteConfig.footerTextColor || '#ffffff', siteConfig.footerBgColor || '#011812'],
      ['Pop-ups', generalPopupsConfig.uploadAtaHeaderTextColor, generalPopupsConfig.uploadAtaHeaderBg]
    ] as const;
    const contrastFailures = contrastChecks.filter(([, foreground, background]) => contrastRatio(foreground, background) < 4.5);
    if (contrastFailures.length) {
      setSaveMessage(`Publicação bloqueada: contraste insuficiente em ${contrastFailures.map(([label]) => label).join(', ')}.`);
      return;
    }
    try {
      await apiClient.updateSettings({
        tableAppearance: loadGlobalTableConfig(),
        tableLayouts,
        portalAppearance: {
          schemaVersion: 4,
          globalPopupStyle,
          linkedItems,
          siteConfig,
          calendarPopup: calendarPopupFormat,
          tccDetailPopup: tccDetailFormat,
          loginPopup: loginPopupConfig,
          generalPopups: generalPopupsConfig,
          designSystem: {
            primaryColor: siteConfig.sidebarActiveBgColor || siteConfig.headerTextColor || '#047857',
            textColor: siteConfig.headerTitleColor || '#0f172a',
            fontFamily: generalPopupsConfig.fontFamily || 'Inter, sans-serif',
            radius: generalPopupsConfig.borderRadius || '16px',
            targetSize: settings?.integrationStudio?.operationsPolicy?.accessibility?.minimumTargetSize || 44,
            contrastStandard: settings?.integrationStudio?.operationsPolicy?.accessibility?.minimumContrast || 'AA',
            validationScore: 100
          },
          publishedAt: new Date().toISOString(),
          publishedBy: userEmail
        }
      });
      await refreshAuth();
      setSaveMessage('Configurações publicadas para todos os usuários.');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Falha ao publicar as configurações.');
    }
  };

  const updateTableFormatLive = (key: keyof TableTextFormat, val: any) => {
    updateTableFormatBatch({ [key]: val });
  };

  const updateGlobalPopupStyleLive = (updater: (prev: GlobalPopupStyle) => GlobalPopupStyle) => {
    const next = saveGlobalPopupStyle(updater(loadGlobalPopupStyle()));
    setGlobalPopupStyle(next);
    const appearance = normalizeUnifiedAppearance({ ...settings, portalAppearance: {
      schemaVersion: 4, globalPopupStyle: next, generalPopups: generalPopupsConfig,
      tccDetailPopup: tccDetailFormat, loginPopup: loginPopupConfig, calendarPopup: calendarPopupFormat,
    } } as GlobalSettings).portalAppearance!;
    const general = appearance.generalPopups as GeneralPopupsConfig;
    setGeneralPopupsConfig(general); saveGeneralPopupsConfig(general);
    setTccDetailFormat(appearance.tccDetailPopup as TccDetailPopupFormat); saveTccDetailPopupFormat(appearance.tccDetailPopup as TccDetailPopupFormat);
    setLoginPopupConfig(appearance.loginPopup as LoginPopupConfig); saveLoginPopupConfig(appearance.loginPopup as LoginPopupConfig);
    setCalendarPopupFormat(appearance.calendarPopup as CalendarPopupFormat); saveCalendarPopupConfig(appearance.calendarPopup as CalendarPopupFormat);
    applyGeneralPopupCssVariables(general, next, linkedItems);
    const table = { ...loadGlobalTableConfig(), fontFamily: portalFontKey(next.fontFamily), customHeaderColor: next.headerBgColor, customHeaderTextColor: next.headerTextColor, headerTextColor: 'custom' as const, toolbarButtonColor: next.actionBgColor };
    saveGlobalTableConfig(table); setLocalTableFormat(table); setTextFormat?.(table);
  };

  const updateCalendarPopupLive = (updater: (prev: CalendarPopupFormat) => CalendarPopupFormat) => {
    const next = updater(calendarPopupFormat);
    setCalendarPopupFormat(next); saveCalendarPopupConfig(next);
    syncAllLinkedItems({ headerBgColor: next.headerBgColor, headerTextColor: next.headerTextColor, primaryButtonBg: next.progressBarCustomColor });
  };

  const updateTccDetailLive = (updater: (prev: TccDetailPopupFormat) => TccDetailPopupFormat) => {
    const next = updater(tccDetailFormat);
    setTccDetailFormat(next);
    saveTccDetailPopupFormat(next);
    if (activeTab === 'popup_tcc_detail' && linkedItems.popup_tcc_detail !== false) {
      updateGlobalPopupStyleLive((current) => ({
        ...current,
        surfaceBgColor: next.modalBgColor || current.surfaceBgColor,
        headerBgColor: next.headerBgColor || current.headerBgColor,
        headerTextColor: next.headerTextColor || current.headerTextColor,
        actionBgColor: next.primaryActionColor || current.actionBgColor,
        actionTextColor: next.primaryActionTextColor || current.actionTextColor,
      }));
    }
  };

  const updateLoginPopupLive = (updater: (prev: LoginPopupConfig) => LoginPopupConfig) => {
    const next = updater(loginPopupConfig);
    setLoginPopupConfig(next);
    saveLoginPopupConfig(next);
    if (activeTab === 'popup_login' && linkedItems.popup_login !== false) {
      updateGlobalPopupStyleLive((current) => ({
        ...current,
        headerBgColor: next.cardBgColor || current.headerBgColor,
        headerTextColor: next.cardTextColor || current.headerTextColor,
        actionBgColor: next.primaryBtnBg || current.actionBgColor,
        actionTextColor: next.primaryBtnTextColor || current.actionTextColor,
      }));
    }
  };

  const updateGeneralPopupsLive = (updater: (prev: GeneralPopupsConfig) => GeneralPopupsConfig) => {
    const next = updater(generalPopupsConfig);
    setGeneralPopupsConfig(next);
    saveGeneralPopupsConfig(next);
    const isSpecificPopup = activeTab.startsWith('popup_') && activeTab !== 'popup_tcc_detail' && activeTab !== 'popup_login';
    if (isSpecificPopup && linkedItems[activeTab] !== false) {
      const source = activeTab === 'popup_new_defense'
        ? { surface: next.newDefenseBg, header: next.newDefenseHeaderBg, headerText: next.newDefenseHeaderTextColor, action: next.newDefenseBtnBg, actionText: next.newDefenseBtnText }
        : activeTab === 'popup_hipoar'
          ? { surface: next.hipoarBg, header: next.hipoarHeaderBg, headerText: next.hipoarHeaderTextColor, action: next.hipoarAccentColor }
          : activeTab === 'popup_pdf_viewer'
            ? { surface: next.pdfViewerBg, header: next.pdfViewerHeaderBg, headerText: next.pdfViewerHeaderTextColor, action: next.pdfViewerBtnBg }
            : activeTab === 'popup_correction'
              ? { surface: next.correctionBg, header: next.correctionHeaderBg, headerText: next.correctionHeaderTextColor, action: next.correctionBtnBg }
              : { surface: next.uploadAtaBg, header: next.uploadAtaHeaderBg, headerText: next.uploadAtaHeaderTextColor, action: next.uploadAtaBtnBg, actionText: next.uploadAtaBtnText };
      updateGlobalPopupStyleLive((current) => ({
        ...current,
        surfaceBgColor: source.surface || current.surfaceBgColor,
        headerBgColor: source.header || current.headerBgColor,
        headerTextColor: source.headerText || current.headerTextColor,
        actionBgColor: source.action || current.actionBgColor,
        actionTextColor: source.actionText || current.actionTextColor,
        fontFamily: next.fontFamily || current.fontFamily,
        fontSize: next.fontSize || current.fontSize,
        borderRadius: next.borderRadius || current.borderRadius,
        borderColor: next.borderColor || current.borderColor,
        styleVariant: next.styleVariant || current.styleVariant,
      }));
    }
  };

  // Synchronize key styles across all items that have paperclip LINKED = TRUE
  const syncAllLinkedItems = (styles: { headerBgColor?: string; headerTextColor?: string; primaryButtonBg?: string; fontFamily?: string }) => {
    updateGlobalPopupStyleLive(current => ({ ...current,
      headerBgColor: styles.headerBgColor || current.headerBgColor,
      headerTextColor: styles.headerTextColor || current.headerTextColor,
      actionBgColor: styles.primaryButtonBg || current.actionBgColor,
      fontFamily: styles.fontFamily || current.fontFamily,
    }));
  };

  // 1-Click Preset Theme Applier (Support for Light/Dark Mode + 3 Letter/Bg Combinations)
  const applyPresetScheme = (
    themeId: string = rainbowThemeId,
    mode: 'dark' | 'light' = themeMode,
    letterCombo: 1 | 2 | 3 = letterComboOption
  ) => {
    setRainbowThemeId(themeId);
    setThemeMode(mode);
    setLetterComboOption(letterCombo);

    const selectedTheme = PALETTE_THEMES.find((t) => t.id === themeId) || PALETTE_THEMES[0];
    const primary = selectedTheme.primaryHex;
    const harmonic = THEME_HARMONICS[themeId] || THEME_HARMONICS['militar'];

    let headerBg = primary;
    let headerTextColor = '#ffffff';
    let headerTitleColor = '#ffffff';
    let sidebarBg = mode === 'dark' ? harmonic.sidebarBg : '#f8fafc';
    let sidebarHeaderBg = mode === 'dark' ? harmonic.sidebarHeaderBg : '#f1f5f9';
    let sidebarActiveBg = mode === 'dark' ? harmonic.sidebarActiveBg : primary;
    let sidebarActiveText = mode === 'dark' ? harmonic.sidebarActiveText : '#ffffff';
    let sidebarActiveBorder = mode === 'dark' ? harmonic.sidebarActiveBorder : primary;
    let footerBg = mode === 'dark' ? harmonic.footerBg : '#f1f5f9';
    let footerText = mode === 'dark' ? '#94a3b8' : '#475569';
    let tableHeaderTextColor = '#ffffff';
    let tableHeaderBgColor = primary;

    if (mode === 'dark') {
      if (letterCombo === 1) {
        // Opção 1: Texto Branco
        headerTextColor = '#ffffff';
        headerTitleColor = '#ffffff';
        tableHeaderTextColor = '#ffffff';
      } else if (letterCombo === 2) {
        // Opção 2: Texto Dourado / Amarelo
        headerTextColor = '#fef08a';
        headerTitleColor = '#fde047';
        tableHeaderTextColor = '#fde047';
      } else if (letterCombo === 3) {
        // Opção 3: Texto Menta / Ciano
        headerTextColor = '#99f6e4';
        headerTitleColor = '#5eead4';
        tableHeaderTextColor = '#99f6e4';
      }
    } else {
      // Modo Claro
      if (letterCombo === 1) {
        // Opção 1: Fundo Intenso + Texto Branco
        headerBg = primary;
        headerTextColor = '#ffffff';
        headerTitleColor = '#ffffff';
        tableHeaderTextColor = '#ffffff';
        tableHeaderBgColor = primary;
      } else if (letterCombo === 2) {
        // Opção 2: Fundo Branco + Texto Escuro
        headerBg = '#ffffff';
        headerTextColor = '#0f172a';
        headerTitleColor = primary === '#ffffff' ? '#0f172a' : primary;
        tableHeaderTextColor = '#0f172a';
        tableHeaderBgColor = '#f1f5f9';
        sidebarActiveBg = '#e2e8f0';
        sidebarActiveText = primary === '#ffffff' ? '#0f172a' : primary;
      } else if (letterCombo === 3) {
        // Opção 3: Fundo Suave + Texto Colorido
        headerBg = primary === '#ffffff' ? '#f1f5f9' : '#e0f2fe';
        headerTextColor = primary === '#ffffff' ? '#0f172a' : primary;
        headerTitleColor = primary === '#ffffff' ? '#0f172a' : primary;
        tableHeaderTextColor = primary === '#ffffff' ? '#0f172a' : primary;
        tableHeaderBgColor = primary === '#ffffff' ? '#e2e8f0' : '#bae6fd';
      }
    }

    const isLight = mode === 'light';
    const sidebarTextColor = isLight ? '#0f172a' : '#e2e8f0';
    const sidebarTitleColor = isLight ? '#0f172a' : '#ffffff';
    const sidebarSubtitleColor = isLight ? (primary === '#ffffff' ? '#047857' : primary) : '#7bc394';

    updateSiteConfigLive((c) => ({
      ...c,
      headerBgColor: headerBg,
      headerTextColor,
      headerTitleColor,
      sidebarBgColor: sidebarBg,
      sidebarHeaderBgColor: sidebarHeaderBg,
      sidebarTextColor,
      sidebarTitleColor,
      sidebarSubtitleColor,
      sidebarActiveBgColor: sidebarActiveBg,
      sidebarActiveTextColor: sidebarActiveText,
      sidebarActiveBorderColor: sidebarActiveBorder,
      footerBgColor: footerBg,
      footerTextColor: footerText,
      footerBorderColor: isLight ? '#cbd5e1' : '#1e293b',
      footerDividerColor: isLight ? '#cbd5e1' : '#033628',
      footerWhatsappBtnBg: primary,
    }));

    updateTableFormatBatch({
      headerTheme: selectedTheme.id as any,
      customHeaderColor: tableHeaderBgColor,
      customHeaderTextColor: tableHeaderTextColor,
      headerTextColor: tableHeaderTextColor as any,
      cellTextColor: isLight ? 'dark' : 'neutral',
      customCellTextColor: isLight ? '#0f172a' : undefined,
      toolbarButtonColor: primary,
      toolbarButtonBorderColor: primary,
    });

    updateCalendarPopupLive((c) => ({ ...c, headerBgColor: primary, progressBarCustomColor: primary }));
    updateTccDetailLive((c) => ({ ...c, headerBgColor: primary, primaryActionColor: primary }));
    
    const loginThemeMap: Record<string, LoginPopupConfig['headerTheme']> = {
      emerald: 'emerald',
      marinho: 'blue',
      ocean: 'blue',
      royal: 'blue',
      vinho: 'rose',
      red: 'rose',
      militar: 'emerald',
      forest: 'emerald',
      roxo: 'purple',
      purple: 'purple',
      indigo: 'indigo',
      marsala: 'purple',
      grafite: 'slate',
      steel: 'slate',
      amber: 'amber',
      orange: 'amber',
      monocromatico: 'slate',
      verde: 'emerald',
      slate: 'slate',
      dark: 'slate',
      clean: 'slate',
    };
    
    updateLoginPopupLive((c) => ({
      ...c,
      headerTheme: loginThemeMap[selectedTheme.id] || 'emerald',
      cardBgColor: primary,
      cardTextColor: '#ffffff',
      primaryBtnBg: primary,
      primaryBtnTextColor: '#ffffff',
    }));

    updateGeneralPopupsLive((c) => ({
      ...c,
      newDefenseHeaderBg: primary,
      newDefenseBtnBg: primary,
      uploadAtaHeaderBg: primary,
      uploadAtaBtnBg: primary,
      hipoarHeaderBg: primary,
      hipoarAccentColor: primary,
      pdfViewerHeaderBg: primary,
      pdfViewerBtnBg: primary,
      correctionHeaderBg: primary,
      correctionBtnBg: primary,
    }));

    setSaveMessage(`Tema "${selectedTheme.label.toUpperCase()}" aplicado com sucesso!`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Synchronize 3 Font Groups Alignment (Header, First Column, Cells)
  const syncThreeFontGroupsAlignment = (alignment: 'left' | 'center') => {
    updateTableFormatBatch({
      headerAlignment: alignment,
      firstColAlignment: alignment,
      cellAlignment: alignment,
    });
    setSaveMessage(`Alinhamento ajustado para "${alignment === 'left' ? 'ESQUERDA' : 'CENTRO'}"!`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Synchronize Unified Font Family Across All Groups
  const syncThreeFontGroupsFamily = (fontFamily: string) => {
    updateTableFormatBatch({
      fontFamily: fontFamily as any,
    });
    updateGlobalPopupStyleLive((c) => ({ ...c, fontFamily: portalFontFamily(fontFamily) }));
    setSaveMessage(`Padrão de fonte "${fontFamily.split(',')[0]}" aplicado!`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Preset 2: Font Pattern Applier for Entire Site
  const applyFontPreset = (id: 1 | 2 | 3) => {
    setFontPresetId(id);
    let fontFamily = 'inter';
    if (id === 2) fontFamily = 'roboto';
    if (id === 3) fontFamily = 'georgia';
    
    updateTableFormatBatch({
      fontFamily: fontFamily as any,
      boldHeaders: true,
      boldCells: false,
    });
    updateGeneralPopupsLive((c) => ({ ...c, fontFamily: id === 3 ? 'Georgia, serif' : id === 2 ? 'Roboto, sans-serif' : 'Inter, sans-serif' }));
    setSaveMessage(`Padrão de letras ${id} aplicado a todo o site!`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Preset 3: Button Pattern Applier for Entire Site
  const applyButtonPreset = (id: 1 | 2 | 3) => {
    setButtonPresetId(id);
    let radius: 'rounded-full' | 'rounded-lg' | 'rounded-md' = 'rounded-lg';
    let shape: 'circle' | 'rounded' | 'square' = 'rounded';
    if (id === 1) {
      radius = 'rounded-full';
      shape = 'circle';
    } else if (id === 3) {
      radius = 'rounded-md';
      shape = 'square';
    }
    updateTableFormatBatch({
      buttonBorderRadius: radius as any,
      toolbarButtonShape: shape as any,
    });
    setSaveMessage(`Padrão de botões ${id} aplicado!`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Preset 4: Popup Pattern Applier for Entire Site
  const applyPopupPreset = (id: 1 | 2 | 3) => {
    setPopupPresetId(id);
    updateGeneralPopupsLive((c) => ({
      ...c,
      fontFamily: localTableFormat.fontFamily === 'georgia' ? 'Georgia, serif' : localTableFormat.fontFamily === 'roboto' ? 'Roboto, sans-serif' : 'Inter, sans-serif',
      styleVariant: id === 2 ? 'minimal' : id === 3 ? 'elevated' : 'solid',
      borderRadius: id === 2 ? '10px' : id === 3 ? '22px' : '16px',
      borderColor: id === 2 ? '#94a3b8' : id === 3 ? '#d1d5db' : '#cbd5e1',
      uploadAtaBg: id === 3 ? '#f8fafc' : '#ffffff',
      correctionBg: id === 3 ? '#f8fafc' : '#ffffff',
      hipoarCardBg: id === 2 ? '#f8fafc' : '#ffffff',
    }));
    setSaveMessage(`Padrão de pop-ups ${id} aplicado!`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Restore Defaults Action
  const handleRestoreDefaults = () => {
    resetSiteLayoutConfig();
    setSiteConfig(loadSiteLayoutConfig());
    setLocalTableFormat({ ...DEFAULT_TABLE_TEXT_FORMAT });
    saveGlobalTableConfig(DEFAULT_TABLE_TEXT_FORMAT);
    setCalendarPopupFormat({ ...DEFAULT_CALENDAR_POPUP_FORMAT });
    saveCalendarPopupConfig(DEFAULT_CALENDAR_POPUP_FORMAT);
    setTccDetailFormat({ ...DEFAULT_TCC_DETAIL_POPUP_FORMAT });
    saveTccDetailPopupFormat(DEFAULT_TCC_DETAIL_POPUP_FORMAT);
    setLoginPopupConfig({ ...DEFAULT_LOGIN_POPUP_CONFIG });
    saveLoginPopupConfig(DEFAULT_LOGIN_POPUP_CONFIG);
    setGeneralPopupsConfig({ ...DEFAULT_GENERAL_POPUPS_CONFIG });
    saveGeneralPopupsConfig(DEFAULT_GENERAL_POPUPS_CONFIG);
    const restoredLinks = { ...DEFAULT_PORTAL_APPEARANCE_LINKS };
    setLinkedItems(restoredLinks);
    savePortalAppearanceLinks(restoredLinks, DEFAULT_TABLE_TEXT_FORMAT as Record<string, unknown>);

    if (setTextFormat) setTextFormat({ ...DEFAULT_TABLE_TEXT_FORMAT });
    setSaveMessage('Todas as configurações do portal foram restauradas para os padrões originais.');
    setTimeout(() => setSaveMessage(null), 3500);
  };

  if (!isOpen) return null;

  const toggleBlockLink = (keys: string[]) => {
    setLinkedItems((prev) => {
      const allLinked = keys.every((k) => prev[k]);
      const targetState = !allLinked;
      const next = { ...prev };
      keys.forEach((k) => {
        next[k] = targetState;
      });
      savePortalAppearanceLinks(next, loadGlobalTableConfig() as Record<string, unknown>);
      if (targetState && keys.some((key) => Boolean(TABLE_STORAGE_BY_EDITOR_TAB[key]))) {
        const inherited = loadGlobalTableConfig();
        setLocalTableFormat(inherited);
        setTextFormat?.(inherited);
      }
      if (targetState) {
        keys.filter((key) => key.startsWith('popup_')).forEach((key) => {
          applyGlobalPopupStyleToItem(key, globalPopupStyle, next);
        });
      }
      if (targetState && keys.some((key) => key === 'site_header' || key === 'site_sidebar' || key === 'site_footer')) {
        setSiteConfig((current) => {
          const synchronized = synchronizeLinkedBarAccents(current, next, 'site_header');
          saveSiteLayoutConfig(synchronized);
          return synchronized;
        });
      }
      return next;
    });
  };

  // Helper render link icon button on left sidebar
  const renderLinkButton = (_itemKey: string) => <span title="Aparência global compartilhada" className="p-1"><Link2 aria-hidden="true" className="h-3.5 w-3.5" /><span className="sr-only">Aparência global compartilhada</span></span>;

  // Helper render navigation row with link button
  const renderNavRow = (
    itemKey: UnifiedEditorTab,
    label: string,
    IconComponent: React.ComponentType<{ className?: string }>
  ) => {
    const isActive = activeTab === itemKey;

    return (
      <div key={itemKey} className={`w-full rounded-lg text-xs flex items-center gap-1 transition-all ${isActive?'bg-white text-slate-900 border border-slate-300 font-black shadow-2xs':'text-slate-700 hover:bg-slate-200/80 font-bold'}`}>
        <button type="button" onClick={() => setActiveTab(itemKey)} aria-current={isActive?'page':undefined} className="min-w-0 flex flex-1 items-center gap-2 px-2.5 py-1.5 text-left">
          <IconComponent className="w-4 h-4 shrink-0 text-slate-600" />
          <span className="truncate">{label}</span>
        </button>
        <span className="pr-1">{renderLinkButton(itemKey)}</span>
      </div>
    );
  };

  // Helper render block link status button
  const renderBlockLinkToggle = (_keys: string[], _blockTitle: string) => <span className="text-xs font-semibold">Padrão global</span>;


  // Button shape helper for previews
  const getButtonRadiusClass = () => {
    if (localTableFormat.toolbarButtonShape === 'square') return 'rounded-none';
    if (localTableFormat.toolbarButtonShape === 'circle') return 'rounded-full';
    return 'rounded-lg';
  };
  const headerContrast = contrastRatio(siteConfig.headerTextColor || '#ffffff', siteConfig.headerBgColor || '#005830');

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto" role="presentation">
      <div className="portal-modal-surface relative w-full max-w-7xl bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 flex flex-col max-h-[92vh] overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="portal-customization-title">
        
        {/* MODAL HEADER */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 text-slate-700 rounded-xl border border-slate-200">
              <Palette className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h2 id="portal-customization-title" className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <span>Personalização do Portal do TCC</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={publishAppearance}
              className="px-3 py-1.5 text-xs font-black text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Publicar no portal</span>
            </button>
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Restaurar todos os padrões originais"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restaurar Padrão</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NOTIFICATION FEEDBACK TOAST */}
        {saveMessage && (
          <div className="bg-slate-800 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shrink-0 animate-fade-in">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{saveMessage}</span>
            </span>
            <button type="button" onClick={() => setSaveMessage(null)} className="text-white hover:opacity-80">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* MODAL MAIN CONTENT */}
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden md:flex-row">
          
          {/* CATEGORIZED NAVIGATION SIDEBAR WITH LINKING COLUMN */}
          <div className="max-h-48 w-full bg-slate-100 text-slate-800 border-b border-slate-300 flex flex-col shrink-0 overflow-y-auto p-3 space-y-3 md:max-h-none md:w-72 md:border-b-0 md:border-r">
            
            {/* TEMAS PRONTOS */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab('quick_presets')}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                  activeTab === 'quick_presets'
                    ? 'bg-white text-slate-900 border border-slate-300 font-black shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-200/80 font-bold'
                }`}
              >
                <Wand2 className="w-4 h-4 text-slate-700 shrink-0" />
                <span>Temas Prontos (1-Clique)</span>
              </button>
            </div>

            {/* BLOCO 1: BARRAS DO PORTAL */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[10.5px] font-black uppercase tracking-wider text-slate-900 pb-1.5 border-b border-slate-100 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-700" />
                  <span>Barras do Portal</span>
                </span>
                {renderBlockLinkToggle(['site_header', 'site_sidebar', 'site_footer'], 'Barras do Portal')}
              </div>
              {renderNavRow('site_header', 'Barra Superior', Building2)}
              {renderNavRow('site_sidebar', 'Barra Lateral', Menu)}
              {renderNavRow('site_footer', 'Rodapé e Contatos', Layers)}
            </div>

            {/* BLOCO 2: PLANILHAS E TABELAS */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[10.5px] font-black uppercase tracking-wider text-slate-900 pb-1.5 border-b border-slate-100 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <TableProperties className="w-3.5 h-3.5 text-slate-700" />
                  <span>Planilhas e Tabelas</span>
                </span>
                {renderBlockLinkToggle([
                  'global_table_buttons',
                  'global_table_style',
                  'sheet_calendar',
                  'sheet_repository',
                  'sheet_my_tccs',
                  'sheet_coordinator'
                ], 'Planilhas e Tabelas')}
              </div>
              {renderNavRow('global_table_buttons', 'Botões no Topo', Square)}
              {renderNavRow('global_table_style', 'Estilo Base Planilhas', LayoutTemplate)}
              {renderNavRow('table_columns', 'Colunas, ordem e linhas', Columns)}
              {renderNavRow('sheet_calendar', 'Calendário Público', Calendar)}
              {renderNavRow('sheet_repository', 'Repositório & Acervo', BookOpen)}
              {renderNavRow('sheet_my_tccs', 'Meus TCCs (Aluno/Banca)', FileText)}
              {renderNavRow('sheet_coordinator', 'Área do Presidente', FolderKanban)}
            </div>

            {/* BLOCO 3: POPUPS E MODAIS */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[10.5px] font-black uppercase tracking-wider text-slate-900 pb-1.5 border-b border-slate-100 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-slate-700" />
                  <span>Popups e Modais</span>
                </span>
                {renderBlockLinkToggle([
                  'global_popup_style',
                  'popup_tcc_detail',
                  'popup_new_defense',
                  'popup_upload_ata',
                  'popup_hipoar',
                  'popup_pdf_viewer',
                  'popup_login',
                  'popup_correction'
                ], 'Popups e Modais')}
              </div>
              {renderNavRow('global_popup_style', 'Estilo Base Pop-ups', Sliders)}
              {renderNavRow('popup_tcc_detail', 'Detalhes TCC / Defesa', FileText)}
              {renderNavRow('popup_new_defense', 'Agendamento Defesa', Calendar)}
              {renderNavRow('popup_upload_ata', 'Upload de Ata', Upload)}
              {renderNavRow('popup_hipoar', 'Análise Hipoar', Award)}
              {renderNavRow('popup_pdf_viewer', 'Visualizador PDF', FileCheck)}
              {renderNavRow('popup_login', 'Login & Autenticação', Lock)}
              {renderNavRow('popup_correction', 'Solicitação de Correção', HelpCircle)}
            </div>
          </div>

          {/* EDITING BODY VIEW */}
          <div className="flex-1 min-w-0 overflow-y-auto p-4 bg-slate-50">


            {/* 1. QUICK PRESETS */}
            {activeTab === 'quick_presets' && (
              <div className="space-y-4">
                {(() => {
                  const buttonRadiusClass =
                    buttonPresetId === 1 ? 'rounded-full' : buttonPresetId === 3 ? 'rounded-md' : 'rounded-lg';
                  
                  const getFontFamilyClass = () => {
                    if (localTableFormat.fontFamily === 'georgia' || fontPresetId === 3) return 'font-serif';
                    if (localTableFormat.fontFamily === 'roboto' || fontPresetId === 2) return '[font-family:Roboto,sans-serif]';
                    return '[font-family:Inter,sans-serif]';
                  };

                  const headerAlignClass = localTableFormat.headerAlignment === 'center' ? 'text-center' : 'text-left';
                  const cellAlignClass = localTableFormat.cellAlignment === 'center' ? 'text-center' : 'text-left';

                  return (
                    /* FULL REALISTIC LIVE PREVIEWS (FIXED AT THE TOP) */
                    <div className={`w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden flex flex-col ${getFontFamilyClass()}`}>
                      <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1.5">
                          <Eye className="w-4 h-4 text-slate-700" />
                          <span>Exemplo Ao Vivo do Portal (Preview em Tempo Real)</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          Reflete instantaneamente as seleções abaixo
                        </span>
                      </div>

                      <div className="p-3.5 bg-slate-100/70 space-y-3">
                    
                        {/* SITE HEADER BAR PREVIEW */}
                        <div
                          className="p-3.5 rounded-xl border shadow-xs flex items-center justify-between gap-4 transition-all"
                          style={{
                            backgroundColor: siteConfig.headerBgColor || '#005830',
                            borderColor: siteConfig.footerBorderColor || '#cbd5e1',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {siteConfig.headerCustomLogoUrl ? (
                              <img
                                src={siteConfig.headerCustomLogoUrl}
                                alt="Logo"
                                className="w-8 h-8 object-contain rounded-sm"
                              />
                            ) : (
                              <NursingEmblemLogo size={32} className="shrink-0" />
                            )}
                            <div>
                              <div
                                className="text-[9px] font-extrabold uppercase tracking-widest leading-none"
                                style={{ color: siteConfig.headerTextColor || '#ffffff' }}
                              >
                                {siteConfig.headerInstitutionText || 'Unidade acadêmica • Instituição'}
                              </div>
                              <h4
                                className="text-xs sm:text-sm font-black uppercase tracking-tight leading-tight mt-1"
                                style={{ color: siteConfig.headerTitleColor || '#ffffff' }}
                              >
                                {siteConfig.headerCourseTitle || 'Curso de Graduação'}
                              </h4>
                            </div>
                          </div>

                          <div className="hidden sm:flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase bg-white/20 text-white px-2.5 py-1 rounded-md">
                              Portal de TCC
                            </span>
                            <span className="text-[10px] font-black uppercase bg-black/30 text-white px-2.5 py-1 rounded-md">
                              Sessão Ativa
                            </span>
                          </div>
                        </div>

                        {/* MAIN SCREEN BODY: SIDEBAR + TABLE & FILTERS */}
                        <div className="flex flex-col md:flex-row gap-3 min-h-[380px]">
                          
                          {/* REALISTIC SIDEBAR */}
                          <div
                            className="w-full md:w-56 p-3 rounded-xl border shadow-xs flex flex-col justify-between text-xs space-y-3 transition-all shrink-0"
                            style={{
                              backgroundColor: siteConfig.sidebarBgColor || '#011f17',
                              color: siteConfig.sidebarTextColor || '#ffffff',
                            }}
                          >
                            <div className="space-y-2">
                              <div
                                className="p-2 rounded-lg font-black uppercase text-[10px] text-center tracking-wider shadow-2xs"
                                style={{ backgroundColor: siteConfig.sidebarHeaderBgColor || '#011812' }}
                              >
                                {siteConfig.sidebarTitle || 'PORTAL DE TCC'}
                              </div>

                              <div className="space-y-1 text-xs">
                                <div
                                  className="px-3 py-2 rounded-lg font-bold flex items-center gap-2 shadow-2xs"
                                  style={{
                                    backgroundColor: siteConfig.sidebarActiveBgColor || '#033d2e',
                                    color: siteConfig.sidebarActiveTextColor || '#a4ebd4',
                                  }}
                                >
                                  <span>📅</span>
                                  <span>Calendário Geral</span>
                                </div>
                                <div className="px-3 py-2 rounded-lg font-medium opacity-80 hover:opacity-100 flex items-center gap-2">
                                  <span>📚</span>
                                  <span>Repositório de TCCs</span>
                                </div>
                                <div className="px-3 py-2 rounded-lg font-medium opacity-80 hover:opacity-100 flex items-center gap-2">
                                  <span>🎓</span>
                                  <span>Meus Processos</span>
                                </div>
                                <div className="px-3 py-2 rounded-lg font-medium opacity-80 hover:opacity-100 flex items-center gap-2">
                                  <span>📋</span>
                                  <span>Área do Presidente</span>
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-white/10 text-[9px] opacity-70 text-center font-bold">
                              Instituição • Unidade acadêmica
                            </div>
                          </div>

                          {/* REALISTIC MAIN PAGE CONTENT (FILTERS + TABLE) */}
                          <div className="flex-1 bg-white rounded-xl border border-slate-300 p-3 shadow-xs flex flex-col justify-between space-y-3">
                            
                            {/* TITLE & FILTERS BAR */}
                            <div className="space-y-2.5 pb-2.5 border-b border-slate-200">
                              
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
                                    Calendário de Defesas Públicas de TCC
                                  </h3>
                                  <p className="text-[10.5px] font-bold text-slate-500">
                                    Bancas agendadas e confirmadas para o semestre
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className={`px-3 py-1.5 text-xs font-bold text-white shadow-2xs shrink-0 flex items-center gap-1.5 transition-all ${buttonRadiusClass}`}
                                    style={{
                                      backgroundColor: localTableFormat.toolbarButtonColor || siteConfig.headerBgColor || '#005830',
                                      border: `1px solid ${localTableFormat.toolbarButtonBorderColor || '#005830'}`,
                                    }}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Agendar Defesa</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={`px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 transition-all ${buttonRadiusClass}`}
                                  >
                                    Exportar
                                  </button>
                                </div>
                              </div>

                              {/* FILTERS BAR */}
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs">
                                <div className="sm:col-span-2">
                                  <input
                                    type="text"
                                    readOnly
                                    value=""
                                    placeholder="🔍 Buscar aluno, orientador, título..."
                                    className="w-full bg-white border border-slate-300 rounded-md p-1 text-xs text-slate-600 font-medium"
                                  />
                                </div>
                                <div>
                                  <select className="w-full bg-white border border-slate-300 rounded-md p-1 text-xs text-slate-700 font-bold" readOnly>
                                    <option>Ano: 2026</option>
                                  </select>
                                </div>
                                <div>
                                  <select className="w-full bg-white border border-slate-300 rounded-md p-1 text-xs text-slate-700 font-bold" readOnly>
                                    <option>Semestre: 2026/2</option>
                                  </select>
                                </div>
                              </div>

                            </div>

                            {/* FULL LIVE TABLE */}
                            <div className="overflow-x-auto rounded-lg border border-slate-300">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr
                                    className="font-black uppercase text-[10px] tracking-wider"
                                    style={{
                                      backgroundColor: localTableFormat.customHeaderColor || siteConfig.headerBgColor || '#005830',
                                      color: localTableFormat.customHeaderTextColor || '#ffffff',
                                    }}
                                  >
                                    <th className={`p-2.5 ${headerAlignClass}`}>Aluno & Título do Trabalho</th>
                                    <th className={`p-2.5 ${headerAlignClass}`}>Orientador(a)</th>
                                    <th className={`p-2.5 ${headerAlignClass}`}>Data & Horário</th>
                                    <th className={`p-2.5 ${headerAlignClass}`}>Local</th>
                                    <th className="p-2.5 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 text-slate-800 font-medium text-[11px]">
                                  <tr className="bg-white hover:bg-slate-50 transition-colors">
                                    <td className={`p-2.5 ${cellAlignClass}`}>
                                      <div className="font-bold text-slate-900">Ana Clara Mendes</div>
                                      <div className="text-[10px] text-slate-500 font-semibold truncate max-w-[220px]">
                                        Título demonstrativo do TCC
                                      </div>
                                    </td>
                                    <td className={`p-2.5 font-bold ${cellAlignClass}`}>Prof.ª Dr.ª Beatriz Costa</td>
                                    <td className={`p-2.5 font-bold text-slate-700 ${cellAlignClass}`}>28/11/2026 às 14:00</td>
                                    <td className={`p-2.5 ${cellAlignClass}`}>Auditório Central (Presencial)</td>
                                    <td className="p-2.5 text-center">
                                      <span className={`px-2 py-0.5 text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 ${buttonRadiusClass}`}>
                                        CONFIRMADA
                                      </span>
                                    </td>
                                  </tr>
                                  <tr className="bg-slate-50/70 hover:bg-slate-100/70 transition-colors">
                                    <td className={`p-2.5 ${cellAlignClass}`}>
                                      <div className="font-bold text-slate-900">Lucas Santos Oliveira</div>
                                      <div className="text-[10px] text-slate-500 font-semibold truncate max-w-[220px]">
                                        Protocolos de Triagem na Atenção Primária
                                      </div>
                                    </td>
                                    <td className={`p-2.5 font-bold ${cellAlignClass}`}>Prof. Dr. Ricardo Silva</td>
                                    <td className={`p-2.5 font-bold text-slate-700 ${cellAlignClass}`}>30/11/2026 às 09:30</td>
                                    <td className={`p-2.5 ${cellAlignClass}`}>Sala de defesas</td>
                                    <td className="p-2.5 text-center">
                                      <span className={`px-2 py-0.5 text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 ${buttonRadiusClass}`}>
                                        CONFIRMADA
                                      </span>
                                    </td>
                                  </tr>
                                  <tr className="bg-white hover:bg-slate-50 transition-colors">
                                    <td className={`p-2.5 ${cellAlignClass}`}>
                                      <div className="font-bold text-slate-900">Juliana Lima Ferreira</div>
                                      <div className="text-[10px] text-slate-500 font-semibold truncate max-w-[220px]">
                                        Humanização no Atendimento de Urgência
                                      </div>
                                    </td>
                                    <td className={`p-2.5 font-bold ${cellAlignClass}`}>Prof.ª Dr.ª Mariana Ribeiro</td>
                                    <td className={`p-2.5 font-bold text-slate-700 ${cellAlignClass}`}>02/12/2026 às 10:00</td>
                                    <td className={`p-2.5 ${cellAlignClass}`}>Auditório B (Híbrido)</td>
                                    <td className="p-2.5 text-center">
                                      <span className={`px-2 py-0.5 text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-300 ${buttonRadiusClass}`}>
                                        AGENDADA
                                      </span>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            {/* TABLE PAGINATION FOOTER */}
                            <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold pt-1">
                              <span>Exibindo 3 de 24 defesas agendadas</span>
                              <div className="flex items-center gap-1">
                                <span className={`px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-500 ${buttonRadiusClass}`}>Anterior</span>
                                <span className={`px-2.5 py-0.5 bg-slate-900 text-white font-black ${buttonRadiusClass}`}>1</span>
                                <span className={`px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 ${buttonRadiusClass}`}>2</span>
                                <span className={`px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 ${buttonRadiusClass}`}>Próximo</span>
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* POPUPS & MODAIS REALTIME PREVIEW CARDS */}
                        <div className="pt-1">
                          <div className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-slate-600" />
                            <span>Pop-ups e Modais Vinculados (Preview Ao Vivo)</span>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {/* POPUP 1: DETALHES DA BANCA */}
                            <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
                              <div
                                className="p-2.5 text-white font-black text-xs uppercase flex items-center justify-between"
                                style={{ backgroundColor: tccDetailFormat.headerBgColor || siteConfig.headerBgColor || '#005830' }}
                              >
                                <span>🎓 Detalhes da Banca</span>
                                <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded">TCC</span>
                              </div>
                              <div className="p-2.5 text-[11px] space-y-1.5 text-slate-700 font-medium">
                                <div className="font-bold text-slate-900">Ana Clara Mendes</div>
                                <div className="text-[10px] text-slate-500">UTI Neonatal • 28/11/2026</div>
                                <button
                                  type="button"
                                  className={`w-full py-1 text-[10px] font-black uppercase text-white shadow-2xs transition-all ${buttonRadiusClass}`}
                                  style={{ backgroundColor: tccDetailFormat.primaryActionColor || siteConfig.headerBgColor || '#005830' }}
                                >
                                  Confirmar Presença
                                </button>
                              </div>
                            </div>

                            {/* POPUP 2: ATA ASSINADA / DOCUMENTOS */}
                            <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
                              <div
                                className="p-2.5 text-white font-black text-xs uppercase flex items-center justify-between"
                                style={{ backgroundColor: generalPopupsConfig.uploadAtaHeaderBg || siteConfig.headerBgColor || '#005830' }}
                              >
                                <span>📄 Ata Assinada & PDF</span>
                                <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded">PDF</span>
                              </div>
                              <div className="p-2.5 text-[11px] space-y-1.5 text-slate-700 font-medium">
                                <div className="font-bold text-slate-900">Ata de Defesa do TCC</div>
                                <div className="text-[10px] text-slate-500">Status: Assinada e arquivada via Asten</div>
                                <button
                                  type="button"
                                  className={`w-full py-1 text-[10px] font-black uppercase text-white shadow-2xs transition-all ${buttonRadiusClass}`}
                                  style={{ backgroundColor: generalPopupsConfig.uploadAtaBtnBg || siteConfig.headerBgColor || '#005830' }}
                                >
                                  Baixar Ata (PDF)
                                </button>
                              </div>
                            </div>

                            {/* POPUP 3: LOGIN / ACESSO RESTRITO */}
                            <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
                              <div
                                className="p-2.5 text-white font-black text-xs uppercase flex items-center justify-between"
                                style={{ backgroundColor: loginPopupConfig.cardBgColor || siteConfig.headerBgColor || '#005830' }}
                              >
                                <span>🔐 Acesso ao Portal</span>
                                <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded">LOGIN</span>
                              </div>
                              <div className="p-2.5 text-[11px] space-y-1.5 text-slate-700 font-medium">
                                <div className="font-bold text-slate-900">Identificação institucional</div>
                                <div className="text-[10px] text-slate-500">Alunos & Professores</div>
                                <button
                                  type="button"
                                  className={`w-full py-1 text-[10px] font-black uppercase text-white shadow-2xs transition-all ${buttonRadiusClass}`}
                                  style={{ backgroundColor: loginPopupConfig.primaryBtnBg || siteConfig.headerBgColor || '#005830' }}
                                >
                                  Entrar no Sistema
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* REALISTIC FOOTER BAR PREVIEW */}
                        <div
                          className="p-3 rounded-xl border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs transition-all"
                          style={{
                            backgroundColor: siteConfig.footerBgColor || '#011812',
                            color: siteConfig.footerTextColor || '#94a3b8',
                            borderColor: siteConfig.footerBorderColor || '#1e293b',
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <NursingEmblemLogo size={24} className="shrink-0" />
                            <div>
                              <div className="font-extrabold text-white text-[11px]">
                                {siteConfig.footerDepartmentName || 'Unidade acadêmica • Instituição'}
                              </div>
                              <div className="text-[9.5px] opacity-80">
                                {siteConfig.footerAddress || 'Av. Marechal Campos, 1468 - Maruípe, Vitória - ES'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`px-3 py-1 text-[10.5px] font-black text-white shadow-2xs cursor-pointer flex items-center gap-1.5 ${buttonRadiusClass}`}
                              style={{ backgroundColor: siteConfig.footerWhatsappBtnBg || siteConfig.headerBgColor || '#005830' }}
                            >
                              <span>💬</span>
                              <span>{siteConfig.footerWhatsappText || 'Suporte WhatsApp'}</span>
                            </span>
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })()}

                {/* OS 4 SELETORES PRINCIPAIS E CONTROLES (LOCALIZADOS ABAIXO DO EXEMPLO) */}
                <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-xs space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                    <span className="text-xs font-black uppercase text-slate-900 tracking-tight flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-slate-700" />
                      <span>Configuração Global do Portal (Site Todo)</span>
                    </span>

                    {/* MODO CLARO / ESCURO */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-300">
                      <button
                        type="button"
                        onClick={() => applyPresetScheme(rainbowThemeId, 'dark', letterComboOption)}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          themeMode === 'dark'
                            ? 'bg-slate-800 text-white shadow-xs font-black'
                            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                        }`}
                      >
                        🌙 Escuro
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetScheme(rainbowThemeId, 'light', letterComboOption)}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          themeMode === 'light'
                            ? 'bg-white text-slate-900 border border-slate-300 shadow-xs font-black'
                            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                        }`}
                      >
                        ☀️ Claro
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* 1. COR DO PORTAL */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase text-slate-800 block">
                        1. Tema & Cor do Portal
                      </label>
                      <div className="flex items-center gap-2 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-300">
                        <span
                          className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs shrink-0"
                          style={{
                            backgroundColor:
                              PALETTE_THEMES.find((t) => t.id === rainbowThemeId)?.primaryHex || '#005830',
                          }}
                        />
                        <select
                          value={rainbowThemeId}
                          onChange={(e) => applyPresetScheme(e.target.value, themeMode, letterComboOption)}
                          className="w-full bg-transparent text-slate-900 font-bold text-xs focus:outline-none cursor-pointer pr-1"
                        >
                          {PALETTE_THEMES.map((theme) => (
                            <option key={theme.id} value={theme.id} className="bg-white text-slate-900 font-medium py-1">
                              {theme.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* 2. PADRÃO DE LETRAS */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase text-slate-800 block">
                        2. Padrão de Letras
                      </label>
                      <select
                        value={fontPresetId}
                        onChange={(e) => applyFontPreset(Number(e.target.value) as 1 | 2 | 3)}
                        className="w-full bg-slate-100 text-slate-900 border border-slate-300 font-bold text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                      >
                        <option value={1}>Exemplo 1: Limpo & Moderno (Inter)</option>
                        <option value={2}>Exemplo 2: Executivo & Formal (Roboto)</option>
                        <option value={3}>Exemplo 3: Elegante & Clássico (Georgia)</option>
                      </select>
                    </div>

                    {/* 3. BOTÕES GERAIS */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase text-slate-800 block">
                        3. Botões Gerais
                      </label>
                      <select
                        value={buttonPresetId}
                        onChange={(e) => applyButtonPreset(Number(e.target.value) as 1 | 2 | 3)}
                        className="w-full bg-slate-100 text-slate-900 border border-slate-300 font-bold text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                      >
                        <option value={1}>Padrão 1: Arredondado Pílula (Pill)</option>
                        <option value={2}>Padrão 2: Moderno Elegante (Rounded-LG)</option>
                        <option value={3}>Padrão 3: Retangular Clássico (Rounded-MD)</option>
                      </select>
                    </div>

                    {/* 4. POP-UPS & MODAIS */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase text-slate-800 block">
                        4. Pop-ups & Modais
                      </label>
                      <select
                        value={popupPresetId}
                        onChange={(e) => applyPopupPreset(Number(e.target.value) as 1 | 2 | 3)}
                        className="w-full bg-slate-100 text-slate-900 border border-slate-300 font-bold text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                      >
                        <option value={1}>Estilo 1: Cabeçalho Colorido Sólido</option>
                        <option value={2}>Estilo 2: Minimalista Borda Fina</option>
                        <option value={3}>Estilo 3: Card em Destaque</option>
                      </select>
                    </div>
                  </div>

                  {/* CONTRASTE DE TEXTO & ALINHAMENTO (SUB-CONTROLES) */}
                  <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase text-slate-800">Contraste de Texto:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => applyPresetScheme(rainbowThemeId, themeMode, 1)}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border ${
                            letterComboOption === 1
                              ? 'bg-slate-800 text-white border-slate-900 shadow-xs font-black'
                              : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          Texto Branco
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetScheme(rainbowThemeId, themeMode, 2)}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border ${
                            letterComboOption === 2
                              ? 'bg-slate-800 text-white border-slate-900 shadow-xs font-black'
                              : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {themeMode === 'dark' ? 'Texto Dourado' : 'Texto Escuro'}
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetScheme(rainbowThemeId, themeMode, 3)}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border ${
                            letterComboOption === 3
                              ? 'bg-slate-800 text-white border-slate-900 shadow-xs font-black'
                              : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {themeMode === 'dark' ? 'Texto Menta' : 'Texto Colorido'}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase text-slate-800">Alinhamento:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => syncThreeFontGroupsAlignment('left')}
                          className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                            localTableFormat.headerAlignment === 'left' && localTableFormat.cellAlignment === 'left'
                              ? 'bg-slate-800 text-white border-slate-900 shadow-xs font-black'
                              : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          <AlignLeft className="w-3.5 h-3.5" />
                          <span>Esquerda</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => syncThreeFontGroupsAlignment('center')}
                          className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                            localTableFormat.headerAlignment === 'center' && localTableFormat.cellAlignment === 'center'
                              ? 'bg-slate-800 text-white border-slate-900 shadow-xs font-black'
                              : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          <AlignCenter className="w-3.5 h-3.5" />
                          <span>Centro</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* 2. BARRA SUPERIOR */}
            {activeTab === 'site_header' && (
              <div className="space-y-4">
                {/* PREVIEW ABOVE */}
                <div className="w-full bg-white border border-slate-300 rounded-xl shadow-2xs overflow-hidden">
                  <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-[10.5px] font-black uppercase text-slate-800 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-slate-600" />
                      <span>Barra Superior (Preview Ao Vivo)</span>
                    </span>
                  </div>
                  <div className="p-3 bg-slate-100">
                    <div
                      className="p-3.5 rounded-xl border shadow-xs flex items-center justify-between gap-3 transition-all"
                      style={{
                        backgroundColor: siteConfig.headerBgColor || '#ffffff',
                        borderColor: siteConfig.footerBorderColor || '#cbd5e1',
                        ...(siteConfig.headerBgImage
                          ? { backgroundImage: `url(${siteConfig.headerBgImage})`, backgroundSize: 'cover' }
                          : {})
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {siteConfig.headerCustomLogoUrl ? (
                          <img
                            src={siteConfig.headerCustomLogoUrl}
                            alt="Logo Customizada"
                            className="w-9 h-9 object-contain shrink-0 rounded-md border border-slate-200"
                          />
                        ) : siteConfig.headerShowEmblem !== false ? (
                          <NursingEmblemLogo size={36} className="shrink-0" />
                        ) : null}

                        <div>
                          <div className="text-[9px] font-extrabold uppercase tracking-widest leading-tight" style={{ color: siteConfig.headerTextColor || '#047857' }}>
                            {siteConfig.headerInstitutionText || 'Unidade acadêmica • Instituição'}
                          </div>
                          <h4 className="text-[12px] font-black uppercase tracking-tight leading-snug" style={{ color: siteConfig.headerTitleColor || '#0f172a' }}>
                            {siteConfig.headerCourseTitle || 'Curso de Graduação'}
                          </h4>
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center gap-2">
                        <span className="text-[10px] font-extrabold bg-slate-200/60 px-2.5 py-1 rounded-md text-slate-700">
                          Sessão Ativa
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CONTROLS BELOW */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
                      CORES DA BARRA SUPERIOR
                    </h3>
                    <div className="space-y-3">
                      <ColorField
                        label="Fundo da Barra Superior"
                        value={siteConfig.headerBgColor || '#ffffff'}
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, headerBgColor: val }))}
                      />
                      <ColorField
                        label="Cor do Subtítulo / Instituição"
                        value={siteConfig.headerTextColor || '#047857'}
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, headerTextColor: val }))}
                      />
                      <ColorField
                        label="Cor do Título Principal do Curso"
                        value={siteConfig.headerTitleColor || '#0f172a'}
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, headerTitleColor: val }))}
                      />
                      <div role="status" className={`rounded-lg border px-3 py-2 text-[11px] font-bold ${headerContrast>=4.5?'border-emerald-200 bg-emerald-50 text-emerald-900':'border-red-200 bg-red-50 text-red-900'}`}>
                        Contraste do subtítulo: {headerContrast.toFixed(2)}:1 — {headerContrast>=4.5?'aprovado para texto normal (WCAG AA).':'insuficiente; ajuste texto ou fundo até pelo menos 4,5:1.'}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
                      LOGOMARCA E IMAGEM DE FUNDO
                    </h3>
                    <div className="space-y-3">
                      <ImageUploadField
                        label="Logomarca Personalizada (Anexar Arquivo ou Link)"
                        value={siteConfig.headerCustomLogoUrl || ''}
                        placeholder="Clique para anexar imagem do seu computador ou cole a URL"
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, headerCustomLogoUrl: val }))}
                      />
                      <ImageUploadField
                        label="Imagem de Fundo da Barra (Anexar Arquivo ou Link)"
                        value={siteConfig.headerBgImage || ''}
                        placeholder="Clique para anexar imagem de textura ou cole a URL"
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, headerBgImage: val }))}
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
                      TEXTOS E TÍTULOS DA BARRA SUPERIOR
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <TextField
                        label="Subtítulo Superior / Nome da Instituição"
                        value={siteConfig.headerInstitutionText || ''}
                        placeholder="Ex.: Unidade acadêmica • Instituição"
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, headerInstitutionText: val }))}
                      />
                      <TextField
                        label="Título Principal do Curso ou Departamento"
                        value={siteConfig.headerCourseTitle || ''}
                        placeholder="Ex.: Curso de Graduação em Engenharia"
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, headerCourseTitle: val }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. BARRA LATERAL */}
            {activeTab === 'site_sidebar' && (
              <div className="flex flex-col xl:flex-row items-start gap-5">
                <div className="w-full xl:w-[300px] shrink-0 bg-white border border-slate-300 rounded-xl shadow-2xs overflow-hidden">
                  <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-[10.5px] font-black uppercase text-slate-800 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-slate-600" />
                      <span>Barra Lateral (Preview)</span>
                    </span>
                  </div>
                  <div className="p-3 bg-slate-100">
                    <div
                      className="p-3.5 rounded-xl border shadow-md space-y-3 text-xs font-bold transition-all"
                      style={{
                        backgroundColor: siteConfig.sidebarBgColor || '#011f17',
                        color: siteConfig.sidebarTextColor || '#e2e8f0',
                      }}
                    >
                      <div className="p-2.5 rounded-lg text-center" style={{ backgroundColor: siteConfig.sidebarHeaderBgColor || '#011812' }}>
                        <div className="font-black uppercase text-xs" style={{ color: siteConfig.sidebarActiveTextColor || '#a4ebd4' }}>
                          {siteConfig.sidebarTitle || 'PORTAL DE TCC'}
                        </div>
                        <div className="text-[9px] font-extrabold uppercase" style={{ color: siteConfig.sidebarSubtitleColor || '#7bc394' }}>
                          {siteConfig.sidebarSubtitle || 'CURSO • INSTITUIÇÃO'}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div
                          className="px-3 py-2 rounded-lg border font-bold text-xs flex items-center justify-between"
                          style={{
                            backgroundColor: siteConfig.sidebarActiveBgColor || '#033d2e',
                            color: siteConfig.sidebarActiveTextColor || '#a4ebd4',
                            borderColor: siteConfig.sidebarActiveBorderColor || '#7bc394',
                          }}
                        >
                          <span>📅 {siteConfig.sidebarNavLabels?.home || 'Calendário'}</span>
                          <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded">Ativo</span>
                        </div>
                        <div className="px-3 py-2 rounded-lg font-medium text-xs opacity-80">
                          <span>📚 {siteConfig.sidebarNavLabels?.biblioteca || 'Repositório'}</span>
                        </div>
                        <div className="px-3 py-2 rounded-lg font-medium text-xs opacity-80">
                          <span>📋 {siteConfig.sidebarNavLabels?.['meus-processos'] || 'Meus TCCs'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 w-full space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
                      CORES DA BARRA LATERAL
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <ColorField
                        label="Fundo Principal da Barra"
                        value={siteConfig.sidebarBgColor || '#011f17'}
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, sidebarBgColor: val }))}
                      />
                      <ColorField
                        label="Fundo do Cabeçalho Interno"
                        value={siteConfig.sidebarHeaderBgColor || '#011812'}
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, sidebarHeaderBgColor: val }))}
                      />
                      <ColorField
                        label="Texto dos Menus"
                        value={siteConfig.sidebarTextColor || '#e2e8f0'}
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, sidebarTextColor: val }))}
                      />
                      <ColorField
                        label="Fundo do Menu Ativo"
                        value={siteConfig.sidebarActiveBgColor || '#033d2e'}
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, sidebarActiveBgColor: val }))}
                      />
                      <ColorField
                        label="Texto do Menu Ativo"
                        value={siteConfig.sidebarActiveTextColor || '#a4ebd4'}
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, sidebarActiveTextColor: val }))}
                      />
                      <ColorField
                        label="Borda do Menu Ativo"
                        value={siteConfig.sidebarActiveBorderColor || '#7bc394'}
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, sidebarActiveBorderColor: val }))}
                      />
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
                      TEXTOS E RÓTULOS DOS MENUS
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <TextField
                        label="Título Principal da Barra"
                        value={siteConfig.sidebarTitle || ''}
                        placeholder="Ex: PORTAL DE TCC"
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, sidebarTitle: val }))}
                      />
                      <TextField
                        label="Subtítulo Institucional"
                        value={siteConfig.sidebarSubtitle || ''}
                        placeholder="Ex.: CURSO • INSTITUIÇÃO"
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, sidebarSubtitle: val }))}
                      />
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
                      LOGOMARCA DA BARRA LATERAL
                    </h3>
                    <ImageUploadField
                      label="Logo Personalizada da Barra Lateral (Anexar ou Link)"
                      value={siteConfig.sidebarCustomLogoUrl || ''}
                      placeholder="Clique para anexar imagem do seu computador ou cole a URL"
                      onChange={(val) => updateSiteConfigLive((c) => ({ ...c, sidebarCustomLogoUrl: val }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. RODAPÉ */}
            {activeTab === 'site_footer' && (
              <div className="space-y-4">
                <div className="w-full bg-white border border-slate-300 rounded-xl shadow-2xs overflow-hidden">
                  <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-[10.5px] font-black uppercase text-slate-800 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-slate-600" />
                      <span>Rodapé e Contatos (Preview Ao Vivo)</span>
                    </span>
                  </div>
                  <div className="p-3 bg-slate-100">
                    <div
                      className="p-3.5 rounded-xl text-xs space-y-3 transition-all border shadow-xs"
                      style={{
                        backgroundColor: siteConfig.footerBgColor || '#011812',
                        color: siteConfig.footerTextColor || '#ffffff',
                        borderColor: siteConfig.footerBorderColor || '#033628',
                      }}
                    >
                      <div className="flex flex-col md:flex-row items-center justify-between gap-3 pb-2 border-b" style={{ borderColor: siteConfig.footerDividerColor || '#033628' }}>
                        <div>
                          <div className="font-extrabold uppercase text-[9px]" style={{ color: siteConfig.footerMutedTextColor || '#94a3b8' }}>
                            {siteConfig.footerPresidentLabel || 'Presidente da Comissão'}
                          </div>
                          <p className="font-bold text-[11px] mt-0.5">
                            {siteConfig.footerPresidentName || 'Prof.ª Drª. Márcia Valéria...'}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className="inline-block px-3 py-1.5 text-[10px] font-bold rounded-lg shadow-2xs"
                            style={{
                              backgroundColor: siteConfig.footerWhatsappBtnBg || '#059669',
                              color: siteConfig.footerWhatsappBtnText || '#ffffff',
                            }}
                          >
                            {siteConfig.footerWhatsappLabel || 'WhatsApp Secretária'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
                      CORES DO RODAPÉ E BOTÕES
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <ColorField
                        label="Fundo do Rodapé"
                        value={siteConfig.footerBgColor || '#011812'}
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, footerBgColor: val }))}
                      />
                      <ColorField
                        label="Cor dos Textos e Nomes"
                        value={siteConfig.footerTextColor || '#ffffff'}
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, footerTextColor: val }))}
                      />
                      <ColorField
                        label="Fundo Botão WhatsApp"
                        value={siteConfig.footerWhatsappBtnBg || '#059669'}
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, footerWhatsappBtnBg: val }))}
                      />
                      <ColorField
                        label="Texto Botão WhatsApp"
                        value={siteConfig.footerWhatsappBtnText || '#ffffff'}
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, footerWhatsappBtnText: val }))}
                      />
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
                      TEXTOS E COMISSÃO DE TCC
                    </h3>
                    <div className="space-y-3">
                      <TextField
                        label="Título do Cargo Principal"
                        value={siteConfig.footerPresidentLabel || 'Presidente da Comissão'}
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, footerPresidentLabel: val }))}
                      />
                      <TextField
                        label="Nome do Responsável Principal"
                        value={siteConfig.footerPresidentName || ''}
                        onChange={(val) => updateSiteConfigLive((c) => ({ ...c, footerPresidentName: val }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. BOTÕES NO TOPO DA PLANILHA */}
            {activeTab === 'global_table_buttons' && (
              <div className="space-y-4">
                <div className="bg-slate-200 p-4 rounded-xl border border-slate-300 space-y-2">
                  <span className="text-[10.5px] font-black uppercase text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-slate-600" />
                    <span>Preview Ao Vivo dos Botões no Topo da Planilha</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-xl border border-slate-300">
                    <button
                      type="button"
                      className={`px-3 py-2 text-xs font-bold flex items-center gap-2 shadow-xs transition-all ${getButtonRadiusClass()}`}
                      style={{
                        backgroundColor: localTableFormat.toolbarButtonColor || '#005830',
                        color: localTableFormat.toolbarButtonTextColor || '#ffffff',
                        border: `1px solid ${localTableFormat.toolbarButtonBorderColor || '#047857'}`,
                      }}
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      <span>{localTableFormat.customFilterTitle || 'Filtrar'}</span>
                    </button>

                    <button
                      type="button"
                      className={`px-3 py-2 text-xs font-bold flex items-center gap-2 shadow-xs transition-all ${getButtonRadiusClass()}`}
                      style={{
                        backgroundColor: localTableFormat.toolbarButtonColor || '#005830',
                        color: localTableFormat.toolbarButtonTextColor || '#ffffff',
                        border: `1px solid ${localTableFormat.toolbarButtonBorderColor || '#047857'}`,
                      }}
                    >
                      <Columns className="w-4 h-4" />
                      <span>Colunas</span>
                    </button>

                    <button
                      type="button"
                      className={`px-3 py-2 text-xs font-bold flex items-center gap-2 shadow-xs transition-all ${getButtonRadiusClass()}`}
                      style={{
                        backgroundColor: localTableFormat.toolbarButtonColor || '#005830',
                        color: localTableFormat.toolbarButtonTextColor || '#ffffff',
                        border: `1px solid ${localTableFormat.toolbarButtonBorderColor || '#047857'}`,
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      <span>{localTableFormat.newDefenseButtonText || 'Agendar Defesa'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
                      CORES DOS BOTÕES DA PLANILHA
                    </h3>
                    <div className="space-y-3">
                      <ColorField
                        label="Cor de Fundo dos Botões"
                        value={localTableFormat.toolbarButtonColor || '#005830'}
                        onChange={(val) => updateTableFormatLive('toolbarButtonColor', val)}
                      />
                      <ColorField
                        label="Cor do Texto/Ícone"
                        value={localTableFormat.toolbarButtonTextColor || '#ffffff'}
                        onChange={(val) => updateTableFormatLive('toolbarButtonTextColor', val)}
                      />
                      <ColorField
                        label="Cor da Borda dos Botões"
                        value={localTableFormat.toolbarButtonBorderColor || '#047857'}
                        onChange={(val) => updateTableFormatLive('toolbarButtonBorderColor', val)}
                      />
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
                      TEXTOS E RÓTULOS DOS BOTÕES
                    </h3>
                    <div className="space-y-3">
                      <TextField
                        label="Texto do Botão Agendar Defesa"
                        value={localTableFormat.newDefenseButtonText || 'Agendar Defesa'}
                        onChange={(val) => updateTableFormatLive('newDefenseButtonText', val)}
                      />
                      <TextField
                        label="Texto do Botão WhatsApp"
                        value={localTableFormat.whatsappButtonText || 'Falar no WhatsApp'}
                        onChange={(val) => updateTableFormatLive('whatsappButtonText', val)}
                      />
                      <TextField
                        label="Texto do Botão Exportar Planilha"
                        value={localTableFormat.downloadDadosButtonText || 'Exportar Dados'}
                        onChange={(val) => updateTableFormatLive('downloadDadosButtonText', val)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6. ESTILO BASE DAS PLANILHAS */}
            {activeTab === 'global_table_style' && (
              <div className="space-y-4">
                <div className="bg-slate-200 p-4 rounded-xl border border-slate-300 space-y-2">
                  <span className="text-[10.5px] font-black uppercase text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-slate-600" />
                    <span>Preview Ao Vivo da Tabela</span>
                  </span>
                  <div className="overflow-x-auto bg-white rounded-xl border border-slate-300">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr
                          style={{
                            backgroundColor: localTableFormat.customHeaderColor || '#005830',
                            color: localTableFormat.customHeaderTextColor || '#ffffff',
                          }}
                        >
                          <th className="p-3 font-extrabold uppercase">Data / Hora</th>
                          <th className="p-3 font-extrabold uppercase">Discente / Autor</th>
                          <th className="p-3 font-extrabold uppercase">Título do Trabalho</th>
                          <th className="p-3 font-extrabold uppercase">Orientador(a)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="p-3 font-bold text-slate-900">25/08/2026 - 14:00</td>
                          <td className="p-3 font-bold text-slate-900">Ana Maria Silva</td>
                          <td className="p-3 font-medium text-slate-700">Título demonstrativo do TCC</td>
                          <td className="p-3 font-bold text-slate-900">Prof.ª Drª. Maria Santos</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
                    CORES DO CABEÇALHO E LINHAS DA TABELA
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <ColorField
                      label="Cor de Fundo do Cabeçalho"
                      value={localTableFormat.customHeaderColor || '#005830'}
                      onChange={(val) => updateTableFormatLive('customHeaderColor', val)}
                    />
                    <ColorField
                      label="Cor do Texto do Cabeçalho"
                      value={localTableFormat.customHeaderTextColor || '#ffffff'}
                      onChange={(val) => updateTableFormatLive('customHeaderTextColor', val)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 7. POP-UPS ESPECÍFICOS */}
            {(activeTab === 'global_popup_style' ||
              activeTab === 'popup_tcc_detail' ||
              activeTab === 'popup_new_defense' ||
              activeTab === 'popup_upload_ata' ||
              activeTab === 'popup_hipoar' ||
              activeTab === 'popup_pdf_viewer' ||
              activeTab === 'popup_login' ||
              activeTab === 'popup_correction') && (
              <PopupPreviewSection
                activeTab={activeTab}
                tccDetailFormat={tccDetailFormat}
                updateTccDetailLive={updateTccDetailLive}
                generalPopupsConfig={generalPopupsConfig}
                updateGeneralPopupsLive={updateGeneralPopupsLive}
                loginPopupConfig={loginPopupConfig}
                updateLoginPopupLive={updateLoginPopupLive}
                buttonRadiusClass={
                  localTableFormat.toolbarButtonShape === 'circle'
                    ? 'rounded-full'
                    : localTableFormat.toolbarButtonShape === 'square'
                    ? 'rounded-none'
                    : 'rounded-lg'
                }
              />
            )}

            {/* PLANILHAS ESPECÍFICAS (sheet_*) */}
            {(activeTab === 'sheet_calendar' ||
              activeTab === 'sheet_repository' ||
              activeTab === 'sheet_my_tccs' ||
              activeTab === 'sheet_coordinator') && (
              <SpreadsheetPreviewSection
                activeTab={activeTab}
                tableFormat={localTableFormat}
                updateTableFormatLive={updateTableFormatLive}
                updateTableFormatBatch={updateTableFormatBatch}
              />
            )}

            {activeTab === 'table_columns' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-xs font-black uppercase text-slate-900">Colunas e ordem — configuração individual</h3>
                  <p className="mt-1 text-[11px] leading-5 text-slate-600">A aparência pode continuar vinculada ao padrão global; ordem, visibilidade e quantidade de linhas pertencem somente a esta planilha.</p>
                  <div className="mt-4 space-y-2">
                    {layoutColumnOrder.map((key, index) => {
                      const definition = allColumns.find((column) => column.key === key);
                      if (!definition) return null;
                      const fixed = definition.isFixed || index === 0;
                      return <div key={key} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <input type="checkbox" aria-label={`Exibir ${definition.label}`} checked={fixed || visibleColumns[key] !== false} disabled={fixed} onChange={(event) => { const next = { ...visibleColumns, [key]: event.target.checked }; setVisibleColumns?.(next); saveSpecificLayout({ visibleColumns: next }); }} className="h-4 w-4 accent-emerald-700"/>
                        <div><div className="text-xs font-black text-slate-900">{definition.label}</div><div className="text-[10px] font-mono text-slate-500">{key}{fixed ? ' · fixa' : ''}</div></div>
                        <div className="flex gap-1"><button type="button" aria-label={`Mover ${definition.label} para cima`} disabled={fixed || index <= 1} onClick={() => moveLayoutColumn(index, -1)} className="rounded-lg border bg-white px-2 py-1 text-xs font-black disabled:opacity-30">↑</button><button type="button" aria-label={`Mover ${definition.label} para baixo`} disabled={fixed || index === layoutColumnOrder.length - 1} onClick={() => moveLayoutColumn(index, 1)} className="rounded-lg border bg-white px-2 py-1 text-xs font-black disabled:opacity-30">↓</button></div>
                      </div>;
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-xs font-black uppercase text-slate-900">Linhas exibidas</h3>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{[25, 50, 100, 'all'].map((limit) => <button key={String(limit)} type="button" onClick={() => { const value = limit as number | 'all'; setRecordsLimit?.(value); saveSpecificLayout({ recordsLimit: value }); }} className={`rounded-xl border px-3 py-2 text-xs font-black ${recordsLimit === limit ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-800'}`}>{limit === 'all' ? 'Todos' : limit}</button>)}</div>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
