import { useEffect } from 'react';

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function replaceText(node: HTMLElement, from: RegExp, to: string) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) texts.push(current as Text);
  texts.forEach((text) => {
    from.lastIndex = 0;
    const next = text.data.replace(from, to);
    if (next !== text.data) text.data = next;
  });
}

function requestPane(pane: 'identity' | 'integrations') {
  document.documentElement.dataset.portalSettingsRequestedPane = pane;
  const dispatch = () => window.dispatchEvent(new CustomEvent('portal-settings-open-pane', { detail: { pane } }));
  dispatch();
  window.setTimeout(dispatch, 0);
  window.setTimeout(dispatch, 80);
  window.setTimeout(dispatch, 180);
}

export function PortalSettingsRuntime() {
  useEffect(() => {
    let frame = 0;
    let openingIntegrationAlias = false;

    const enhanceHub = () => {
      const hub = document.getElementById('portal-settings-hub');
      if (!hub) return;

      let identity = hub.querySelector<HTMLButtonElement>('button[data-portal-settings-identity="true"]');
      if (!identity) {
        identity = Array.from(hub.querySelectorAll<HTMLButtonElement>('button.portal-settings-title-bar')).find((button) => normalize(button.textContent || '').includes('sincronizacao')) || null;
        if (identity) {
          identity.dataset.portalSettingsIdentity = 'true';
          identity.addEventListener('click', () => {
            if (!openingIntegrationAlias) requestPane('identity');
          });
        }
      }
      if (!identity) return;

      replaceText(identity, /Sincronização/gi, 'Rodapé e Identidade');
      replaceText(identity, /Rodapé, Asten, Google, Supabase, Vercel e demais integrações\./gi, 'Responsáveis, contatos, rodapé e identidade operacional.');

      let integrations = hub.querySelector<HTMLButtonElement>('button[data-portal-settings-integrations="true"]');
      if (!integrations) {
        integrations = identity.cloneNode(true) as HTMLButtonElement;
        integrations.removeAttribute('id');
        integrations.dataset.portalSettingsIdentity = 'false';
        integrations.dataset.portalSettingsIntegrations = 'true';
        replaceText(integrations, /Rodapé e Identidade/gi, 'Integrações e Plataforma');
        replaceText(integrations, /Responsáveis, contatos, rodapé e identidade operacional\./gi, 'Asten, Google, Supabase, Vercel e demais integrações da plataforma.');
        integrations.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          requestPane('integrations');
          openingIntegrationAlias = true;
          identity!.click();
          openingIntegrationAlias = false;
          requestPane('integrations');
        });
        identity.insertAdjacentElement('afterend', integrations);
      }
    };

    const applyRequestedPane = () => {
      const requested = document.documentElement.dataset.portalSettingsRequestedPane;
      if (requested !== 'identity' && requested !== 'integrations') return;
      const workspace = document.querySelector<HTMLElement>('.portal-settings-workspace');
      if (!workspace) return;
      requestPane(requested);
    };

    const enhanceAll = () => {
      enhanceHub();
      applyRequestedPane();
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(enhanceAll);
    };

    enhanceAll();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
