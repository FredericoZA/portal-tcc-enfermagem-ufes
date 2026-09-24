import React from 'react';

export const PortalSectionDivider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div aria-hidden="true" className={`portal-section-divider h-4 shrink-0 bg-white ${className}`} />
);
