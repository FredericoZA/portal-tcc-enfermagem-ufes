import { useEffect } from 'react';

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
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

      if (title.includes('integracoes e plataforma')) {
        workspace.dataset.portalSettingsPane = 'integrations';
        workspace.dataset.portalFullBleed = 'true';
        makeWorkspaceDirect(workspace);
        return;
      }

      if (title.includes('rodape e identidade')) {
        workspace.dataset.portalSettingsPane = 'identity';
        workspace.dataset.portalFullBleed = 'false';
        return;
      }

      if (title.includes('modelos e variaveis')) {
        workspace.dataset.portalSettingsModels = 'true';
      }
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(configureWorkspace);
    };

    configureWorkspace();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
