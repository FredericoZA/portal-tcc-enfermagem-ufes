import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { ipAddress } from '@vercel/functions';
import type { Request, Response, RequestHandler } from 'express';

type Family = 'api' | 'sync' | 'callback' | 'asset' | 'download' | 'indicators';
const LIMITS: Record<Family, number> = { api: 1000, sync: 300, callback: 240, asset: 600, download: 60, indicators: 120 };
const WINDOW_MS = 60_000;
const admissionMark = Symbol.for('portal.request.admission');

/** Per-instance admission, before parsing or provider access; not a distributed WAF. */
export function createRequestAdmission(options: { now?: () => number; maxBuckets?: number; limits?: Partial<Record<Family, number>> } = {}) {
  const buckets = new Map<string, { expiresAt: number; count: number }>();
  const now = options.now || Date.now;
  const maxBuckets = options.maxBuckets || 10_000;
  const limits = { ...LIMITS, ...options.limits };
  return (client: string, family: Family) => {
    const instant = now();
    const key = createHash('sha256').update(family + ':' + client).digest('hex');
    let bucket = buckets.get(key);
    if (bucket && bucket.expiresAt <= instant) { buckets.delete(key); bucket = undefined; }
    if (!bucket) {
      if (buckets.size >= maxBuckets) {
        for (const [id, entry] of buckets) if (entry.expiresAt <= instant) buckets.delete(id);
        if (buckets.size >= maxBuckets) return { allowed: false, retryAfter: 60 };
      }
      bucket = { expiresAt: instant + WINDOW_MS, count: 0 };
      buckets.set(key, bucket);
    }
    if (bucket.count >= limits[family]) return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.expiresAt - instant) / 1000)) };
    bucket.count++;
    return { allowed: true, retryAfter: 0 };
  };
}

function clientAddress(req: Request): string {
  // Only Vercel's trusted edge may supply the SDK's x-real-ip header.
  // Local/direct HTTP never trusts arbitrary forwarding headers.
  const edgeIp = typeof req.headers?.['x-real-ip'] === 'string' ? req.headers['x-real-ip'] : '';
  const raw = process.env.VERCEL ? ipAddress(new Headers({ 'x-real-ip': edgeIp })) : req.socket?.remoteAddress;
  const value = String(raw || '').trim().replace(/^::ffff:/, '');
  return isIP(value) ? value : 'unknown';
}

function requestFamily(req: Request): Family | null {
  const route = String(req.originalUrl || req.url || '').split('?')[0];
  if (['GET', 'HEAD'].includes(req.method) && ['/api/health', '/health'].includes(route)) return null;
  if (route === '/api/integrations/asten/webhook') return 'callback';
  if (route === '/api/public/sync/version' || route === '/api/sync/version') return 'sync';
  return 'api';
}

const admit = createRequestAdmission();
export function admitPortalRequest(req: Request, res: Response, family: Family | null = requestFamily(req)): boolean {
  if (!family) return true;
  const marked = req as Request & { [admissionMark]?: Set<Family> };
  if (marked[admissionMark]?.has(family)) return true;
  const result = admit(clientAddress(req), family);
  if (!result.allowed) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Retry-After', String(result.retryAfter));
    res.status(429).json({ error: 'Muitas solicitações. Aguarde alguns segundos e tente novamente.', code: 'REQUEST_RATE_LIMITED' });
    return false;
  }
  (marked[admissionMark] ||= new Set()).add(family);
  return true;
}

export const portalRequestAdmission: RequestHandler = (req, res, next) => { if (admitPortalRequest(req, res)) next(); };
