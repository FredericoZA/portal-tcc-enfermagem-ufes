/**
 * Compatibilidade de classes semânticas do Portal.
 *
 * Este módulo não define cor, tamanho ou geometria.
 * Todos os valores visuais vivem em CSS e consomem os tokens canônicos.
 */
export const THEME = {
  btnPrimary: 'portal-theme-btn-primary',
  btnSecondary: 'portal-theme-btn-secondary',
  btnOutline: 'portal-theme-btn-outline',
  btnPillPrimary: 'portal-theme-btn-pill-primary',
  filterActive: 'portal-theme-filter-active',
  filterInactive: 'portal-theme-filter-inactive',
  headerIconButton: 'portal-theme-header-icon-button',
  headerIconButtonActive: 'portal-theme-header-icon-button-active',
  gearIconBtn: 'portal-theme-header-icon-button',
  lupaIconBtn: 'portal-theme-header-icon-button',
} as const;
