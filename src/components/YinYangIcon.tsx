import React from 'react';

export const YinYangIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a5 5 0 0 0 0 10 5 5 0 0 1 0 10" />
    <circle cx="12" cy="7" r="1.2" fill="currentColor" />
    <circle cx="12" cy="17" r="1.2" fill="currentColor" />
  </svg>
);
