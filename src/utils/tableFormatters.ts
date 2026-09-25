// Shared Table Formatting and Styling Utilities
import type { CSSProperties } from 'react';
import { portalFontFamily } from './portalFonts';
import { TableTextFormat, HeaderTheme, DEFAULT_TABLE_TEXT_FORMAT } from '../components/TableColumnSelectorPanel';
import { tableInheritsGlobalAppearance } from './portalAppearanceLinks';
export type { TableTextFormat, HeaderTheme };
export { DEFAULT_TABLE_TEXT_FORMAT };

export const GLOBAL_TABLE_CONFIG_KEY = 'master_global_table_config';
export const GLOBAL_TABLE_EVENT = 'global_table_format_changed';

/**
 * Loads the system-wide Master Global Table Format from localStorage,
 * falling back to DEFAULT_TABLE_TEXT_FORMAT.
 */
export function loadGlobalTableConfig(): TableTextFormat {
  if (typeof window === 'undefined') return { ...DEFAULT_TABLE_TEXT_FORMAT };
  try {
    const raw = localStorage.getItem(GLOBAL_TABLE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_TABLE_TEXT_FORMAT, ...parsed };
    }
  } catch (e) {
    console.error('Error loading global table config:', e);
  }
  return { ...DEFAULT_TABLE_TEXT_FORMAT };
}

/**
 * Saves the Master Global Table Format to localStorage and dispatches
 * a cross-component event to sync all tables in real-time.
 */
export function saveGlobalTableConfig(format: TableTextFormat): void {
  try {
    localStorage.setItem(GLOBAL_TABLE_CONFIG_KEY, JSON.stringify(format));
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--portal-font-family', portalFontFamily(format.fontFamily));
      const palette = THEME_PALETTES[format.headerTheme || 'militar'] || THEME_PALETTES.militar;
      const sizes = { xs: '11px', sm: '12px', base: '14px', lg: '16px' };
      const density = format.cellPadding || format.density || 'normal';
      const colors = { white: '#ffffff', dark: '#0f172a', muted: '#475569', colored: '#022c22' };
      const tokens: Record<string, string> = {
        '--portal-table-font-size': sizes[format.fontSize || 'base'] || '14px',
        '--portal-table-header-size': sizes[format.headerFontSize || 'base'] || '14px',
        '--portal-table-header-bg': format.customHeaderColor || palette.theadBg,
        '--portal-table-header-text': format.headerTextColor === 'custom' ? format.customHeaderTextColor || palette.text : colors[format.headerTextColor || ''] || format.customHeaderTextColor || palette.text,
        '--portal-table-text': format.cellTextColor === 'custom' ? format.customCellTextColor || '#0f172a' : format.cellTextColor === 'colored' ? '#022c22' : format.cellTextColor === 'neutral' ? '#334155' : '#0f172a',
        '--portal-table-divider': format.customDividerColor || palette.divider,
        '--portal-table-padding': density === 'ultra_compact' ? '.125rem .25rem' : density === 'compact' ? '.25rem .375rem' : density === 'spacious' ? '.75rem 1rem' : density === 'comfortable' ? '.625rem .75rem' : '.375rem .5rem',
        '--portal-table-header-align': format.headerAlignment === 'left' ? 'left' : 'center',
        '--portal-table-cell-align': format.cellAlignment === 'left' ? 'left' : 'center',
        '--portal-table-cell-weight': format.boldCells ? '700' : '400',
        '--portal-table-cell-style': format.italicCells ? 'italic' : 'normal',
        '--portal-table-header-case': format.headerUppercase || format.headerCasing === 'uppercase' ? 'uppercase' : format.headerCasing === 'capitalize' ? 'capitalize' : 'none',
        '--portal-table-zebra': format.zebraStriping ? '#f3f7f4' : 'transparent',
      };
      for (const [name, value] of Object.entries(tokens)) document.documentElement.style.setProperty(name, value);
    }
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(GLOBAL_TABLE_EVENT, { detail: format }));
      }, 0);
    }
  } catch (e) {
    console.error('Error saving global table config:', e);
  }
}

export function inheritsGlobalTableAppearance(storageKey: string): boolean {
  return tableInheritsGlobalAppearance(storageKey);
}

// Regex to strip any unicode emojis
export const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}]/gu;

export function stripEmojis(str: string): string {
  if (!str) return '';
  return str.replace(EMOJI_REGEX, '').replace(/\s+/g, ' ').trim();
}

/**
 * Formats a column header label based on table preferences (custom label, emoji toggle, casing)
 */
export function formatColumnLabel(
  colKey: string,
  rawLabel: string,
  format?: TableTextFormat,
  customLabels?: Record<string, string>
): string {
  let label = (customLabels && customLabels[colKey] !== undefined && customLabels[colKey] !== '') 
    ? customLabels[colKey] 
    : rawLabel;

  // Check if emojis are globally disabled for headers OR disabled for this specific column
  const isGlobalHeaderEmojiDisabled = format?.headerShowEmojis === false;
  const isColumnEmojiDisabled = format?.columnEmojis && format.columnEmojis[colKey] === false;

  if (isGlobalHeaderEmojiDisabled || isColumnEmojiDisabled) {
    label = stripEmojis(label);
  }

  if (format?.headerUppercase) {
    label = label.toUpperCase();
  }

  return label;
}

/**
 * Formats a text inside a table cell (strips emojis if cellShowEmojis is disabled or columnEmojis is false)
 */
export function formatCellText(
  colKey: string,
  text: string,
  format?: TableTextFormat,
  defaultPrefixEmoji?: string
): string {
  if (!text) return '';
  const isGlobalCellEmojiDisabled = format?.cellShowEmojis === false;
  const isColumnEmojiDisabled = format?.columnEmojis && format.columnEmojis[colKey] === false;

  if (isGlobalCellEmojiDisabled || isColumnEmojiDisabled) {
    return stripEmojis(text);
  }

  if (defaultPrefixEmoji && !text.includes(defaultPrefixEmoji) && !EMOJI_REGEX.test(text.slice(0, 4))) {
    return `${defaultPrefixEmoji} ${text}`;
  }

  return text;
}

/**
 * Returns column width CSS classes
 */
export function getColWidthClass(
  colKey: string,
  widthsMap?: Record<string, string | number>,
  defaultClass: string = ''
): string {
  if (!widthsMap) return defaultClass;
  const setting = widthsMap[colKey];
  if (!setting || setting === 'auto') return defaultClass;
  if (setting === 'compact') return 'w-20 min-w-[75px] max-w-[95px]';
  if (setting === 'normal') return 'w-32 min-w-[120px] max-w-[160px]';
  if (setting === 'wide') return 'w-48 min-w-[180px] max-w-[240px]';
  if (setting === 'extrawide') return 'w-72 min-w-[280px] max-w-[380px]';
  return defaultClass;
}

export function getEditableTableText(
  labels: Record<string, string> | undefined,
  key: '__tableTitle' | '__filterTitle' | string,
  fallback: string
): string {
  const value = labels?.[key]?.trim();
  return value || fallback;
}

export function getColumnWeightClass(colKey: string, format?: TableTextFormat): string {
  return format?.columnBold?.[colKey] ? 'font-bold' : '';
}

/**
 * Computes all Tailwind CSS classes for table header, rows, cells and borders
 */
export const THEME_PALETTES: Record<HeaderTheme, {
  bg: string;
  secondary: string;
  text: string;
  divider: string;
  filterDivider: string;
  buttonBg: string;
  buttonText: string;
  theadBg: string;
  theadHover: string;
  isDark: boolean;
}> = {
  militar: {
    bg: '#344125',
    secondary: '#28331d',
    text: '#ffffff',
    divider: '#1f2817',
    filterDivider: 'rgba(255, 255, 255, 0.20)',
    buttonBg: '#5d6761',
    buttonText: '#ffffff',
    theadBg: '#344125',
    theadHover: 'hover:bg-[#28331d]',
    isDark: true,
  },
  red: {
    bg: '#7f1d1d',
    secondary: '#450a0a',
    text: '#ffffff',
    divider: '#260404',
    filterDivider: 'rgba(255, 255, 255, 0.18)',
    buttonBg: '#450a0a',
    buttonText: '#ffffff',
    theadBg: '#7f1d1d',
    theadHover: 'hover:bg-[#6b1717]',
    isDark: true,
  },
  emerald: {
    bg: '#064e3b',
    secondary: '#022c22',
    text: '#ffffff',
    divider: '#022c22',
    filterDivider: 'rgba(255, 255, 255, 0.18)',
    buttonBg: '#022c22',
    buttonText: '#ffffff',
    theadBg: '#064e3b',
    theadHover: 'hover:bg-[#065f46]',
    isDark: true,
  },
  forest: {
    bg: '#14532d',
    secondary: '#052e16',
    text: '#ffffff',
    divider: '#022c22',
    filterDivider: 'rgba(255, 255, 255, 0.18)',
    buttonBg: '#052e16',
    buttonText: '#ffffff',
    theadBg: '#14532d',
    theadHover: 'hover:bg-[#166534]',
    isDark: true,
  },
  royal: {
    bg: '#1e40af',
    secondary: '#1e3a8a',
    text: '#ffffff',
    divider: '#172554',
    filterDivider: 'rgba(255, 255, 255, 0.18)',
    buttonBg: '#1e3a8a',
    buttonText: '#ffffff',
    theadBg: '#1e40af',
    theadHover: 'hover:bg-[#1d4ed8]',
    isDark: true,
  },
  ocean: {
    bg: '#0369a1',
    secondary: '#075985',
    text: '#ffffff',
    divider: '#0c4a6e',
    filterDivider: 'rgba(255, 255, 255, 0.18)',
    buttonBg: '#075985',
    buttonText: '#ffffff',
    theadBg: '#0369a1',
    theadHover: 'hover:bg-[#0284c7]',
    isDark: true,
  },
  wine: {
    bg: '#4c0519',
    secondary: '#27020d',
    text: '#ffffff',
    divider: '#180108',
    filterDivider: 'rgba(255, 255, 255, 0.18)',
    buttonBg: '#27020d',
    buttonText: '#ffffff',
    theadBg: '#4c0519',
    theadHover: 'hover:bg-[#5e071f]',
    isDark: true,
  },
  marsala: {
    bg: '#831843',
    secondary: '#500724',
    text: '#ffffff',
    divider: '#310416',
    filterDivider: 'rgba(255, 255, 255, 0.18)',
    buttonBg: '#500724',
    buttonText: '#ffffff',
    theadBg: '#831843',
    theadHover: 'hover:bg-[#9d174d]',
    isDark: true,
  },
  amber: {
    bg: '#b45309',
    secondary: '#78350f',
    text: '#ffffff',
    divider: '#451a03',
    filterDivider: 'rgba(255, 255, 255, 0.18)',
    buttonBg: '#78350f',
    buttonText: '#ffffff',
    theadBg: '#b45309',
    theadHover: 'hover:bg-[#d97706]',
    isDark: true,
  },
  indigo: {
    bg: '#3730a3',
    secondary: '#231f69',
    text: '#ffffff',
    divider: '#1e1b4b',
    filterDivider: 'rgba(255, 255, 255, 0.18)',
    buttonBg: '#231f69',
    buttonText: '#ffffff',
    theadBg: '#3730a3',
    theadHover: 'hover:bg-[#4338ca]',
    isDark: true,
  },
  steel: {
    bg: '#2c3e50',
    secondary: '#243342',
    text: '#ffffff',
    divider: '#141d24',
    filterDivider: 'rgba(255, 255, 255, 0.18)',
    buttonBg: '#1e2b37',
    buttonText: '#ffffff',
    theadBg: '#2c3e50',
    theadHover: 'hover:bg-[#1f2c39]',
    isDark: true,
  },
  teal: {
    bg: '#134e4a',
    secondary: '#042f2e',
    text: '#ffffff',
    divider: '#021f1e',
    filterDivider: 'rgba(255, 255, 255, 0.18)',
    buttonBg: '#042f2e',
    buttonText: '#ffffff',
    theadBg: '#134e4a',
    theadHover: 'hover:bg-[#0f766e]',
    isDark: true,
  },
  orange: {
    bg: '#9a3412',
    secondary: '#7c2d12',
    text: '#ffffff',
    divider: '#431407',
    filterDivider: 'rgba(255, 255, 255, 0.18)',
    buttonBg: '#7c2d12',
    buttonText: '#ffffff',
    theadBg: '#9a3412',
    theadHover: 'hover:bg-[#c2410c]',
    isDark: true,
  },
  purple: {
    bg: '#581c87',
    secondary: '#3b0764',
    text: '#ffffff',
    divider: '#2e1065',
    filterDivider: 'rgba(255, 255, 255, 0.18)',
    buttonBg: '#3b0764',
    buttonText: '#ffffff',
    theadBg: '#581c87',
    theadHover: 'hover:bg-[#6b21a8]',
    isDark: true,
  },
  dark: {
    bg: '#0f172a',
    secondary: '#020617',
    text: '#ffffff',
    divider: '#000000',
    filterDivider: 'rgba(255, 255, 255, 0.18)',
    buttonBg: '#1e293b',
    buttonText: '#ffffff',
    theadBg: '#0f172a',
    theadHover: 'hover:bg-[#1e293b]',
    isDark: true,
  },
  slate: {
    bg: '#cbd5e1',
    secondary: '#94a3b8',
    text: '#0f172a',
    divider: '#64748b',
    filterDivider: 'rgba(0, 0, 0, 0.15)',
    buttonBg: '#ffffff',
    buttonText: '#0f172a',
    theadBg: '#cbd5e1',
    theadHover: 'hover:bg-[#94a3b8]',
    isDark: false,
  },
  light: {
    bg: '#e2e8f0',
    secondary: '#cbd5e1',
    text: '#0f172a',
    divider: '#94a3b8',
    filterDivider: 'rgba(0, 0, 0, 0.15)',
    buttonBg: '#ffffff',
    buttonText: '#0f172a',
    theadBg: '#e2e8f0',
    theadHover: 'hover:bg-[#cbd5e1]',
    isDark: false,
  },
  clean: {
    bg: '#ffffff',
    secondary: '#f8fafc',
    text: '#0f172a',
    divider: '#e2e8f0',
    filterDivider: 'rgba(0, 0, 0, 0.10)',
    buttonBg: '#f1f5f9',
    buttonText: '#0f172a',
    theadBg: '#f8fafc',
    theadHover: 'hover:bg-[#f1f5f9]',
    isDark: false,
  },
  colored: {
    bg: '#435649',
    secondary: '#303f35',
    text: '#ffffff',
    divider: '#1c241e',
    filterDivider: 'rgba(255, 255, 255, 0.20)',
    buttonBg: '#303f35',
    buttonText: '#ffffff',
    theadBg: '#435649',
    theadHover: 'hover:brightness-110',
    isDark: true,
  }
};

/**
 * Computes all Tailwind CSS classes and inline styles for table header, rows, cells and borders
 */
export function getTableStyles(format: TableTextFormat = {}) {
  // 1. Header Theme
  const theme = format.headerTheme || 'militar';
  const tDef = THEME_PALETTES[theme] || THEME_PALETTES.militar;

  // Dividing Line Colors
  const dividerColor = format.customDividerColor || (theme === 'colored' ? (format.customDividerColor || format.customHeaderSecondaryColor || tDef.divider) : tDef.divider);
  const filterDividerColor = format.customFilterDividerColor || (theme === 'colored' ? (format.customFilterDividerColor || 'rgba(255, 255, 255, 0.20)') : tDef.filterDivider);

  // Button Colors
  const toolbarBtnBg = format.toolbarButtonColor || tDef.buttonBg;
  const toolbarBtnText = format.toolbarButtonTextColor || tDef.buttonText;
  
  let bannerHeaderClass = `${tDef.isDark ? 'text-white' : 'text-slate-900'} border-b`;
  let filterBarBgClass = `${tDef.isDark ? 'text-white' : 'text-slate-900'} border-b`;
  let headerTheadClass = `${tDef.isDark ? 'text-white' : 'text-slate-900'} border-b-2`;
  let headerThClass = tDef.isDark ? 'text-white' : 'text-slate-900';
  let headerThHoverClass = tDef.theadHover;
  let headerBtnClass = tDef.isDark ? 'bg-white/15 hover:bg-white/25 text-white border border-white/25' : 'bg-white hover:bg-slate-100 text-slate-900 border border-slate-300';
  let filterActiveChipClass = tDef.isDark ? 'border-black/40 bg-black/40 text-white shadow-2xs font-black ring-1 ring-white/30' : 'border-slate-800 bg-slate-800 text-white shadow-2xs font-black';
  let filterInactiveChipClass = tDef.isDark ? 'border-white/25 bg-white/15 hover:bg-white/25 text-white shadow-2xs' : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-800 shadow-2xs';
  let rowZebraClass = format.zebraStriping ? 'even:bg-slate-50/75 hover:bg-slate-100/90' : 'hover:bg-slate-50';
  let calendarBannerClass = `${tDef.isDark ? 'text-white' : 'text-slate-900'} border-b`;
  let calendarDaysHeaderClass = `${tDef.isDark ? 'text-white' : 'text-slate-900'} border-b`;
  let calendarNavBtnClass = tDef.isDark ? 'bg-black/30 hover:bg-black/50 text-white border border-white/20' : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300';

  if (theme === 'militar') {
    bannerHeaderClass = 'bg-[#435649] text-white border-b';
    filterBarBgClass = 'bg-[#435649] text-white border-b';
    headerTheadClass = 'bg-[#435649] text-white border-b-2';
    headerThClass = 'bg-[#435649] text-white';
    headerThHoverClass = 'hover:bg-[#344439]';
    filterActiveChipClass = 'border-[#232d26] bg-[#2d3a31] text-white shadow-2xs font-black ring-1 ring-white/30';
    filterInactiveChipClass = 'border-white/25 bg-white/15 hover:bg-white/25 text-white shadow-2xs';
    rowZebraClass = format.zebraStriping ? 'even:bg-[#f3f7f4] hover:bg-[#e4ede6]' : 'hover:bg-[#f7faf8]';
    calendarBannerClass = 'bg-[#435649] text-white border-b';
    calendarDaysHeaderClass = 'bg-[#435649] text-white border-b';
    calendarNavBtnClass = 'bg-[#344439] hover:bg-[#2d3a31] text-white border border-[#4d6354]';
  } else if (theme === 'red') {
    bannerHeaderClass = 'bg-[#7f1d1d] text-white border-b';
    filterBarBgClass = 'bg-[#7f1d1d] text-white border-b';
    headerTheadClass = 'bg-[#7f1d1d] text-white border-b-2';
    headerThClass = 'bg-[#7f1d1d] text-white';
    headerThHoverClass = 'hover:bg-[#6b1717]';
    filterActiveChipClass = 'border-[#260404] bg-[#3b0707] text-white shadow-2xs font-black ring-1 ring-white/30';
    filterInactiveChipClass = 'border-white/25 bg-white/15 hover:bg-white/25 text-white shadow-2xs';
    rowZebraClass = format.zebraStriping ? 'even:bg-red-50/55 hover:bg-red-100/60' : 'hover:bg-red-50/35';
    calendarBannerClass = 'bg-[#7f1d1d] text-white border-b';
    calendarDaysHeaderClass = 'bg-[#7f1d1d] text-white border-b';
    calendarNavBtnClass = 'bg-[#450a0a] hover:bg-[#260404] text-white border border-red-800';
  } else if (theme === 'emerald') {
    bannerHeaderClass = 'bg-emerald-900 text-white border-b';
    filterBarBgClass = 'bg-emerald-900 text-white border-b';
    headerTheadClass = 'bg-emerald-900 text-white border-b-2';
    headerThClass = 'bg-emerald-900 text-white';
    headerThHoverClass = 'hover:bg-emerald-800';
    filterActiveChipClass = 'border-emerald-950 bg-emerald-950 text-white shadow-2xs font-black ring-1 ring-emerald-400';
    filterInactiveChipClass = 'border-white/25 bg-white/15 hover:bg-white/25 text-white shadow-2xs';
    rowZebraClass = format.zebraStriping ? 'even:bg-emerald-50/50 hover:bg-emerald-100/60' : 'hover:bg-emerald-50/30';
    calendarBannerClass = 'bg-emerald-900 text-white border-b';
    calendarDaysHeaderClass = 'bg-emerald-900 text-white border-b';
    calendarNavBtnClass = 'bg-emerald-950 hover:bg-emerald-900 text-white border border-emerald-700';
  } else if (theme === 'steel') {
    bannerHeaderClass = 'bg-[#2c3e50] text-white border-b';
    filterBarBgClass = 'bg-[#2c3e50] text-white border-b';
    headerTheadClass = 'bg-[#2c3e50] text-white border-b-2';
    headerThClass = 'bg-[#2c3e50] text-white';
    headerThHoverClass = 'hover:bg-[#1f2c39]';
    filterActiveChipClass = 'border-[#141d24] bg-[#1a2530] text-white shadow-2xs font-black ring-1 ring-sky-400';
    filterInactiveChipClass = 'border-white/25 bg-white/15 hover:bg-white/25 text-white shadow-2xs';
    rowZebraClass = format.zebraStriping ? 'even:bg-slate-50/75 hover:bg-slate-100/90' : 'hover:bg-slate-50';
    calendarBannerClass = 'bg-[#2c3e50] text-white border-b';
    calendarDaysHeaderClass = 'bg-[#2c3e50] text-white border-b';
    calendarNavBtnClass = 'bg-[#1e2b37] hover:bg-[#151e27] text-white border border-slate-600';
  } else if (theme === 'dark') {
    bannerHeaderClass = 'bg-slate-900 text-white border-b';
    filterBarBgClass = 'bg-slate-900 text-white border-b';
    headerTheadClass = 'bg-slate-900 text-white border-b-2';
    headerThClass = 'bg-slate-900 text-white';
    headerThHoverClass = 'hover:bg-slate-800';
    filterActiveChipClass = 'border-black bg-black text-white shadow-2xs font-black ring-1 ring-slate-400';
    filterInactiveChipClass = 'border-white/25 bg-white/15 hover:bg-white/25 text-white shadow-2xs';
    rowZebraClass = format.zebraStriping ? 'even:bg-slate-50/75 hover:bg-slate-100/90' : 'hover:bg-slate-50';
    calendarBannerClass = 'bg-slate-800 text-white border-b';
    calendarDaysHeaderClass = 'bg-slate-900 text-white border-b';
    calendarNavBtnClass = 'bg-slate-900 hover:bg-black text-white border border-slate-700';
  } else if (theme === 'slate') {
    bannerHeaderClass = 'bg-slate-300 text-slate-900 border-b';
    filterBarBgClass = 'bg-slate-300 text-slate-900 border-b';
    headerTheadClass = 'bg-slate-300 text-slate-900 border-b-2';
    headerThClass = 'bg-slate-300 text-slate-900';
    headerThHoverClass = 'hover:bg-slate-400/40';
    filterActiveChipClass = 'border-slate-800 bg-slate-800 text-white shadow-2xs font-black';
    filterInactiveChipClass = 'border-slate-400 bg-white/80 hover:bg-white text-slate-800 shadow-2xs';
    rowZebraClass = format.zebraStriping ? 'even:bg-slate-50/75 hover:bg-slate-100/90' : 'hover:bg-slate-50';
    calendarBannerClass = 'bg-slate-300 text-slate-900 border-b';
    calendarDaysHeaderClass = 'bg-slate-300 text-slate-900 border-b';
    calendarNavBtnClass = 'bg-slate-700 hover:bg-slate-800 text-white border border-slate-600';
  } else if (theme === 'clean') {
    bannerHeaderClass = 'bg-white text-slate-900 border-b';
    filterBarBgClass = 'bg-white text-slate-900 border-b';
    headerTheadClass = 'bg-slate-100 text-slate-900 border-b-2 shadow-2xs';
    headerThClass = 'bg-slate-100 text-slate-900';
    headerThHoverClass = 'hover:bg-slate-200';
    filterActiveChipClass = 'border-slate-800 bg-slate-800 text-white shadow-2xs font-black';
    filterInactiveChipClass = 'border-slate-300 bg-white hover:bg-slate-100 text-slate-800 shadow-2xs';
    rowZebraClass = format.zebraStriping ? 'even:bg-slate-50/50 hover:bg-slate-100/80' : 'hover:bg-slate-50/50';
    calendarBannerClass = 'bg-white text-slate-900 border-b';
    calendarDaysHeaderClass = 'bg-white text-slate-900 border-b';
    calendarNavBtnClass = 'bg-slate-800 hover:bg-slate-900 text-white border border-slate-700';
  } else if (theme === 'light') {
    bannerHeaderClass = 'bg-slate-200 text-slate-900 border-b';
    filterBarBgClass = 'bg-slate-200 text-slate-900 border-b';
    headerTheadClass = 'bg-slate-200 text-slate-900 border-b-2';
    headerThClass = 'bg-slate-200 text-slate-900';
    headerThHoverClass = 'hover:bg-slate-300/80';
    filterActiveChipClass = 'border-slate-800 bg-slate-800 text-white shadow-2xs font-black';
    filterInactiveChipClass = 'border-slate-300 bg-white/90 hover:bg-white text-slate-800 shadow-2xs';
    rowZebraClass = format.zebraStriping ? 'even:bg-slate-50/75 hover:bg-slate-100/90' : 'hover:bg-slate-50';
    calendarBannerClass = 'bg-slate-200 text-slate-900 border-b';
    calendarDaysHeaderClass = 'bg-slate-200 text-slate-900 border-b';
    calendarNavBtnClass = 'bg-slate-700 hover:bg-slate-800 text-white border border-slate-600';
  } else if (theme === 'teal') {
    bannerHeaderClass = 'bg-teal-900 text-white border-b';
    filterBarBgClass = 'bg-teal-900 text-white border-b';
    headerTheadClass = 'bg-teal-900 text-white border-b-2';
    headerThClass = 'bg-teal-900 text-white';
    headerThHoverClass = 'hover:bg-teal-800';
    filterActiveChipClass = 'border-teal-950 bg-teal-950 text-white shadow-2xs font-black';
    filterInactiveChipClass = 'border-teal-300 bg-white hover:bg-teal-50 text-teal-950 shadow-2xs';
    rowZebraClass = format.zebraStriping ? 'even:bg-teal-50/60 hover:bg-teal-100/60' : 'hover:bg-teal-50/40';
    calendarBannerClass = 'bg-teal-900 text-white border-b';
    calendarDaysHeaderClass = 'bg-teal-900 text-white border-b';
    calendarNavBtnClass = 'bg-teal-950 hover:bg-teal-900 text-white border border-teal-700';
  } else if (theme === 'orange') {
    bannerHeaderClass = 'bg-orange-800 text-white border-b';
    filterBarBgClass = 'bg-orange-800 text-white border-b';
    headerTheadClass = 'bg-orange-800 text-white border-b-2';
    headerThClass = 'bg-orange-800 text-white';
    headerThHoverClass = 'hover:bg-orange-700';
    filterActiveChipClass = 'border-orange-950 bg-orange-900 text-white shadow-2xs font-black';
    filterInactiveChipClass = 'border-orange-300 bg-white hover:bg-orange-50 text-orange-950 shadow-2xs';
    rowZebraClass = format.zebraStriping ? 'even:bg-orange-50/60 hover:bg-orange-100/60' : 'hover:bg-orange-50/40';
    calendarBannerClass = 'bg-orange-800 text-white border-b';
    calendarDaysHeaderClass = 'bg-orange-800 text-white border-b';
    calendarNavBtnClass = 'bg-orange-900 hover:bg-orange-950 text-white border border-orange-700';
  } else if (theme === 'purple') {
    bannerHeaderClass = 'bg-purple-900 text-white border-b';
    filterBarBgClass = 'bg-purple-900 text-white border-b';
    headerTheadClass = 'bg-purple-900 text-white border-b-2';
    headerThClass = 'bg-purple-900 text-white';
    headerThHoverClass = 'hover:bg-purple-800';
    filterActiveChipClass = 'border-purple-950 bg-purple-950 text-white shadow-2xs font-black';
    filterInactiveChipClass = 'border-purple-300 bg-white hover:bg-purple-50 text-purple-950 shadow-2xs';
    rowZebraClass = format.zebraStriping ? 'even:bg-purple-50/55 hover:bg-purple-100/60' : 'hover:bg-purple-50/35';
    calendarBannerClass = 'bg-purple-900 text-white border-b';
    calendarDaysHeaderClass = 'bg-purple-900 text-white border-b';
    calendarNavBtnClass = 'bg-purple-950 hover:bg-purple-900 text-white border border-purple-700';
  } else if (theme === 'colored') {
    bannerHeaderClass = 'bg-[var(--table-header)] text-[var(--table-header-text)] border-b';
    filterBarBgClass = 'bg-[var(--table-header)] text-[var(--table-header-text)] border-b';
    headerTheadClass = 'bg-[var(--table-header)] text-[var(--table-header-text)] border-b-2';
    headerThClass = 'bg-[var(--table-header)] text-[var(--table-header-text)]';
    headerThHoverClass = 'hover:brightness-110';
    filterActiveChipClass = 'border-black/30 bg-[var(--table-header-secondary)] text-[var(--table-header-text)] shadow-2xs font-black';
    filterInactiveChipClass = 'border-slate-300 bg-white hover:bg-slate-50 text-slate-900 shadow-2xs';
    rowZebraClass = format.zebraStriping ? 'even:bg-slate-50/75 hover:bg-slate-100/90' : 'hover:bg-slate-50';
    calendarBannerClass = 'bg-[var(--table-header)] text-[var(--table-header-text)] border-b';
    calendarDaysHeaderClass = 'bg-[var(--table-header)] text-[var(--table-header-text)] border-b';
    calendarNavBtnClass = 'bg-[var(--table-header-secondary)] text-[var(--table-header-text)] border border-white/25 hover:brightness-110';
  }

  // Filter Style Override if explicitly set
  if (format.filterStyle === 'militar') {
    filterActiveChipClass = 'border-[#232d26] bg-[#2d3a31] text-white shadow-2xs font-black';
    filterInactiveChipClass = 'border-[#435649]/40 bg-white hover:bg-[#f0f5f1] text-[#2d3a31] shadow-2xs';
  } else if (format.filterStyle === 'emerald') {
    filterActiveChipClass = 'border-emerald-950 bg-emerald-900 text-white shadow-2xs font-black';
    filterInactiveChipClass = 'border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-950 shadow-2xs';
  } else if (format.filterStyle === 'steel') {
    filterActiveChipClass = 'border-[#1e2b37] bg-[#2c3e50] text-white shadow-2xs font-black';
    filterInactiveChipClass = 'border-slate-300 bg-white hover:bg-slate-100 text-slate-900 shadow-2xs';
  } else if (format.filterStyle === 'dark') {
    filterActiveChipClass = 'border-black bg-slate-900 text-white shadow-2xs font-black';
    filterInactiveChipClass = 'border-slate-300 bg-white hover:bg-slate-100 text-slate-900 shadow-2xs';
  } else if (format.filterStyle === 'teal') {
    filterActiveChipClass = 'border-teal-950 bg-teal-900 text-white shadow-2xs font-black';
    filterInactiveChipClass = 'border-teal-300 bg-white hover:bg-teal-50 text-teal-950 shadow-2xs';
  } else if (format.filterStyle === 'red') {
    filterActiveChipClass = 'border-red-950 bg-red-900 text-white shadow-2xs font-black';
    filterInactiveChipClass = 'border-red-300 bg-white hover:bg-red-50 text-red-950 shadow-2xs';
  } else if (format.filterStyle === 'orange') {
    filterActiveChipClass = 'border-orange-950 bg-orange-800 text-white shadow-2xs font-black';
    filterInactiveChipClass = 'border-orange-300 bg-white hover:bg-orange-50 text-orange-950 shadow-2xs';
  } else if (format.filterStyle === 'purple') {
    filterActiveChipClass = 'border-purple-950 bg-purple-900 text-white shadow-2xs font-black';
    filterInactiveChipClass = 'border-purple-300 bg-white hover:bg-purple-50 text-purple-950 shadow-2xs';
  } else if (format.filterStyle === 'slate') {
    filterActiveChipClass = 'border-slate-950 bg-slate-900 text-white shadow-2xs font-black';
    filterInactiveChipClass = 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 shadow-2xs';
  } else if (format.filterStyle === 'clean') {
    filterActiveChipClass = 'border-slate-800 bg-slate-800 text-white shadow-2xs font-black';
    filterInactiveChipClass = 'border-slate-300 bg-white hover:bg-slate-100 text-slate-800 shadow-2xs';
  } else if (format.filterStyle === 'custom') {
    filterActiveChipClass = 'border-black/30 bg-[var(--table-header)] text-[var(--table-header-text)] shadow-2xs font-black';
    filterInactiveChipClass = 'border-slate-300 bg-white hover:bg-slate-50 text-slate-900 shadow-2xs';
  }

  // Header Text Color Override
  let headerTextColorClass = '';
  if (format.headerTextColor === 'white') {
    headerTextColorClass = '!text-white';
  } else if (format.headerTextColor === 'dark') {
    headerTextColorClass = '!text-slate-900';
  } else if (format.headerTextColor === 'muted') {
    headerTextColorClass = '!text-slate-600';
  } else if (format.headerTextColor === 'colored') {
    headerTextColorClass = '!text-emerald-950';
  } else if (format.headerTextColor === 'custom') {
    headerTextColorClass = '!text-[var(--table-header-text)]';
  }

  // Header Weight & Casing
  const headerWeightClass = `${format.boldHeaders ? 'font-bold' : 'font-medium'} ${format.italicHeaders ? 'italic' : 'not-italic'}`;
  const headerCasingClass = format.headerCasing === 'uppercase' || format.headerUppercase
    ? 'uppercase tracking-wider'
    : format.headerCasing === 'capitalize'
      ? 'capitalize tracking-normal'
      : 'normal-case tracking-normal';
  const headerWrapClass = format.wrapHeaders !== false ? 'whitespace-normal break-words leading-tight' : 'whitespace-nowrap truncate';
  const headerAlignClass = format.headerAlignment === 'left' ? 'text-left justify-start' : 'text-center justify-center';
  const headerPaddingClass = format.headerPadding === 'compact' ? 'p-2 sm:p-2.5' : format.headerPadding === 'spacious' ? 'p-4 sm:p-5' : 'p-3 sm:p-4';
  
  // Header Font Size
  const headerFontSizeClass = format.headerFontSize === 'xs' 
    ? 'text-[11px]' 
    : format.headerFontSize === 'base' 
      ? 'text-[14px]' 
      : format.headerFontSize === 'lg'
        ? 'text-[16px]'
        : 'text-[12px]';

  // 2. Cells & Body Formatting
  const cellWeightClass = `${format.boldCells ? 'font-bold' : 'font-normal'} ${format.italicCells ? 'italic' : 'not-italic'}`;
  const cellWrapClass = format.wrapCells !== false ? 'whitespace-normal break-words leading-snug' : 'whitespace-nowrap truncate';
  const cellAlignClass = format.cellAlignment === 'left' ? 'text-left' : 'text-center';
  const firstColAlignClass = format.firstColAlignment
    ? (format.firstColAlignment === 'left' ? 'text-left' : 'text-center')
    : cellAlignClass;
  
  // Cell Font Size
  const cellFontSizeClass = format.fontSize === 'xs' 
    ? 'text-[11px]' 
    : format.fontSize === 'base' 
      ? 'text-[14px]' 
      : format.fontSize === 'lg'
        ? 'text-[16px]'
        : 'text-[12px]';

  // Cell Padding (Density)
  const effDensity = format.cellPadding || format.density || 'normal';
  const cellPadClass = effDensity === 'ultra_compact'
    ? 'px-1 py-0.5'
    : effDensity === 'compact' 
      ? 'px-1.5 py-1' 
      : effDensity === 'comfortable'
        ? 'px-3 py-2.5'
        : effDensity === 'spacious' 
          ? 'px-4 py-3' 
          : 'px-2 py-1.5';

  // Table Container Radius
  const tableRadiusClass = format.tableRadius === 'sharp'
    ? 'rounded-none'
    : format.tableRadius === 'subtle'
      ? 'rounded-lg'
      : format.tableRadius === 'rounded'
        ? 'rounded-xl'
        : 'rounded-2xl';

  // Cell Text Color — contrato global: conteúdo comum das células é preto.
  const cellTextColorClass = 'text-black';

  // Column Borders & Zebra Striping
  const isDarkHeader = ['militar', 'emerald', 'steel', 'teal', 'red', 'orange', 'purple', 'dark', 'colored'].includes(theme);
  const borderClass = format.showBorders === false ? '' : 'border-r border-slate-200/60';
  const headerBorderClass = format.showBorders === false ? '' : isDarkHeader ? 'border-r border-black/35' : 'border-r border-slate-300';

  // First column button styles (Customizable highlight: green, militar, steel, amber, slate)
  const firstColHighlight = format.firstColHighlight || 'emerald';
  let firstColBtnClass = 'inline-flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg bg-slate-100/90 group-hover/col0:bg-emerald-100 group-hover/col0:border-emerald-500 group-hover/col0:text-emerald-950 transition-all border border-slate-200 shadow-2xs text-center w-full select-none cursor-pointer';
  let firstColTagClass = 'font-semibold text-slate-700 group-hover/col0:text-emerald-900 text-[10px] tracking-tight whitespace-nowrap';
  let firstColSubtextClass = 'text-[8px] font-bold text-slate-600 group-hover/col0:text-emerald-800 uppercase tracking-tight mt-0.5';
  let firstColCellHoverClass = 'hover:bg-emerald-50/40';

  if (firstColHighlight === 'militar') {
    firstColBtnClass = 'inline-flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg bg-slate-100/90 group-hover/col0:bg-[#e2ebe4] group-hover/col0:border-[#435649] group-hover/col0:text-[#232d26] transition-all border border-slate-200 shadow-2xs text-center w-full select-none cursor-pointer';
    firstColTagClass = 'font-semibold text-slate-700 group-hover/col0:text-[#2d3a31] text-[10px] tracking-tight whitespace-nowrap';
    firstColSubtextClass = 'text-[8px] font-bold text-slate-600 group-hover/col0:text-[#344439] uppercase tracking-tight mt-0.5';
    firstColCellHoverClass = 'hover:bg-[#f0f5f1]';
  } else if (firstColHighlight === 'steel') {
    firstColBtnClass = 'inline-flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg bg-slate-100/90 group-hover/col0:bg-sky-100 group-hover/col0:border-sky-500 group-hover/col0:text-sky-950 transition-all border border-slate-200 shadow-2xs text-center w-full select-none cursor-pointer';
    firstColTagClass = 'font-semibold text-slate-700 group-hover/col0:text-sky-900 text-[10px] tracking-tight whitespace-nowrap';
    firstColSubtextClass = 'text-[8px] font-bold text-slate-600 group-hover/col0:text-sky-800 uppercase tracking-tight mt-0.5';
    firstColCellHoverClass = 'hover:bg-sky-50/50';
  } else if (firstColHighlight === 'amber') {
    firstColBtnClass = 'inline-flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg bg-slate-100/90 group-hover/col0:bg-amber-100 group-hover/col0:border-amber-500 group-hover/col0:text-amber-950 transition-all border border-slate-200 shadow-2xs text-center w-full select-none cursor-pointer';
    firstColTagClass = 'font-semibold text-slate-700 group-hover/col0:text-amber-900 text-[10px] tracking-tight whitespace-nowrap';
    firstColSubtextClass = 'text-[8px] font-bold text-slate-600 group-hover/col0:text-amber-800 uppercase tracking-tight mt-0.5';
    firstColCellHoverClass = 'hover:bg-amber-50/40';
  } else if (firstColHighlight === 'slate') {
    firstColBtnClass = 'inline-flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg bg-slate-100/90 group-hover/col0:bg-slate-200 group-hover/col0:border-slate-400 group-hover/col0:text-slate-950 transition-all border border-slate-200 shadow-2xs text-center w-full select-none cursor-pointer';
    firstColTagClass = 'font-semibold text-slate-700 group-hover/col0:text-slate-900 text-[10px] tracking-tight whitespace-nowrap';
    firstColSubtextClass = 'text-[8px] font-bold text-slate-600 group-hover/col0:text-slate-800 uppercase tracking-tight mt-0.5';
    firstColCellHoverClass = 'hover:bg-slate-100/70';
  } else if (firstColHighlight === 'custom') {
    firstColBtnClass = 'inline-flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg bg-slate-100/90 group-hover/col0:bg-[var(--table-first-column)] group-hover/col0:border-[var(--table-first-column)] group-hover/col0:text-white transition-all border border-slate-200 shadow-2xs text-center w-full select-none cursor-pointer';
    firstColTagClass = 'font-semibold text-slate-700 group-hover/col0:text-white text-[10px] tracking-tight whitespace-nowrap';
    firstColSubtextClass = 'text-[8px] font-bold text-slate-600 group-hover/col0:text-white uppercase tracking-tight mt-0.5';
    firstColCellHoverClass = 'hover:bg-slate-50';
  }

  // Row Hover & Shadow
  let rowHoverClass = 'hover:bg-slate-50';
  if (format.rowHoverEffect === 'none') {
    rowHoverClass = '';
  } else if (format.rowHoverEffect === 'highlight') {
    rowHoverClass = theme === 'militar' ? 'hover:bg-[#eaf1ec]' : theme === 'emerald' ? 'hover:bg-emerald-50' : theme === 'red' ? 'hover:bg-red-50' : 'hover:bg-slate-100';
  } else if (format.rowHoverEffect === 'scale') {
    rowHoverClass = 'hover:bg-slate-50/90 hover:brightness-[0.98] transition-colors';
  } else {
    rowHoverClass = 'hover:bg-slate-50/80';
  }

  if (format.zebraStriping) {
    rowZebraClass = `even:bg-slate-50/60 ${rowHoverClass}`;
  } else {
    rowZebraClass = rowHoverClass;
  }

  const tableShadowClass = format.tableShadow === 'none'
    ? 'shadow-none'
    : format.tableShadow === 'medium'
      ? 'shadow-md'
      : format.tableShadow === 'prominent'
        ? 'shadow-xl'
        : 'shadow-xs';

  // Progress styling (Always green or custom)
  const progressStrokeColor = format.progressColorMode === 'custom' && format.customProgressColor
    ? format.customProgressColor
    : (format.customFirstColumnColor || '#059669');
  const progressBgStrokeColor = '#d1fae5'; // Emerald-100
  const progressPercentTextClass = 'text-[9.5px] font-black text-emerald-950 leading-none';
  const progressLabelTextClass = 'text-[7px] font-black text-emerald-800 uppercase tracking-tight leading-none mt-0.5 truncate max-w-[36px]';

  const fontFamilyClass = format.fontFamily === 'serif' || format.fontFamily === 'georgia'
    ? 'font-serif'
    : format.fontFamily === 'mono'
      ? 'font-mono'
      : format.fontFamily === 'arial'
        ? '[font-family:Arial,sans-serif]'
        : format.fontFamily === 'verdana'
          ? '[font-family:Verdana,sans-serif]'
          : format.fontFamily === 'rounded'
            ? '[font-family:ui-rounded,system-ui,sans-serif]'
            : format.fontFamily === 'roboto'
              ? '[font-family:Roboto,sans-serif]'
              : format.fontFamily === 'inter'
                ? '[font-family:Inter,ui-sans-serif,system-ui,sans-serif]'
                : 'font-sans';

  // Toolbar Button Shapes and Dimensions
  const btnShapeClass = (format.buttonBorderRadius === 'rounded-full' || format.toolbarButtonShape === 'circle')
    ? 'rounded-full'
    : (format.buttonBorderRadius === 'rounded-md' || format.toolbarButtonShape === 'square')
      ? 'rounded-md'
      : 'rounded-xl';

  const btnSizeClass = format.toolbarButtonSize === 'sm'
    ? 'h-6.5 w-6.5 text-[11px]'
    : format.toolbarButtonSize === 'lg'
      ? 'h-9 w-9 text-sm'
      : 'h-7.5 w-7.5 text-xs';

  const btnBorderWidthClass = format.toolbarButtonBorderWidth === 'none'
    ? 'border-0'
    : format.toolbarButtonBorderWidth === 'medium'
      ? 'border-2'
      : 'border';

  const toolbarButtonClass = `${btnShapeClass} ${btnSizeClass} ${btnBorderWidthClass} shadow-xs transition-all hover:brightness-115 active:scale-95 flex items-center justify-center cursor-pointer shrink-0 select-none`;

  const toolbarButtonStyle: CSSProperties = {
    backgroundColor: toolbarBtnBg,
    color: toolbarBtnText,
    borderColor: format.toolbarButtonBorderColor || (format.toolbarButtonBorderWidth === 'none' ? 'transparent' : toolbarBtnBg),
    opacity: format.toolbarButtonOpacity !== undefined ? format.toolbarButtonOpacity : 1,
  };

  const bannerHeaderStyle: CSSProperties = {
    backgroundColor: format.customHeaderColor || (theme === 'colored' ? tDef.bg : undefined),
    color: format.customHeaderTextColor || (theme === 'colored' ? tDef.text : undefined),
    borderBottomColor: dividerColor,
  };

  const filterDividerStyle: CSSProperties = {
    borderTopColor: filterDividerColor,
  };

  const theadStyle: CSSProperties = {
    backgroundColor: format.customHeaderColor || (theme === 'colored' ? tDef.bg : undefined),
    color: format.customHeaderTextColor || (theme === 'colored' ? tDef.text : undefined),
    borderBottomColor: dividerColor,
  };

  const filterActiveChipStyle: CSSProperties = {
    backgroundColor: format.customFilterActiveBg || undefined,
    color: format.customFilterActiveText || undefined,
    borderColor: format.customFilterActiveBorder || undefined,
  };

  const filterInactiveChipStyle: CSSProperties = {
    backgroundColor: format.customFilterInactiveBg || undefined,
    color: format.customFilterInactiveText || undefined,
    borderColor: format.customFilterInactiveBorder || undefined,
  };

  const rootStyle = {
    '--table-header': format.customHeaderColor || tDef.bg,
    '--table-header-secondary': format.customHeaderSecondaryColor || tDef.secondary,
    '--table-header-text': format.customHeaderTextColor || tDef.text,
    '--table-header-divider': dividerColor,
    '--table-filter-divider': filterDividerColor,
    '--table-cell-text': format.customCellTextColor || '#0f172a',
    '--table-first-column': format.customFirstColumnColor || '#047857',
  } as Record<string, string>;

  const actionPillClass = `inline-flex items-center justify-center gap-1.5 font-extrabold text-xs px-4 py-2 uppercase tracking-wider shadow-2xs transition-all cursor-pointer select-none active:scale-95 ${btnShapeClass} ${btnBorderWidthClass}`;

  const actionPillStyle: CSSProperties = {
    backgroundColor: toolbarBtnBg,
    color: toolbarBtnText,
    borderColor: format.toolbarButtonBorderColor || (format.toolbarButtonBorderWidth === 'none' ? 'transparent' : toolbarBtnBg),
    opacity: format.toolbarButtonOpacity !== undefined ? format.toolbarButtonOpacity : 1,
  };

  return {
    bannerHeaderClass,
    bannerHeaderStyle,
    filterDividerStyle,
    theadStyle,
    bannerDividerColor: dividerColor,
    filterDividerColor,

    toolbarButtonClass,
    toolbarButtonStyle,
    actionPillClass,
    actionPillStyle,

    headerTheadClass,
    headerThClass,
    headerThHoverClass,
    headerBtnClass,
    headerTextColorClass,
    headerWeightClass,
    headerCasingClass,
    headerWrapClass,
    headerAlignClass,
    headerFontSizeClass,
    headerBorderClass,
    headerPaddingClass,
    tableRadiusClass,

    filterBarBgClass,
    filterActiveChipClass,
    filterInactiveChipClass,
    filterActiveChipStyle,
    filterInactiveChipStyle,

    calendarBannerClass,
    calendarDaysHeaderClass,
    calendarNavBtnClass,

    cellWeightClass,
    cellWrapClass,
    cellAlignClass,
    firstColAlignClass,
    cellFontSizeClass,
    cellPadClass,
    cellTextColorClass,

    borderClass,
    rowZebraClass,
    rowHoverClass,
    tableShadowClass,

    firstColBtnClass,
    firstColTagClass,
    firstColSubtextClass,
    firstColCellHoverClass,

    progressStrokeColor,
    progressBgStrokeColor,
    progressPercentTextClass,
    progressLabelTextClass,
    fontFamilyClass,
    rootStyle,
    isDark: tDef.isDark,
  };
}

/**
 * Helper function to compute filter chip styling based on filterColorMode, filterColorScheme,
 * and individual category configurations (e.g. ALUNO, BANCA, AVALIADOR, VISUALIZADOR, MODELOS, etc.)
 */
export function getFilterChipProps(
  key: string,
  isSelected: boolean,
  format: TableTextFormat = {},
  fallbackLabel?: string,
  fallbackEmoji?: string
) {
  const mode = format.filterColorMode || 'full';
  const scheme = format.filterColorScheme || 'vibrant';

  const defaultConfigs = DEFAULT_TABLE_TEXT_FORMAT.filterItemsConfig || {};
  const customConfigs = format.filterItemsConfig || {};
  const itemConfig = customConfigs[key] || defaultConfigs[key] || {
    key,
    label: fallbackLabel || key.toUpperCase(),
    emoji: fallbackEmoji || '🟡',
    dotColor: '#eab308',
    bgColor: '#fef9c3',
    textColor: '#713f12',
    borderColor: '#eab308',
    badgeBgColor: '#eab308',
    badgeTextColor: '#ffffff',
  };

  const label = itemConfig.label || fallbackLabel || key.toUpperCase();
  const emoji = itemConfig.emoji || fallbackEmoji || '';
  const dotColor = itemConfig.dotColor || '#eab308';

  let buttonStyle: CSSProperties = {};
  let badgeStyle: CSSProperties = {};

  if (scheme === 'vibrant' || scheme === 'custom') {
    if (mode === 'full') {
      // Coloração no botão todo (pílula com cor de fundo, borda e texto contrastante)
      if (isSelected) {
        buttonStyle = {
          backgroundColor: itemConfig.bgColor || '#fef9c3',
          color: itemConfig.textColor || '#713f12',
          borderColor: itemConfig.borderColor || itemConfig.dotColor || '#eab308',
          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
        };
        badgeStyle = {
          backgroundColor: itemConfig.badgeBgColor || itemConfig.dotColor || '#eab308',
          color: itemConfig.badgeTextColor || '#ffffff',
        };
      } else {
        buttonStyle = {
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          color: 'inherit',
          borderColor: 'rgba(255, 255, 255, 0.3)',
          opacity: 0.85,
        };
        badgeStyle = {
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          color: '#ffffff',
        };
      }
    } else {
      // Coloração SÓ no número / badge
      if (isSelected) {
        buttonStyle = {
          backgroundColor: '#ffffff',
          color: '#0f172a',
          borderColor: itemConfig.borderColor || '#cbd5e1',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        };
      } else {
        buttonStyle = {
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          color: 'inherit',
          borderColor: 'rgba(255, 255, 255, 0.25)',
        };
      }
      // O badge do número SEMPRE recebe a cor personalizada
      badgeStyle = {
        backgroundColor: itemConfig.badgeBgColor || itemConfig.dotColor || '#eab308',
        color: itemConfig.badgeTextColor || '#ffffff',
      };
    }
  } else {
    // Theme scheme
    const tStyles = getTableStyles(format);
    buttonStyle = isSelected ? tStyles.filterActiveChipStyle : tStyles.filterInactiveChipStyle;
    badgeStyle = {
      backgroundColor: isSelected ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)',
      color: '#ffffff',
    };
  }

  return {
    label,
    emoji,
    dotColor,
    buttonStyle,
    badgeStyle,
    mode,
    itemConfig,
  };
}

export interface PortalTablePreset {
  id: string;
  storageKey: string;
  name: string;
  description: string;
  defaultTitle: string;
  columns: Array<{ key: string; label: string; defaultVisible?: boolean }>;
}

export const PORTAL_TABLE_PRESETS: Record<string, PortalTablePreset> = {
  defesas: {
    id: 'defesas',
    storageKey: 'defenses',
    name: 'Planilha Geral de Defesas',
    description: 'Tabela principal de agendamento de defesas públicas com calendário',
    defaultTitle: 'Planilha Geral de Defesas de TCC',
    columns: [
      { key: 'protocolo', label: '📄 Nº Processo', defaultVisible: true },
      { key: 'defesaDataHora', label: '📅 Data e Hora', defaultVisible: true },
      { key: 'progresso', label: '📊 Progresso', defaultVisible: true },
      { key: 'titulo', label: '📖 Título do Trabalho', defaultVisible: true },
      { key: 'aluno1', label: '🎓 Aluno 1', defaultVisible: true },
      { key: 'aluno2', label: '🎓 Aluno 2', defaultVisible: true },
      { key: 'orientador', label: '🧑‍🏫 Orientador(a)', defaultVisible: true },
      { key: 'membro1', label: '👥 1º Membro', defaultVisible: true },
      { key: 'membro2', label: '👥 2º Membro', defaultVisible: true },
      { key: 'coorientador', label: '🧑‍🏫 Coorientador(a)', defaultVisible: true },
      { key: 'resumo', label: '📝 Resumo', defaultVisible: false },
      { key: 'palavrasChave', label: '🏷️ Palavras-chave', defaultVisible: false },
      { key: 'defesaLocal', label: '📍 Local da Defesa', defaultVisible: true },
    ]
  },
  acervo: {
    id: 'acervo',
    storageKey: 'acervo',
    name: 'Planilha do Repositório (Biblioteca)',
    description: 'Tabela de trabalhos de conclusão de curso finalizados e aprovados',
    defaultTitle: 'Repositório de TCCs Concluídos',
    columns: [
      { key: 'protocolo', label: '📄 Nº Processo', defaultVisible: true },
      { key: 'progresso', label: '📊 Progresso', defaultVisible: true },
      { key: 'titulo', label: '📖 Título do Trabalho', defaultVisible: true },
      { key: 'aluno1', label: '🎓 Aluno 1', defaultVisible: true },
      { key: 'aluno2', label: '🎓 Aluno 2', defaultVisible: true },
      { key: 'orientador', label: '🧑‍🏫 Orientador(a)', defaultVisible: true },
      { key: 'membro1', label: '👥 1º Membro', defaultVisible: true },
      { key: 'membro2', label: '👥 2º Membro', defaultVisible: true },
      { key: 'coorientador', label: '🧑‍🏫 Coorientador(a)', defaultVisible: true },
      { key: 'resumo', label: '📝 Resumo do TCC', defaultVisible: true },
      { key: 'palavrasChave', label: '🏷️ Palavras-chave', defaultVisible: true },
      { key: 'defesaDataHora', label: '📅 Data e Hora', defaultVisible: true },
      { key: 'defesaLocal', label: '📍 Local da Defesa', defaultVisible: true },
    ]
  },
  meus_processos: {
    id: 'meus_processos',
    storageKey: 'meus_processos',
    name: 'Planilha Meus TCCs & Processos',
    description: 'Painel discente e docente para acompanhamento de orientações e defesas',
    defaultTitle: 'Meus Processos de TCC',
    columns: [
      { key: 'protocolo', label: '📄 Nº Processo', defaultVisible: true },
      { key: 'defesaDataHora', label: '📅 Data e Hora', defaultVisible: true },
      { key: 'progresso', label: '📊 Progresso', defaultVisible: true },
      { key: 'titulo', label: '📖 Título do Trabalho', defaultVisible: true },
      { key: 'aluno1', label: '🎓 Aluno 1', defaultVisible: true },
      { key: 'aluno2', label: '🎓 Aluno 2', defaultVisible: true },
      { key: 'orientador', label: '🧑‍🏫 Orientador(a)', defaultVisible: true },
      { key: 'membro1', label: '👥 1º Membro', defaultVisible: true },
      { key: 'membro2', label: '👥 2º Membro', defaultVisible: false },
      { key: 'coorientador', label: '🧑‍🏫 Coorientador(a)', defaultVisible: false },
      { key: 'resumo', label: '📝 Resumo', defaultVisible: false },
      { key: 'palavrasChave', label: '🏷️ Palavras-chave', defaultVisible: false },
      { key: 'defesaLocal', label: '📍 Local', defaultVisible: true },
    ]
  },
  coordenador: {
    id: 'coordenador',
    storageKey: 'coordinator',
    name: 'Planilha da Área do Presidente',
    description: 'Gestão administrativa da comissão, atas e aprovações de banca',
    defaultTitle: 'Gestão da Comissão de TCC',
    columns: [
      { key: 'protocolo', label: '📄 Nº Processo', defaultVisible: true },
      { key: 'envioStatus', label: '📤 Envio', defaultVisible: true },
      { key: 'defesaDataHora', label: '📅 Data e Hora', defaultVisible: true },
      { key: 'titulo', label: '📖 Título do Trabalho', defaultVisible: true },
      { key: 'aluno1', label: '🎓 Aluno 1', defaultVisible: true },
      { key: 'aluno2', label: '🎓 Aluno 2', defaultVisible: true },
      { key: 'orientador', label: '🧑‍🏫 Orientador(a)', defaultVisible: true },
      { key: 'membro1', label: '👥 1º Membro', defaultVisible: false },
      { key: 'membro2', label: '👥 2º Membro', defaultVisible: false },
      { key: 'coorientador', label: '🧑‍🏫 Coorientador(a)', defaultVisible: false },
      { key: 'resumo', label: '📝 Resumo', defaultVisible: false },
      { key: 'palavrasChave', label: '🏷️ Palavras-chave', defaultVisible: false },
      { key: 'defesaLocal', label: '📍 Local', defaultVisible: true },
    ]
  }
};

/**
 * Helper to compute action button styling using global table configuration for coloration,
 * combined with local/table-specific overrides for labels/visibility.
 */
export function getActionPillStyles(localFormat?: TableTextFormat) {
  const globalFormat = loadGlobalTableConfig();
  const mergedFormat = { ...globalFormat, ...localFormat };
  return getTableStyles(mergedFormat);
}
