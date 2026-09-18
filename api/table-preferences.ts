import type { Request, Response } from 'express';

const DEFAULT_OWNER = '__MASTER_DEFAULT__';
const TABLE_KEY_RE = /^[a-z0-9_-]{1,80}$/;
const supabaseUrl = () => String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const supabaseSecret = () => String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function adminHeaders(): Record<string, string> {
  const secret = supabaseSecret();
  const headers: Record<string, string> = { apikey: secret, 'Content-Type': 'application/json', Accept: 'application/json' };
  if (!secret.startsWith('sb_secret_')) headers.Authorization = `Bearer ${secret}`;
  return headers;
}

function requestOrigin(req: Request): string {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return host ? `${proto}://${host}` : String(process.env.APP_URL || process.env.PORTAL_PUBLIC_URL || '').replace(/\/$/, '');
}

function sameOriginWrite(req: Request): boolean {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return true;
  try { return new URL(origin).host === new URL(requestOrigin(req)).host; } catch { return false; }
}

async function identity(req: Request): Promise<{ userEmail: string; globalRoles: string[] } | null> {
  const origin = requestOrigin(req);
  if (!origin) return null;
  const cookie = String(req.headers.cookie || '');
  try {
    const response = await fetch(`${origin}/api/me`, {
      headers: { ...(cookie ? { cookie } : {}), Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const value = await response.json() as any;
    if (!value?.isAuthenticated || !value?.userEmail) return null;
    return { userEmail: String(value.userEmail).trim().toLowerCase(), globalRoles: Array.isArray(value.globalRoles) ? value.globalRoles.map(String) : [] };
  } catch {
    return null;
  }
}

function normalizePatch(raw: unknown): Record<string, unknown> {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const result: Record<string, unknown> = {};
  if (Array.isArray(source.columnOrder)) result.columnOrder = source.columnOrder.map(String).filter(Boolean).slice(0, 120);
  if (source.visibleColumns && typeof source.visibleColumns === 'object' && !Array.isArray(source.visibleColumns)) {
    result.visibleColumns = Object.fromEntries(Object.entries(source.visibleColumns as Record<string, unknown>).slice(0, 120).map(([key, value]) => [key, Boolean(value)]));
  }
  if (source.recordsLimit === 'all' || (typeof source.recordsLimit === 'number' && Number.isFinite(source.recordsLimit) && source.recordsLimit > 0 && source.recordsLimit <= 1000)) result.recordsLimit = source.recordsLimit;
  if (typeof source.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$|^$/.test(source.startDate)) result.startDate = source.startDate;
  if (typeof source.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$|^$/.test(source.endDate)) result.endDate = source.endDate;
  return result;
}

async function readPreference(tableKey: string, scope: 'USER' | 'DEFAULT', owner: string): Promise<Record<string, unknown> | null> {
  const url = `${supabaseUrl()}/rest/v1/portal_table_preferences?table_key=eq.${encodeURIComponent(tableKey)}&preference_scope=eq.${scope}&owner_email=eq.${encodeURIComponent(owner)}&select=config&limit=1`;
  const response = await fetch(url, { headers: adminHeaders(), signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Supabase recusou leitura das preferências (${response.status}).`);
  const rows = await response.json() as Array<{ config?: Record<string, unknown> }>;
  return rows?.[0]?.config && typeof rows[0].config === 'object' ? rows[0].config : null;
}

async function writePreference(tableKey: string, scope: 'USER' | 'DEFAULT', owner: string, updatedBy: string, patch: Record<string, unknown>) {
  const current = await readPreference(tableKey, scope, owner);
  const config = { ...(current || {}), ...patch };
  const response = await fetch(`${supabaseUrl()}/rest/v1/portal_table_preferences?on_conflict=table_key,preference_scope,owner_email`, {
    method: 'POST',
    headers: { ...adminHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ table_key: tableKey, preference_scope: scope, owner_email: owner, config, updated_by: updatedBy, updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Supabase recusou gravação das preferências (${response.status}).`);
  return config;
}

async function deletePreference(tableKey: string, scope: 'USER' | 'DEFAULT', owner: string) {
  const response = await fetch(`${supabaseUrl()}/rest/v1/portal_table_preferences?table_key=eq.${encodeURIComponent(tableKey)}&preference_scope=eq.${scope}&owner_email=eq.${encodeURIComponent(owner)}`, {
    method: 'DELETE', headers: { ...adminHeaders(), Prefer: 'return=minimal' }, signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Supabase recusou remoção das preferências (${response.status}).`);
}

export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!supabaseUrl() || !supabaseSecret()) return res.status(503).json({ error: 'Persistência de preferências indisponível.' });
  const user = await identity(req);
  if (!user) return res.status(401).json({ error: 'Autenticação necessária.', code: 'AUTHENTICATION_REQUIRED' });

  const tableKey = String(req.query?.table || (req.body as any)?.tableKey || '').trim().toLowerCase();
  if (!TABLE_KEY_RE.test(tableKey)) return res.status(400).json({ error: 'Identificador de planilha inválido.' });

  try {
    if (req.method === 'GET') {
      const [defaultConfig, userConfig] = await Promise.all([
        readPreference(tableKey, 'DEFAULT', DEFAULT_OWNER),
        readPreference(tableKey, 'USER', user.userEmail),
      ]);
      return res.status(200).json({ tableKey, defaultConfig, userConfig, effectiveConfig: { ...(defaultConfig || {}), ...(userConfig || {}) } });
    }

    if (!sameOriginWrite(req)) return res.status(403).json({ error: 'Origem da solicitação inválida.' });

    if (req.method === 'PATCH') {
      const scope = String((req.body as any)?.scope || 'USER').toUpperCase() as 'USER' | 'DEFAULT';
      if (!['USER', 'DEFAULT'].includes(scope)) return res.status(400).json({ error: 'Escopo inválido.' });
      if (scope === 'DEFAULT' && !user.globalRoles.includes('MASTER_ADMIN')) return res.status(403).json({ error: 'Somente o usuário Master pode definir o padrão global.' });
      const patch = normalizePatch((req.body as any)?.config);
      if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nenhuma preferência válida foi enviada.' });
      const owner = scope === 'DEFAULT' ? DEFAULT_OWNER : user.userEmail;
      const config = await writePreference(tableKey, scope, owner, user.userEmail, patch);
      return res.status(200).json({ saved: true, scope, config });
    }

    if (req.method === 'DELETE') {
      const scope = String(req.query?.scope || 'USER').toUpperCase() as 'USER' | 'DEFAULT';
      if (scope === 'DEFAULT' && !user.globalRoles.includes('MASTER_ADMIN')) return res.status(403).json({ error: 'Somente o usuário Master pode remover o padrão global.' });
      const owner = scope === 'DEFAULT' ? DEFAULT_OWNER : user.userEmail;
      await deletePreference(tableKey, scope, owner);
      const defaultConfig = await readPreference(tableKey, 'DEFAULT', DEFAULT_OWNER);
      return res.status(200).json({ deleted: true, effectiveConfig: defaultConfig || {} });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error) {
    console.error('[TablePreferences]', error);
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Falha ao persistir preferências.' });
  }
}
