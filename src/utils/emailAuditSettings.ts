import type { GlobalSettings } from '../types';
import { resolveInstallationProfile } from './installationProfile';

type EmailAuditSettings = Pick<GlobalSettings, 'masterEmail' | 'emailConfig' | 'installationProfile'>;

export function isEmailAuditEnabled(settings: EmailAuditSettings): boolean {
  const configured = settings.emailConfig?.auditEmailsEnabled;
  return configured === undefined
    ? resolveInstallationProfile(settings).installationId === 'ufes-enfermagem'
    : configured === true;
}

export function emailAuditMailbox(settings: EmailAuditSettings): string | undefined {
  if (!isEmailAuditEnabled(settings)) return undefined;
  const email = String(settings.masterEmail || '').trim().toLowerCase();
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) ? email : undefined;
}
