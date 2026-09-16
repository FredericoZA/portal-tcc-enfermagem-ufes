import type { NextFunction, Request, Response } from 'express';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { normalizeEmail } from '../../src/utils/formatters';

export interface PortalIdentity {
  sessionId: string;
  uid: string;
  email: string;
  emailVerified: boolean;
  authTime: number;
  issuedAt: number;
  expiresAt: number;
  isDemo: boolean;
  method: 'EMAIL_OTP' | 'GOOGLE_BOOTSTRAP' | 'DEVELOPMENT_DEMO';
}

const LEGACY_COOKIE_NAME = 'portal_tcc_session';
// A sessão precisa sobreviver a F5 e a períodos longos de leitura/preenchimento.
// O bloqueio administrativo sensível continua protegido por hasRecentAuthentication.
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const secureRuntime = () => process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
const cookieName = () => secureRuntime() ? '__Host-portal_tcc_session' : LEGACY_COOKIE_NAME;

function sessionSecret(): string {
  return String(process.env.PORTAL_SESSION_SECRET || '').trim();
}

export function getPortalSessionRuntimeStatus() {
  const secretConfigured = sessionSecret().length >= 32;
  const distinctFromOtp = process.env.NODE_ENV !== 'production'
    || !process.env.PORTAL_OTP_PEPPER
    || sessionSecret() !== String(process.env.PORTAL_OTP_PEPPER).trim();
  const distinctFromGoogleOAuth = process.env.NODE_ENV !== 'production'
    || !process.env.GOOGLE_OAUTH_STATE_SECRET
    || sessionSecret() !== String(process.env.GOOGLE_OAUTH_STATE_SECRET).trim();
  const distinctFromSensitiveSecrets = process.env.NODE_ENV !== 'production' || ![
    process.env.PORTAL_SECRET_ENCRYPTION_KEY,
    process.env.PORTAL_VERIFICATION_SECRET,
    process.env.PORTAL_UPLOAD_BINDING_SECRET,
    process.env.ASTEN_SESSION_ENCRYPTION_KEY,
    process.env.ASTEN_WEBHOOK_SECRET
  ].map((value) => String(value || '').trim()).filter(Boolean).includes(sessionSecret());
  return {
    configured: secretConfigured && distinctFromOtp && distinctFromGoogleOAuth && distinctFromSensitiveSecrets,
    secretConfigured,
    distinctFromOtp,
    distinctFromGoogleOAuth,
    distinctFromSensitiveSecrets
  } as const;
}

export function assertPortalSessionConfigured(): void {
  const status = getPortalSessionRuntimeStatus();
  if (!status.secretConfigured) throw new Error('PORTAL_SESSION_SECRET precisa ter pelo menos 32 caracteres.');
  if (!status.distinctFromOtp || !status.distinctFromGoogleOAuth || !status.distinctFromSensitiveSecrets) {
    throw new Error('PORTAL_SESSION_SECRET deve ser exclusivo e diferente dos demais segredos em produção.');
  }
}

function encodeSession(identity: PortalIdentity): string {
  assertPortalSessionConfigured();
  const payload = Buffer.from(JSON.stringify(identity), 'utf8').toString('base64url');
  const signature = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function decodeSession(value: string): PortalIdentity {
  assertPortalSessionConfigured();
  const [payload, suppliedSignature] = String(value || '').split('.');
  if (!payload || !suppliedSignature) throw new Error('Sessão inválida.');
  const expected = createHmac('sha256', sessionSecret()).update(payload).digest();
  const received = Buffer.from(suppliedSignature, 'base64url');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error('Sessão adulterada.');
  const identity = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as PortalIdentity;
  const now = Math.floor(Date.now() / 1000);
  if (!identity?.email || !identity.expiresAt || identity.expiresAt <= now || identity.issuedAt > now + 60) {
    throw new Error('Sessão expirada.');
  }
  if (!identity.sessionId || !/^[A-Za-z0-9_-]{20,100}$/.test(identity.sessionId)) throw new Error('Sessão sem identificador seguro.');
  return { ...identity, email: normalizeEmail(identity.email) };
}

function parseCookies(req: Request): Record<string, string> {
  const header = String(req.headers.cookie || '');
  return Object.fromEntries(header.split(';').flatMap((part) => {
    const index = part.indexOf('=');
    if (index < 1) return [];
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try { return [[key, decodeURIComponent(value)]]; } catch { return [[key, value]]; }
  }));
}

function demoIdentity(req: Request): PortalIdentity | null {
  if (process.env.NODE_ENV === 'production' || process.env.PORTAL_ALLOW_INSECURE_DEMO_AUTH !== 'true') return null;
  const email = normalizeEmail(String(req.headers['x-demo-user-email'] || ''));
  if (!email) return null;
  const now = Math.floor(Date.now() / 1000);
  return {
    sessionId: `demo_${randomBytes(18).toString('base64url')}`, uid: `demo:${email}`, email, emailVerified: true, authTime: now, issuedAt: now,
    expiresAt: now + SESSION_TTL_SECONDS, isDemo: true, method: 'DEVELOPMENT_DEMO'
  };
}

export function createPortalIdentity(email: string, method: PortalIdentity['method'] = 'EMAIL_OTP'): PortalIdentity {
  const normalized = normalizeEmail(email);
  const now = Math.floor(Date.now() / 1000);
  return {
    sessionId: randomBytes(24).toString('base64url'), uid: `email:${normalized}`, email: normalized, emailVerified: true, authTime: now, issuedAt: now,
    issuedAt: now, expiresAt: now + SESSION_TTL_SECONDS, isDemo: false, method
  };
}

export function setPortalSessionCookie(res: Response, email: string, method: PortalIdentity['method'] = 'EMAIL_OTP'): PortalIdentity {
  const identity = createPortalIdentity(email, method);
  const token = encodeSession(identity);
  const secure = secureRuntime();
  res.setHeader('Set-Cookie', [
    `${cookieName()}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax',
    secure ? 'Secure' : '', 'Priority=High', `Max-Age=${SESSION_TTL_SECONDS}`
  ].filter(Boolean).join('; '));
  return identity;
}

export function clearPortalSessionCookie(res: Response): void {
  const secure = secureRuntime();
  const expired = (name: string) => [
    `${name}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', secure ? 'Secure' : '', 'Max-Age=0'
  ].filter(Boolean).join('; ');
  res.setHeader('Set-Cookie', Array.from(new Set([cookieName(), LEGACY_COOKIE_NAME])).map(expired));
}

export async function attachPortalIdentity(req: Request, _res: Response, next: NextFunction) {
  try {
    const cookies = parseCookies(req);
    const token = cookies[cookieName()];
    (req as any).portalIdentity = token ? decodeSession(token) : demoIdentity(req);
  } catch (error) {
    (req as any).portalIdentity = null;
    (req as any).portalAuthError = error instanceof Error ? error.message : 'Sessão inválida.';
  }
  next();
}

export function getPortalIdentity(req: Request): PortalIdentity | null { return (req as any).portalIdentity || null; }

export function requireAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!getPortalIdentity(req)) {
    return res.status(401).json({
      error: (req as any).portalAuthError || 'Informe seu e-mail e o código de acesso.',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }
  next();
}

export function hasRecentAuthentication(identity: PortalIdentity, maxAgeSeconds = 600): boolean {
  return identity.isDemo || Math.floor(Date.now() / 1000) - identity.authTime <= maxAgeSeconds;
}
