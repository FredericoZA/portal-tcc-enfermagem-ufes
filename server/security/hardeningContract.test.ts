import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

interface VercelHeader { key: string; value: string }
interface VercelHeaderRule { source: string; headers: VercelHeader[] }
interface VercelConfig {
  env?: Record<string, string>;
  headers?: VercelHeaderRule[];
}

const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as VercelConfig;
const rules = config.headers || [];
const globalHeaders = Object.fromEntries((rules.find((rule) => rule.source === '/(.*)')?.headers || []).map(({ key, value }) => [key.toLowerCase(), value]));
const apiHeaders = Object.fromEntries((rules.find((rule) => rule.source === '/api/(.*)')?.headers || []).map(({ key, value }) => [key.toLowerCase(), value]));

test('CSP usa origem exata do Supabase e bloqueia vetores estruturais', () => {
  const csp = globalHeaders['content-security-policy'] || '';
  assert.match(csp, /connect-src[^;]*https:\/\/vvgdmycmotazqjvpywmk\.supabase\.co/);
  assert.doesNotMatch(csp, /\*\.supabase\.co/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
});

test('headers de isolamento e política de cache permanecem ativos', () => {
  assert.equal(globalHeaders['x-content-type-options'], 'nosniff');
  assert.equal(globalHeaders['x-frame-options'], 'DENY');
  assert.equal(globalHeaders['cross-origin-opener-policy'], 'same-origin-allow-popups');
  assert.equal(globalHeaders['cross-origin-resource-policy'], 'same-origin');
  assert.equal(globalHeaders['x-permitted-cross-domain-policies'], 'none');
  assert.equal(globalHeaders['origin-agent-cluster'], '?1');
  assert.match(globalHeaders['strict-transport-security'] || '', /max-age=31536000/);
  assert.match(apiHeaders['cache-control'] || '', /no-store/);
});

test('produção mantém fallbacks inseguros desligados e Asten fail-closed', () => {
  assert.equal(config.env?.PORTAL_ALLOW_INSECURE_DEMO_AUTH, 'false');
  assert.equal(config.env?.PORTAL_ALLOW_LOCAL_OTP_STORE, 'false');
  assert.equal(config.env?.PORTAL_ALLOW_LOCAL_SECRET_STORE, 'false');
  assert.equal(config.env?.PORTAL_PERSISTENCE_PROVIDER, 'supabase');
  assert.equal(config.env?.ASTEN_INTEGRATION_ENABLED, 'false');
});
