import {createHash} from 'node:crypto';
import type {Request, Response} from 'express';
import {admitPortalRequest} from '../security/requestAdmission';
import {buildPublicIndicatorsFromState} from '../publicIndicators';
import type {ProcessData} from '../../src/types';
import type {LegacyAcademicRecord} from '../../src/types/legacyArchive';

const indicatorCacheMs = 30_000;
let cached: {body: string; etag: string; expiresAt: number} | undefined;
let pending: Promise<NonNullable<typeof cached>> | undefined;

async function readIndicators() {
  const secret = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const origin = new URL(String(process.env.SUPABASE_URL || '').trim());
  if (origin.username || origin.password || origin.search || origin.hash || origin.protocol !== 'https:'
      || process.env.PORTAL_PERSISTENCE_PROVIDER !== 'supabase' || !secret) throw new Error('Unavailable');

  const query = new URLSearchParams({
    id: 'eq.global',
    select: 'processes:payload->processes,legacyAcademicRecords:payload->legacyAcademicRecords',
    limit: '1',
  });
  const headers: Record<string, string> = {apikey:secret, Accept:'application/json'};
  if (!secret.startsWith('sb_secret_')) headers.Authorization = `Bearer ${secret}`;
  const response = await fetch(`${origin.href.replace(/\/$/, '')}/rest/v1/portal_runtime_state?${query}`, {
    headers, signal:AbortSignal.timeout(12_000), redirect:'error', cache:'no-store',
  });
  if (!response.ok) throw new Error('Unavailable');
  const rows = await response.json() as Array<{processes?:ProcessData[];legacyAcademicRecords?:LegacyAcademicRecord[]}>;
  if (!Array.isArray(rows) || !Array.isArray(rows[0]?.processes)
      || (rows[0].legacyAcademicRecords != null && !Array.isArray(rows[0].legacyAcademicRecords))) {
    throw new Error('Unavailable');
  }
  // Cache only the suppressed aggregate. The source rows never enter the cache.
  const body = JSON.stringify(buildPublicIndicatorsFromState(rows[0]));
  return {body, etag:`W/"${createHash('sha256').update(body).digest('hex')}"`, expiresAt:Date.now() + indicatorCacheMs};
}

async function indicators() {
  if (cached && cached.expiresAt > Date.now()) return cached;
  pending ??= readIndicators().then(value => cached = value).finally(() => { pending = undefined; });
  return pending;
}

export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!admitPortalRequest(req, res, 'indicators')) return;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({error:'Método não permitido.'});
  }
  if (String(req.originalUrl || req.url || '').includes('?')) {
    res.setHeader('Location', '/api/public/indicators');
    return res.status(308).end();
  }
  try {
    const {body, etag} = await indicators();
    res.setHeader('Cache-Control', 'public, max-age=30, must-revalidate');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=120, must-revalidate');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('ETag', etag);
    const validator = String(req.headers['if-none-match'] || '').split(',');
    if (validator.some(value => value.trim().replace(/^W\//, '') === etag.slice(2) || value.trim() === '*')) {
      return res.status(304).end();
    }
    return req.method === 'HEAD' ? res.end() : res.end(body);
  } catch {
    return res.status(503).json({error:'Os indicadores estão temporariamente indisponíveis.'});
  }
}
