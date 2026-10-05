/**
 * Referências semânticas do tema.
 *
 * Os valores reais (HEX, pixels, z-index) vivem exclusivamente em src/styles/portal-tokens.css.
 * O TypeScript consome CSS Custom Properties para não duplicar a fonte de verdade.
 */
export const PORTAL_THEME = {
  surface: {
    page: 'var(--portal-surface-page)',
    panel: 'var(--portal-surface-panel)',
    card: 'var(--portal-surface-card)',
    inner: 'var(--portal-surface-inner)',
  },
  brand: {
    header: 'var(--portal-brand-header)',
    action: 'var(--portal-brand-action)',
    actionBorder: 'var(--portal-brand-action-border)',
    headerInstitution: 'var(--portal-header-institution)',
  },
  chrome: {
    sidebarFooter: 'var(--portal-sidebar-footer)',
    active: 'var(--portal-sidebar-active)',
    divider: 'var(--portal-sidebar-divider)',
  },
  text: {
    dark: 'var(--portal-text-dark)',
    light: 'var(--portal-text-light)',
    mutedLight: 'var(--portal-text-muted-light)',
  },
  semantic: {
    defense: {
      defended: {
        bg: 'var(--portal-defense-defended-bg)',
        border: 'var(--portal-defense-defended-border)',
        text: 'var(--portal-defense-defended-text)',
      },
      upcoming: {
        bg: 'var(--portal-defense-upcoming-bg)',
        border: 'var(--portal-defense-upcoming-border)',
        text: 'var(--portal-defense-upcoming-text)',
      },
    },
    role: {
      student: {
        bg: 'var(--portal-role-student-bg)',
        border: 'var(--portal-role-student-border)',
        text: 'var(--portal-role-student-text)',
      },
      board: {
        bg: 'var(--portal-role-board-bg)',
        border: 'var(--portal-role-board-border)',
        text: 'var(--portal-role-board-text)',
      },
      evaluator: {
        bg: 'var(--portal-role-evaluator-bg)',
        border: 'var(--portal-role-evaluator-border)',
        text: 'var(--portal-role-evaluator-text)',
      },
      viewer: {
        bg: 'var(--portal-role-viewer-bg)',
        border: 'var(--portal-role-viewer-border)',
        text: 'var(--portal-role-viewer-text)',
      },
    },
    signature: {
      pending: {
        bg: 'var(--portal-signature-pending-bg)',
        border: 'var(--portal-signature-pending-border)',
        text: 'var(--portal-signature-pending-text)',
      },
      signed: {
        bg: 'var(--portal-signature-signed-bg)',
        border: 'var(--portal-signature-signed-border)',
        text: 'var(--portal-signature-signed-text)',
      },
    },
    neutral: {
      bg: 'var(--portal-neutral-bg)',
      border: 'var(--portal-neutral-border)',
      text: 'var(--portal-neutral-text)',
    },
  },
} as const;

export type PortalTheme = typeof PORTAL_THEME;
