import React, { useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenAppearance: (target: string) => void;
}

/**
 * Compatibilidade temporária para chamadas antigas.
 * A personalização agora abre diretamente na primeira tela real do Portal,
 * evitando a antiga configuração geral/tema pronto e mantendo o fluxo tela a tela.
 */
export const PortalPersonalizationHubModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onOpenAppearance,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    onClose();
    onOpenAppearance('site_header');
  }, [isOpen, onClose, onOpenAppearance]);

  return null;
};