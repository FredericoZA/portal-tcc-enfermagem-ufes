import type { CSSProperties } from 'react';
import { PORTAL_THEME } from '../theme/portalTheme';

export const PORTAL_SURFACE_COLORS = {
  page: PORTAL_THEME.surface.page,
  layer1: PORTAL_THEME.surface.panel,
  layer2: PORTAL_THEME.surface.card,
  inner: PORTAL_THEME.surface.inner,
} as const;

export const PORTAL_BRAND_COLORS = {
  header: PORTAL_THEME.brand.header,
  action: PORTAL_THEME.brand.action,
  actionBorder: PORTAL_THEME.brand.actionBorder,
} as const;

export const PORTAL_SEMANTIC_COLORS = {
  defense: PORTAL_THEME.semantic.defense,
  processRole: PORTAL_THEME.semantic.role,
  signature: PORTAL_THEME.semantic.signature,
  neutral: PORTAL_THEME.semantic.neutral,
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
  // Os valores reais vivem em :root no index.css.
  // Mantemos a função por compatibilidade com consumidores existentes.
  return {};
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
