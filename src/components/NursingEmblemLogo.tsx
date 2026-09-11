import React, { useState } from 'react';

interface NursingEmblemLogoProps {
  className?: string;
  size?: number;
  customSrc?: string;
}

export const NursingEmblemLogo: React.FC<NursingEmblemLogoProps> = ({ className = '', size = 56, customSrc }) => {
  const [imgError, setImgError] = useState<boolean>(false);
  const logoSrc = customSrc;

  if (!logoSrc || imgError) {
    return (
      <div
        style={{ width: `${size}px`, height: `${size}px` }}
        className={`rounded-xl bg-[#033628] border border-[#7bc394]/30 flex items-center justify-center font-black text-white text-xs shrink-0 shadow-sm ${className}`}
      >
        TCC
      </div>
    );
  }

  return (
    <img
      src={logoSrc}
      alt="Logo institucional configurado"
      width={size}
      height={size}
      style={{ width: `${size}px`, height: `${size}px` }}
      onError={() => setImgError(true)}
      className={`object-contain shrink-0 rounded-md transition-transform duration-200 hover:scale-105 ${className}`}
    />
  );
};



