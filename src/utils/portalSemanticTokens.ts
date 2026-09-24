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
} as const;

export const PORTAL_SECTION_DIVIDER_PX = 16;
