import { createHash } from 'node:crypto';

type AuditValue = Record<string, unknown>;
type CompactAudit = {
  before: { fingerprint: string };
  after: { fingerprint: string; changedPaths: string[]; truncated: boolean };
};

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

function isRecord(value: unknown): value is AuditValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Preserve what changed and an integrity fingerprint, never two full settings
 * snapshots. Full settings remain in the canonical state, not in audit events.
 * Paths are metadata; values, OAuth secrets and document templates are omitted.
 */
export function compactSettingsAudit(before: AuditValue, after: AuditValue): CompactAudit {
  const paths: string[] = [];
  let truncated = false;
  const visit = (oldValue: unknown, newValue: unknown, path: string, depth: number): void => {
    if (fingerprint(oldValue) === fingerprint(newValue)) return;
    if (paths.length >= 80) { truncated = true; return; }
    if (depth < 3 && isRecord(oldValue) && isRecord(newValue)) {
      const keys = [...new Set([...Object.keys(oldValue), ...Object.keys(newValue)])].sort();
      for (const key of keys) {
        if (key === 'updatedAt') continue;
        visit(oldValue[key], newValue[key], path ? `${path}.${key}` : key, depth + 1);
      }
      return;
    }
    if (path) paths.push(path);
  };
  visit(before, after, '', 0);
  return {
    before: { fingerprint: fingerprint(before) },
    after: { fingerprint: fingerprint(after), changedPaths: paths, truncated },
  };
}
