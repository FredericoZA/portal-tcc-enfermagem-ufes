export const PORTAL_TABLE_KEYS = [
  'defenses',
  'acervo',
  'meus_processos',
  'coordinator',
  'authorized_access',
  'signature_logs',
  'audit_logs',
] as const;

export type PortalTableKey = (typeof PORTAL_TABLE_KEYS)[number];

export const PORTAL_TABLE_CONTAINER_SELECTORS: Record<PortalTableKey, string[]> = {
  defenses: ['#public-calendar-cards-section'],
  acervo: ['#biblioteca-tccs-section'],
  meus_processos: ['#meus-processos-page-container'],
  coordinator: ['#coordenador-page-root'],
  authorized_access: ['#authorized-access-panel'],
  signature_logs: ['#asten-logs-page'],
  audit_logs: ['#audit-logs-page'],
};

const slug = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

export function inferManagedTableKey(table: HTMLTableElement): PortalTableKey | null {
  const explicit = table.dataset.portalTableKey as PortalTableKey | undefined;
  if (explicit && PORTAL_TABLE_KEYS.includes(explicit)) return explicit;

  for (const key of PORTAL_TABLE_KEYS) {
    if (PORTAL_TABLE_CONTAINER_SELECTORS[key].some((selector) => table.closest(selector))) return key;
  }
  return null;
}

export function stableTableIdentity(table: HTMLTableElement): string {
  const managed = inferManagedTableKey(table);
  if (managed) return managed;

  const explicit = table.dataset.portalTableKey || table.dataset.portalCoreTableKey;
  if (explicit) return explicit;

  const sheet = table.closest<HTMLElement>('[data-portal-sheet]')?.dataset.portalSheet;
  if (sheet) return `sheet-${slug(sheet)}`;

  const owner = table.closest<HTMLElement>('[id]');
  if (owner?.id) return `owner-${slug(owner.id)}`;

  const headers = Array.from(table.tHead?.rows[0]?.cells || [])
    .map((cell) => slug(cell.textContent || ''))
    .filter(Boolean)
    .join('-');

  return `table-${headers || 'generic'}`;
}
