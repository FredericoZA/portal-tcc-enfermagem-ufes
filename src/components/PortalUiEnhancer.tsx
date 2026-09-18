import { useEffect } from 'react';

const SEARCH_HINT = 'Buscar registros — pesquisa o conteúdo desta planilha';
const SYNC_HINT = 'Sincronizar dados — recarrega os registros desta planilha';
const SETTINGS_HINT = 'Configurar exibição — ajusta linhas, período, colunas e ordem';
const DOWNLOAD_HINT = 'Baixar dados — exporta o Repositório de TCCs em CSV';
const ACCENT = '#337959';
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
  try {
    const raw = window.sessionStorage.getItem('portal_tcc_identity_cache_v1');
    const parsed = raw ? JSON.parse(raw) : null;
    const roles = Array.isArray(parsed?.globalRoles) ? parsed.globalRoles.map(String) : [];
    const presidentOnly = roles.includes('COMMISSION_PRESIDENT') && !roles.includes('MASTER_ADMIN');
    if (presidentOnly) document.documentElement.dataset.portalSettingsRole = 'president-only';
    else delete document.documentElement.dataset.portalSettingsRole;
  } catch {
    delete document.documentElement.dataset.portalSettingsRole;
  }
}

function hideClosestEditorCard(node: HTMLElement | null) {
  if (!node) return;
  const card = node.closest<HTMLElement>('.rounded-xl, .rounded-2xl') || node.parentElement?.parentElement;
  if (card && !card.hasAttribute('role')) card.dataset.portalPersonalizationRemoved = 'true';
}

function pruneLegacyPersonalizationRows() {
  const title = document.getElementById('portal-customization-title');
  const dialog = title?.closest<HTMLElement>('[role="dialog"]');
  if (!dialog) return;

  title.classList.add('portal-customization-title-left');

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

  const loginDialog = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], div.fixed.inset-0')).find((node) =>
    normalizeLabel(node.textContent || '').includes('acesso ao portal do tcc') && Boolean(node.querySelector('input[type="email"]')),
  );
  if (!loginDialog) return;

  loginDialog.querySelectorAll<HTMLElement>('h1,h2,h3,p,span,div').forEach((node) => {
    const label = normalizeLabel(node.textContent || '');
    if (label === 'enfermagem e obstetricia ufes') node.dataset.portalLoginSubtitle = 'removed';
  });

  const email = loginDialog.querySelector<HTMLInputElement>('input[type="email"]');
  if (email) email.placeholder = 'nome@exemplo.com';

  const passwordlessTitle = Array.from(loginDialog.querySelectorAll<HTMLElement>('div,strong,h3')).find((node) => normalizeLabel(node.textContent || '') === 'acesso sem senha');
  const redundantCard = passwordlessTitle?.closest<HTMLElement>('.rounded-xl');
  if (redundantCard) redundantCard.dataset.portalLoginRedundant = 'true';

  const tipsTitle = Array.from(loginDialog.querySelectorAll<HTMLElement>('span,strong,div')).find((node) => normalizeLabel(node.textContent || '') === 'orientacoes para identificacao');
  const tipsBox = tipsTitle?.closest<HTMLElement>('.rounded-xl');
  if (tipsBox && !tipsBox.querySelector('.portal-login-access-note')) {
    const note = document.createElement('p');
    note.className = 'portal-login-access-note';
    note.innerHTML = '<strong>Como funciona o acesso:</strong> informe o e-mail cadastrado no Portal. Enviaremos um código de acesso de uso único para esse endereço.';
    const list = tipsBox.querySelector('ul');
    if (list) tipsBox.insertBefore(note, list);
    else tipsBox.appendChild(note);
  }
}

function pruneDuplicatedAdministrationForm() {
  document.querySelectorAll<HTMLElement>('.portal-admin-accounts-panel').forEach((node) => {
    node.dataset.portalLegacyAdministration = 'true';
  });
}

function normalizeSynchronizationHeadings() {
  document.querySelectorAll<HTMLElement>('h2,h3,h4,p').forEach((node) => {
    const label = normalizeLabel(node.textContent || '');
    if (label === 'secretaria presidencia e comissao') node.textContent = 'Sincronização do rodapé';
    if (label === 'e mail de acesso contato publico responsavel tecnico presidencia e integrantes adicionais em um unico cadastro visual') {
      node.textContent = 'Contatos institucionais e integrantes da comissão que alimentam o rodapé público do Portal.';
    }
  });
  const innerHeading = document.querySelector<HTMLElement>('.portal-commission-identity-panel #commission-management-title');
  if (innerHeading) innerHeading.textContent = 'Presidência, Secretaria e Comissão';
}

function findRepositoryToolbar(): HTMLElement | null {
  const heading = Array.from(document.querySelectorAll<HTMLElement>('h1, h2')).find((node) =>
    /reposit[oó]rio.*acervo|acervo.*reposit[oó]rio/i.test(node.textContent || ''),
  );
  if (!heading) return null;

  const header = heading.parentElement?.parentElement;
  const gear = header?.querySelector<HTMLButtonElement>('button[title*="Exibição da planilha"], button[aria-label^="Configurar exibição"]');
  if (!gear) return null;
  return gear.parentElement?.parentElement || null;
}

function enhanceToolbarButtons() {
  normalizeLegacyInlineAccents();
  markSettingsRole();
  pruneLegacyPersonalizationRows();
  clarifyLoginIdentityGuidance();
  pruneDuplicatedAdministrationForm();
  normalizeSynchronizationHeadings();

  document.querySelectorAll<HTMLButtonElement>('button[title^="Buscar"], button[aria-label^="Buscar registros"]').forEach((button) => setButtonHint(button, SEARCH_HINT));
  document.querySelectorAll<HTMLButtonElement>('button[title="Atualizar dados da tabela"], button[title*="Sincronizar"], button[aria-label^="Sincronizar dados"]').forEach((button) => setButtonHint(button, SYNC_HINT));
  document.querySelectorAll<HTMLButtonElement>('button[title*="Exibição da planilha"], button[aria-label^="Configurar exibição"]').forEach((button) => setButtonHint(button, SETTINGS_HINT));

  const source = document.querySelector<HTMLButtonElement>('button[title^="Exportar todo o banco de dados"], button[aria-label^="Baixar dados"]:not(.portal-repository-download-toolbar)');
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
  downloadButton.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>`;
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
      delete document.documentElement.dataset.portalSettingsRole;
    };
  }, []);

  return null;
}