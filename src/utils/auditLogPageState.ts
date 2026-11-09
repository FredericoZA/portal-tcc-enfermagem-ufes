import type { AuditLog } from '../types';

export type AuditLogPageResult = { items: AuditLog[]; nextCursor: string | null; total: number };
export type AuditLogLoadMode = 'replace' | 'append' | 'refresh';
export type AuditLogPageState = {
  key: string;
  requestId: number;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  mode: AuditLogLoadMode;
  items: AuditLog[];
  nextCursor: string | null;
  total: number | null;
  error: string;
  retryBefore?: string;
};
type AuditLogPageAction =
  | { type: 'start'; key: string; requestId: number; mode: AuditLogLoadMode; before?: string }
  | { type: 'success'; key: string; requestId: number; page: AuditLogPageResult }
  | { type: 'failure'; key: string; requestId: number; message: string }
  | { type: 'reset' };

export const initialAuditLogPageState = (): AuditLogPageState => ({
  key: '', requestId: 0, status: 'idle', mode: 'replace', items: [], nextCursor: null, total: null, error: '',
});

/** Responses belong to one identity, filter set and request; cancellation alone is not an ownership check. */
export function auditLogPageReducer(state: AuditLogPageState, action: AuditLogPageAction): AuditLogPageState {
  if (action.type === 'reset') return initialAuditLogPageState();
  if (action.type === 'start') {
    const preserve = state.key === action.key && action.mode !== 'replace';
    return {
      ...(preserve ? state : initialAuditLogPageState()), key: action.key, requestId: action.requestId,
      status: 'loading', mode: action.mode, error: '', retryBefore: action.before,
    };
  }
  if (state.key !== action.key || state.requestId !== action.requestId) return state;
  if (action.type === 'failure') return {...state, status: 'error', error: action.message};
  const ids = new Set(state.items.map(item => item.id));
  const items = state.mode === 'append'
    ? [...state.items, ...action.page.items.filter(item => !ids.has(item.id))]
    : action.page.items;
  return {...state, status: 'loaded', items, nextCursor: action.page.nextCursor, total: action.page.total, error: '', retryBefore: undefined};
}

/** Do not expose a previous account/filter's rows, selection, cursor or totals while React runs effect cleanup. */
export function auditLogPageView(state: AuditLogPageState, key: string) {
  const current = key && state.key === key ? state : initialAuditLogPageState();
  return {
    items: current.items,
    nextCursor: current.nextCursor,
    total: current.total,
    loading: current.status === 'idle' || current.status === 'loading',
    loadingOlder: current.status === 'loading' && current.mode === 'append',
    error: current.error,
    retryBefore: current.retryBefore,
    showCount: current.status === 'loaded' && current.total !== null,
    showEmpty: current.status === 'loaded' && current.items.length === 0,
  };
}


/** A delayed GET retry must stop when the account/filter changes or the page closes. */
export function waitForAuditLogRetry(signal: AbortSignal, milliseconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); reject(new DOMException('Consulta cancelada.', 'AbortError')); };
    if (signal.aborted) { reject(new DOMException('Consulta cancelada.', 'AbortError')); return; }
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, milliseconds);
    signal.addEventListener('abort', cancel, {once:true});
  });
}
