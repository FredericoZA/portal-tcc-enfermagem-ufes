import React from 'react';
import { getPortalToneCssVars, type PortalSemanticTone } from '../utils/portalSemanticTokens';

export type PortalPillTone = PortalSemanticTone;

export const normalizeProcessNumber = (value?: string) => {
  const raw = String(value || '').trim().replace(/^TCC\s*[-/]?\s*/i, '').trim();
  const match = raw.match(/(20\d{2})[-/]?(\d{3,})/);
  if (match) return `${match[1]}-${match[2]}`;
  return raw || '—';
};

interface PortalProcessPillProps {
  value?: string;
  tone?: PortalPillTone;
  className?: string;
}

export const PortalProcessPill: React.FC<PortalProcessPillProps> = (props) => {
  const tone: PortalPillTone = props.tone ?? 'neutral';
  return (
    <span
      className={`portal-process-pill portal-semantic-tone ${props.className ?? ''}`}
      data-portal-pill-tone={tone}
      style={getPortalToneCssVars(tone)}
    >
      {normalizeProcessNumber(props.value)}
    </span>
  );
};
