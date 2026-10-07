import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path:string) => readFile(path,'utf8');

test('sessão usa janela móvel de três horas com teto absoluto de doze horas', async () => {
  const auth = await source('server/security/firebaseAuth.ts');
  assert.ok(auth.includes('SESSION_IDLE_TTL_SECONDS = 3 * 60 * 60'));
  assert.ok(auth.includes('SESSION_ABSOLUTE_TTL_SECONDS = 12 * 60 * 60'));
  assert.ok(auth.includes('expiresAt: now + SESSION_IDLE_TTL_SECONDS'));
  assert.ok(auth.includes('identity.issuedAt + SESSION_ABSOLUTE_TTL_SECONDS'));
  assert.ok(auth.includes('Math.min(now + SESSION_IDLE_TTL_SECONDS, absoluteExpiry)'));
  assert.ok(auth.includes('Math.min(SESSION_IDLE_TTL_SECONDS, identity.expiresAt - now)'));
  assert.ok(auth.includes("requestPath === '/api/me' || req.path === '/me'"));
});

test('sessão assinada valida integridade temporal, identidade e bloqueia demo em runtime seguro', async () => {
  const auth = await source('server/security/firebaseAuth.ts');
  assert.ok(auth.includes('identity.authTime > now + 60'));
  assert.ok(auth.includes('identity.authTime < identity.issuedAt - 60'));
  assert.ok(auth.includes('identity.expiresAt > absoluteExpiry'));
  assert.ok(auth.includes('const expectedUid = isDemoIdentity ? `demo:${normalizedEmail}` : `email:${normalizedEmail}`'));
  assert.ok(auth.includes('identity.uid !== expectedUid'));
  assert.ok(auth.includes('secureRuntime() && isDemoIdentity'));
});

test('atividade real renova a sessão sem timer agressivo e F5 reconfirma identidade', async () => {
  const context = await source('src/context/AuthContext.tsx');
  assert.ok(context.includes('AUTH_CACHE_MAX_AGE_MS = 3 * 60 * 60 * 1000'));
  assert.ok(context.includes('SESSION_ACTIVITY_TOUCH_INTERVAL_MS = 60 * 1000'));
  assert.ok(context.includes("fetch('/api/me', { method: 'GET', credentials: 'include'"));
  assert.ok(context.includes("['pointerdown', 'keydown', 'touchstart', 'wheel', 'focus']"));
  assert.ok(context.includes('getIdentityWithRetry().then(applyIdentity)'));
});