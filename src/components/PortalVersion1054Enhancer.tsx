import { useEffect } from 'react';

type TargetKey = 'acervo' | 'meus_processos';
type PageSize = 25 | 50 | 100 | 'all';

const TARGETS: Array<{ root: string; key: TargetKey }> = [
  { root: '#biblioteca-tccs-section', key: 'acervo' },
  { root: '#meus-processos-page-container', key: 'meus_processos' },
];

const INTERACTIVE_SELECTOR = 'button,input,select,textarea,a,[role="button"],[contenteditable="true"]';
const PAGE_SIZE_PREFIX = 'portal_table_page_size_';
const CURRENT_PAGE_PREFIX = 'portal_table_current_page_';

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function parsePageSize(value: unknown): PageSize {
  if (value === 'all') return 'all';
  const numberValue = Number(value);
  if (numberValue === 50 || numberValue === 100) return numberValue;
  return 25;
}

function readPageSize(key: TargetKey): PageSize {
  try { return parsePageSize(localStorage.getItem(`${PAGE_SIZE_PREFIX}${key}`)); }
  catch { return 25; }
}

function readCurrentPage(key: TargetKey) {
  try { return Math.max(1, Number(localStorage.getItem(`${CURRENT_PAGE_PREFIX}${key}`)) || 1); }
  catch { return 1; }
}

function saveCurrentPage(key: TargetKey, page: number) {
  try { localStorage.setItem(`${CURRENT_PAGE_PREFIX}${key}`, String(Math.max(1, page))); }
  catch { /* preferência local opcional */ }
}

function visibleTextNodes(element: HTMLElement) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) nodes.push(current as Text);
  return nodes;
}

function forceProcessHeader(table: HTMLTableElement) {
  const headerRow = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!headerRow) return;
  const headers = Array.from(headerRow.cells) as HTMLTableCellElement[];
  const processHeader = headers.find((header) => {
    const key = normalize(header.dataset.portalColumnKey || header.dataset.portalCoreColumnKey || '');
    const text = normalize(header.textContent || '');
    return key === 'protocolo'
      || key === 'processo'
      || key.endsWith('protocolo')
      || text.includes('processo')
      || text === 'protocolo';
  });
  if (!processHeader) return;

  processHeader.dataset.portalV54ProcessHeader = 'true';
  const candidates = visibleTextNodes(processHeader).filter((node) => !node.parentElement?.closest('button,.portal-column-controls'));
  const matching = candidates.find((node) => {
    const value = normalize(node.data);
    return value.includes('processo') || value === 'protocolo';
  });
  if (matching && matching.data.trim() !== 'Processo') matching.data = 'Processo';
}

function roleFromButton(button: HTMLButtonElement) {
  const label = normalize(button.querySelector<HTMLElement>('.whitespace-nowrap')?.textContent || button.textContent || '');
  if (label.includes('aluno')) return 'student';
  if (label.includes('banca')) return 'committee';
  if (label.includes('avaliador')) return 'evaluator';
  if (label.includes('visualizador')) return 'viewer';
  return '';
}

function roleFromProcessPill(pill: HTMLElement) {
  const preset = pill.dataset.portalRolePill || pill.closest<HTMLTableRowElement>('tr')?.dataset.portalRoleCategory || '';
  if (preset) return preset;
  const border = normalize(pill.style.getPropertyValue('--portal-role-border')).replace(/\s+/g, '');
  if (border.includes('#9a7a12') || border.includes('154,122,18')) return 'student';
  if (border.includes('#9a5149') || border.includes('154,81,73')) return 'committee';
  if (border.includes('#4f8092') || border.includes('79,128,146')) return 'evaluator';
  if (border.includes('#765493') || border.includes('118,84,147')) return 'viewer';
  return '';
}

function syncMyTccFilters(root: HTMLElement) {
  const filterRow = root.querySelector<HTMLElement>('.portal-meus-processos-filter-row');
  if (!filterRow) return;
  const all = filterRow.querySelector<HTMLButtonElement>('.portal-v52-all-filter');
  if (!all?.parentElement) return;
  const group = all.parentElement;
  group.dataset.portalV54RoleFilters = 'true';

  all.dataset.portalV54All = 'true';
  const allDot = all.querySelector<HTMLElement>('.portal-filter-dot');
  if (allDot) allDot.dataset.portalV54HiddenDot = 'true';

  const roles = Array.from(group.querySelectorAll<HTMLButtonElement>('button.portal-standard-filter-chip:not(.portal-v52-all-filter)'));
  roles.forEach((button) => {
    const role = roleFromButton(button);
    if (role) button.dataset.portalV54Role = role;
    const spans = Array.from(button.querySelectorAll<HTMLElement>('span'));
    const count = spans[spans.length - 1];
    if (count) count.classList.add('portal-v54-filter-count');
  });

  const allRolesSelected = roles.length > 0 && roles.every((button) => button.getAttribute('aria-pressed') === 'true');
  group.dataset.portalV54AllActive = allRolesSelected ? 'true' : 'false';
  if (all.getAttribute('aria-pressed') !== String(allRolesSelected)) all.setAttribute('aria-pressed', String(allRolesSelected));
  if (all.dataset.selected !== String(allRolesSelected)) all.dataset.selected = String(allRolesSelected);

  root.querySelectorAll<HTMLElement>('#meus-processos-table .portal-role-process-button').forEach((pill) => {
    const role = roleFromProcessPill(pill);
    if (role) pill.dataset.portalV54Role = role;
  });
}

function getScrollHost(table: HTMLTableElement) {
  return table.closest<HTMLElement>('.table-sticky-container') || table.parentElement;
}

function filteredRows(table: HTMLTableElement) {
  return Array.from(table.tBodies[0]?.rows || []).filter((row) =>
    !row.classList.contains('portal-column-filter-hidden')
    && !row.classList.contains('portal-core-filter-hidden'));
}

function renderPager(table: HTMLTableElement, key: TargetKey) {
  const host = getScrollHost(table);
  if (!host || !table.tBodies[0]) return;
  const root = table.closest<HTMLElement>(key === 'acervo' ? '#biblioteca-tccs-section' : '#meus-processos-page-container');
  if (!root) return;

  const allRows = Array.from(table.tBodies[0].rows);
  const rows = filteredRows(table);
  const pageSize = readPageSize(key);
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(totalPages, readCurrentPage(key));
  saveCurrentPage(key, currentPage);
  const start = pageSize === 'all' ? 0 : (currentPage - 1) * pageSize;
  const end = pageSize === 'all' ? rows.length : Math.min(rows.length, start + pageSize);
  const visibleIndex = new Map<HTMLTableRowElement, number>();
  rows.forEach((row, index) => visibleIndex.set(row, index));

  allRows.forEach((row) => {
    const index = visibleIndex.get(row);
    const pageHidden = index !== undefined && (index < start || index >= end);
    row.classList.toggle('portal-v54-page-hidden', pageHidden);
  });

  let pager = root.querySelector<HTMLElement>(`.portal-v54-pager[data-portal-v54-key="${key}"]`);
  if (!pager) {
    pager = document.createElement('nav');
    pager.className = 'portal-v54-pager';
    pager.dataset.portalV54Key = key;
    pager.setAttribute('aria-label', 'Paginação da planilha');
    host.insertAdjacentElement('afterend', pager);
  }

  const signature = `${rows.length}|${pageSize}|${currentPage}|${totalPages}`;
  if (pager.dataset.portalV54Signature === signature) return;
  pager.dataset.portalV54Signature = signature;
  pager.replaceChildren();

  const summary = document.createElement('span');
  summary.className = 'portal-v54-pager-info';
  const first = rows.length ? start + 1 : 0;
  const last = rows.length ? end : 0;
  summary.textContent = `${first}–${last} de ${rows.length} registros`;
  pager.appendChild(summary);

  const controls = document.createElement('div');
  controls.className = 'portal-v54-pager-controls';

  const makeButton = (label: string, page: number, options?: { disabled?: boolean; active?: boolean }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = Boolean(options?.disabled);
    if (options?.active) button.dataset.active = 'true';
    button.addEventListener('click', () => {
      saveCurrentPage(key, page);
      pager!.dataset.portalV54Signature = '';
      renderPager(table, key);
      host.scrollTop = 0;
    });
    return button;
  };

  controls.appendChild(makeButton('Anterior', Math.max(1, currentPage - 1), { disabled: currentPage === 1 }));
  for (let page = 1; page <= totalPages; page += 1) {
    controls.appendChild(makeButton(String(page), page, { active: page === currentPage }));
  }
  controls.appendChild(makeButton('Próxima', Math.min(totalPages, currentPage + 1), { disabled: currentPage === totalPages }));
  pager.appendChild(controls);
}

function markTargetTable(table: HTMLTableElement, key: TargetKey) {
  table.dataset.portalV54Table = key;
  forceProcessHeader(table);
  renderPager(table, key);
}

export function PortalVersion1054Enhancer() {
  useEffect(() => {
    const unbinders = new Map<HTMLElement, () => void>();
    let frame = 0;
    let normalizingRoleSelection = false;

    const bindMousePan = (host: HTMLElement) => {
      if (unbinders.has(host)) return;
      host.dataset.portalV54PanHost = 'true';
      host.classList.add('portal-v54-pan-host');

      let active = false;
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;
      let suppressClickUntil = 0;

      const onMouseMove = (event: MouseEvent) => {
        if (!active) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (!dragging && Math.max(Math.abs(dx), Math.abs(dy)) < 3) return;
        dragging = true;
        host.classList.add('portal-v54-dragging');
        event.preventDefault();
        if (host.scrollWidth > host.clientWidth + 1) host.scrollLeft = startLeft - dx;
        if (host.scrollHeight > host.clientHeight + 1) host.scrollTop = startTop - dy;
      };

      const finish = () => {
        if (!active) return;
        if (dragging) suppressClickUntil = performance.now() + 320;
        active = false;
        dragging = false;
        host.classList.remove('portal-v54-pointer-down', 'portal-v54-dragging');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', finish);
      };

      const onMouseDown = (event: MouseEvent) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (target.closest(INTERACTIVE_SELECTOR)) return;
        const canX = host.scrollWidth > host.clientWidth + 1;
        const canY = host.scrollHeight > host.clientHeight + 1;
        if (!canX && !canY) return;
        active = true;
        dragging = false;
        startX = event.clientX;
        startY = event.clientY;
        startLeft = host.scrollLeft;
        startTop = host.scrollTop;
        host.classList.add('portal-v54-pointer-down');
        event.preventDefault();
        window.addEventListener('mousemove', onMouseMove, { passive: false });
        window.addEventListener('mouseup', finish, { once: true });
      };

      const onClickCapture = (event: MouseEvent) => {
        if (performance.now() < suppressClickUntil) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
      };

      host.addEventListener('mousedown', onMouseDown);
      host.addEventListener('click', onClickCapture, true);
      unbinders.set(host, () => {
        finish();
        host.removeEventListener('mousedown', onMouseDown);
        host.removeEventListener('click', onClickCapture, true);
        host.classList.remove('portal-v54-pan-host', 'portal-v54-pointer-down', 'portal-v54-dragging');
        delete host.dataset.portalV54PanHost;
      });
    };

    const enhanceAll = () => {
      TARGETS.forEach(({ root, key }) => {
        const rootElement = document.querySelector<HTMLElement>(root);
        if (!rootElement) return;
        const table = rootElement.querySelector<HTMLTableElement>('table');
        if (!table) return;
        markTargetTable(table, key);
        const host = getScrollHost(table);
        if (host) bindMousePan(host);
        if (key === 'meus_processos') syncMyTccFilters(rootElement);
      });
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(enhanceAll);
    };

    const normalizeRoleSelection = (targetButton: HTMLButtonElement) => {
      if (normalizingRoleSelection) return;
      const group = targetButton.parentElement;
      if (!group) return;
      const roles = Array.from(group.querySelectorAll<HTMLButtonElement>('button.portal-standard-filter-chip:not(.portal-v52-all-filter)'));
      const selected = roles.filter((button) => button.getAttribute('aria-pressed') === 'true');
      if (selected.length <= 1 || selected.length === roles.length) return;
      normalizingRoleSelection = true;
      selected.filter((button) => button !== targetButton).forEach((button) => button.click());
      normalizingRoleSelection = false;
      window.setTimeout(schedule, 0);
    };

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const roleButton = target.closest<HTMLButtonElement>('#meus-processos-page-container button.portal-standard-filter-chip:not(.portal-v52-all-filter)');
      if (roleButton && !normalizingRoleSelection) window.setTimeout(() => normalizeRoleSelection(roleButton), 0);
    };

    document.addEventListener('click', onDocumentClick);
    enhanceAll();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-pressed', 'data-selected'],
    });
    window.addEventListener('portal:table-layout-changed', schedule as EventListener);
    window.addEventListener('global_table_layouts_changed', schedule as EventListener);

    return () => {
      document.removeEventListener('click', onDocumentClick);
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('portal:table-layout-changed', schedule as EventListener);
      window.removeEventListener('global_table_layouts_changed', schedule as EventListener);
      unbinders.forEach((unbind) => unbind());
      unbinders.clear();
    };
  }, []);

  return null;
}
