import React from 'react';

export type PortalPillTone = 'defended' | 'upcoming' | 'student' | 'board' | 'evaluator' | 'viewer' | 'pending' | 'signed' | 'neutral';

const toneClass: Record<PortalPillTone, string> = {
  defended: 'portal-tone-defended',
  upcoming: 'portal-tone-upcoming',
  student: 'portal-tone-student',
  board: 'portal-tone-board',
  evaluator: 'portal-tone-evaluator',
  viewer: 'portal-tone-viewer',
  pending: 'portal-tone-pending',
  signed: 'portal-tone-signed',
  neutral: 'portal-tone-neutral',
};

export const normalizeProcessNumber = (value?: string) => {
  const raw = String(value || '').trim().replace(/^TCC\s*[-/]?\s*/i, '').trim();
  const match = raw.match(/(20\d{2})[-/]?(\d{3,})/);
  if (match) return `${match[1]}-${match[2]}`;
  return raw || '—';
};

export const PortalProcessPill: React.FC<{ value?: string; tone?: PortalPillTone; className?: string }> = ({ value, tone = 'neutral', className = '' }) => (
  <span className={`portal-process-pill ${toneClass[tone]} ${className}`} data-portal-pill-tone={tone}>
    {normalizeProcessNumber(value)}
  </span>
);
