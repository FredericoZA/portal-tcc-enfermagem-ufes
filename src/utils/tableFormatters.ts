// Shared Table Formatting and Styling Utilities
// Aparência: uma única fonte de verdade em src/index.css.
// Este módulo conserva apenas comportamento, texto e referências semânticas.
import type { CSSProperties } from 'react';
import type { TableTextFormat, HeaderTheme } from '../components/TableColumnSelectorPanel';
import { DEFAULT_TABLE_TEXT_FORMAT } from '../components/TableColumnSelectorPanel';
import { tableInheritsGlobalAppearance } from './portalAppearanceLinks';
import { getPortalToneStyle, resolvePortalFilterTone } from './portalSemanticTokens';

export type { TableTextFormat, HeaderTheme };
export { DEFAULT_TABLE_TEXT_FORMAT };

export const GLOBAL_TABLE_CONFIG_KEY = 'master_global_table_config';
export const GLOBAL_TABLE_EVENT = 'global_table_format_changed';

export const STATIC_PORTAL_TABLE_FORMAT: TableTextFormat = {
  headerTheme: 'colored',
  headerTextColor: 'custom',
  customHeaderColor: 'var(--portal-brand-header)',
  customHeaderSecondaryColor: 'var(--portal-brand-header)',
  customHeaderTextColor: 'var(--portal-text-light)',
  filterStyle: 'custom',
  toolbarButtonColor: 'var(--portal-surface-inner)',
  toolbarButtonTextColor: 'var(--portal-text-dark)',
  toolbarButtonBorderColor: 'var(--portal-border)',
  toolbarButtonBorderWidth: 'none',
  toolbarButtonOpacity: 1,
  fontFamily: 'inter',
};

export function loadGlobalTableConfig(): TableTextFormat {
  return {
    ...DEFAULT_TABLE_TEXT_FORMAT,
    ...STATIC_PORTAL_TABLE_FORMAT,
    filterItemsConfig: {
      ...(DEFAULT_TABLE_TEXT_FORMAT.filterItemsConfig || {}),
      ...(STATIC_PORTAL_TABLE_FORMAT.filterItemsConfig || {}),
    },
    columnEmojis: {},
    columnBold: {},
    columnWidths: {},
  };
}

export function saveGlobalTableConfig(_format: TableTextFormat): void {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(GLOBAL_TABLE_EVENT, { detail: loadGlobalTableConfig() }));
    }
  } catch {
    // Aparência é estática e versionada; falha de evento não pode quebrar a tela.
  }
}

export function inheritsGlobalTableAppearance(storageKey: string): boolean {
  return tableInheritsGlobalAppearance(storageKey);
}

export const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}]/gu;

export function stripEmojis(str: string): string {
  if (!str) return '';
  return str.replace(EMOJI_REGEX, '').replace(/\s+/g, ' ').trim();
}

export function formatColumnLabel(
  colKey: string,
  rawLabel: string,
  format?: TableTextFormat,
  customLabels?: Record<string, string>,
): string {
  let label = stripEmojis(customLabels?.[colKey]?.trim() || rawLabel);
  if (format?.headerUppercase) label = label.toUpperCase();
  return label;
}

export function formatCellText(
  colKey: string,
  text: string,
  format?: TableTextFormat,
  defaultPrefixEmoji?: string,
): string {
  void colKey;
  void format;
  void defaultPrefixEmoji;
  if (!text) return '';
  return stripEmojis(text);
}

export function getColWidthClass(
  colKey: string,
  widthsMap?: Record<string, string | number>,
  defaultClass = '',
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
  fallback: string,
): string {
  return labels?.[key]?.trim() || fallback;
}

export function getColumnWeightClass(colKey: string, format?: TableTextFormat): string {
  return format?.columnBold?.[colKey] ? 'font-bold' : '';
}

type CanonicalPalette = {
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
};

const CANONICAL_PALETTE: CanonicalPalette = {
  bg: 'var(--portal-brand-header)',
  secondary: 'var(--portal-brand-header)',
  text: 'var(--portal-text-light)',
  divider: 'var(--portal-border)',
  filterDivider: 'var(--portal-surface-inner)',
  buttonBg: 'var(--portal-surface-inner)',
  buttonText: 'var(--portal-text-dark)',
  theadBg: 'var(--portal-brand-header)',
  theadHover: '',
  isDark: true,
};

const HEADER_THEMES: HeaderTheme[] = [
  'militar','emerald','forest','steel','royal','ocean','teal','red','wine','marsala',
  'orange','amber','purple','indigo','dark','slate','light','clean','colored',
];

// Compatibilidade de API: temas históricos apontam para a mesma paleta canônica.
export const THEME_PALETTES = Object.fromEntries(
  HEADER_THEMES.map((theme) => [theme, CANONICAL_PALETTE]),
) as Record<HeaderTheme, CanonicalPalette>;

function fontSizeClass(size: TableTextFormat['fontSize'] | TableTextFormat['headerFontSize']) {
  if (size === 'xs') return 'text-[11px]';
  if (size === 'base') return 'text-[14px]';
  if (size === 'lg') return 'text-[16px]';
  return 'text-[12px]';
}

export function getTableStyles(format: TableTextFormat = {}) {
  const headerWeightClass = `${format.boldHeaders ? 'font-bold' : 'font-medium'} ${format.italicHeaders ? 'italic' : 'not-italic'}`;
  const headerCasingClass = format.headerCasing === 'uppercase' || format.headerUppercase
    ? 'uppercase tracking-wider'
    : format.headerCasing === 'capitalize'
      ? 'capitalize tracking-normal'
      : 'normal-case tracking-normal';
  const headerWrapClass = format.wrapHeaders !== false
    ? 'whitespace-normal break-words leading-tight'
    : 'whitespace-nowrap truncate';
  const headerAlignClass = format.headerAlignment === 'left'
    ? 'text-left justify-start'
    : 'text-center justify-center';

  const cellWeightClass = `${format.boldCells ? 'font-bold' : 'font-normal'} ${format.italicCells ? 'italic' : 'not-italic'}`;
  const cellWrapClass = format.wrapCells !== false
    ? 'whitespace-normal break-words leading-snug'
    : 'whitespace-nowrap truncate';
  const cellAlignClass = format.cellAlignment === 'left' ? 'text-left' : 'text-center';
  const firstColAlignClass = format.firstColAlignment
    ? (format.firstColAlignment === 'left' ? 'text-left' : 'text-center')
    : cellAlignClass;

  const noStyle: CSSProperties = {};

  return {
    bannerHeaderClass: 'portal-table-banner',
    bannerHeaderStyle: noStyle,
    filterDividerStyle: noStyle,
    theadStyle: noStyle,
    bannerDividerColor: 'var(--portal-border)',
    filterDividerColor: 'var(--portal-surface-inner)',

    toolbarButtonClass: 'portal-toolbar-icon-button',
    toolbarButtonStyle: noStyle,
    actionPillClass: 'portal-action',
    actionPillStyle: noStyle,

    headerTheadClass: 'portal-table-head',
    headerThClass: 'portal-table-header-cell',
    headerThHoverClass: '',
    headerBtnClass: 'portal-column-control',
    headerTextColorClass: '',
    headerWeightClass,
    headerCasingClass,
    headerWrapClass,
    headerAlignClass,
    headerFontSizeClass: fontSizeClass(format.headerFontSize),
    headerBorderClass: 'portal-table-header-border',
    headerPaddingClass: 'portal-table-header-padding',
    tableRadiusClass: 'portal-sheet-frame',

    filterBarBgClass: 'portal-table-filter-bar',
    filterActiveChipClass: 'portal-standard-filter-chip',
    filterInactiveChipClass: 'portal-standard-filter-chip',
    filterActiveChipStyle: noStyle,
    filterInactiveChipStyle: noStyle,

    calendarBannerClass: 'portal-table-banner',
    calendarDaysHeaderClass: 'portal-table-head',
    calendarNavBtnClass: 'portal-calendar-nav-button',

    cellWeightClass,
    cellWrapClass,
    cellAlignClass,
    firstColAlignClass,
    cellFontSizeClass: fontSizeClass(format.fontSize),
    cellPadClass: 'portal-table-cell-padding',
    cellTextColorClass: 'portal-table-cell-text',

    borderClass: 'portal-table-cell-border',
    rowZebraClass: 'portal-table-row',
    rowHoverClass: 'portal-table-row',
    tableShadowClass: '',

    firstColBtnClass: 'portal-process-pill',
    firstColTagClass: 'portal-process-pill-tag',
    firstColSubtextClass: 'portal-process-pill-subtext',
    firstColCellHoverClass: 'portal-sticky-cell',

    progressStrokeColor: 'var(--portal-brand-action)',
    progressBgStrokeColor: 'var(--portal-surface-inner)',
    progressPercentTextClass: 'portal-progress-percent',
    progressLabelTextClass: 'portal-progress-label',
    fontFamilyClass: 'portal-font',
    rootStyle: {} as Record<string, string>,
    isDark: true,
  };
}

export function getFilterChipProps(
  key: string,
  isSelected: boolean,
  format: TableTextFormat = {},
  fallbackLabel?: string,
  fallbackEmoji?: string,
) {
  const defaultConfigs = DEFAULT_TABLE_TEXT_FORMAT.filterItemsConfig || {};
  const customConfigs = format.filterItemsConfig || {};
  const itemConfig = customConfigs[key] || defaultConfigs[key] || {
    key,
    label: fallbackLabel || key.toUpperCase(),
    emoji: fallbackEmoji || '',
  };

  const label = itemConfig.label || fallbackLabel || key.toUpperCase();
  const semanticTone =
    resolvePortalFilterTone(key) ||
    resolvePortalFilterTone(itemConfig.key || '') ||
    resolvePortalFilterTone(label) ||
    resolvePortalFilterTone(fallbackLabel || '');

  if (semanticTone) {
    const semanticStyle = getPortalToneStyle(semanticTone);
    return {
      label,
      emoji: '',
      dotColor: String(semanticStyle.borderColor || 'var(--portal-neutral-border)'),
      buttonStyle: isSelected
        ? ({ ...semanticStyle, boxShadow: 'none' } as CSSProperties)
        : ({
            backgroundColor: 'var(--portal-surface-inner)',
            color: 'var(--portal-text-dark)',
            borderColor: semanticStyle.borderColor,
            boxShadow: 'none',
          } as CSSProperties),
      badgeStyle: {
        backgroundColor: semanticStyle.borderColor,
        color: semanticStyle.color,
      } as CSSProperties,
      mode: 'full',
      itemConfig,
    };
  }

  const border = itemConfig.borderColor || itemConfig.dotColor || 'var(--portal-neutral-border)';
  const bg = itemConfig.bgColor || 'var(--portal-neutral-bg)';
  const text = itemConfig.textColor || 'var(--portal-neutral-text)';
  return {
    label,
    emoji: itemConfig.emoji || fallbackEmoji || '',
    dotColor: itemConfig.dotColor || border,
    buttonStyle: isSelected
      ? ({ backgroundColor: bg, color: text, borderColor: border, boxShadow: 'none' } as CSSProperties)
      : ({
          backgroundColor: 'var(--portal-surface-inner)',
          color: 'var(--portal-text-dark)',
          borderColor: border,
          boxShadow: 'none',
        } as CSSProperties),
    badgeStyle: {
      backgroundColor: itemConfig.badgeBgColor || itemConfig.dotColor || border,
      color: itemConfig.badgeTextColor || 'var(--portal-text-light)',
    } as CSSProperties,
    mode: 'full',
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
