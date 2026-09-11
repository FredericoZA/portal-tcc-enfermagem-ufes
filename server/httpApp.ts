import express, { type RequestHandler, type ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

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
