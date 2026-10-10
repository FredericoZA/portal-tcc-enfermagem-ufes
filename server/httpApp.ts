import express, { type RequestHandler, type ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

function normalizedOrigin(value: string): string | null {
  try { return new URL(value).origin; }
  catch { return null; }
}

function secureRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

function configuredPortalOrigin(): string | null {
  const preferred = normalizedOrigin(String(process.env.PORTAL_PUBLIC_URL || '').trim());
  if (preferred) return preferred;
  return normalizedOrigin(String(process.env.APP_URL || '').trim());
}

function expectedRequestOrigins(req: express.Request): Set<string> {
  const configuredOrigin = configuredPortalOrigin();
  if (configuredOrigin) return new Set([configuredOrigin]);

  // Em runtime seguro, ausência de URL pública canônica deve falhar fechada.
  // Host/X-Forwarded-Host são controlados pela requisição e não podem ampliar
  // a fronteira de confiança de mutações de navegador em produção.
  if (secureRuntime()) return new Set();

  // Fallback apenas para desenvolvimento/testes locais sem URL canônica.
  const values = new Set<string>();
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwardedProto || req.protocol || 'https';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (host) {
    const origin = normalizedOrigin(`${proto}://${host}`);
    if (origin) values.add(origin);
  }
  return values;
}

/**
 * SameSite is useful, but not sufficient as the only CSRF boundary. Browser mutations
 * must be same-origin (or explicitly match the configured public origin). Server-to-server
 * callbacks normally do not send Origin/Sec-Fetch-Site and remain compatible.
 */
export const portalSecurityHeaders: RequestHandler = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (req.method === 'TRACE' || req.method === 'CONNECT') {
    res.setHeader('Allow', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Método HTTP não permitido.', code: 'METHOD_NOT_ALLOWED' });
  }
  next();
};

export const requireMutationOrigin: RequestHandler = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) return next();

  const fetchSite = String(req.headers['sec-fetch-site'] || '').trim().toLowerCase();
  if (fetchSite === 'cross-site') {
    return res.status(403).json({ error: 'A origem desta operação não é autorizada.', code: 'ORIGIN_VALIDATION_FAILED' });
  }

  const rawOrigin = String(req.headers.origin || '').trim();
  if (!rawOrigin) return next();
  const received = normalizedOrigin(rawOrigin);
  const expected = expectedRequestOrigins(req);
  if (!received || expected.size === 0 || !expected.has(received)) {
    return res.status(403).json({ error: 'A origem desta operação não é autorizada.', code: 'ORIGIN_VALIDATION_FAILED' });
  }
  next();
};

/** Express 4 needs rejected handler promises forwarded to its error middleware. */
export function createPortalHttpApp() {
  const app = express();
  const wrap = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(wrap);
    if (typeof value !== 'function' || value.length === 4) return value;
    return ((req, res, next) => {
      try { Promise.resolve(value(req, res, next)).catch(error => next(error || new Error('Handler rejected'))); }
      catch (error) { next(error); }
    }) as RequestHandler;
  };
  for (const method of ['use', 'get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all'] as const) {
    const register = app[method].bind(app) as (...args: unknown[]) => unknown;
    (app as any)[method] = (...args: unknown[]) => register(...args.map(wrap));
  }
  app.disable('x-powered-by');
  app.use(portalSecurityHeaders);
  app.use(requireMutationOrigin);
  return app;
}

export const portalHttpError: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  const requestId = randomUUID();
  const status = error?.type === 'entity.too.large' ? 413 : error?.type === 'entity.parse.failed' ? 400 : 500;
  // Do not log provider tokens, request bodies or raw exception messages.
  console.error('[Portal HTTP]', JSON.stringify({ requestId, method: req.method, status, kind: error?.name || 'Error' }));
  res.status(status).json({
    error: status === 413 ? 'O envio excede o limite permitido.' : status === 400 ? 'O conteúdo enviado é inválido.' : 'Não foi possível concluir a operação. Atualize o processo para conferir o que foi salvo e tente novamente.',
    code: 'REQUEST_FAILED', requestId,
  });
};
