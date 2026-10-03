import type { CSSProperties } from 'react';

/**
 * Paleta canônica protegida do Portal TCC.
 *
 * Regra de governança: estes valores são fonte de verdade. Componentes podem
 * consumir os tokens, mas não criar tons estruturais ou semânticos paralelos.
 */
export const PORTAL_PROTECTED_COLORS = {
  surfaceLevel1: '#f2f2f2',
  surfaceLevel2: '#d9d9d9',
  surfaceLevel3: '#b7b7b7',
  white: '#ffffff',
  structuralGreen: '#006000',
  neutralSelected: '#909090',
  black: '#000000',
  sidebar: '#011f17',
  footer: '#011f17',
  navigationActive: '#154c41',
} as const;

/**
 * Paleta oficial de filtros/status fornecida para a instalação UFES.
 * F01..F10 preservam a ordem da referência visual aprovada.
 */
export const PORTAL_FILTER_PALETTE = {
  F01: '#982b15', // marrom / terracota
  F02: '#bb271a', // vermelho
  F03: '#da954b', // laranja
  F04: '#eac451', // amarelo
  F05: '#78a65a', // verde
  F06: '#54808c', // azul-petróleo
  F07: '#4b77d1', // azul
  F08: '#5083c1', // azul médio
  F09: '#634fa2', // roxo
  F10: '#9b5277', // vinho
} as const;

export const PORTAL_SURFACE_COLORS = {
  page: PORTAL_PROTECTED_COLORS.surfaceLevel1,
  layer1: PORTAL_PROTECTED_COLORS.surfaceLevel2,
  layer2: PORTAL_PROTECTED_COLORS.surfaceLevel3,
  inner: PORTAL_PROTECTED_COLORS.white,
} as const;

export const PORTAL_BRAND_COLORS = {
  header: PORTAL_PROTECTED_COLORS.structuralGreen,
  action: PORTAL_PROTECTED_COLORS.structuralGreen,
  actionBorder: PORTAL_PROTECTED_COLORS.structuralGreen,
} as const;

/**
 * Distribuição semântica deliberadamente distante.
 *
 * Vínculos: amarelo, laranja, azul e marrom, nesta ordem, para evitar que
 * categorias adjacentes dependam de tons próximos.
 */
export const PORTAL_SEMANTIC_COLORS = {
  defense: {
    defended: {
      bg: PORTAL_FILTER_PALETTE.F05,
      border: PORTAL_FILTER_PALETTE.F05,
      text: PORTAL_PROTECTED_COLORS.black,
    },
    upcoming: {
      bg: PORTAL_FILTER_PALETTE.F04,
      border: PORTAL_FILTER_PALETTE.F04,
      text: PORTAL_PROTECTED_COLORS.black,
    },
  },
  processRole: {
    student: {
      bg: PORTAL_FILTER_PALETTE.F04,
      border: PORTAL_FILTER_PALETTE.F04,
      text: PORTAL_PROTECTED_COLORS.black,
    },
    board: {
      bg: PORTAL_FILTER_PALETTE.F03,
      border: PORTAL_FILTER_PALETTE.F03,
      text: PORTAL_PROTECTED_COLORS.black,
    },
    evaluator: {
      bg: PORTAL_FILTER_PALETTE.F07,
      border: PORTAL_FILTER_PALETTE.F07,
      text: PORTAL_PROTECTED_COLORS.black,
    },
    viewer: {
      bg: PORTAL_FILTER_PALETTE.F01,
      border: PORTAL_FILTER_PALETTE.F01,
      text: PORTAL_PROTECTED_COLORS.white,
    },
  },
  signature: {
    pending: {
      bg: PORTAL_FILTER_PALETTE.F09,
      border: PORTAL_FILTER_PALETTE.F09,
      text: PORTAL_PROTECTED_COLORS.white,
    },
    signed: {
      bg: PORTAL_FILTER_PALETTE.F06,
      border: PORTAL_FILTER_PALETTE.F06,
      text: PORTAL_PROTECTED_COLORS.black,
    },
  },
  neutral: {
    bg: PORTAL_PROTECTED_COLORS.neutralSelected,
    border: PORTAL_PROTECTED_COLORS.neutralSelected,
    text: PORTAL_PROTECTED_COLORS.black,
  },
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
    '--portal-surface-level-1': PORTAL_PROTECTED_COLORS.surfaceLevel1,
    '--portal-surface-level-2': PORTAL_PROTECTED_COLORS.surfaceLevel2,
    '--portal-surface-level-3': PORTAL_PROTECTED_COLORS.surfaceLevel3,
    '--portal-surface-level-4': PORTAL_PROTECTED_COLORS.white,
    '--portal-surface-page': PORTAL_SURFACE_COLORS.page,
    '--portal-surface-layer-1': PORTAL_SURFACE_COLORS.layer1,
    '--portal-surface-layer-2': PORTAL_SURFACE_COLORS.layer2,
    '--portal-surface-inner': PORTAL_SURFACE_COLORS.inner,
    '--portal-green-header': PORTAL_BRAND_COLORS.header,
    '--portal-green-action': PORTAL_BRAND_COLORS.action,
    '--portal-green-action-border': PORTAL_BRAND_COLORS.actionBorder,
    '--portal-selection-neutral': PORTAL_PROTECTED_COLORS.neutralSelected,
    '--portal-sidebar-footer': PORTAL_PROTECTED_COLORS.sidebar,
    '--portal-navigation-active': PORTAL_PROTECTED_COLORS.navigationActive,
    '--portal-filter-f01': PORTAL_FILTER_PALETTE.F01,
    '--portal-filter-f02': PORTAL_FILTER_PALETTE.F02,
    '--portal-filter-f03': PORTAL_FILTER_PALETTE.F03,
    '--portal-filter-f04': PORTAL_FILTER_PALETTE.F04,
    '--portal-filter-f05': PORTAL_FILTER_PALETTE.F05,
    '--portal-filter-f06': PORTAL_FILTER_PALETTE.F06,
    '--portal-filter-f07': PORTAL_FILTER_PALETTE.F07,
    '--portal-filter-f08': PORTAL_FILTER_PALETTE.F08,
    '--portal-filter-f09': PORTAL_FILTER_PALETTE.F09,
    '--portal-filter-f10': PORTAL_FILTER_PALETTE.F10,
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

/** Separador branco canônico entre filtro e cabeçalho de colunas. */
export const PORTAL_SECTION_DIVIDER_PX = 15;
