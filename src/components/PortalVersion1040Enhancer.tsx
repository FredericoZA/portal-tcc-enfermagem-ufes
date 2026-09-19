import { useEffect } from 'react';

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
}

function rootModal(node: HTMLElement) {
  let current: HTMLElement = node;
  while (current.parentElement && current.parentElement !== document.body) current = current.parentElement;
  return current.parentElement === document.body ? current : null;
}

function keepPortalDialogsAboveWorkspaces() {
  document.querySelectorAll<HTMLElement>('[role="dialog"]').forEach((dialog) => {
    const root = rootModal(dialog);
    if (root && !root.closest('[data-portal-workspace-open="true"]')) root.style.zIndex = '1000030';
  });
}

function configureSyncWorkspace() {
  const section = document.getElementById('google-workspace-sync-section');
  if (!section || section.dataset.portalWorkspaceOpen !== 'true') return;

  const sidebar = section.querySelector<HTMLElement>('.portal-settings-workspace-sidebar');
  sidebar?.querySelector<HTMLElement>('.portal-settings-workspace-sidebar-title')?.setAttribute('hidden', 'true');
  const labels: Record<string, string> = { identity: 'Rodapé', integrations: 'Integrações da Plataforma', access: 'Autorização de Acesso' };
  sidebar?.querySelectorAll<HTMLButtonElement>('button[data-workspace-tab]').forEach((button) => {
    const label = labels[button.dataset.workspaceTab || ''];
    const text = button.querySelectorAll('span')[1];
    if (label && text && text.textContent !== label) text.textContent = label;
  });

  const toggle = section.querySelector<HTMLButtonElement>(':scope > button:first-child');
  toggle?.querySelectorAll<HTMLElement>('span,small,div').forEach((node) => {
    if (normalize(node.textContent || '') === 'recolher' && node.children.length === 0) node.style.display = 'none';
  });

  const adminPanel = section.querySelector<HTMLElement>('#administrative-identity-panel');
  if (adminPanel) adminPanel.dataset.portal1040AdminPanel = 'true';

  const commission = section.querySelector<HTMLElement>('.portal-commission-identity-panel');
  if (commission) {
    const originalAdd = Array.from(commission.querySelectorAll<HTMLButtonElement>('button')).find((button) => normalize(button.textContent || '') === 'adicionar membro');
    if (originalAdd) originalAdd.dataset.portal1040OriginalAddMember = 'true';
    const membersTitle = Array.from(commission.querySelectorAll<HTMLElement>('h4')).find((node) => normalize(node.textContent || '') === 'membros da comissao');
    const membersToolbar = membersTitle?.parentElement;
    if (originalAdd && membersToolbar && !membersToolbar.querySelector('.portal1040-add-member')) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'portal1040-add-member';
      add.textContent = 'Adicionar membro';
      add.addEventListener('click', () => originalAdd.click());
      membersToolbar.appendChild(add);
    }
  }

  const access = section.querySelector<HTMLElement>('#authorized-access-panel');
  if (access) access.dataset.portal1040AccessPanel = 'true';
}

function renameSignatureRegistry() {
  const button = document.getElementById('nav-item-asten-logs');
  if (button) {
    const label = button.querySelector('div span:last-child');
    if (label && label.textContent !== 'Registros de Assinatura') label.textContent = 'Registros de Assinatura';
    button.setAttribute('title', 'Fila e histórico de assinaturas');
    button.setAttribute('aria-label', 'Fila e histórico de assinaturas');
  }
  const header = document.getElementById('portal-header');
  header?.querySelectorAll<HTMLElement>('h1,h2,h3,span').forEach((node) => {
    if (normalize(node.textContent || '') === 'registros da asten' && node.children.length === 0) node.textContent = 'Registros de Assinatura';
  });
}

function placeSpreadsheetControls() {
  document.querySelectorAll<HTMLTableElement>('.portal-spreadsheet-table').forEach((table) => {
    table.querySelectorAll<HTMLTableCellElement>('thead th').forEach((th) => {
      const controls = th.querySelector<HTMLElement>('.portal-column-controls');
      if (!controls) return;
      th.dataset.portal1040Header = 'true';
      const sort = controls.querySelector<HTMLButtonElement>('.portal-column-sort');
      if (sort && !sort.classList.contains('portal1040-inline-sort')) {
        sort.classList.add('portal1040-inline-sort');
        controls.insertAdjacentElement('beforebegin', sort);
      }
      const filter = controls.querySelector<HTMLButtonElement>('.portal-column-filter');
      if (filter) filter.classList.add('portal1040-corner-filter');
    });
  });
}

function classifyGreenBands() {
  const pages = [document.getElementById('meus-processos-page-container'), document.getElementById('coordenador-page-root'), document.getElementById('audit-logs-page'), document.querySelector<HTMLElement>('[data-portal-signature-logs="true"]')].filter(Boolean) as HTMLElement[];
  pages.forEach((page) => page.dataset.portal1040SheetBands = 'true');
  document.querySelectorAll<HTMLElement>('.portal-defense-filter-row,.portal-meus-processos-filter-row,.portal-coordinator-filter-row').forEach((row) => row.dataset.portal1040FilterBand = 'true');
}

let calendarCache: any[] | null = null;
let calendarLoading = false;
async function enrichCalendarPreview() {
  const previews = Array.from(document.querySelectorAll<HTMLElement>('.portal-calendar-preview'));
  if (!previews.length) return;
  if (!calendarCache && !calendarLoading) {
    calendarLoading = true;
    try {
      const response = await fetch('/api/processes', { credentials: 'include', headers: { Accept: 'application/json' } });
      if (response.ok) { const payload = await response.json(); calendarCache = Array.isArray(payload) ? payload : []; }
    } catch { calendarCache = []; }
    finally { calendarLoading = false; }
  }
  if (!calendarCache) return;
  previews.forEach((preview) => {
    if (preview.querySelector('.portal1040-calendar-extra')) return;
    const title = normalize(preview.querySelector('strong')?.textContent || '');
    const process = calendarCache?.find((item) => normalize(String(item?.titulo || '')) === title);
    const student = String(process?.aluno1?.nome || '').trim();
    if (!student) return;
    const extra = document.createElement('span');
    extra.className = 'portal1040-calendar-extra';
    extra.textContent = `Aluno: ${student}`;
    preview.appendChild(extra);
  });
}

function enhanceAll() {
  keepPortalDialogsAboveWorkspaces();
  configureSyncWorkspace();
  renameSignatureRegistry();
  placeSpreadsheetControls();
  classifyGreenBands();
  void enrichCalendarPreview();
}

export function PortalVersion1040Enhancer() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(enhanceAll); };
    enhanceAll();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-portal-workspace-open', 'data-portal-sync-tab'] });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  return null;
}
