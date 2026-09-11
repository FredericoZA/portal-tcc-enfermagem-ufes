import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

interface StoredSecretRow {
  provider: string;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  metadata?: Record<string, unknown> | null;
  updated_at?: string;
}

const localSecrets = new Map<string, { value: string; metadata: Record<string, unknown>; updatedAt: string }>();

function supabaseUrl(): string {
  return String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
}

function supabaseSecret(): string {
  return String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

function rawEncryptionKey(): string {
  return String(process.env.PORTAL_SECRET_ENCRYPTION_KEY || '').trim();
}

function encryptionKeyIsSeparated(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  const value = rawEncryptionKey();
  if (!value) return false;
  const otherSecrets = [
    process.env.PORTAL_SESSION_SECRET,
    process.env.PORTAL_OTP_PEPPER,
    process.env.GOOGLE_OAUTH_STATE_SECRET,
    process.env.PORTAL_VERIFICATION_SECRET,
    process.env.PORTAL_UPLOAD_BINDING_SECRET,
    process.env.ASTEN_SESSION_ENCRYPTION_KEY,
    process.env.ASTEN_WEBHOOK_SECRET
  ].map((item) => String(item || '').trim()).filter(Boolean);
  return !otherSecrets.includes(value);
}

function adminHeaders(): Record<string, string> {
  const secret = supabaseSecret();
  const headers:Record<string,string> = {
    apikey: secret,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  if(!secret.startsWith('sb_secret_'))headers.Authorization=`Bearer ${secret}`;
  return headers;
}

function encryptionKey(): Buffer {
  const raw = rawEncryptionKey();
  if (!encryptionKeyIsSeparated()) throw new Error('PORTAL_SECRET_ENCRYPTION_KEY deve ser exclusiva e diferente dos demais segredos em produção.');
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  try {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === 32) return decoded;
  } catch {
    // Handled below with a single, non-secret-bearing error.
  }
  throw new Error('PORTAL_SECRET_ENCRYPTION_KEY deve conter exatamente 32 bytes.');
}

function canUseSupabase(): boolean {
  return Boolean(supabaseUrl() && supabaseSecret());
}

function allowLocalFallback(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.PORTAL_ALLOW_LOCAL_SECRET_STORE === 'true';
}

function encrypt(provider: string, value: string): Pick<StoredSecretRow, 'ciphertext' | 'iv' | 'auth_tag'> {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`portal-tcc:${provider}:v1`));
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    auth_tag: cipher.getAuthTag().toString('base64')
  };
}

function decrypt(row: StoredSecretRow): string {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(row.iv, 'base64'));
  decipher.setAAD(Buffer.from(`portal-tcc:${row.provider}:v1`));
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

export function getSecretStoreStatus() {
  const encrypted = (() => {
    try { encryptionKey(); return true; } catch { return false; }
  })();
  const durable = canUseSupabase();
  const keySeparated = encryptionKeyIsSeparated();
  return {
    configured: encrypted && keySeparated && (durable || allowLocalFallback()),
    durable,
    encrypted,
    keySeparated,
    mode: durable ? 'SUPABASE_ENCRYPTED' : allowLocalFallback() ? 'LOCAL_DEVELOPMENT_ONLY' : 'UNAVAILABLE'
  } as const;
}

export async function saveIntegrationSecret(
  provider: string,
  value: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const normalizedProvider = provider.trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,40}$/.test(normalizedProvider) || !value.trim()) {
    throw new Error('Segredo de integração inválido.');
  }
  const now = new Date().toISOString();
  if (!canUseSupabase()) {
    if (!allowLocalFallback()) throw new Error('O armazenamento seguro do Supabase precisa estar configurado.');
    localSecrets.set(normalizedProvider, { value, metadata, updatedAt: now });
    return;
  }
  const encrypted = encrypt(normalizedProvider, value);
  const response = await fetch(`${supabaseUrl()}/rest/v1/portal_integration_secrets?on_conflict=provider`, {
    method: 'POST',
    headers: { ...adminHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      provider: normalizedProvider,
      ...encrypted,
      metadata,
      updated_at: now
    }),
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Não foi possível guardar a credencial de ${normalizedProvider} (${response.status}).`);
}

export async function loadIntegrationSecret(provider: string): Promise<{ value: string; metadata: Record<string, unknown>; updatedAt?: string } | null> {
  const normalizedProvider = provider.trim().toLowerCase();
  if (!canUseSupabase()) {
    const local = localSecrets.get(normalizedProvider);
    if (!local) return null;
    return { value: local.value, metadata: local.metadata, updatedAt: local.updatedAt };
  }
  const response = await fetch(
    `${supabaseUrl()}/rest/v1/portal_integration_secrets?provider=eq.${encodeURIComponent(normalizedProvider)}&select=provider,ciphertext,iv,auth_tag,metadata,updated_at&limit=1`,
    { headers: adminHeaders(), signal: AbortSignal.timeout(12_000) }
  );
  if (!response.ok) throw new Error(`Não foi possível ler a credencial de ${normalizedProvider} (${response.status}).`);
  const rows = await response.json() as StoredSecretRow[];
  const row = rows[0];
  if (!row) return null;
  return { value: decrypt(row), metadata: row.metadata || {}, updatedAt: row.updated_at };
}

export async function deleteIntegrationSecret(provider: string): Promise<void> {
  const normalizedProvider = provider.trim().toLowerCase();
  if (!canUseSupabase()) {
    localSecrets.delete(normalizedProvider);
    return;
  }
  const response = await fetch(
    `${supabaseUrl()}/rest/v1/portal_integration_secrets?provider=eq.${encodeURIComponent(normalizedProvider)}`,
    { method: 'DELETE', headers: adminHeaders(), signal: AbortSignal.timeout(12_000) }
  );
  if (!response.ok) throw new Error(`Não foi possível remover a credencial de ${normalizedProvider} (${response.status}).`);
}
