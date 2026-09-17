import React, { useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenAppearance: (target: string) => void;
}

/**
 * Compatibilidade temporária para chamadas antigas.
 * O hub intermediário foi removido: a ação Personalização abre diretamente
 * o editor completo, que passa a ser a única superfície de configuração.
 */
export const PortalPersonalizationHubModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onOpenAppearance,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    onClose();
    onOpenAppearance('quick_presets');
  }, [isOpen, onClose, onOpenAppearance]);

  return null;
};