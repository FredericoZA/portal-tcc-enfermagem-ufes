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

function makeWorkspaceDirect(workspace: HTMLElement) {
  const aside = workspace.querySelector<HTMLElement>('aside');
  if (aside) aside.style.setProperty('display', 'none', 'important');
  const main = workspace.querySelector<HTMLElement>('.portal-settings-workspace-main');
  if (main) {
    main.style.setProperty('padding', '0', 'important');
    main.style.setProperty('width', '100%', 'important');
    main.style.setProperty('max-width', '100%', 'important');
  }
  const content = workspace.querySelector<HTMLElement>('.portal-settings-workspace-content');
  if (content) {
    content.style.setProperty('width', '100%', 'important');
    content.style.setProperty('height', '100%', 'important');
    content.style.setProperty('min-height', '100%', 'important');
    content.style.setProperty('border-radius', '0', 'important');
  }
}

export function PortalSettingsRuntime() {
  useEffect(() => {
    let frame = 0;
    let desiredSyncPane: 'identity' | 'integrations' = 'identity';
    let openingAlias = false;

    const enhanceHub = () => {
      const hub = document.getElementById('portal-settings-hub');
      if (!hub) return;

      let identity = hub.querySelector<HTMLButtonElement>('button[data-portal-settings-identity="true"]');
      if (!identity) {
        identity = Array.from(hub.querySelectorAll<HTMLButtonElement>('button.portal-settings-title-bar')).find((button) => normalize(button.textContent || '').includes('sincronizacao')) || null;
        if (identity) {
          identity.dataset.portalSettingsIdentity = 'true';
          identity.addEventListener('click', () => {
            if (!openingAlias) desiredSyncPane = 'identity';
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
        replaceText(integrations, /Responsáveis, contatos, rodapé e identidade operacional\./gi, 'Asten, Google, Supabase, Vercel e serviços operacionais do Portal.');
        integrations.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          desiredSyncPane = 'integrations';
          openingAlias = true;
          identity!.click();
          openingAlias = false;
          desiredSyncPane = 'integrations';
          window.setTimeout(configureWorkspace, 0);
          window.setTimeout(configureWorkspace, 40);
          window.setTimeout(configureWorkspace, 120);
        });
        identity.insertAdjacentElement('afterend', integrations);
      }
    };

    const configureWorkspace = () => {
      const workspace = document.querySelector<HTMLElement>('.portal-settings-workspace');
      if (!workspace) return;
      const heading = workspace.querySelector<HTMLElement>('.portal-settings-workspace-header h2');
      const title = normalize(heading?.textContent || '');
      workspace.removeAttribute('data-portal-sheet-mode');
      workspace.removeAttribute('data-portal-settings-pane');
      workspace.removeAttribute('data-portal-settings-models');

      if (title.includes('acesso')) {
        workspace.dataset.portalSheetMode = 'access';
        workspace.dataset.portalFullBleed = 'true';
        makeWorkspaceDirect(workspace);
        return;
      }
      if (title.includes('registros de assinatura')) {
        workspace.dataset.portalSheetMode = 'signatures';
        workspace.dataset.portalFullBleed = 'true';
        makeWorkspaceDirect(workspace);
        return;
      }
      if (title.includes('registro de logs')) {
        workspace.dataset.portalSheetMode = 'logs';
        workspace.dataset.portalFullBleed = 'true';
        makeWorkspaceDirect(workspace);
        return;
      }
      if (title.includes('modelos e variaveis')) {
        workspace.dataset.portalSettingsModels = 'true';
        return;
      }

      const navButtons = Array.from(workspace.querySelectorAll<HTMLButtonElement>('aside button'));
      const syncWorkspace = title.includes('sincronizacao')
        || title.includes('rodape e identidade')
        || title.includes('integracoes e plataforma')
        || navButtons.some((button) => normalize(button.textContent || '').includes('rodape e identidade'));
      if (!syncWorkspace) return;

      workspace.dataset.portalSettingsPane = desiredSyncPane;
      workspace.dataset.portalFullBleed = desiredSyncPane === 'integrations' ? 'true' : 'false';
      const wanted = navButtons.find((button) => {
        const label = normalize(button.textContent || '');
        return desiredSyncPane === 'identity'
          ? label.includes('rodape e identidade')
          : label.includes('integracoes e plataformas');
      });
      if (wanted) {
        const selected = wanted.classList.contains('text-white') || wanted.getAttribute('aria-selected') === 'true';
        if (!selected) wanted.click();
      }
      makeWorkspaceDirect(workspace);
      if (heading) heading.textContent = desiredSyncPane === 'identity' ? 'Rodapé e Identidade' : 'Integrações e Plataforma';
    };

    const enhanceAll = () => {
      enhanceHub();
      configureWorkspace();
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(enhanceAll);
    };

    enhanceAll();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
