import type { CSSProperties } from 'react';

export const PORTAL_SURFACE_COLORS = {
  // Escala estrutural canônica: clara, memorável e reutilizada no Portal inteiro.
  page: '#f5f5f5',
  layer1: '#f0f0f0',
  layer2: '#e5e5e5',
  inner: '#ffffff',
  selected: '#909090',
  border: '#d0d0d0',
} as const;

export const PORTAL_BRAND_COLORS = {
  // Verde estrutural único das planilhas e cabeçalhos operacionais.
  header: '#006030',
  action: '#006030',
  actionBorder: '#006030',
  // Identidade lateral protegida. O rodapé usa o mesmo fundo da barra lateral.
  sidebar: '#011f17',
} as const;

export const PORTAL_SHEET_DIMENSIONS = {
  titleBar: 45,
  titleSeparator: 5,
  filterBar: 40,
  filterSeparator: 15,
  columnHeader: 35,
  columnControl: 15,
  pagination: 15,
  cellPaddingY: 5,
} as const;

export const PORTAL_SEMANTIC_COLORS = {
  defense: {
    defended: { bg: '#bed8c3', border: '#719a79', text: '#23472b' },
    upcoming: { bg: '#e8dda7', border: '#b49d4f', text: '#4a4020' },
  },
  // Quatro famílias cromáticas fáceis de distinguir na leitura rápida:
  // amarelo, laranja, verde e azul. A mesma família alimenta bolinha e processo.
  processRole: {
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
} as const;

export type PortalSemanticTone =
  | 'defended'
  | 'upcoming'
  | 'student'
  | 'board'
  | 'evaluator'
  | 'viewer'
  | 'pending'
  | 'signed'
  | 'neutral';

type PortalToneColors = { bg: string; border: string; text: string };

export function getPortalToneColors(tone: PortalSemanticTone): PortalToneColors {
  switch (tone) {
    case 'defended': return PORTAL_SEMANTIC_COLORS.defense.defended;
    case 'upcoming': return PORTAL_SEMANTIC_COLORS.defense.upcoming;
    case 'student': return PORTAL_SEMANTIC_COLORS.processRole.student;
    case 'board': return PORTAL_SEMANTIC_COLORS.processRole.board;
    case 'evaluator': return PORTAL_SEMANTIC_COLORS.processRole.evaluator;
    case 'viewer': return PORTAL_SEMANTIC_COLORS.processRole.viewer;
    case 'pending': return PORTAL_SEMANTIC_COLORS.signature.pending;
    case 'signed': return PORTAL_SEMANTIC_COLORS.signature.signed;
    case 'neutral':
    default:
      return PORTAL_SEMANTIC_COLORS.neutral;
  }
}

export function getPortalToneStyle(tone: PortalSemanticTone): CSSProperties {
  const colors = getPortalToneColors(tone);
  return {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    color: colors.text,
  };
}

export function getPortalToneCssVars(tone: PortalSemanticTone): CSSProperties {
  const colors = getPortalToneColors(tone);
  return {
    '--portal-tone-bg': colors.bg,
    '--portal-tone-border': colors.border,
    '--portal-tone-text': colors.text,
  } as CSSProperties;
}

export function getPortalSemanticRootVars(): CSSProperties {
  return {
    '--portal-surface-page': PORTAL_SURFACE_COLORS.page,
    '--portal-surface-layer-1': PORTAL_SURFACE_COLORS.layer1,
    '--portal-surface-layer-2': PORTAL_SURFACE_COLORS.layer2,
    '--portal-surface-inner': PORTAL_SURFACE_COLORS.inner,
    '--portal-surface-selected': PORTAL_SURFACE_COLORS.selected,
    '--portal-surface-border': PORTAL_SURFACE_COLORS.border,
    '--portal-sidebar-bg': PORTAL_BRAND_COLORS.sidebar,
    '--portal-green-header': PORTAL_BRAND_COLORS.header,
    '--portal-green-action': PORTAL_BRAND_COLORS.action,
    '--portal-green-action-border': PORTAL_BRAND_COLORS.actionBorder,
    '--portal-sheet-title-height': `${PORTAL_SHEET_DIMENSIONS.titleBar}px`,
    '--portal-sheet-title-separator': `${PORTAL_SHEET_DIMENSIONS.titleSeparator}px`,
    '--portal-sheet-filter-height': `${PORTAL_SHEET_DIMENSIONS.filterBar}px`,
    '--portal-sheet-filter-separator': `${PORTAL_SHEET_DIMENSIONS.filterSeparator}px`,
    '--portal-sheet-column-header-height': `${PORTAL_SHEET_DIMENSIONS.columnHeader}px`,
    '--portal-sheet-column-control-size': `${PORTAL_SHEET_DIMENSIONS.columnControl}px`,
    '--portal-sheet-pagination-height': `${PORTAL_SHEET_DIMENSIONS.pagination}px`,
    '--portal-sheet-cell-padding-y': `${PORTAL_SHEET_DIMENSIONS.cellPaddingY}px`,
    '--portal-defense-defended-bg': PORTAL_SEMANTIC_COLORS.defense.defended.bg,
    '--portal-defense-defended-border': PORTAL_SEMANTIC_COLORS.defense.defended.border,
    '--portal-defense-defended-text': PORTAL_SEMANTIC_COLORS.defense.defended.text,
    '--portal-defense-upcoming-bg': PORTAL_SEMANTIC_COLORS.defense.upcoming.bg,
    '--portal-defense-upcoming-border': PORTAL_SEMANTIC_COLORS.defense.upcoming.border,
    '--portal-defense-upcoming-text': PORTAL_SEMANTIC_COLORS.defense.upcoming.text,
    '--portal-role-student-bg': PORTAL_SEMANTIC_COLORS.processRole.student.bg,
    '--portal-role-student-border': PORTAL_SEMANTIC_COLORS.processRole.student.border,
    '--portal-role-student-text': PORTAL_SEMANTIC_COLORS.processRole.student.text,
    '--portal-role-board-bg': PORTAL_SEMANTIC_COLORS.processRole.board.bg,
    '--portal-role-board-border': PORTAL_SEMANTIC_COLORS.processRole.board.border,
    '--portal-role-board-text': PORTAL_SEMANTIC_COLORS.processRole.board.text,
    '--portal-role-evaluator-bg': PORTAL_SEMANTIC_COLORS.processRole.evaluator.bg,
    '--portal-role-evaluator-border': PORTAL_SEMANTIC_COLORS.processRole.evaluator.border,
    '--portal-role-evaluator-text': PORTAL_SEMANTIC_COLORS.processRole.evaluator.text,
    '--portal-role-viewer-bg': PORTAL_SEMANTIC_COLORS.processRole.viewer.bg,
    '--portal-role-viewer-border': PORTAL_SEMANTIC_COLORS.processRole.viewer.border,
    '--portal-role-viewer-text': PORTAL_SEMANTIC_COLORS.processRole.viewer.text,
    '--portal-signature-pending-bg': PORTAL_SEMANTIC_COLORS.signature.pending.bg,
    '--portal-signature-pending-border': PORTAL_SEMANTIC_COLORS.signature.pending.border,
    '--portal-signature-pending-text': PORTAL_SEMANTIC_COLORS.signature.pending.text,
    '--portal-signature-signed-bg': PORTAL_SEMANTIC_COLORS.signature.signed.bg,
    '--portal-signature-signed-border': PORTAL_SEMANTIC_COLORS.signature.signed.border,
    '--portal-signature-signed-text': PORTAL_SEMANTIC_COLORS.signature.signed.text,
    '--portal-neutral-bg': PORTAL_SEMANTIC_COLORS.neutral.bg,
    '--portal-neutral-border': PORTAL_SEMANTIC_COLORS.neutral.border,
    '--portal-neutral-text': PORTAL_SEMANTIC_COLORS.neutral.text,
  } as CSSProperties;
}

const FILTER_TONE_ALIASES: Record<string, PortalSemanticTone> = {
  all: 'neutral',
  todas: 'neutral',
  todos: 'neutral',
  upcoming: 'upcoming',
  scheduled: 'upcoming',
  pending_defense: 'upcoming',
  pendingdefense: 'upcoming',
  a_defender: 'upcoming',
  defended: 'defended',
  completed: 'defended',
  concluded: 'defended',
  ja_defendidas: 'defended',
  student: 'student',
  aluno: 'student',
  discente: 'student',
  board: 'board',
  banca: 'board',
  evaluator: 'evaluator',
  avaliador: 'evaluator',
  avaliadora: 'evaluator',
  viewer: 'viewer',
  visualizador: 'viewer',
  visitante: 'viewer',
  pending: 'pending',
  pendente: 'pending',
  signed: 'signed',
  assinado: 'signed',
  assinada: 'signed',
};

const normalizeSemanticKey = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('pt-BR')
  .replace(/[-\s]+/g, '_');

export function resolvePortalFilterTone(key: string): PortalSemanticTone | null {
  return FILTER_TONE_ALIASES[normalizeSemanticKey(key)] || null;
}

export const PORTAL_SECTION_DIVIDER_PX = 15;
