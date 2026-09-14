import { useEffect } from 'react';

const SEARCH_HINT = 'Buscar registros — pesquisa o conteúdo desta planilha';
const SYNC_HINT = 'Sincronizar dados — recarrega os registros desta planilha';
const SETTINGS_HINT = 'Configurar exibição — ajusta linhas por página e período';
const DOWNLOAD_HINT = 'Baixar dados — exporta o Repositório de TCCs em CSV';

function setButtonHint(button: HTMLButtonElement | null, hint: string) {
  if (!button) return;
  button.title = hint;
  button.setAttribute('aria-label', hint);
}

function findRepositoryToolbar(): HTMLElement | null {
  const heading = Array.from(document.querySelectorAll<HTMLElement>('h1, h2')).find((node) =>
    /reposit[oó]rio.*acervo|acervo.*reposit[oó]rio/i.test(node.textContent || ''),
  );
  if (!heading) return null;

  const header = heading.parentElement?.parentElement;
  const gear = header?.querySelector<HTMLButtonElement>('button[title*="Exibição da planilha"]');
  if (!gear) return null;
  return gear.parentElement?.parentElement || null;
}

function enhanceToolbarButtons() {
  document.querySelectorAll<HTMLButtonElement>('button[title^="Buscar"], button[aria-label^="Buscar registros"]').forEach((button) =>
    setButtonHint(button, SEARCH_HINT),
  );

  document.querySelectorAll<HTMLButtonElement>('button[title="Atualizar dados da tabela"], button[title*="Sincronizar"]').forEach((button) =>
    setButtonHint(button, SYNC_HINT),
  );

  document.querySelectorAll<HTMLButtonElement>('button[title*="Exibição da planilha"]').forEach((button) =>
    setButtonHint(button, SETTINGS_HINT),
  );

  const source = document.querySelector<HTMLButtonElement>('button[title^="Exportar todo o banco de dados"]');
  if (!source) return;

  source.parentElement?.setAttribute('data-portal-download-source', 'true');
  setButtonHint(source, DOWNLOAD_HINT);

  const toolbar = findRepositoryToolbar();
  if (!toolbar || toolbar.querySelector('.portal-repository-download-toolbar')) return;

  const downloadButton = document.createElement('button');
  downloadButton.type = 'button';
  downloadButton.className = 'portal-repository-download-toolbar';
  downloadButton.title = DOWNLOAD_HINT;
  downloadButton.setAttribute('aria-label', DOWNLOAD_HINT);
  downloadButton.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" x2="12" y1="15" y2="3"></line>
    </svg>`;
  downloadButton.addEventListener('click', () => source.click());
  toolbar.appendChild(downloadButton);
}

export function PortalUiEnhancer() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(enhanceToolbarButtons);
    };

    enhanceToolbarButtons();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      document.querySelectorAll('.portal-repository-download-toolbar').forEach((node) => node.remove());
    };
  }, []);

  return null;
}
