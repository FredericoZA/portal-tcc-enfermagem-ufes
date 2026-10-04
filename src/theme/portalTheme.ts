import type { CSSProperties } from 'react';

/**
 * Única fonte de verdade para a identidade visual do Portal TCC.
 *
 * Regra arquitetural:
 * - componentes não inventam cores estruturais;
 * - CSS consome variáveis --portal-*;
 * - configurações administrativas podem alterar conteúdo, nunca a identidade estrutural.
 */
export const PORTAL_THEME = {
  surface: {
    page: '#f1f5f9',
    panel: '#e1e6e9',
    card: '#d5dce0',
    inner: '#ffffff',
  },
  brand: {
    header: '#005830',
    action: '#337959',
    actionBorder: '#286a4d',
    headerInstitution: '#d5dce0',
  },
  chrome: {
    sidebarFooter: '#011f17',
    active: '#154d41',
    divider: '#174c3b',
  },
  text: {
    dark: '#0f172a',
    light: '#ffffff',
    mutedLight: '#b5c8bf',
  },
  semantic: {
    defense: {
      defended: { bg: '#bed8c3', border: '#719a79', text: '#23472b' },
      upcoming: { bg: '#e8dda7', border: '#b49d4f', text: '#4a4020' },
    },
    role: {
      student: { bg: '#fde68a', border: '#d4a300', text: '#3f3000' },
      board: { bg: '#fdba74', border: '#ea580c', text: '#431407' },
      evaluator: { bg: '#bbf7d0', border: '#16a34a', text: '#14532d' },
      viewer: { bg: '#bfdbfe', border: '#2563eb', text: '#1e3a8a' },
    },
    signature: {
      pending: { bg: '#d8c98f', border: '#9b884b', text: '#3e361c' },
      signed: { bg: '#c2d0c2', border: '#7e907e', text: '#263728' },
    },
    neutral: { bg: '#e2e8f0', border: '#94a3b8', text: '#334155' },
  },
  geometry: {
    sheetTitle: 45,
    titleToFilterDivider: 5,
    sheetFilter: 45,
    contentDivider: 15,
    columnHeader: 35,
    rowMin: 30,
    pagination: 24,
    columnControl: 15,
    toolbarButton: 30,
    toolbarActionGap: 10,
    toolbarPairGap: 4,
    cellPaddingY: 4,
    cellPaddingX: 8,
    barPaddingX: 16,
    panelRadius: 16,
  },
  zIndex: {
    stickyColumn: 30,
    stickyHeader: 40,
    stickyCorner: 60,
  },
} as const;

export type PortalTheme = typeof PORTAL_THEME;

export const PORTAL_STRUCTURAL_COLORS = new Set<string>([
  PORTAL_THEME.surface.page,
  PORTAL_THEME.surface.panel,
  PORTAL_THEME.surface.card,
  PORTAL_THEME.surface.inner,
  PORTAL_THEME.brand.header,
  PORTAL_THEME.brand.action,
  PORTAL_THEME.brand.headerInstitution,
  PORTAL_THEME.chrome.sidebarFooter,
  PORTAL_THEME.chrome.active,
  PORTAL_THEME.text.dark,
  PORTAL_THEME.text.light,
]);

export function getPortalThemeCssVars(): CSSProperties {
  const { surface, brand, chrome, text, geometry, zIndex } = PORTAL_THEME;
  return {
    '--portal-surface-page': surface.page,
    '--portal-surface-layer-1': surface.panel,
    '--portal-surface-layer-2': surface.card,
    '--portal-surface-inner': surface.inner,
    '--portal-green-header': brand.header,
    '--portal-green-action': brand.action,
    '--portal-green-action-border': brand.actionBorder,
    '--portal-header-institution': brand.headerInstitution,
    '--portal-sidebar-footer': chrome.sidebarFooter,
    '--portal-sidebar-active': chrome.active,
    '--portal-text-dark': text.dark,
    '--portal-text-light': text.light,
    '--portal-sheet-title-height': `${geometry.sheetTitle}px`,
    '--portal-sheet-title-divider': `${geometry.titleToFilterDivider}px`,
    '--portal-sheet-filter-height': `${geometry.sheetFilter}px`,
    '--portal-sheet-content-divider': `${geometry.contentDivider}px`,
    '--portal-sheet-column-header-height': `${geometry.columnHeader}px`,
    '--portal-sheet-row-min-height': `${geometry.rowMin}px`,
    '--portal-sheet-pagination-height': `${geometry.pagination}px`,
    '--portal-sheet-column-control-size': `${geometry.columnControl}px`,
    '--portal-toolbar-button-size': `${geometry.toolbarButton}px`,
    '--portal-toolbar-action-gap': `${geometry.toolbarActionGap}px`,
    '--portal-toolbar-pair-gap': `${geometry.toolbarPairGap}px`,
    '--portal-cell-padding-y': `${geometry.cellPaddingY}px`,
    '--portal-cell-padding-x': `${geometry.cellPaddingX}px`,
    '--portal-bar-padding-x': `${geometry.barPaddingX}px`,
    '--portal-panel-radius': `${geometry.panelRadius}px`,
    '--portal-z-sticky-column': String(zIndex.stickyColumn),
    '--portal-z-sticky-header': String(zIndex.stickyHeader),
    '--portal-z-sticky-corner': String(zIndex.stickyCorner),
  } as CSSProperties;
}
