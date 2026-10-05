import React from 'react';
import { getPortalToneCssVars, type PortalSemanticTone } from '../utils/portalSemanticTokens';

export type PortalPillTone = PortalSemanticTone;

export const normalizeProcessNumber = (value?: string) => {
  const raw = String(value || '').trim();
  const withoutTcc = raw.replace(/^TCC\s*[-/:]?\s*/i, '').trim();
  const withoutTest = withoutTcc.replace(/^TESTE\s*[-/:]?\s*/i, '').trim();
  const normalized = withoutTest
    .replace(/[\s/]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const match = normalized.match(/(20\d{2})-?(\d{1,})/);
  if (match) return `${match[1]}-${match[2]}`;
  return normalized || '—';
};

export const formatProcessLabel = (value?: string) => {
  const normalized = normalizeProcessNumber(value);
  return normalized === '—' ? 'TCC' : `TCC - ${normalized}`;
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
      {formatProcessLabel(props.value)}
    </span>
  );
};
