import React from 'react';

/** Lâmpada a óleo decorativa: identifica a navegação sem usar a marca do colegiado. */
export function OilLampIcon({size = 64.8, className = ''}: {size?: number; className?: string}) {
  return (
    <svg viewBox="0 0 72 64" width={size} height={size} role="img" aria-label="Lâmpada do Aladdin" className={`shrink-0 ${className}`}>
      <g stroke="#e8f3ed" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M51 30c3-9 16-9 16-1 0 7-9 11-15 9" fill="none" />
        <path d="M8 28c8 1 10 5 18 6l27-1c0 11-10 16-20 16-10 0-15-6-18-11L5 31c-2-2-1-4 3-3Z" fill="#8cb1a3" />
        <path d="M23 32c1-6 23-8 29 0" fill="#8cb1a3" />
        <path d="M28 27c2-4 13-4 16 0M36 24v-3" fill="none" />
        <path d="M29 49v5l-7 4h28l-8-4v-5" fill="#8cb1a3" />
        <path d="M10 22c-5-5 6-7 1-13M18 22c-5-5 6-8 1-15" fill="none" opacity=".8" />
      </g>
    </svg>
  );
}
