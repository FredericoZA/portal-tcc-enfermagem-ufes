import { useEffect } from 'react';

const SEARCH_HINT = 'Buscar registros — pesquisa o conteúdo desta planilha';
const SYNC_HINT = 'Sincronizar dados — recarrega os registros desta planilha';
const SETTINGS_HINT = 'Configurar exibição — ajusta linhas por página e período';
const ACCENT = 'var(--portal-brand-action)';
const LEGACY_ACCENTS = new Set(['#47866a', 'rgb(71, 134, 106)']);
const LEGACY_PERSONALIZATION_LABELS = new Set([
  'temas prontos 1 clique',
  'botoes no topo',
  'estilo base das planilhas',
  'colunas ordem e linhas',
  'estilo base pop ups',
  'analise hipoar',
  'solicitacao de correcao',
]);

function normalizeLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function readGlobalRoles(): string[] {
  try {
    const raw = window.sessionStorage.getItem('portal_tcc_identity_cache_v1');
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.globalRoles) ? parsed.globalRoles.map(String) : [];
  } catch {
    return [];
  }
}

function setButtonHint(button: HTMLButtonElement | null, hint: string) {
  if (!button) return;
  button.title = hint;
  button.setAttribute('aria-label', hint);
}

function normalizeLegacyInlineAccents() {
  document.querySelectorAll<HTMLElement>('[style]').forEach((node) => {
    if (LEGACY_ACCENTS.has(node.style.backgroundColor.toLowerCase())) node.style.backgroundColor = ACCENT;
    if (LEGACY_ACCENTS.has(node.style.borderColor.toLowerCase())) node.style.borderColor = ACCENT;
    if (LEGACY_ACCENTS.has(node.style.color.toLowerCase())) node.style.color = ACCENT;
  });
}

function markSettingsRole() {
  const roles = readGlobalRoles();
  const presidentOnly = roles.includes('COMMISSION_PRESIDENT') && !roles.includes('MASTER_ADMIN');
  if (presidentOnly) document.documentElement.dataset.portalSettingsRole = 'president-only';
  else delete document.documentElement.dataset.portalSettingsRole;
}

function hideClosestEditorCard(node: HTMLElement | null) {
  if (!node) return;
  const card = node.closest<HTMLElement>('.rounded-xl, .rounded-2xl') || node.parentElement?.parentElement;
  if (card && !card.hasAttribute('role')) card.dataset.portalPersonalizationRemoved = 'true';
}

function pruneLegacyPersonalizationRows() {
  const title = document.getElementById('portal-customization-title');
  const dialog = title?.closest<HTMLElement>('[role="dialog"]');
  if (!dialog || !title) return;

  title.classList.add('portal-customization-title-left');
  const header = title.parentElement?.parentElement?.parentElement as HTMLElement | null;
  if (header) {
    header.classList.add('portal-customization-header');
    const firstSvg = header.querySelector<SVGElement>('svg');
    const iconShell = firstSvg?.parentElement;
    if (iconShell && iconShell.tagName === 'DIV') iconShell.classList.add('portal-customization-icon-shell');
    header.querySelectorAll<HTMLButtonElement>('button').forEach((button) => button.classList.add('portal-customization-top-action'));
  }

  dialog.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    const label = normalizeLabel(button.textContent || '');
    if (LEGACY_PERSONALIZATION_LABELS.has(label)) {
      const row = button.parentElement;
      if (row) row.dataset.portalPersonalizationRemoved = 'true';
      else button.dataset.portalPersonalizationRemoved = 'true';
      return;
    }
    if (label === 'publicar no portal' || label === 'restaurar padrao') {
      button.classList.add('portal-customization-top-action');
    }
  });

  dialog.querySelectorAll<HTMLElement>('h1,h2,h3,h4,span,p').forEach((node) => {
    const label = normalizeLabel(node.textContent || '');
    if (label === 'configuracao global do portal site todo') hideClosestEditorCard(node);
    if (label === 'exemplo ao vivo do portal preview em tempo real') hideClosestEditorCard(node);
  });
}

function clarifyLoginIdentityGuidance() {
  document.querySelectorAll<HTMLElement>('strong,label').forEach((node) => {
    const label = normalizeLabel(node.textContent || '');
    if (label === 'docentes e banca') node.textContent = 'Demais usuários:';
    if (label === 'orientacao docentes banca') node.textContent = 'Orientação dos demais usuários:';
  });
}

function pruneDuplicatedAdministrationForm() {
  document.querySelectorAll<HTMLElement>('.portal-admin-accounts-panel').forEach((node) => {
    node.dataset.portalLegacyAdministration = 'true';
  });
}

function createWorkspaceSidebar(section: HTMLElement, kind: 'sync' | 'models') {
  let sidebar = section.querySelector<HTMLElement>(':scope > .portal-settings-workspace-sidebar');
  if (sidebar) return sidebar;

  sidebar = document.createElement('aside');
  sidebar.className = 'portal-settings-workspace-sidebar';
  const title = document.createElement('strong');
  title.className = 'portal-settings-workspace-sidebar-title';
  title.textContent = kind === 'sync' ? 'Sincronização e acessos' : 'Modelos e variáveis';
  sidebar.appendChild(title);

  const nav = document.createElement('nav');
  nav.className = 'portal-settings-workspace-nav';
  nav.setAttribute('aria-label', title.textContent);
  const items = kind === 'sync'
    ? [
        ['identity', '👥', 'Administração'],
        ['integrations', '🔗', 'Integrações'],
        ['access', '🔐', 'Acessos'],
      ]
    : [
        ['catalog', '📄', 'Catálogo DOCX'],
        ['documents', '📝', 'Documentos'],
        ['emails', '✉️', 'E-mails'],
        ['forms', '📋', 'Formulários'],
        ['workflow', '🔀', 'Fluxo'],
        ['variables', '🔣', 'Variáveis'],
      ];

  items.forEach(([id, emoji, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.workspaceTab = id;
    button.innerHTML = `<span aria-hidden="true">${emoji}</span><span>${label}</span>`;
    button.addEventListener('click', () => {
      if (kind === 'sync') {
        section.dataset.portalSyncTab = id;
      } else {
        section.dataset.portalModelTab = id;
        if (id !== 'catalog') {
          const studio = section.querySelector<HTMLElement>('.portal-studio');
          const target = Array.from(studio?.querySelectorAll<HTMLButtonElement>('button') || []).find((candidate) => normalizeLabel(candidate.textContent || '') === normalizeLabel(label));
          target?.click();
        }
      }
      sidebar?.querySelectorAll<HTMLButtonElement>('button[data-workspace-tab]').forEach((candidate) => {
        candidate.dataset.active = candidate.dataset.workspaceTab === id ? 'true' : 'false';
      });
    });
    nav.appendChild(button);
  });
  sidebar.appendChild(nav);
  section.appendChild(sidebar);
  return sidebar;
}

function ensureWorkspaceClose(section: HTMLElement) {
  let close = section.querySelector<HTMLButtonElement>(':scope > .portal-settings-workspace-close');
  if (close) return;
  close = document.createElement('button');
  close.type = 'button';
  close.className = 'portal-settings-workspace-close';
  close.innerHTML = '<span aria-hidden="true">✕</span><span>Fechar</span>';
  close.addEventListener('click', () => (section.querySelector(':scope > button:first-child') as HTMLButtonElement | null)?.click());
  section.appendChild(close);
}

function enhanceSettingsWorkspace(sectionId: string, kind: 'sync' | 'models') {
  const section = document.getElementById(sectionId);
  if (!section) return false;
  const content = Array.from(section.children).find((child) => child.tagName === 'DIV' && !child.classList.contains('portal-settings-workspace-sidebar')) as HTMLElement | undefined;
  if (!content) {
    delete section.dataset.portalWorkspaceOpen;
    section.querySelector(':scope > .portal-settings-workspace-sidebar')?.remove();
    section.querySelector(':scope > .portal-settings-workspace-close')?.remove();
    return false;
  }

  section.dataset.portalWorkspaceOpen = 'true';
  if (kind === 'sync' && !section.dataset.portalSyncTab) section.dataset.portalSyncTab = 'identity';
  if (kind === 'models' && !section.dataset.portalModelTab) section.dataset.portalModelTab = 'catalog';
  const sidebar = createWorkspaceSidebar(section, kind);
  ensureWorkspaceClose(section);

  const active = kind === 'sync' ? section.dataset.portalSyncTab : section.dataset.portalModelTab;
  sidebar.querySelectorAll<HTMLButtonElement>('button[data-workspace-tab]').forEach((button) => {
    button.dataset.active = button.dataset.workspaceTab === active ? 'true' : 'false';
  });

  if (kind === 'models') {
    const studio = section.querySelector<HTMLElement>('.portal-studio');
    const strip = studio?.firstElementChild?.querySelector<HTMLElement>('.grid');
    strip?.classList.add('portal-studio-tab-strip');
  }
  return true;
}

function enhanceSettingsWorkspaces() {
  const syncOpen = enhanceSettingsWorkspace('google-workspace-sync-section', 'sync');
  const modelsOpen = enhanceSettingsWorkspace('master-flow-system-section', 'models');
  const anyOpen = syncOpen || modelsOpen;
  let backdrop = document.querySelector<HTMLElement>('.portal-settings-workspace-backdrop');
  if (anyOpen && !backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'portal-settings-workspace-backdrop';
    backdrop.addEventListener('click', () => {
      const openSection = document.querySelector<HTMLElement>('[data-portal-workspace-open="true"]');
      (openSection?.querySelector(':scope > button:first-child') as HTMLButtonElement | null)?.click();
    });
    document.body.appendChild(backdrop);
  }
  if (!anyOpen) backdrop?.remove();
  document.body.classList.toggle('portal-settings-workspace-lock', anyOpen);
}

function enhanceToolbarButtons() {
  normalizeLegacyInlineAccents();
  markSettingsRole();
  pruneLegacyPersonalizationRows();
  clarifyLoginIdentityGuidance();
  pruneDuplicatedAdministrationForm();
  enhanceSettingsWorkspaces();

  document.querySelectorAll<HTMLButtonElement>('button[title^="Buscar"], button[aria-label^="Buscar registros"]').forEach((button) =>
    setButtonHint(button, SEARCH_HINT),
  );

  document.querySelectorAll<HTMLButtonElement>('button[title="Atualizar dados da tabela"], button[title*="Sincronizar"], button[aria-label^="Sincronizar dados"]').forEach((button) =>
    setButtonHint(button, SYNC_HINT),
  );

  document.querySelectorAll<HTMLButtonElement>('button[title*="Exibição da planilha"], button[aria-label^="Configurar exibição"]').forEach((button) =>
    setButtonHint(button, SETTINGS_HINT),
  );
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
      document.querySelectorAll('.portal-settings-workspace-backdrop').forEach((node) => node.remove());
      document.body.classList.remove('portal-settings-workspace-lock');
      delete document.documentElement.dataset.portalSettingsRole;
    };
  }, []);

  return null;
}
