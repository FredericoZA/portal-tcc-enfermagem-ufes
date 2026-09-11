import type { Request, Response } from 'express';

type StartupFailure = { code: string; message: string };
type StartupState = { app: ((req: Request, res: Response) => unknown) | null; error: unknown };

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

export default async function handler(req: Request, res: Response) {
  const state = await startup();
  if (state.app) return state.app(req, res);

  const diagnostic = classifyStartupFailure(state.error);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(503).json({
    status: 'unavailable',
    code: diagnostic.code,
    message: diagnostic.message
  });
}
