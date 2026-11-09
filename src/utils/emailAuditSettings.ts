import type { GlobalSettings } from '../types';
import { resolveInstallationProfile } from './installationProfile';
import { isEmailHeaderAddress } from './emailAddress';

type EmailAuditSettings = Pick<GlobalSettings, 'masterEmail' | 'emailConfig' | 'installationProfile'>;

export function isEmailAuditEnabled(settings: EmailAuditSettings): boolean {
  const configured = settings.emailConfig?.auditEmailsEnabled;
  return configured === undefined
    ? resolveInstallationProfile(settings).installationId === 'ufes-enfermagem'
    : configured === true;
}

export function emailAuditMailbox(settings: EmailAuditSettings): string | undefined {
  if (!isEmailAuditEnabled(settings)) return undefined;
  const configured=settings.emailConfig?.auditCopyEmail;
  const raw=configured===undefined?settings.masterEmail:configured;
  if(typeof raw!=='string'||/[\u0000-\u001f\u007f]/.test(raw))return undefined;
  const email = raw.trim().toLowerCase();
  return isEmailHeaderAddress(email) ? email : undefined;
}
