import React from 'react';

export function OilLampIcon({size = 64.8, className = ''}: {size?: number; className?: string}) {
  return (
    <svg viewBox="0 0 160 86" width={size} height={size} role="img" aria-label="Lâmpada de enfermagem" className={`shrink-0 ${className}`}>
      <g fill="#e8f3ed">
        <path fillRule="evenodd" d="M24 50C8 59 3 52 6 38C11 17 24 9 44 17C63 25 78 42 103 42C122 42 141 32 156 17C140 38 122 49 99 47L91 46C88 59 103 69 121 72C131 74 124 77 113 78C95 81 72 80 56 77C46 75 44 73 55 70C70 67 79 57 79 44C65 37 57 26 44 21C28 14 18 21 12 33C6 46 7 56 24 50ZM85 48C84 57 81 64 76 69C84 71 92 71 99 69C93 62 89 55 88 48Z"/>
        <path d="M35 7C60 15 95 24 105 16C110 12 110 6 110 1C115 18 107 25 90 24C69 23 49 14 35 7Z"/>
        <path d="M57 13C67 1 78 0 89 4C94 6 99 10 102 15C87 4 72 4 57 13Z"/>
        <path d="M48 21C77 32 114 38 138 26C126 41 99 39 76 31Z"/>
      </g>
    </svg>
  );
}
