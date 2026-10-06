import { apiClient, ApiRequestError } from './apiClient';
import { portalPrompt } from './portalDialogs';

export function requiresPortalReauthentication(error: unknown): boolean {
  return error instanceof ApiRequestError
    && (error.code === 'REAUTHENTICATION_REQUIRED' || error.status === 428);
}

export async function confirmPortalIdentity(message = 'Confirme sua identidade com o código enviado ao seu e-mail. Você permanece no Portal.'): Promise<void> {
  const me = await apiClient.getMe();
  await apiClient.requestLoginCode(me.userEmail);
  const code = await portalPrompt(message, '', {
    title: 'Confirmar identidade',
    confirmLabel: 'Validar',
    cancelLabel: 'Cancelar'
  });
  if (!code?.trim()) throw new Error('A confirmação de identidade foi cancelada.');
  await apiClient.verifyLoginCode(me.userEmail, code.trim());
}

export async function retryAfterPortalReauthentication<T>(
  operation: () => Promise<T>,
  message?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!requiresPortalReauthentication(error)) throw error;
    await confirmPortalIdentity(message);
    return operation();
  }
}
