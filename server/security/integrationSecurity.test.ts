import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAstenEnvelopeParams,
  callAsten,
  getAstenIntegrationStatus,
  getAstenSecurityPreflight,
  safeCompareWebhookSecret
} from '../integrations/asten';
import { saveIntegrationSecret } from '../integrations/integrationSecrets';
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
  'APP_URL',
  'PORTAL_PUBLIC_URL',
  'ASTEN_INTEGRATION_ENABLED',
  'ASTEN_ALLOW_STORED_TOKEN',
  'ASTEN_API_KEY',
  'ASTEN_SESSION_ENCRYPTION_KEY',
  'ASTEN_CALLBACK_URL',
  'ASTEN_WEBHOOK_SECRET',
  'ASTEN_REQUIRE_CODE',
  'ASTEN_REQUIRE_LOGIN',
  'ASTEN_AUTHENTICATION_OPTION',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_STATE_SECRET',
  'PORTAL_SECRET_ENCRYPTION_KEY',
  'PORTAL_SECRET_ENCRYPTION_KEY_V2',
  'PORTAL_VERIFICATION_SECRET',
  'PORTAL_UPLOAD_BINDING_SECRET',
  'PORTAL_SECURITY_WEBHOOK_SECRET',
  'PORTAL_SESSION_SECRET',
  'PORTAL_OTP_PEPPER',
  'PORTAL_ALLOW_LOCAL_OTP_STORE',
  'CRON_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
] as const;

function snapshotManagedEnvironment() {
  return Object.fromEntries(MANAGED_ENV.map((key) => [key, process.env[key]]));
}

function restoreManagedEnvironment(previous: Record<string, string | undefined>): void {
  for (const key of MANAGED_ENV) {
    const value = previous[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function withCleanEnvironment(run: () => void): void {
  const previous = snapshotManagedEnvironment();
  for (const key of MANAGED_ENV) delete process.env[key];
  try { run(); } finally { restoreManagedEnvironment(previous); }
}

async function withCleanEnvironmentAsync(run: () => Promise<void>): Promise<void> {
  const previous = snapshotManagedEnvironment();
  for (const key of MANAGED_ENV) delete process.env[key];
  try { await run(); } finally { restoreManagedEnvironment(previous); }
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

test('Asten rejeita credencial com caracteres de controle antes de acessar a rede', async () => {
  await withCleanEnvironmentAsync(async () => {
    process.env.ASTEN_INTEGRATION_ENABLED = 'true';
    const originalFetch = globalThis.fetch;
    let called = false;
    (globalThis as any).fetch = async () => { called = true; throw new Error('não deveria acessar a rede'); };
    try {
      await assert.rejects(callAsten('getIdentificador', {}, 'token-valido-123\nX-Injetado: sim'), /Configuração Asten inválida/i);
      assert.equal(called, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('Asten bloqueia redirects e não propaga credencial em mensagem de erro do provedor', async () => {
  await withCleanEnvironmentAsync(async () => {
    process.env.ASTEN_INTEGRATION_ENABLED = 'true';
    const token = 'asten-token-ultrassecreto-123456789';
    const originalFetch = globalThis.fetch;
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    (globalThis as any).fetch = async (input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(JSON.stringify({ error: { message: `Token recusado: ${token}\ntrace interno` } }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      });
    };
    try {
      await assert.rejects(
        callAsten('getIdentificador', {}, token),
        (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          assert.equal(message.includes(token), false);
          assert.equal(message.includes('[credencial omitida]'), true);
          assert.equal(/[\r\n]/.test(message), false);
          return true;
        }
      );
      assert.equal(capturedUrl, 'https://plataforma.astenassinatura.com.br/api/getIdentificador');
      assert.equal(capturedInit?.redirect, 'error');
      assert.equal(capturedInit?.cache, 'no-store');
      assert.equal((capturedInit?.headers as Record<string, string>)['x-api-key'], token);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('cofre de integrações bloqueia redirects e nunca envia segredo em texto puro no payload', async () => {
  await withCleanEnvironmentAsync(async () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL = 'https://project.example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'sb_' + 'secret_example_only_for_test';
    process.env.PORTAL_SECRET_ENCRYPTION_KEY = 'a'.repeat(64);
    const plaintext = 'credencial-integracao-nao-pode-sair-em-claro';
    const originalFetch = globalThis.fetch;
    let capturedInit: RequestInit | undefined;
    (globalThis as any).fetch = async (_input: string | URL | Request, init?: RequestInit) => {
      capturedInit = init;
      return new Response('', { status: 201 });
    };
    try {
      await saveIntegrationSecret('asten', plaintext, { identifier: 'test' });
      assert.equal(capturedInit?.redirect, 'error');
      assert.equal(capturedInit?.cache, 'no-store');
      const body = String(capturedInit?.body || '');
      assert.equal(body.includes(plaintext), false);
      assert.equal(body.includes('ciphertext'), true);
      assert.equal(body.includes('auth_tag'), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('cofre de integrações rejeita Supabase sem HTTPS em runtime seguro antes da rede', async () => {
  await withCleanEnvironmentAsync(async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL = '1';
    process.env.SUPABASE_URL = 'http://project.example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'sb_' + 'secret_example_only_for_test';
    process.env.PORTAL_SECRET_ENCRYPTION_KEY = 'b'.repeat(64);
    const originalFetch = globalThis.fetch;
    let called = false;
    (globalThis as any).fetch = async () => { called = true; return new Response('', { status: 201 }); };
    try {
      await assert.rejects(saveIntegrationSecret('asten', 'credencial-teste-valida'), /armazenamento seguro do Supabase/i);
      assert.equal(called, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
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

test('produção exige segredos distintos para sessão, OTP, OAuth e demais chaves operacionais', () => {
  withCleanEnvironment(() => {
    process.env.NODE_ENV = 'production';
    process.env.PORTAL_SESSION_SECRET = 's'.repeat(48);
    process.env.PORTAL_OTP_PEPPER = process.env.PORTAL_SESSION_SECRET;
    process.env.GOOGLE_OAUTH_STATE_SECRET = process.env.PORTAL_SESSION_SECRET;
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'client.apps.googleusercontent.com';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'client-secret';
    process.env.PORTAL_SECRET_ENCRYPTION_KEY = 'e'.repeat(64);

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

    process.env.PORTAL_SECRET_ENCRYPTION_KEY_V2 = process.env.PORTAL_SESSION_SECRET;
    assert.equal(getPortalSessionRuntimeStatus().configured, false);
    process.env.PORTAL_SECRET_ENCRYPTION_KEY_V2 = 'v'.repeat(48);
    process.env.PORTAL_SECURITY_WEBHOOK_SECRET = process.env.PORTAL_SESSION_SECRET;
    assert.equal(getPortalSessionRuntimeStatus().configured, false);
    process.env.PORTAL_SECURITY_WEBHOOK_SECRET = 'w'.repeat(48);
    process.env.CRON_SECRET = process.env.PORTAL_SESSION_SECRET;
    assert.equal(getPortalSessionRuntimeStatus().configured, false);
  });
});
