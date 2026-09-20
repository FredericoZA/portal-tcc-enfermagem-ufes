import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

interface StoredSecretRow {
  provider: string;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  metadata?: Record<string, unknown> | null;
  updated_at?: string;
}

type EncryptionKeyId = 'v1' | 'v2';
const CRYPTO_KEY_METADATA_FIELD = '__portalCryptoKeyId';

const localSecrets = new Map<string, { value: string; metadata: Record<string, unknown>; updatedAt: string }>();

function supabaseUrl(): string {
  return String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
}

function supabaseSecret(): string {
  return String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

function rawEncryptionKey(id: EncryptionKeyId): string {
  return String(id === 'v2' ? process.env.PORTAL_SECRET_ENCRYPTION_KEY_V2 || '' : process.env.PORTAL_SECRET_ENCRYPTION_KEY || '').trim();
}

function parseEncryptionKey(raw: string): Buffer {
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  try {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === 32) return decoded;
  } catch {
    // Handled below without exposing key material.
  }
  throw new Error('A chave de cifragem do Portal deve conter exatamente 32 bytes.');
}

function configuredKeyIds(): EncryptionKeyId[] {
  return rawEncryptionKey('v2') ? ['v1', 'v2'] : ['v1'];
}

function activeKeyId(): EncryptionKeyId {
  return rawEncryptionKey('v2') ? 'v2' : 'v1';
}

function encryptionKeysAreSeparated(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  const values = configuredKeyIds().map((id) => rawEncryptionKey(id));
  if (values.some((value) => !value)) return false;
  if (new Set(values).size !== values.length) return false;
  const otherSecrets = [
    process.env.PORTAL_SESSION_SECRET,
    process.env.PORTAL_OTP_PEPPER,
    process.env.GOOGLE_OAUTH_STATE_SECRET,
    process.env.PORTAL_VERIFICATION_SECRET,
    process.env.PORTAL_UPLOAD_BINDING_SECRET,
    process.env.ASTEN_SESSION_ENCRYPTION_KEY,
    process.env.ASTEN_WEBHOOK_SECRET
  ].map((item) => String(item || '').trim()).filter(Boolean);
  return values.every((value) => !otherSecrets.includes(value));
}

function encryptionKey(id: EncryptionKeyId): Buffer {
  if (!encryptionKeysAreSeparated()) throw new Error('As chaves de cifragem do Portal devem ser exclusivas e diferentes dos demais segredos em produção.');
  const raw = rawEncryptionKey(id);
  if (!raw) throw new Error(`A chave de cifragem ${id} não está configurada.`);
  return parseEncryptionKey(raw);
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

function canUseSupabase(): boolean {
  return Boolean(supabaseUrl() && supabaseSecret());
}

function allowLocalFallback(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.PORTAL_ALLOW_LOCAL_SECRET_STORE === 'true';
}

function encrypt(provider: string, value: string): Pick<StoredSecretRow, 'ciphertext' | 'iv' | 'auth_tag'> & { keyId: EncryptionKeyId } {
  const keyId = activeKeyId();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(keyId), iv);
  cipher.setAAD(Buffer.from(`portal-tcc:${provider}:${keyId}`));
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    auth_tag: cipher.getAuthTag().toString('base64'),
    keyId
  };
}

function decryptWithKey(row: StoredSecretRow, keyId: EncryptionKeyId): string {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(keyId), Buffer.from(row.iv, 'base64'));
  decipher.setAAD(Buffer.from(`portal-tcc:${row.provider}:${keyId}`));
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

function decrypt(row: StoredSecretRow): string {
  const declared = String(row.metadata?.[CRYPTO_KEY_METADATA_FIELD] || '').toLowerCase();
  if (declared === 'v1' || declared === 'v2') return decryptWithKey(row, declared);

  // Registros históricos não possuem key id e foram gravados com v1.
  try { return decryptWithKey(row, 'v1'); }
  catch (firstError) {
    if (!rawEncryptionKey('v2')) throw firstError;
    return decryptWithKey(row, 'v2');
  }
}

export function encryptPortalBackupPayload(value:string):Buffer{
  const keyId=activeKeyId();
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',encryptionKey(keyId),iv);
  cipher.setAAD(Buffer.from(`portal-tcc:backup:${keyId}`));
  const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return Buffer.from(JSON.stringify({schema:`portal-tcc-backup-${keyId}`,alg:'A256GCM',kid:keyId,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:encrypted.toString('base64')}),'utf8');
}

export function decryptPortalBackupPayload(payload:Buffer):string{
  const parsed=JSON.parse(payload.toString('utf8')) as {schema?:string;alg?:string;kid?:string;iv?:string;tag?:string;ciphertext?:string};
  if(parsed.alg!=='A256GCM'||!parsed.iv||!parsed.tag||!parsed.ciphertext)throw new Error('Backup cifrado em formato inválido.');
  const keyId:EncryptionKeyId=parsed.schema==='portal-tcc-backup-v1'?'v1':parsed.schema==='portal-tcc-backup-v2'&&parsed.kid==='v2'?'v2':(() => { throw new Error('Backup cifrado em formato inválido.'); })();
  const decipher=createDecipheriv('aes-256-gcm',encryptionKey(keyId),Buffer.from(parsed.iv,'base64'));
  decipher.setAAD(Buffer.from(`portal-tcc:backup:${keyId}`));
  decipher.setAuthTag(Buffer.from(parsed.tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(parsed.ciphertext,'base64')),decipher.final()]).toString('utf8');
}

export function getSecretStoreStatus() {
  const encrypted = (() => {
    try { configuredKeyIds().forEach((id) => encryptionKey(id)); return true; } catch { return false; }
  })();
  const durable = canUseSupabase();
  const keySeparated = encryptionKeysAreSeparated();
  const currentKeyId=activeKeyId();
  return {
    configured: encrypted && keySeparated && (durable || allowLocalFallback()),
    durable,
    encrypted,
    keySeparated,
    activeKeyId:currentKeyId,
    keyCount:configuredKeyIds().length,
    rotationReady:currentKeyId==='v2',
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
  const { keyId, ...cipherFields } = encrypted;
  const response = await fetch(`${supabaseUrl()}/rest/v1/portal_integration_secrets?on_conflict=provider`, {
    method: 'POST',
    headers: { ...adminHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      provider: normalizedProvider,
      ...cipherFields,
      metadata: { ...metadata, [CRYPTO_KEY_METADATA_FIELD]: keyId },
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
  const metadata = { ...(row.metadata || {}) };
  delete metadata[CRYPTO_KEY_METADATA_FIELD];
  return { value: decrypt(row), metadata, updatedAt: row.updated_at };
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
