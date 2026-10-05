import React from 'react';

export const PortalSectionDivider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div aria-hidden="true" className={`portal-section-divider shrink-0 ${className}`} />
);
