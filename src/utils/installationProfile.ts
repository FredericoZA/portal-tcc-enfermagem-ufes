import type { GlobalSettings, InstallationProfile, PortalFeatureFlag, PortalFeatureKey } from '../types';
import { DEFAULT_FEATURE_FLAGS, DEFAULT_INSTALLATION_PROFILE } from '../constants/installation';

export function resolveInstallationProfile(settings?: Pick<GlobalSettings, 'installationProfile'> | null): InstallationProfile {
  const source = settings?.installationProfile || DEFAULT_INSTALLATION_PROFILE;
  return {
    ...DEFAULT_INSTALLATION_PROFILE,
    ...source,
    studentEmailDomains: normalizeDomains(source.studentEmailDomains || DEFAULT_INSTALLATION_PROFILE.studentEmailDomains),
    internalEmailDomains: normalizeDomains(source.internalEmailDomains || DEFAULT_INSTALLATION_PROFILE.internalEmailDomains)
  };
}

export function normalizeDomains(domains: string[]): string[] {
  return Array.from(new Set(domains.map((domain) => domain.trim().toLowerCase().replace(/^@/, '')).filter(Boolean)));
}

export function emailMatchesDomains(email: string, domains: string[]): boolean {
  const normalized = email.trim().toLowerCase();
  return normalizeDomains(domains).some((domain) => normalized.endsWith(`@${domain}`) || normalized.endsWith(`.${domain}`));
}

export function buildProtocol(profile: InstallationProfile, year: number, sequence: number): string {
  const prefix = profile.protocolPrefix.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 16) || 'TCC';
  return `${prefix}-${year}-${String(sequence).padStart(4, '0')}`;
}

export function effectiveFeatureFlags(settings?: Pick<GlobalSettings, 'featureFlags'> | null): PortalFeatureFlag[] {
  const configured = new Map((settings?.featureFlags || []).map((flag) => [flag.key, flag]));
  return DEFAULT_FEATURE_FLAGS.map((fallback) => ({ ...fallback, ...(configured.get(fallback.key) || {}) }));
}

export function isPortalFeatureEnabled(settings: Pick<GlobalSettings, 'featureFlags'>, key: PortalFeatureKey): boolean {
  return Boolean(effectiveFeatureFlags(settings).find((flag) => flag.key === key)?.enabled);
}
