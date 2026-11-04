/** Persist only table presentation; never executable styles, identity or process data. */
export interface TablePreference {
  columnOrder?: string[];
  visibleColumns?: Record<string, boolean>;
  customLabels?: Record<string, string>;
  columnWidths?: Record<string, string | number>;
  resizedWidths?: Record<string, number>;
  pageSize?: number | 'all';
  recordsLimit?: number | 'all';
  wrapMode?: 'wrap' | 'nowrap';
  startDate?: string;
  endDate?: string;
}
export const TABLE_PREFERENCE_EVENT = 'portal-table-preference-edited';
export const TABLE_DEFAULTS_EVENT = 'global_table_layouts_changed';
export const validTableKey = (key: string) => ['defenses', 'acervo', 'meus_processos', 'coordinator', 'authorized_access', 'signature_logs', 'audit_logs', 'feedback_inbox'].includes(key);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
export function sanitizeTablePreference(value: unknown): TablePreference {
  if (!record(value)) throw new Error('Configuração de planilha inválida.');
  if (JSON.stringify(value).length > 24000) throw new Error('Configuração de planilha muito extensa.');
  const result: TablePreference = {};
  const safeKey = (key: string) => key.length <= 140 && !['__proto__', 'prototype', 'constructor'].includes(key);
  if (Array.isArray(value.columnOrder)) result.columnOrder = [...new Set(value.columnOrder.filter((v): v is string => typeof v === 'string' && safeKey(v)))].slice(0, 100);
  for (const field of ['visibleColumns', 'customLabels', 'columnWidths', 'resizedWidths'] as const) {
    if (!record(value[field])) continue;
    const entries = Object.entries(value[field]).filter(([key, v]) => safeKey(key) && (
      field === 'visibleColumns' ? typeof v === 'boolean' :
      field === 'customLabels' ? typeof v === 'string' && v.length <= 120 :
      typeof v === 'number' ? Number.isFinite(v) && v >= 72 && v <= 720 :
      field === 'columnWidths' && ['auto', 'compact', 'normal', 'wide', 'extrawide'].includes(String(v))
    )).slice(0, 100);
    (result as Record<string, unknown>)[field] = Object.fromEntries(entries);
  }
  const size = value.pageSize ?? value.recordsLimit;
  if (size === 'all' || [25, 50, 100].includes(Number(size))) result.pageSize = size === 'all' ? 'all' : Number(size);
  result.recordsLimit = 'all';
  if (value.wrapMode === 'wrap' || value.wrapMode === 'nowrap') result.wrapMode = value.wrapMode;
  for (const field of ['startDate', 'endDate'] as const) if (typeof value[field] === 'string' && (!value[field] || /^\d{4}-\d{2}-\d{2}$/.test(value[field]))) result[field] = value[field];
  return result;
}
export const tablePreferenceKey = (email: string, key: string) => `portal_user_table_config_${email.trim().toLowerCase().replace(/[^a-z0-9@._+-]/g, '_')}_${key}`;
export function mergeTablePreferences(base: TablePreference, personal: TablePreference): TablePreference {
  const merged = {...base,...personal};
  for (const key of ['visibleColumns','customLabels','columnWidths','resizedWidths'] as const) {
    if (base[key] || personal[key]) (merged as Record<string,unknown>)[key] = {...base[key],...personal[key]};
  }
  return merged;
}
export function readStoredTablePreference(key: string, email = '', personal = true): TablePreference {
  if (typeof localStorage === 'undefined') return {};
  const read = (storageKey: string) => { try { const raw = localStorage.getItem(storageKey); return raw ? sanitizeTablePreference(JSON.parse(raw)) : {}; } catch { return {}; } };
  return mergeTablePreferences(read(`default_table_config_${key}`), personal && email ? read(tablePreferenceKey(email, key)) : {});
}
export function applyTableRuntimePreference(key: string, preference: TablePreference): void {
  try {
    localStorage.setItem(`portal_table_page_size_${key}`, String(preference.pageSize ?? 25));
    localStorage.setItem(`portal_table_current_page_${key}`, '1');
    localStorage.setItem(`portal_table_wrap_${key}`, preference.wrapMode || 'wrap');
    localStorage.setItem(`portal_tcc_v1043_wrap_${key}`, preference.wrapMode || 'wrap');
    localStorage.setItem(`portal_table_widths_${key}`, JSON.stringify(preference.resizedWidths || {}));
  } catch { /* Storage restrictions must not block the table. */ }
  window.dispatchEvent(new Event('portal-table-layouts-updated'));
}
