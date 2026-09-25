import React from 'react';
import { getPortalToneCssVars, type PortalSemanticTone } from '../utils/portalSemanticTokens';

export type PortalPillTone = PortalSemanticTone;

export const normalizeProcessNumber = (value?: string) => {
  const raw = String(value || '').trim().replace(/^TCC\s*[-/]?\s*/i, '').trim();
  const match = raw.match(/(20\d{2})[-/]?(\d{3,})/);
  if (match) return `${match[1]}-${match[2]}`;
  return raw || '—';
};

export const PortalProcessPill: React.FC<{ value?: string; tone?: PortalPillTone; className?: string }> = ({ value, tone = 'neutral', className = '' }) => (
  <span
    className={`portal-process-pill portal-semantic-tone ${className}`}
    data-portal-pill-tone={tone}
    style={getPortalToneCssVars(tone)}
  >
    {normalizeProcessNumber(value)}
  </span>
);
