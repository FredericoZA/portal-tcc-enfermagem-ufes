import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAstenEnvelopeParams,
  getAstenIntegrationStatus,
  getAstenSecurityPreflight,
  safeCompareWebhookSecret
} from '../integrations/asten';
import {
  buildGoogleAuthorizationUrl,
  getGoogleOAuthSecurityPreflight,
  getGoogleWorkspaceConfigStatus
} from '../integrations/googleWorkspace';
import { getOtpRuntimeStatus } from './portalOtp';
import { getPortalSessionRuntimeStatus } from './firebaseAuth';

const MANAGED_ENV = [
  'NODE_ENV',
  'VERCEL',
  'ASTEN_INTEGRATION_ENABLED',
  'ASTEN_ALLOW_STORED_TOKEN',
  'ASTEN_API_KEY',
  'ASTEN_SESSION_ENCRYPTION_KEY',
  'ASTEN_CALLBACK_URL',
  'ASTEN_WEBHOOK_SECRET',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_STATE_SECRET',
  'PORTAL_SECRET_ENCRYPTION_KEY',
  'PORTAL_SESSION_SECRET',
  'PORTAL_OTP_PEPPER',
  'PORTAL_ALLOW_LOCAL_OTP_STORE'
] as const;

function withCleanEnvironment(run: () => void): void {
  const previous = Object.fromEntries(MANAGED_ENV.map((key) => [key, process.env[key]]));
  for (const key of MANAGED_ENV) delete process.env[key];
  try { run(); } finally {
    for (const key of MANAGED_ENV) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('Asten bloqueia despacho e criação de envelope sem callback HTTPS autenticado', () => {
  withCleanEnvironment(() => {
    process.env.ASTEN_INTEGRATION_ENABLED = 'true';
    process.env.ASTEN_ALLOW_STORED_TOKEN = 'true';
    process.env.ASTEN_API_KEY = 'token-de-integracao-valido';
    process.env.ASTEN_CALLBACK_URL = 'http://portal.example/api/integrations/asten/callback';
    process.env.ASTEN_WEBHOOK_SECRET = 'curto';

    const preflight = getAstenSecurityPreflight();
    assert.equal(preflight.callbackConfigured, false);
    assert.equal(getAstenIntegrationStatus().dispatchEnabled, false);
    assert.throws(() => buildAstenEnvelopeParams({
      description: 'Ata', fileName: 'ata.pdf', mimeType: 'application/pdf',
      contentBase64: 'JVBERi0=', repositoryId: 1,
      signers: [{ name: 'Orientador', email: 'orientador@example.edu', order: 1 }]
    }), /envio Asten está bloqueado/i);
  });
});

test('Asten aceita somente callback HTTPS e segredo de webhook forte', () => {
  withCleanEnvironment(() => {
    const secret = 'w'.repeat(48);
    process.env.PORTAL_PUBLIC_URL = 'https://portal.example';
    process.env.ASTEN_CALLBACK_URL = 'https://portal.example/api/integrations/asten/callback';
    process.env.ASTEN_WEBHOOK_SECRET = secret;
    assert.equal(getAstenSecurityPreflight().callbackConfigured, true);
    assert.equal(safeCompareWebhookSecret(secret), true);
    assert.equal(safeCompareWebhookSecret('fraco'), false);

    process.env.ASTEN_WEBHOOK_SECRET = 'w'.repeat(31);
    assert.equal(safeCompareWebhookSecret(process.env.ASTEN_WEBHOOK_SECRET), false);
  });
});

test('OTP não reutiliza PORTAL_SESSION_SECRET como pepper', () => {
  withCleanEnvironment(() => {
    process.env.NODE_ENV = 'development';
    process.env.PORTAL_SESSION_SECRET = 's'.repeat(48);
    process.env.PORTAL_ALLOW_LOCAL_OTP_STORE = 'true';
    assert.equal(getOtpRuntimeStatus().pepperConfigured, false);
    assert.equal(getOtpRuntimeStatus().configured, false);

    process.env.PORTAL_OTP_PEPPER = 'o'.repeat(48);
    assert.equal(getOtpRuntimeStatus().configured, true);
  });
});

test('produção exige segredos distintos para sessão, OTP e estado OAuth', () => {
  withCleanEnvironment(() => {
    process.env.NODE_ENV = 'production';
    process.env.PORTAL_SESSION_SECRET = 's'.repeat(48);
    process.env.PORTAL_OTP_PEPPER = process.env.PORTAL_SESSION_SECRET;
    process.env.GOOGLE_OAUTH_STATE_SECRET = process.env.PORTAL_SESSION_SECRET;
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'client.apps.googleusercontent.com';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'client-secret';
    process.env.PORTAL_SECRET_ENCRYPTION_KEY = 'e'.repeat(48);

    assert.equal(getPortalSessionRuntimeStatus().configured, false);
    assert.equal(getOtpRuntimeStatus().pepperSeparated, false);
    assert.equal(getGoogleOAuthSecurityPreflight().stateSecretSeparated, false);
    assert.equal(getGoogleWorkspaceConfigStatus().oauthConfigured, false);
    assert.throws(() => buildGoogleAuthorizationUrl({}), /diferente de PORTAL_SESSION_SECRET/i);

    process.env.PORTAL_OTP_PEPPER = 'o'.repeat(48);
    process.env.GOOGLE_OAUTH_STATE_SECRET = 'g'.repeat(48);
    assert.equal(getPortalSessionRuntimeStatus().configured, true);
    assert.equal(getGoogleOAuthSecurityPreflight().ready, true);
    assert.equal(getGoogleWorkspaceConfigStatus().oauthConfigured, true);
  });
});
