import { useEffect } from 'react';
import { apiClient } from '../services/apiClient';

const TABLE_KEYS = ['defenses', 'acervo', 'meus_processos', 'coordinator', 'authorized_access', 'signature_logs', 'audit_logs'] as const;
type TableKey = typeof TABLE_KEYS[number];
type PageSize = 25 | 50 | 100 | 'all';
type RoleTone = 'student' | 'board' | 'evaluator' | 'viewer';

const DEFAULT_PAGE_SIZE: Record<TableKey, PageSize> = {
  defenses: 25,
  acervo: 25,
  meus_processos: 25,
  coordinator: 25,
  authorized_access: 25,
  signature_logs: 25,
  audit_logs: 25,
};

const PAGE_SIZE_PREFIX = 'portal_table_page_size_';
const CURRENT_PAGE_PREFIX = 'portal_table_current_page_';
const INTERACTIVE_SELECTOR = 'button,input,select,textarea,a,[role="button"],[contenteditable="true"]';
const ROLE_TONES: RoleTone[] = ['student', 'board', 'evaluator', 'viewer'];
const ROLE_BORDER_TO_TONE: Record<string, RoleTone> = {
  '#9a7600': 'student',
  'rgb(154, 118, 0)': 'student',
  '#a04444': 'board',
  'rgb(160, 68, 68)': 'board',
  '#2e718d': 'evaluator',
  'rgb(46, 113, 141)': 'evaluator',
  '#6e4a94': 'viewer',
  'rgb(110, 74, 148)': 'viewer',
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function parsePageSize(value: unknown): PageSize | null {
  if (value === 'all') return 'all';
  const numeric = Number(value);
  return numeric === 25 || numeric === 50 || numeric === 100 ? numeric : null;
}

function pageSizeKey(key: TableKey) { return `${PAGE_SIZE_PREFIX}${key}`; }
function currentPageKey(key: TableKey) { return `${CURRENT_PAGE_PREFIX}${key}`; }

function migrateRowLimits() {
  if (typeof window === 'undefined') return;
  try {
    for (const key of TABLE_KEYS) {
      const masterKey = `default_table_config_${key}`;
      const raw = localStorage.getItem(masterKey);
      const config = raw ? JSON.parse(raw) : {};
      const legacy = parsePageSize(config.recordsLimit);
      if (!localStorage.getItem(pageSizeKey(key))) localStorage.setItem(pageSizeKey(key), String(legacy || DEFAULT_PAGE_SIZE[key]));
      config.recordsLimit = 'all';
      localStorage.setItem(masterKey, JSON.stringify(config));
    }

    const localKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(Boolean) as string[];
    for (const storageKey of localKeys) {
      if (!storageKey.startsWith('portal_user_table_config_')) continue;
      const key = TABLE_KEYS.find((candidate) => storageKey.endsWith(`_${candidate}`));
      if (!key) continue;
      try {
        const config = JSON.parse(localStorage.getItem(storageKey) || '{}');
        const legacy = parsePageSize(config.recordsLimit);
        if (!localStorage.getItem(pageSizeKey(key)) && legacy) localStorage.setItem(pageSizeKey(key), String(legacy));
        config.recordsLimit = 'all';
        localStorage.setItem(storageKey, JSON.stringify(config));
      } catch { /* preferência individual inválida não bloqueia o portal */ }
    }
  } catch { /* localStorage indisponível */ }
}

migrateRowLimits();

function tableKey(table: HTMLTableElement): TableKey | null {
  if (table.closest('#public-calendar-cards-section')) return 'defenses';
  if (table.closest('#biblioteca-tccs-section')) return 'acervo';
  if (table.closest('#meus-processos-page-container')) return 'meus_processos';
  if (table.closest('#coordenador-page-root') || table.closest('#portal-president-all-view')) return 'coordinator';
  if (table.closest('#authorized-access-panel')) return 'authorized_access';
  if (table.closest('#asten-logs-page')) return 'signature_logs';
  if (table.closest('#audit-logs-page')) return 'audit_logs';
  return null;
}

function readPageSize(key: TableKey): PageSize {
  try { return parsePageSize(localStorage.getItem(pageSizeKey(key))) || DEFAULT_PAGE_SIZE[key]; }
  catch { return DEFAULT_PAGE_SIZE[key]; }
}

function savePageSize(key: TableKey, size: PageSize) {
  try {
    localStorage.setItem(pageSizeKey(key), String(size));
    localStorage.setItem(currentPageKey(key), '1');
  } catch { /* noop */ }
}

function readCurrentPage(key: TableKey): number {
  try { return Math.max(1, Number(localStorage.getItem(currentPageKey(key))) || 1); }
  catch { return 1; }
}

function saveCurrentPage(key: TableKey, page: number) {
  try { localStorage.setItem(currentPageKey(key), String(Math.max(1, page))); }
  catch { /* noop */ }
}

function headerLabel(header: HTMLTableCellElement) {
  const clone = header.cloneNode(true) as HTMLTableCellElement;
  clone.querySelectorAll('button,.portal-core-resizer,.portal-core-column-menu,svg').forEach((node) => node.remove());
  return normalize(clone.textContent || '');
}

function isProcessHeader(header: HTMLTableCellElement) {
  const key = normalize(header.dataset.portalColumnKey || header.dataset.portalCoreColumnKey || '');
  const label = headerLabel(header);
  return key === 'protocolo'
    || key === 'processo'
    || key.endsWith('protocolo')
    || label === 'processo'
    || label === 'protocolo'
    || label.includes('numero do processo')
    || label.includes('nº do processo')
    || label.includes('n° do processo')
    || label.includes('no do processo');
}

function renameProcessHeader(header: HTMLTableCellElement) {
  const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) nodes.push(current as Text);
  nodes.forEach((node) => {
    if (node.parentElement?.closest('.portal-core-column-menu,.portal-core-resizer')) return;
    node.data = node.data
      .replace(/n[º°o]?\.?\s*do\s*processo/gi, 'Processo')
      .replace(/n[uú]mero\s+do\s+processo/gi, 'Processo')
      .replace(/^\s*protocolo\s*$/gi, 'Processo');
  });
}

function rowBackground(row: HTMLTableRowElement) {
  const rowColor = getComputedStyle(row).backgroundColor;
  if (rowColor && rowColor !== 'rgba(0, 0, 0, 0)' && rowColor !== 'transparent') return rowColor;
  const firstCell = row.cells[0] as HTMLTableCellElement | undefined;
  const cellColor = firstCell ? getComputedStyle(firstCell).backgroundColor : '';
  if (cellColor && cellColor !== 'rgba(0, 0, 0, 0)' && cellColor !== 'transparent') return cellColor;
  return '#ffffff';
}

function normalizeDefenseProcessCell(cell: HTMLTableCellElement) {
  const button = cell.querySelector<HTMLElement>('.portal-semantic-tone');
  if (!button) return;
  const parts = Array.from(button.children) as HTMLElement[];
  if (parts.length < 2) return;
  const number = (parts[1].textContent || '').trim();
  if (!number || number === '—') return;
  parts[0].textContent = `TCC - ${number}`;
  parts[1].style.display = 'none';
}

function markSpreadsheet(table: HTMLTableElement) {
  const key = tableKey(table);
  if (!key || !table.tHead?.rows.length || !table.tBodies.length) return;
  table.dataset.portalSpreadsheet = key;
  table.classList.add('portal-runtime-spreadsheet');

  const headerRow = table.tHead.rows[table.tHead.rows.length - 1];
  const headers = Array.from(headerRow.cells) as HTMLTableCellElement[];
  headers.forEach((header) => { header.dataset.portalStickyHeader = 'true'; });

  const selectionIndex = headers.findIndex((header) =>
    header.dataset.portalSelectionColumn === 'true'
    || normalize(header.dataset.portalColumnLabel || '') === 'selecao'
    || headerLabel(header) === 'selecao');
  const processIndex = headers.findIndex(isProcessHeader);

  if (selectionIndex >= 0) {
    const header = headers[selectionIndex];
    header.dataset.portalStickySelection = 'true';
    const headerButton = header.querySelector<HTMLButtonElement>('button');
    if (headerButton) {
      headerButton.classList.add('portal-sheet-checkbox');
      headerButton.setAttribute('aria-label', headerButton.getAttribute('title') || 'Selecionar todos');
    }
  }

  if (processIndex >= 0) {
    renameProcessHeader(headers[processIndex]);
    headers[processIndex].dataset.portalStickyProcess = 'true';
    if (selectionIndex >= 0 && selectionIndex < processIndex) headers[processIndex].dataset.portalAfterSelection = 'true';
  }

  Array.from(table.tBodies).forEach((tbody) => Array.from(tbody.rows).forEach((row) => {
    row.style.setProperty('--portal-sticky-row-bg', rowBackground(row));
    if (selectionIndex >= 0) {
      const cell = row.cells[selectionIndex] as HTMLTableCellElement | undefined;
      if (cell) {
        cell.dataset.portalStickySelection = 'true';
        const button = cell.querySelector<HTMLButtonElement>('button');
        if (button) button.classList.add('portal-sheet-checkbox');
      }
    }
    if (processIndex >= 0) {
      const cell = row.cells[processIndex] as HTMLTableCellElement | undefined;
      if (cell) {
        cell.dataset.portalStickyProcess = 'true';
        if (selectionIndex >= 0 && selectionIndex < processIndex) cell.dataset.portalAfterSelection = 'true';
        if (key === 'defenses') normalizeDefenseProcessCell(cell);
      }
    }
  }));

  if (key === 'coordinator') {
    const envioIndex = headers.findIndex((header) => normalize(header.dataset.portalColumnKey || '') === 'enviostatus' || headerLabel(header) === 'envio');
    if (envioIndex >= 0) Array.from(table.tBodies).forEach((tbody) => Array.from(tbody.rows).forEach((row) => {
      const cell = row.cells[envioIndex] as HTMLTableCellElement | undefined;
      if (cell) cell.dataset.portalPlainText = 'true';
    }));
  }
}

function findScrollHost(table: HTMLTableElement) {
  return table.closest<HTMLElement>('.table-sticky-container,[data-portal-scroll-host="true"],.overflow-x-auto') || table.parentElement;
}

function ensurePager(host: HTMLElement, key: TableKey) {
  let pager = host.nextElementSibling as HTMLElement | null;
  if (!pager?.classList.contains('portal-spreadsheet-pager') || pager.dataset.portalTableKey !== key) {
    pager = document.createElement('nav');
    pager.className = 'portal-spreadsheet-pager';
    pager.dataset.portalTableKey = key;
    pager.setAttribute('aria-label', 'Paginação da planilha');
    host.insertAdjacentElement('afterend', pager);
  }
  return pager;
}

function rowIsExternallyHidden(row: HTMLTableRowElement) {
  return row.classList.contains('portal-core-filter-hidden')
    || row.dataset.portalFilterHidden === 'true'
    || row.hidden;
}

function pageList(totalPages: number, current: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set<number>([1, totalPages, current - 1, current, current + 1]);
  return Array.from(pages).filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
}

function applyPagination(table: HTMLTableElement) {
  const key = tableKey(table);
  if (!key) return;
  const host = findScrollHost(table);
  if (!host) return;

  const allRows = Array.from(table.tBodies).flatMap((tbody) => Array.from(tbody.rows));
  const visibleRows = allRows.filter((row) => !rowIsExternallyHidden(row));
  const pageSize = readPageSize(key);
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const current = Math.min(totalPages, readCurrentPage(key));
  saveCurrentPage(key, current);
  const start = pageSize === 'all' ? 0 : (current - 1) * pageSize;
  const end = pageSize === 'all' ? visibleRows.length : start + pageSize;
  const visibleIndex = new Map<HTMLTableRowElement, number>();
  visibleRows.forEach((row, index) => visibleIndex.set(row, index));

  allRows.forEach((row) => {
    const index = visibleIndex.get(row);
    const hiddenByPage = pageSize !== 'all' && index !== undefined && (index < start || index >= end);
    row.classList.toggle('portal-runtime-page-hidden', hiddenByPage);
  });

  const pager = ensurePager(host, key);
  const signature = `${pageSize}|${current}|${visibleRows.length}|${totalPages}`;
  if (pager.dataset.portalSignature === signature) return;
  pager.dataset.portalSignature = signature;
  pager.replaceChildren();

  const controls = document.createElement('div');
  controls.className = 'portal-spreadsheet-pager-controls';
  const makeButton = (label: string, page: number, disabled = false, active = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = disabled;
    button.dataset.active = active ? 'true' : 'false';
    button.addEventListener('click', () => {
      saveCurrentPage(key, page);
      pager.dataset.portalSignature = '';
      applyPagination(table);
      host.scrollTop = 0;
    });
    return button;
  };

  controls.appendChild(makeButton('Anterior', Math.max(1, current - 1), current === 1));
  let previous = 0;
  pageList(totalPages, current).forEach((page) => {
    if (previous && page - previous > 1) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'portal-spreadsheet-pager-ellipsis';
      ellipsis.textContent = '…';
      controls.appendChild(ellipsis);
    }
    controls.appendChild(makeButton(String(page), page, false, page === current));
    previous = page;
  });
  controls.appendChild(makeButton('Próxima', Math.min(totalPages, current + 1), current === totalPages));
  pager.appendChild(controls);
}

function syncPageSizePopover(activeTable: HTMLTableElement | null) {
  const popup = document.querySelector<HTMLElement>('.portal-table-settings-popover');
  if (!popup || !activeTable) return;
  const key = tableKey(activeTable);
  if (!key) return;
  const pageSize = readPageSize(key);
  const sections = Array.from(popup.querySelectorAll<HTMLElement>('section'));
  const section = sections.find((node) => normalize(node.textContent || '').includes('linhas por pagina'));
  if (!section) return;
  const status = Array.from(section.querySelectorAll<HTMLElement>('span')).find((node) => normalize(node.textContent || '').startsWith('atual:'));
  if (status) status.textContent = `Atual: ${pageSize === 'all' ? 'Todos' : pageSize}`;
  section.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    const label = normalize(button.textContent || '');
    const value = label === 'todos' ? 'all' : parsePageSize(label);
    if (!value) return;
    button.dataset.portalPageSizeSelected = value === pageSize ? 'true' : 'false';
  });
}

function findTableForControl(control: HTMLElement) {
  let current: HTMLElement | null = control;
  for (let depth = 0; current && depth < 12; depth += 1, current = current.parentElement) {
    const tables = Array.from(current.querySelectorAll<HTMLTableElement>('table')).filter((table) => Boolean(tableKey(table)));
    if (tables.length === 1) return tables[0];
  }
  return Array.from(document.querySelectorAll<HTMLTableElement>('table')).find((table) => table.offsetParent !== null && Boolean(tableKey(table))) || null;
}

function roleToneFromLabel(label: string): RoleTone | null {
  const normalized = normalize(label);
  if (normalized.includes('aluno')) return 'student';
  if (normalized.includes('banca')) return 'board';
  if (normalized.includes('avaliador')) return 'evaluator';
  if (normalized.includes('visualizador')) return 'viewer';
  return null;
}

function roleToneFromRow(row: HTMLTableRowElement): RoleTone | null {
  const processButton = row.querySelector<HTMLElement>('.portal-role-process-button');
  if (!processButton) return null;
  const inline = processButton.style.getPropertyValue('--portal-role-border').trim().toLowerCase();
  if (ROLE_BORDER_TO_TONE[inline]) return ROLE_BORDER_TO_TONE[inline];
  const computed = getComputedStyle(processButton).getPropertyValue('--portal-role-border').trim().toLowerCase();
  return ROLE_BORDER_TO_TONE[computed] || null;
}

function makeAllFilterButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'portal-standard-filter-chip portal-table-filter-chip portal-runtime-all-filter';
  button.innerHTML = '<span class="portal-runtime-all-label">Todos</span><span class="portal-runtime-all-count">0</span>';
  return button;
}

const selectedMyTccRoles = new Set<RoleTone>(ROLE_TONES);

function enhanceMyTccFilters() {
  const row = document.querySelector<HTMLElement>('#meus-processos-page-container .portal-meus-processos-filter-row');
  if (!row) return;
  const nativeButtons = Array.from(row.querySelectorAll<HTMLButtonElement>('button.portal-standard-filter-chip:not(.portal-runtime-all-filter)'));
  if (!nativeButtons.length) return;
  const group = nativeButtons[0].parentElement;
  if (!group) return;
  group.dataset.portalRoleFilterGroup = 'true';

  nativeButtons.forEach((button) => {
    const tone = roleToneFromLabel(button.textContent || '');
    if (tone) button.dataset.portalRoleTone = tone;
  });

  let all = group.querySelector<HTMLButtonElement>('.portal-runtime-all-filter');
  if (!all) {
    all = makeAllFilterButton();
    group.insertBefore(all, group.firstChild);
  }

  const available = nativeButtons.map((button) => button.dataset.portalRoleTone as RoleTone).filter(Boolean);
  for (const tone of Array.from(selectedMyTccRoles)) if (!available.includes(tone)) selectedMyTccRoles.delete(tone);
  if (!group.dataset.portalFilterInitialized) {
    available.forEach((tone) => selectedMyTccRoles.add(tone));
    group.dataset.portalFilterInitialized = 'true';
  }

  nativeButtons.forEach((button) => {
    const tone = button.dataset.portalRoleTone as RoleTone | undefined;
    const selected = Boolean(tone && selectedMyTccRoles.has(tone));
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    button.dataset.selected = selected ? 'true' : 'false';
  });

  const allSelected = available.length > 0 && available.every((tone) => selectedMyTccRoles.has(tone));
  all.setAttribute('aria-pressed', allSelected ? 'true' : 'false');
  all.dataset.selected = allSelected ? 'true' : 'false';
  const count = nativeButtons.reduce((sum, button) => {
    const value = Number(button.querySelector('span:last-child')?.textContent || 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const countNode = all.querySelector<HTMLElement>('.portal-runtime-all-count');
  if (countNode) countNode.textContent = String(count);

  document.querySelectorAll<HTMLTableRowElement>('#meus-processos-page-container table tbody tr').forEach((tableRow) => {
    const tone = roleToneFromRow(tableRow);
    const hidden = Boolean(tone && !selectedMyTccRoles.has(tone));
    tableRow.dataset.portalFilterHidden = hidden ? 'true' : 'false';
    tableRow.style.display = hidden ? 'none' : '';
  });
}

let presidentAllActive = false;
let presidentLoading = false;
const presidentSelection = new Set<string>();

function dateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function updatePresidentSelection(table: HTMLTableElement) {
  const rows = Array.from(table.tBodies[0]?.rows || []);
  rows.forEach((row) => {
    const id = row.dataset.processId || '';
    const selected = presidentSelection.has(id);
    row.dataset.portalSelected = selected ? 'true' : 'false';
    const button = row.cells[0]?.querySelector<HTMLButtonElement>('button');
    if (button) {
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      const mark = button.querySelector<HTMLElement>('span');
      if (mark) mark.textContent = selected ? '✓' : '';
    }
  });
}

function deactivatePresidentAll() {
  presidentAllActive = false;
  document.getElementById('portal-president-all-view')?.remove();
  const row = document.querySelector<HTMLElement>('#coordenador-page-root .portal-coordinator-filter-row');
  const nativeContent = row?.parentElement?.nextElementSibling as HTMLElement | null;
  if (nativeContent) nativeContent.style.display = '';
  const all = row?.querySelector<HTMLButtonElement>('.portal-runtime-president-all');
  if (all) {
    all.setAttribute('aria-pressed', 'false');
    all.dataset.selected = 'false';
  }
}

async function renderPresidentAllView(filterRow: HTMLElement) {
  if (!presidentAllActive || presidentLoading) return;
  const nativeContent = filterRow.parentElement?.nextElementSibling as HTMLElement | null;
  if (!nativeContent) return;
  nativeContent.style.display = 'none';
  let host = document.getElementById('portal-president-all-view');
  if (!host) {
    host = document.createElement('div');
    host.id = 'portal-president-all-view';
    host.innerHTML = '<div class="portal-runtime-loading">Carregando todos os registros…</div>';
    nativeContent.insertAdjacentElement('beforebegin', host);
  }
  presidentLoading = true;
  try {
    const [queue, processes] = await Promise.all([apiClient.getCoordinatorQueue(), apiClient.getProcesses()]);
    if (!presidentAllActive) return;
    const merged = new Map<string, { process: any; signed: boolean }>();
    (queue || []).forEach((item: any) => { if (item?.process?.id) merged.set(item.process.id, { process: item.process, signed: false }); });
    (processes || []).filter((process: any) => process?.status === 'CONCLUIDO').forEach((process: any) => merged.set(process.id, { process, signed: true }));
    const records = Array.from(merged.values()).sort((a, b) => String(b.process?.defesa?.startAt || '').localeCompare(String(a.process?.defesa?.startAt || '')));

    host.replaceChildren();
    const wrapper = document.createElement('div');
    wrapper.className = 'table-sticky-container portal-spreadsheet-scroll-host portal-runtime-president-all-scroll';
    wrapper.dataset.portalScrollHost = 'true';
    const table = document.createElement('table');
    table.className = 'portal-runtime-president-all-table w-full min-w-[1100px] border-collapse text-xs';
    const thead = table.createTHead();
    const header = thead.insertRow();
    const columns = ['Seleção', 'Processo', 'Envio', 'Data', 'Título do Trabalho', 'Aluno 1', 'Aluno 2', 'Orientador(a)'];
    columns.forEach((label, index) => {
      const th = document.createElement('th');
      th.textContent = label;
      if (index === 0) {
        th.dataset.portalSelectionColumn = 'true';
        th.dataset.portalColumnLabel = 'Seleção';
        th.replaceChildren();
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'portal-sheet-checkbox';
        button.title = 'Selecionar/Deselecionar todos';
        button.setAttribute('aria-pressed', 'false');
        const mark = document.createElement('span');
        button.appendChild(mark);
        button.addEventListener('click', () => {
          const ids = records.map(({ process }) => String(process.id));
          const allSelected = ids.length > 0 && ids.every((id) => presidentSelection.has(id));
          ids.forEach((id) => allSelected ? presidentSelection.delete(id) : presidentSelection.add(id));
          updatePresidentSelection(table);
        });
        th.appendChild(button);
      }
      if (index === 1) th.dataset.portalColumnKey = 'protocolo';
      if (index === 2) th.dataset.portalColumnKey = 'envioStatus';
      header.appendChild(th);
    });

    const tbody = table.createTBody();
    records.forEach(({ process, signed }) => {
      const row = tbody.insertRow();
      row.dataset.processId = String(process.id);
      const selection = row.insertCell();
      selection.dataset.portalSelectionColumnCell = 'true';
      const checkbox = document.createElement('button');
      checkbox.type = 'button';
      checkbox.className = 'portal-sheet-checkbox';
      checkbox.setAttribute('aria-pressed', presidentSelection.has(String(process.id)) ? 'true' : 'false');
      const mark = document.createElement('span');
      mark.textContent = presidentSelection.has(String(process.id)) ? '✓' : '';
      checkbox.appendChild(mark);
      checkbox.addEventListener('click', () => {
        const id = String(process.id);
        presidentSelection.has(id) ? presidentSelection.delete(id) : presidentSelection.add(id);
        updatePresidentSelection(table);
      });
      selection.appendChild(checkbox);

      const processCell = row.insertCell();
      const pill = document.createElement('span');
      pill.className = `portal-process-pill ${signed ? 'portal-tone-signed' : 'portal-tone-pending'}`;
      pill.textContent = String(process.protocolo || process.id || '—').replace(/^TCC\s*[-/]?\s*/i, '');
      processCell.appendChild(pill);
      row.insertCell().textContent = signed ? 'Assinada' : 'Pendente';
      row.insertCell().textContent = dateTime(process.defesa?.startAt);
      row.insertCell().textContent = String(process.titulo || '—');
      row.insertCell().textContent = String(process.aluno1?.nome || '—');
      row.insertCell().textContent = String(process.aluno2?.nome || '—');
      row.insertCell().textContent = String(process.orientador?.nome || '—');
    });

    wrapper.appendChild(table);
    host.appendChild(wrapper);
  } catch (error) {
    host.innerHTML = `<div class="portal-runtime-loading">${error instanceof Error ? error.message : 'Não foi possível carregar todos os registros.'}</div>`;
  } finally {
    presidentLoading = false;
  }
}

function enhancePresidentFilters() {
  const row = document.querySelector<HTMLElement>('#coordenador-page-root .portal-coordinator-filter-row');
  if (!row) return;
  const nativeButtons = Array.from(row.querySelectorAll<HTMLButtonElement>('button.portal-standard-filter-chip:not(.portal-runtime-president-all)'));
  if (nativeButtons.length < 2) return;
  const group = nativeButtons[0].parentElement;
  if (!group) return;
  group.dataset.portalPresidentFilterGroup = 'true';
  nativeButtons.forEach((button) => { button.dataset.portalNativePresidentFilter = 'true'; });
  let all = group.querySelector<HTMLButtonElement>('.portal-runtime-president-all');
  if (!all) {
    all = document.createElement('button');
    all.type = 'button';
    all.className = 'portal-standard-filter-chip portal-table-filter-chip portal-runtime-president-all';
    all.textContent = 'Todos';
    group.insertBefore(all, group.firstChild);
  }
  all.setAttribute('aria-pressed', presidentAllActive ? 'true' : 'false');
  all.dataset.selected = presidentAllActive ? 'true' : 'false';
}

export const PortalSpreadsheetRuntime = () => {
  useEffect(() => {
    const unbinders = new Map<HTMLElement, () => void>();
    let frame = 0;
    let activeSettingsTable: HTMLTableElement | null = null;

    const bindScrollHost = (host: HTMLElement) => {
      if (unbinders.has(host)) return;
      let dragging = false;
      let started = false;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;
      let suppressClickUntil = 0;

      const stopDrag = () => {
        if (dragging) suppressClickUntil = performance.now() + 260;
        dragging = false;
        started = false;
        host.classList.remove('portal-sheet-pointer-down', 'portal-sheet-dragging');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', stopDrag);
      };
      const onMouseMove = (event: MouseEvent) => {
        if (!started) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (!dragging && Math.max(Math.abs(dx), Math.abs(dy)) < 3) return;
        dragging = true;
        host.classList.add('portal-sheet-dragging');
        event.preventDefault();
        if (host.scrollWidth > host.clientWidth + 1) host.scrollLeft = startLeft - dx;
        if (host.scrollHeight > host.clientHeight + 1) host.scrollTop = startTop - dy;
      };
      const onMouseDown = (event: MouseEvent) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (target.closest(INTERACTIVE_SELECTOR) || target.closest('thead')) return;
        const canX = host.scrollWidth > host.clientWidth + 1;
        const canY = host.scrollHeight > host.clientHeight + 1;
        if (!canX && !canY) return;
        started = true;
        startX = event.clientX;
        startY = event.clientY;
        startLeft = host.scrollLeft;
        startTop = host.scrollTop;
        host.classList.add('portal-sheet-pointer-down');
        window.addEventListener('mousemove', onMouseMove, { passive: false });
        window.addEventListener('mouseup', stopDrag, { once: true });
      };
      const onWheel = (event: WheelEvent) => {
        const target = event.target as HTMLElement;
        if (target.closest('select,input,textarea')) return;
        const canX = host.scrollWidth > host.clientWidth + 1;
        const canY = host.scrollHeight > host.clientHeight + 1;
        if (!canX && !canY) return;
        const horizontalIntent = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
        if (horizontalIntent && canX) {
          const before = host.scrollLeft;
          host.scrollLeft += Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY;
          if (host.scrollLeft !== before) event.preventDefault();
          return;
        }
        if (canY) {
          const before = host.scrollTop;
          host.scrollTop += event.deltaY;
          if (host.scrollTop !== before) event.preventDefault();
          return;
        }
        if (canX) {
          const before = host.scrollLeft;
          host.scrollLeft += event.deltaY;
          if (host.scrollLeft !== before) event.preventDefault();
        }
      };
      const onClick = (event: MouseEvent) => {
        if (performance.now() < suppressClickUntil) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
      };
      host.addEventListener('mousedown', onMouseDown);
      host.addEventListener('wheel', onWheel, { passive: false });
      host.addEventListener('click', onClick, true);
      unbinders.set(host, () => {
        stopDrag();
        host.removeEventListener('mousedown', onMouseDown);
        host.removeEventListener('wheel', onWheel);
        host.removeEventListener('click', onClick, true);
      });
    };

    const enhanceTable = (table: HTMLTableElement) => {
      const key = tableKey(table);
      if (!key) return;
      markSpreadsheet(table);
      const host = findScrollHost(table);
      if (!host) return;
      bindScrollHost(host);
      applyPagination(table);
    };

    const enhanceAll = () => {
      enhanceMyTccFilters();
      enhancePresidentFilters();
      document.querySelectorAll<HTMLTableElement>(
        '#public-calendar-cards-section table, #biblioteca-tccs-section table, #meus-processos-page-container table, #coordenador-page-root table, #portal-president-all-view table, #authorized-access-panel table, #asten-logs-page table, #audit-logs-page table',
      ).forEach(enhanceTable);
      syncPageSizePopover(activeSettingsTable);
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(enhanceAll);
    };

    const onDocumentClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      const gear = target.closest<HTMLButtonElement>('button[aria-label="Configurar exibição da planilha"],button[title*="Exibição da planilha"]');
      if (gear) {
        activeSettingsTable = findTableForControl(gear);
        window.setTimeout(() => syncPageSizePopover(activeSettingsTable), 0);
        return;
      }

      const popup = target.closest<HTMLElement>('.portal-table-settings-popover');
      if (popup && activeSettingsTable) {
        const section = target.closest<HTMLElement>('section');
        if (section && normalize(section.textContent || '').includes('linhas por pagina')) {
          const button = target.closest<HTMLButtonElement>('button');
          if (button) {
            const label = normalize(button.textContent || '');
            const size = label === 'todos' ? 'all' : parsePageSize(label);
            const key = tableKey(activeSettingsTable);
            if (size && key) {
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation();
              savePageSize(key, size);
              saveCurrentPage(key, 1);
              applyPagination(activeSettingsTable);
              syncPageSizePopover(activeSettingsTable);
              return;
            }
          }
        }
      }

      const allMyTcc = target.closest<HTMLButtonElement>('#meus-processos-page-container .portal-runtime-all-filter');
      if (allMyTcc) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const nativeButtons = Array.from(allMyTcc.parentElement?.querySelectorAll<HTMLButtonElement>('button[data-portal-role-tone]') || []);
        const available = nativeButtons.map((button) => button.dataset.portalRoleTone as RoleTone).filter(Boolean);
        const allSelected = available.length > 0 && available.every((tone) => selectedMyTccRoles.has(tone));
        selectedMyTccRoles.clear();
        if (!allSelected) available.forEach((tone) => selectedMyTccRoles.add(tone));
        saveCurrentPage('meus_processos', 1);
        schedule();
        return;
      }

      const roleButton = target.closest<HTMLButtonElement>('#meus-processos-page-container button[data-portal-role-tone]');
      if (roleButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const tone = roleButton.dataset.portalRoleTone as RoleTone;
        if (selectedMyTccRoles.has(tone)) selectedMyTccRoles.delete(tone); else selectedMyTccRoles.add(tone);
        saveCurrentPage('meus_processos', 1);
        schedule();
        return;
      }

      const presidentAll = target.closest<HTMLButtonElement>('#coordenador-page-root .portal-runtime-president-all');
      if (presidentAll) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        presidentAllActive = true;
        const row = presidentAll.closest<HTMLElement>('.portal-coordinator-filter-row');
        if (row) void renderPresidentAllView(row).then(schedule);
        schedule();
        return;
      }

      const nativePresident = target.closest<HTMLButtonElement>('#coordenador-page-root button[data-portal-native-president-filter="true"]');
      if (nativePresident && presidentAllActive) deactivatePresidentAll();
    };

    document.addEventListener('click', onDocumentClickCapture, true);
    enhanceAll();
    const observer = new MutationObserver((mutations) => {
      const onlyRuntimeMutations = mutations.every((mutation) => {
        const target = mutation.target as HTMLElement;
        return Boolean(target.closest?.('.portal-spreadsheet-pager'))
          || (mutation.type === 'attributes' && target.classList?.contains('portal-runtime-page-hidden'));
      });
      if (!onlyRuntimeMutations) schedule();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-pressed', 'data-selected', 'data-portal-filter-value', 'style'],
    });
    window.addEventListener('portal:table-layout-changed', schedule as EventListener);
    window.addEventListener('global_table_layouts_changed', schedule as EventListener);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener('click', onDocumentClickCapture, true);
      window.removeEventListener('portal:table-layout-changed', schedule as EventListener);
      window.removeEventListener('global_table_layouts_changed', schedule as EventListener);
      unbinders.forEach((unbind) => unbind());
      unbinders.clear();
      deactivatePresidentAll();
    };
  }, []);

  return null;
};
