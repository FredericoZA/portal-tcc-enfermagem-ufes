import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { attachPortalIdentity, getPortalIdentity, SESSION_ABSOLUTE_TTL_SECONDS } from './security/firebaseAuth';

const SECRET = 'session-test-secret-with-more-than-thirty-two-characters';

function signedCookie(overrides: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const identity = {
    sessionId: 'session_identifier_1234567890',
    uid: 'email:admin@example.edu',
    email: 'admin@example.edu',
    emailVerified: true,
    authTime: now,
    issuedAt: now,
    expiresAt: now + 3600,
    isDemo: false,
    method: 'EMAIL_OTP',
    ...overrides
  };
  const payload = Buffer.from(JSON.stringify(identity), 'utf8').toString('base64url');
  const signature = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

async function attach(cookie: string) {
  const req: any = { headers: { cookie: `portal_tcc_session=${encodeURIComponent(cookie)}` }, method: 'POST', originalUrl: '/api/test', path: '/api/test' };
  const res: any = { setHeader() {} };
  await new Promise<void>((resolve) => attachPortalIdentity(req, res, () => resolve()));
  return req;
}

test('sessão além do teto absoluto é rejeitada mesmo com HMAC válido', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousVercel = process.env.VERCEL;
  const previousSecret = process.env.PORTAL_SESSION_SECRET;
  process.env.NODE_ENV = 'test';
  delete process.env.VERCEL;
  process.env.PORTAL_SESSION_SECRET = SECRET;
  try {
    const now = Math.floor(Date.now() / 1000);
    const issuedAt = now - SESSION_ABSOLUTE_TTL_SECONDS - 5;
    const req = await attach(signedCookie({ issuedAt, authTime: issuedAt, expiresAt: now + 3600 }));
    assert.equal(getPortalIdentity(req), null);
    assert.match(String(req.portalAuthError), /Sessão expirada/i);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previousVercel;
    if (previousSecret === undefined) delete process.env.PORTAL_SESSION_SECRET; else process.env.PORTAL_SESSION_SECRET = previousSecret;
  }
});

test('sessão assinada com uid incoerente é rejeitada', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousVercel = process.env.VERCEL;
  const previousSecret = process.env.PORTAL_SESSION_SECRET;
  process.env.NODE_ENV = 'test';
  delete process.env.VERCEL;
  process.env.PORTAL_SESSION_SECRET = SECRET;
  try {
    const req = await attach(signedCookie({ uid: 'email:outro@example.edu' }));
    assert.equal(getPortalIdentity(req), null);
    assert.match(String(req.portalAuthError), /Sessão inválida/i);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previousVercel;
    if (previousSecret === undefined) delete process.env.PORTAL_SESSION_SECRET; else process.env.PORTAL_SESSION_SECRET = previousSecret;
  }
});
