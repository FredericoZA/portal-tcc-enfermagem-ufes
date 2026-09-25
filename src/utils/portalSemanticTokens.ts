import type { CSSProperties } from 'react';

export const PORTAL_SURFACE_COLORS = {
  page: '#f1f5f9',
} as const;

export const PORTAL_SEMANTIC_COLORS = {
  defense: {
    defended: { bg: '#c2d0c2', border: '#7e907e', text: '#263728' },
    upcoming: { bg: '#d4c69a', border: '#9e8f63', text: '#453d25' },
  },
  processRole: {
    student: { bg: '#d8c98f', border: '#9b884b', text: '#3e361c' },
    board: { bg: '#c9a39a', border: '#8c5e55', text: '#402824' },
    evaluator: { bg: '#9db8c0', border: '#587884', text: '#20363e' },
    viewer: { bg: '#b4a6be', border: '#75647f', text: '#342b39' },
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

const FILTER_TONE_ALIASES: Record<string, PortalSemanticTone> = {
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

export const PORTAL_SECTION_DIVIDER_PX = 16;
