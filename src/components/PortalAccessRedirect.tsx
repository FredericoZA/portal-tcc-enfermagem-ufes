import {readProcessLink} from '../utils/processLink';
import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Mantém somente a regra funcional de entrada pós-autenticação.
 * Aparência e conteúdo pertencem aos componentes que os renderizam;
 * este componente não lê nem modifica o DOM.
 */
export const PortalAccessRedirect: React.FC = () => {
  const { isAuthenticated, userEmail, globalRoles, isLoading } = useAuth();
  const redirectedForRef = useRef('');

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !userEmail) {
      // Expiration closes restricted workspaces instead of leaving an empty
      // administrative route. Clear the key so the same user can enter again.
      if (redirectedForRef.current) {
        redirectedForRef.current = '';
        window.dispatchEvent(new CustomEvent('portal:navigate', { detail: 'home' }));
      }
      return;
    }

    const identityKey = `${userEmail.toLowerCase()}|${globalRoles.slice().sort().join(',')}`;
    if (redirectedForRef.current === identityKey) return;
    redirectedForRef.current = identityKey;

    if(readProcessLink(window.location.search))return;
    const destination = globalRoles.includes('MASTER_ADMIN')
      ? 'configuracoes'
      : globalRoles.includes('COMMISSION_PRESIDENT')
        ? 'coordenador'
        : 'meus-processos';

    window.dispatchEvent(new CustomEvent('portal:navigate', { detail: destination }));
  }, [globalRoles, isAuthenticated, isLoading, userEmail]);

  return null;
};
