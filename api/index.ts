import type { Request, Response } from 'express';

type StartupFailure = { code: string; message: string; missingGroups?: string[] };
type StartupState = { app: ((req: Request, res: Response) => unknown) | null; error: unknown };

function configured(name: string, minLength = 1): boolean {
  return String(process.env[name] || '').trim().length >= minLength;
}

function deployedCommit(): string {
  return String(process.env.VERCEL_GIT_COMMIT_SHA || '');
}

function productionPreflight(): StartupFailure | null {
  if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') return null;

  const missing: string[] = [];
  if (!configured('PORTAL_BOOTSTRAP_MASTER_EMAIL')) missing.push('MASTER');
  if (!configured('SUPABASE_URL') || process.env.PORTAL_PERSISTENCE_PROVIDER !== 'supabase') missing.push('SUPABASE_BASE');
  if (!configured('SUPABASE_SECRET_KEY') && !configured('SUPABASE_SERVICE_ROLE_KEY')) missing.push('SUPABASE_SERVER_KEY');
  if (!configured('PORTAL_SESSION_SECRET', 32)) missing.push('SESSION');
  if (!configured('PORTAL_OTP_PEPPER', 32)) missing.push('OTP');
  if (!configured('PORTAL_SECRET_ENCRYPTION_KEY', 32)) missing.push('SECRET_STORE');
  if (!configured('PORTAL_UPLOAD_BINDING_SECRET', 32) || !configured('SUPABASE_SECURE_FILES_BUCKET')) missing.push('FILE_TRANSPORT');
  if (!configured('CRON_SECRET', 32)) missing.push('CRON');
  if (!configured('PORTAL_VERIFICATION_SECRET', 32)) missing.push('DOCUMENT_VERIFICATION');
  if (!configured('GOOGLE_OAUTH_CLIENT_ID') || !configured('GOOGLE_OAUTH_CLIENT_SECRET')) missing.push('GOOGLE_OAUTH_CLIENT');
  if (!configured('GOOGLE_OAUTH_STATE_SECRET', 32)) missing.push('GOOGLE_OAUTH_STATE');
  if (process.env.ASTEN_INTEGRATION_ENABLED === 'true' && (!configured('ASTEN_CALLBACK_URL') || !configured('ASTEN_WEBHOOK_SECRET', 32) || process.env.ASTEN_REQUIRE_CODE === 'false')) missing.push('ASTEN');

  const exclusives = [
    'PORTAL_SESSION_SECRET', 'PORTAL_OTP_PEPPER', 'GOOGLE_OAUTH_STATE_SECRET',
    'PORTAL_SECRET_ENCRYPTION_KEY', 'PORTAL_VERIFICATION_SECRET', 'PORTAL_UPLOAD_BINDING_SECRET',
    'ASTEN_SESSION_ENCRYPTION_KEY', 'ASTEN_WEBHOOK_SECRET', 'CRON_SECRET'
  ].map((name) => [name, String(process.env[name] || '').trim()] as const).filter(([, value]) => value);
  const seen = new Set<string>();
  if (exclusives.some(([, value]) => seen.has(value) || !seen.add(value))) missing.push('SECRET_SEPARATION');

  const unique = [...new Set(missing)];
  return unique.length ? {
    code: 'PRODUCTION_CONFIGURATION_REQUIRED',
    message: 'A produção ainda precisa de configuração segura antes de iniciar.',
    missingGroups: unique
  } : null;
}

function classifyStartupFailure(error: unknown): StartupFailure {
  const detail = error instanceof Error ? error.message : String(error || '');
  if (detail.includes('PORTAL_BOOTSTRAP_MASTER_EMAIL')) return { code: 'MASTER_EMAIL_REQUIRED', message: 'A identidade inicial de administração ainda não foi configurada.' };
  if (detail.includes('persistência durável do Supabase')) return { code: 'SUPABASE_CONFIGURATION_REQUIRED', message: 'A persistência durável ainda não está configurada.' };
  if (detail.includes('PORTAL_OTP_PEPPER')) return { code: 'OTP_CONFIGURATION_REQUIRED', message: 'A proteção de códigos de acesso ainda não está configurada.' };
  if (detail.includes('PORTAL_SECRET_ENCRYPTION_KEY')) return { code: 'SECRET_STORE_REQUIRED', message: 'O cofre de integrações ainda não está configurado.' };
  if (detail.includes('PORTAL_UPLOAD_BINDING_SECRET')) return { code: 'FILE_TRANSPORT_SECURITY_REQUIRED', message: 'A proteção do transporte privado de arquivos ainda não está configurada.' };
  if (detail.includes('CRON_SECRET')) return { code: 'CRON_SECRET_REQUIRED', message: 'A autenticação da rotina agendada ainda não está configurada.' };
  if (detail.includes('PORTAL_VERIFICATION_SECRET')) return { code: 'VERIFICATION_SECRET_REQUIRED', message: 'A chave de verificação documental ainda não está configurada.' };
  if (detail.includes('Asten') || detail.includes('ASTEN_')) return { code: 'ASTEN_SECURITY_REQUIRED', message: 'A integração de assinatura ainda não passou na verificação de segurança.' };
  if (detail.includes('GOOGLE_') || detail.toLowerCase().includes('oauth')) return { code: 'GOOGLE_OAUTH_SECURITY_REQUIRED', message: 'A integração Google ainda não passou na verificação de segurança.' };
  if (detail.includes('PORTAL_SESSION_SECRET') || detail.toLowerCase().includes('sessão')) return { code: 'SESSION_SECRET_REQUIRED', message: 'A proteção de sessão ainda não está configurada.' };
  if (detail.includes('migrações do Supabase') || detail.includes('outbox transacional')) return { code: 'SUPABASE_SCHEMA_REQUIRED', message: 'O esquema transacional do banco ainda não foi validado.' };
  return { code: 'STARTUP_CONFIGURATION_ERROR', message: 'O portal ainda não concluiu a configuração segura de produção.' };
}

let startupPromise: Promise<StartupState> | null = null;

function startup(): Promise<StartupState> {
  if (!startupPromise) {
    startupPromise = import('../server')
      .then(({ createPortalApp }) => createPortalApp())
      .then(
        (app) => ({ app: app as StartupState['app'], error: null }),
        (error) => {
          console.error('[Startup] Falha ao inicializar o Portal TCC:', error);
          return { app: null, error };
        }
      );
  }
  return startupPromise;
}

function unavailable(res: Response, diagnostic: StartupFailure) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(503).json({
    status: 'unavailable',
    code: diagnostic.code,
    message: diagnostic.message,
    commit: deployedCommit(),
    ...(diagnostic.missingGroups?.length ? { missingGroups: diagnostic.missingGroups } : {})
  });
}

export default async function handler(req: Request, res: Response) {
  const preflight = productionPreflight();
  if (preflight) return unavailable(res, preflight);

  const state = await startup();
  if (!state.app) return unavailable(res, classifyStartupFailure(state.error));

  const requestPath = String(req.url || '').split('?')[0];
  if (requestPath === '/api/health' || requestPath === '/health') {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ status: 'ok', timestamp: new Date().toISOString(), commit: deployedCommit() });
  }
  return state.app(req, res);
}
