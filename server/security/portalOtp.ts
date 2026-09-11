import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { normalizeEmail } from '../../src/utils/formatters';
import { sendGmailMessage } from '../integrations/googleWorkspace';

interface OtpChallenge {
  id: string;
  email: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
  consumed_at?: string | null;
  requested_ip_hash?: string | null;
  created_at: string;
}

const localChallenges = new Map<string, OtpChallenge>();

function supabaseUrl(): string { return String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, ''); }
function supabaseSecret(): string { return String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(); }
function canUseSupabase(): boolean { return Boolean(supabaseUrl() && supabaseSecret()); }
function allowLocalFallback(): boolean { return process.env.NODE_ENV !== 'production' && process.env.PORTAL_ALLOW_LOCAL_OTP_STORE === 'true'; }
function pepper(): string { return String(process.env.PORTAL_OTP_PEPPER || '').trim(); }
function pepperIsSeparated(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  const otherSecrets = [
    process.env.PORTAL_SESSION_SECRET,
    process.env.GOOGLE_OAUTH_STATE_SECRET,
    process.env.PORTAL_SECRET_ENCRYPTION_KEY,
    process.env.PORTAL_VERIFICATION_SECRET,
    process.env.PORTAL_UPLOAD_BINDING_SECRET,
    process.env.ASTEN_SESSION_ENCRYPTION_KEY,
    process.env.ASTEN_WEBHOOK_SECRET
  ].map((value) => String(value || '').trim()).filter(Boolean);
  return !otherSecrets.includes(pepper());
}
function adminHeaders(): Record<string, string> {
  const secret = supabaseSecret();
  const headers:Record<string,string>={ apikey: secret, 'Content-Type': 'application/json', Accept: 'application/json' };
  if(!secret.startsWith('sb_secret_'))headers.Authorization=`Bearer ${secret}`;
  return headers;
}

function assertConfigured(): void {
  if (pepper().length < 32) throw new Error('PORTAL_OTP_PEPPER precisa ter pelo menos 32 caracteres.');
  if (!pepperIsSeparated()) throw new Error('PORTAL_OTP_PEPPER deve ser exclusivo e diferente dos demais segredos em produção.');
  if (!canUseSupabase() && !allowLocalFallback()) throw new Error('O armazenamento de códigos OTP não está configurado.');
}

function hashCode(id: string, email: string, code: string): string {
  return createHmac('sha256', pepper()).update(`${id}\n${email}\n${code}`).digest('hex');
}

function hashIp(ip: string): string {
  return createHash('sha256').update(`${pepper()}\n${ip}`).digest('hex');
}

function safeEqualHex(left: string, right: string): boolean {
  try {
    const a = Buffer.from(left, 'hex');
    const b = Buffer.from(right, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

async function insertChallenge(challenge: OtpChallenge): Promise<void> {
  if (!canUseSupabase()) {
    localChallenges.set(challenge.id, challenge);
    return;
  }
  const response = await fetch(`${supabaseUrl()}/rest/v1/portal_otp_challenges`, {
    method: 'POST',
    headers: { ...adminHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(challenge),
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`Não foi possível registrar o código de acesso (${response.status}).`);
}

async function recentChallenges(email: string): Promise<OtpChallenge[]> {
  if (!canUseSupabase()) {
    return [...localChallenges.values()]
      .filter((challenge) => challenge.email === email)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const query = new URLSearchParams({
    email: `eq.${email}`,
    created_at: `gte.${since}`,
    select: 'id,email,code_hash,expires_at,attempts,max_attempts,consumed_at,requested_ip_hash,created_at',
    order: 'created_at.desc',
    limit: '10'
  });
  const response = await fetch(`${supabaseUrl()}/rest/v1/portal_otp_challenges?${query}`, {
    headers: adminHeaders(), signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`Não foi possível consultar os códigos de acesso (${response.status}).`);
  return await response.json() as OtpChallenge[];
}

async function recentChallengesForIp(ip:string):Promise<number>{
  const ipHash=hashIp(ip);
  const since=new Date(Date.now()-15*60_000).toISOString();
  if(!canUseSupabase())return[...localChallenges.values()].filter(challenge=>challenge.requested_ip_hash===ipHash&&challenge.created_at>=since).length;
  const query=new URLSearchParams({requested_ip_hash:`eq.${ipHash}`,created_at:`gte.${since}`,select:'id',limit:'11'});
  const response=await fetch(`${supabaseUrl()}/rest/v1/portal_otp_challenges?${query}`,{headers:adminHeaders(),signal:AbortSignal.timeout(12_000)});
  if(!response.ok)throw new Error(`Não foi possível validar o limite de solicitações (${response.status}).`);
  const rows=await response.json();return Array.isArray(rows)?rows.length:0;
}

async function updateChallenge(id: string, changes: Partial<OtpChallenge>, expectedAttempts?: number): Promise<boolean> {
  if (!canUseSupabase()) {
    const current = localChallenges.get(id);
    if (!current || current.consumed_at || (expectedAttempts!==undefined&&current.attempts!==expectedAttempts)) return false;
    localChallenges.set(id, { ...current, ...changes });
    return true;
  }
  const attemptsFilter=expectedAttempts===undefined?'':`&attempts=eq.${expectedAttempts}`;
  const response = await fetch(`${supabaseUrl()}/rest/v1/portal_otp_challenges?id=eq.${encodeURIComponent(id)}&consumed_at=is.null${attemptsFilter}`, {
    method: 'PATCH',
    headers: { ...adminHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(changes),
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`Não foi possível atualizar o código de acesso (${response.status}).`);
  const rows = await response.json();
  return Array.isArray(rows) && rows.length === 1;
}

function makeCode(): string {
  const fixed = process.env.NODE_ENV !== 'production' ? String(process.env.PORTAL_OTP_TEST_CODE || '').trim() : '';
  if (/^\d{6}$/.test(fixed)) return fixed;
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function getOtpRuntimeStatus() {
  return {
    configured: pepper().length >= 32 && pepperIsSeparated() && (canUseSupabase() || allowLocalFallback()),
    pepperConfigured: pepper().length >= 32,
    pepperSeparated: pepperIsSeparated(),
    durable: canUseSupabase(),
    delivery: process.env.NODE_ENV !== 'production' && process.env.PORTAL_OTP_DELIVERY_MODE === 'log' ? 'DEVELOPMENT_LOG' : 'GMAIL'
  } as const;
}

export async function requestPortalOtp(input: { email: string; ip?: string; portalName?:string }): Promise<void> {
  assertConfigured();
  const email = normalizeEmail(input.email);
  if(input.ip&&(await recentChallengesForIp(input.ip))>=10)throw new Error('Limite temporário de solicitações atingido. Tente novamente mais tarde.');
  const recent = await recentChallenges(email);
  const newest = recent[0];
  if (newest && Date.now() - new Date(newest.created_at).getTime() < 60_000) {
    throw new Error('Aguarde 60 segundos antes de solicitar outro código.');
  }
  if (recent.length >= 5) throw new Error('Limite temporário de códigos atingido. Tente novamente mais tarde.');

  const id = randomBytes(18).toString('base64url');
  const code = makeCode();
  const now = new Date();
  const challenge: OtpChallenge = {
    id,
    email,
    code_hash: hashCode(id, email, code),
    expires_at: new Date(now.getTime() + 10 * 60_000).toISOString(),
    attempts: 0,
    max_attempts: 5,
    consumed_at: null,
    requested_ip_hash: input.ip ? hashIp(input.ip) : null,
    created_at: now.toISOString()
  };
  await insertChallenge(challenge);

  if (process.env.NODE_ENV !== 'production' && process.env.PORTAL_OTP_DELIVERY_MODE === 'log') {
    console.info(`[Portal OTP desenvolvimento] ${email}: ${code}`);
    return;
  }

  try {
    const portalName=String(input.portalName||'Portal de TCC').replace(/[\r\n]+/g,' ').trim().slice(0,120)||'Portal de TCC';
    const safePortalName=portalName.replace(/[&<>"']/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]||character));
    await sendGmailMessage({
      to: email,
      subject: `Código de acesso — ${portalName}`,
      text: `Seu código de acesso é ${code}. Ele expira em 10 minutos e só pode ser usado uma vez. Se você não solicitou este acesso, ignore esta mensagem.`,
      html: `<div style="font-family:Arial,sans-serif;color:#172033;max-width:560px;margin:auto"><h2 style="color:#005a3c">${safePortalName}</h2><p>Use o código abaixo para concluir seu acesso:</p><div style="font-size:30px;letter-spacing:8px;font-weight:800;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:12px;padding:18px;text-align:center">${code}</div><p style="font-size:13px;color:#475569">O código expira em 10 minutos e só pode ser usado uma vez.</p></div>`
    });
  } catch (error) {
    await updateChallenge(id, { consumed_at: new Date().toISOString() }).catch(() => undefined);
    throw error;
  }
}

export async function verifyPortalOtp(input: { email: string; code: string }): Promise<void> {
  assertConfigured();
  const email = normalizeEmail(input.email);
  const code = String(input.code || '').trim();
  if (!/^\d{6}$/.test(code)) throw new Error('Informe o código de seis dígitos.');
  const challenge = (await recentChallenges(email)).find((item) => !item.consumed_at);
  if (!challenge || new Date(challenge.expires_at).getTime() <= Date.now()) throw new Error('Código inválido ou expirado.');
  if (challenge.attempts >= challenge.max_attempts) throw new Error('Código bloqueado após excesso de tentativas.');
  const matches = safeEqualHex(hashCode(challenge.id, email, code), challenge.code_hash);
  if (!matches) {
    const nextAttempts = challenge.attempts + 1;
    const updated=await updateChallenge(challenge.id, {
      attempts: nextAttempts,
      ...(nextAttempts >= challenge.max_attempts ? { consumed_at: new Date().toISOString() } : {})
    },challenge.attempts);
    if(!updated)throw new Error('O código foi verificado simultaneamente. Solicite um novo código.');
    throw new Error('Código inválido ou expirado.');
  }
  const consumed = await updateChallenge(challenge.id, { consumed_at: new Date().toISOString() },challenge.attempts);
  if (!consumed) throw new Error('Este código já foi utilizado.');
}
