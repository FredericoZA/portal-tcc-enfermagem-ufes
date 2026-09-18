import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

function findByText(selector: string, text: string): HTMLElement | null {
  const expected = normalize(text);
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find((element) => normalize(element.textContent || '') === expected) || null;
}

function markContainingPanel(text: string, marker: string) {
  const title = findByText('h1,h2,h3,h4,span,strong,div', text);
  if (!title) return;
  const panel = title.closest<HTMLElement>('section,article,[role="dialog"],.rounded-xl,.rounded-2xl') || title.parentElement;
  if (panel) panel.dataset.portalFeedbackSection = marker;
}

function refineLoginModal() {
  const heading = findByText('h1,h2,h3', 'Acesso ao Portal do TCC');
  if (!heading) return;
  const dialog = heading.closest<HTMLElement>('[role="dialog"]') || heading.closest<HTMLElement>('.fixed')?.querySelector<HTMLElement>('.bg-white') || heading.parentElement?.parentElement?.parentElement;
  if (!dialog) return;
  dialog.dataset.portalFeedbackLogin = 'true';

  const headerTextBlock = heading.parentElement;
  const subtitle = headerTextBlock?.querySelector<HTMLElement>('p');
  if (subtitle) subtitle.style.display = 'none';

  const emailInput = dialog.querySelector<HTMLInputElement>('input[type="email"]');
  if (emailInput) emailInput.placeholder = 'nome@exemplo.com';

  const passwordlessTitle = findByText('div,strong,span', 'Acesso sem senha');
  const passwordlessBox = passwordlessTitle?.closest<HTMLElement>('.rounded-xl');
  if (passwordlessBox && dialog.contains(passwordlessBox)) passwordlessBox.style.display = 'none';

  const tipsTitle = findByText('span,strong,div', 'Orientações para identificação:');
  const tipsBox = tipsTitle?.closest<HTMLElement>('.rounded-xl');
  if (tipsBox && dialog.contains(tipsBox)) {
    tipsBox.dataset.portalLoginTips = 'true';
    const list = tipsBox.querySelector('ul');
    if (list) {
      list.innerHTML = `
        <li><strong>Como funciona o acesso:</strong> informe o e-mail cadastrado no Portal. Enviaremos um código de acesso de uso único para esse endereço.</li>
        <li><strong>Discentes:</strong> utilize seu e-mail institucional @edu.ufes.br.</li>
        <li><strong>Demais usuários:</strong> docentes, integrantes de banca e demais usuários devem utilizar exatamente o e-mail cadastrado no Portal, que pode ser institucional ou pessoal.</li>`;
    }
  }
}

function markAdministrativeHierarchy() {
  markContainingPanel('SINCRONIZAÇÃO E ACESSOS', 'sync-root');
  markContainingPanel('SECRETARIA, PRESIDÊNCIA E COMISSÃO', 'sync-footer');
  markContainingPanel('INTEGRAÇÕES DA PLATAFORMA', 'sync-integrations');
  markContainingPanel('AUTORIZAÇÃO DE ACESSO', 'sync-access');
  markContainingPanel('MEMBROS DA COMISSÃO', 'sync-members');
  markContainingPanel('MODELOS E VARIÁVEIS', 'models-root');
  markContainingPanel('Modelos documentais do usuário Master', 'models-catalog');

  const personalizationTitle = findByText('h1,h2,h3,div,span', 'PERSONALIZAÇÃO DO PORTAL DO TCC');
  const personalizationDialog = personalizationTitle?.closest<HTMLElement>('[role="dialog"]') || personalizationTitle?.closest<HTMLElement>('.fixed')?.querySelector<HTMLElement>('[class*="rounded"]');
  if (personalizationDialog) personalizationDialog.dataset.portalFeedbackPersonalization = 'true';

  document.querySelectorAll<HTMLElement>('button').forEach((button) => {
    const title = normalize(button.getAttribute('title') || '');
    const aria = normalize(button.getAttribute('aria-label') || '');
    if (title.includes('excluir') || title.includes('remover') || aria.includes('excluir') || aria.includes('remover')) {
      button.dataset.portalDestructiveAction = 'true';
    }
  });
}

export const PortalFeedbackController: React.FC = () => {
  const { isAuthenticated, userEmail, globalRoles, isLoading } = useAuth();
  const redirectedForRef = useRef('');

  useEffect(() => {
    if (isLoading || !isAuthenticated || !userEmail) return;
    const identityKey = `${userEmail.toLowerCase()}|${globalRoles.slice().sort().join(',')}`;
    if (redirectedForRef.current === identityKey) return;
    redirectedForRef.current = identityKey;

    const destination = globalRoles.includes('MASTER_ADMIN')
      ? 'configuracoes'
      : globalRoles.includes('COMMISSION_PRESIDENT')
        ? 'coordenador'
        : 'meus-processos';
    window.dispatchEvent(new CustomEvent('portal:navigate', { detail: destination }));
  }, [isAuthenticated, userEmail, globalRoles, isLoading]);

  useEffect(() => {
    const apply = () => {
      refineLoginModal();
      markAdministrativeHierarchy();
    };
    apply();
    const observer = new MutationObserver(() => window.requestAnimationFrame(apply));
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, []);

  return null;
};
