import React, { useEffect, useState } from 'react';

interface NursingEmblemLogoProps {
  className?: string;
  size?: number;
  customSrc?: string;
}

export const NursingEmblemLogo: React.FC<NursingEmblemLogoProps> = ({ className = '', size = 56, customSrc }) => {
  const logoSrc = customSrc || '/ufes-crest.png';
  const [imgError, setImgError] = useState<boolean>(false);

  useEffect(() => setImgError(false), [logoSrc]);

  if (imgError) {
    return (
      <div
        style={{ width: `${size}px`, height: `${size}px` }}
        className={`flex items-center justify-center font-black text-[#b9ead0] text-xs shrink-0 ${className}`}
        aria-label="Portal TCC Enfermagem UFES"
      >
        TCC
      </div>
    );
  }

  return (
    <img
      src={logoSrc}
      alt="Brasão da Universidade Federal do Espírito Santo"
      width={size}
      height={size}
      style={{ width: `${size}px`, height: `${size}px` }}
      onError={() => setImgError(true)}
      className={`rounded-full object-contain shrink-0 bg-white p-0.5 transition-transform duration-200 hover:scale-105 ${className}`}
    />
  );
};
