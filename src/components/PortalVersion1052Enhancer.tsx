import { useEffect } from 'react';
import { apiClient } from '../services/apiClient';

const TABLE_KEYS = ['defenses', 'acervo', 'meus_processos', 'coordinator', 'authorized_access', 'signature_logs', 'audit_logs'] as const;
type TableKey = typeof TABLE_KEYS[number];
type PageSize = number | 'all';

const DEFAULT_PAGE_SIZE: Record<TableKey, PageSize> = {
  defenses: 'all',
  acervo: 25,
  meus_processos: 25,
  coordinator: 25,
  authorized_access: 25,
  signature_logs: 25,
  audit_logs: 25,
};

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

function parsePageSize(value: unknown): PageSize | null {
  if (value === 'all') return 'all';
  const numeric = Number(value);
  return [25, 50, 100].includes(numeric) ? numeric : null;
}

function pageSizeKey(key: TableKey) { return `${PAGE_SIZE_PREFIX}${key}`; }
function currentPageKey(key: TableKey) { return `${CURRENT_PAGE_PREFIX}${key}`; }

function readPageSize(key: TableKey): PageSize {
  if (typeof window === 'undefined') return DEFAULT_PAGE_SIZE[key];
  return parsePageSize(localStorage.getItem(pageSizeKey(key))) || DEFAULT_PAGE_SIZE[key];
}

function savePageSize(key: TableKey, size: PageSize) {
  try {
    localStorage.setItem(pageSizeKey(key), String(size));
    localStorage.setItem(currentPageKey(key), '1');
  } catch { /* preferência local opcional */ }
}

/**
 * Migração 1.0.52: o antigo recordsLimit truncava os arrays React e descartava
 * as linhas das páginas seguintes. Mantemos a fonte React em "all" e passamos
 * a paginação para a camada estrutural, preservando a preferência 25/50/100.
 */
function migrateLegacyRowLimits() {
  if (typeof window === 'undefined') return;
  try {
    for (const key of TABLE_KEYS) {
      const storageKey = `default_table_config_${key}`;
      const raw = localStorage.getItem(storageKey);
      const config = raw ? JSON.parse(raw) : {};
      const legacy = parsePageSize(config.recordsLimit);
      if (!localStorage.getItem(pageSizeKey(key))) savePageSize(key, legacy || DEFAULT_PAGE_SIZE[key]);
      config.recordsLimit = 'all';
      localStorage.setItem(storageKey, JSON.stringify(config));
    }

    const localKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(Boolean) as string[];
    for (const storageKey of localKeys) {
      if (!storageKey.startsWith('portal_user_table_config_')) continue;
      const key = TABLE_KEYS.find((candidate) => storageKey.endsWith(`_${candidate}`));
      if (!key) continue;
      try {
        const config = JSON.parse(localStorage.getItem(storageKey) || '{}');
        const legacy = parsePageSize(config.recordsLimit);
        if (!localStorage.getItem(pageSizeKey(key)) && legacy) savePageSize(key, legacy);
        config.recordsLimit = 'all';
        localStorage.setItem(storageKey, JSON.stringify(config));
      } catch { /* ignora preferência inválida */ }
    }
  } catch { /* localStorage indisponível */ }
}

migrateLegacyRowLimits();

function tableKey(table: HTMLTableElement): TableKey | null {
  if (table.closest('#public-calendar-cards-section')) return 'defenses';
  if (table.closest('#biblioteca-tccs-section')) return 'acervo';
  if (table.closest('#meus-processos-page-container')) return 'meus_processos';
  if (table.closest('#coordenador-page-root')) return 'coordinator';
  if (table.closest('#authorized-access-panel')) return 'authorized_access';
  if (table.closest('#asten-logs-page')) return 'signature_logs';
  if (table.closest('#audit-logs-page')) return 'audit_logs';
  return null;
}

function headerLabel(header: HTMLTableCellElement) {
  const clone = header.cloneNode(true) as HTMLTableCellElement;
  clone.querySelectorAll('button,.portal-core-resizer,.portal-core-column-menu').forEach((node) => node.remove());
  return normalize(clone.textContent || '');
}

function renameProcessHeader(header: HTMLTableCellElement) {
  const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) nodes.push(current as Text);
  let replaced = false;
  nodes.forEach((node) => {
    if (node.parentElement?.closest('button')) return;
    const next = node.data
      .replace(/n[º°o]?\.?\s*do\s*processo/gi, 'Processo')
      .replace(/n[º°o]?\.?\s*processo/gi, 'Processo')
      .replace(/n[uú]mero\s+do\s+processo/gi, 'Processo');
    if (next !== node.data) {
      node.data = next;
      replaced = true;
    }
  });
  if (!replaced && ['processo', 'protocolo'].includes(headerLabel(header))) {
    const preferred = header.querySelector<HTMLElement>('div > span:first-child, :scope > span:first-child');
    if (preferred && !preferred.closest('button')) preferred.textContent = 'Processo';
  }
}

function markSpreadsheetStructure(table: HTMLTableElement) {
  const key = tableKey(table);
  if (!key) return;
  table.dataset.portalV52Table = key;
  const headers = Array.from(table.tHead?.rows[0]?.cells || []) as HTMLTableCellElement[];
  if (!headers.length) return;

  headers.forEach((header) => { header.dataset.portalV52StickyHeader = 'true'; });

  const selectionIndex = headers.findIndex((header) => header.dataset.portalSelectionColumn === 'true' || headerLabel(header) === 'selecao');
  const processIndex = headers.findIndex((header) => {
    const label = headerLabel(header);
    const keyName = header.dataset.portalColumnKey || '';
    return keyName === 'protocolo' || label === 'processo' || label.includes('numero do processo') || label.includes('nº do processo');
  });

  if (processIndex >= 0) {
    const header = headers[processIndex];
    renameProcessHeader(header);
    header.dataset.portalV52StickyProcess = 'true';
    if (selectionIndex >= 0 && selectionIndex < processIndex) header.dataset.portalV52AfterSelection = 'true';
    Array.from(table.tBodies[0]?.rows || []).forEach((row) => {
      const cell = row.cells[processIndex] as HTMLTableCellElement | undefined;
      if (!cell) return;
      cell.dataset.portalV52StickyProcess = 'true';
      if (selectionIndex >= 0 && selectionIndex < processIndex) cell.dataset.portalV52AfterSelection = 'true';
    });
  }

  if (selectionIndex >= 0) {
    const selectionHeader = headers[selectionIndex];
    selectionHeader.dataset.portalV52StickySelection = 'true';
    const rows = Array.from(table.tBodies[0]?.rows || []);
    rows.forEach((row) => {
      const cell = row.cells[selectionIndex] as HTMLTableCellElement | undefined;
      if (cell) cell.dataset.portalV52StickySelection = 'true';
    });

    const button = selectionHeader.querySelector<HTMLButtonElement>('button');
    if (button && !button.querySelector('.portal-v52-selection-glyph')) {
      const glyph = document.createElement('span');
      glyph.className = 'portal-v52-selection-glyph';
      button.appendChild(glyph);
    }
    const glyph = button?.querySelector<HTMLElement>('.portal-v52-selection-glyph');
    if (glyph) {
      const allSelected = rows.length > 0 && rows.every((row) => {
        const cell = row.cells[selectionIndex] as HTMLTableCellElement | undefined;
        return normalize(cell?.dataset.portalFilterValue || '') === 'selecionado';
      });
      glyph.textContent = allSelected ? '☑' : '☐';
    }
  }

  if (key === 'coordinator') {
    const envioIndex = headers.findIndex((header) => headerLabel(header) === 'envio');
    if (envioIndex >= 0) Array.from(table.tBodies[0]?.rows || []).forEach((row) => {
      const cell = row.cells[envioIndex] as HTMLTableCellElement | undefined;
      if (cell) cell.dataset.portalV52NeutralStatus = 'true';
    });
  }

  if (key === 'audit_logs') {
    const actionIndex = headers.findIndex((header) => (header.dataset.portalColumnKey || '') === 'action' || headerLabel(header) === 'acao / atividade');
    if (actionIndex >= 0) Array.from(table.tBodies[0]?.rows || []).forEach((row) => {
      const cell = row.cells[actionIndex] as HTMLTableCellElement | undefined;
      if (cell) cell.dataset.portalV52AuditAction = 'true';
    });
  }
}

function readCurrentPage(key: TableKey): number {
  try { return Math.max(1, Number(localStorage.getItem(currentPageKey(key))) || 1); }
  catch { return 1; }
}

function saveCurrentPage(key: TableKey, page: number) {
  try { localStorage.setItem(currentPageKey(key), String(Math.max(1, page))); }
  catch { /* noop */ }
}

function pagerElement(wrapper: HTMLElement, key: TableKey) {
  const next = wrapper.nextElementSibling as HTMLElement | null;
  if (next?.classList.contains('portal-v52-pager') && next.dataset.portalTableKey === key) return next;
  const pager = document.createElement('nav');
  pager.className = 'portal-v52-pager';
  pager.dataset.portalTableKey = key;
  pager.setAttribute('aria-label', 'Paginação da planilha');
  wrapper.insertAdjacentElement('afterend', pager);
  return pager;
}

function applyPagination(table: HTMLTableElement) {
  const key = tableKey(table);
  if (!key || !table.tBodies[0]) return;
  const wrapper = table.closest<HTMLElement>('.table-sticky-container') || table.parentElement;
  if (!wrapper) return;

  const allRows = Array.from(table.tBodies[0].rows);
  allRows.forEach((row) => row.classList.remove('portal-pagination-hidden'));
  const visibleRows = allRows.filter((row) => !row.classList.contains('portal-core-filter-hidden'));
  const pageSize = readPageSize(key);
  const pager = pagerElement(wrapper, key);

  if (pageSize === 'all') {
    saveCurrentPage(key, 1);
    pager.replaceChildren();
    const info = document.createElement('span');
    info.className = 'portal-v52-pager-info';
    info.textContent = `${visibleRows.length} registro${visibleRows.length === 1 ? '' : 's'}`;
    pager.appendChild(info);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const current = Math.min(totalPages, readCurrentPage(key));
  saveCurrentPage(key, current);
  const start = (current - 1) * pageSize;
  const end = start + pageSize;
  visibleRows.forEach((row, index) => row.classList.toggle('portal-pagination-hidden', index < start || index >= end));

  pager.replaceChildren();
  const summary = document.createElement('span');
  summary.className = 'portal-v52-pager-info';
  const first = visibleRows.length ? start + 1 : 0;
  const last = Math.min(end, visibleRows.length);
  summary.textContent = `${first}–${last} de ${visibleRows.length} registros`;
  pager.appendChild(summary);

  const controls = document.createElement('div');
  controls.className = 'portal-v52-pager-controls';
  const makeButton = (label: string, page: number, disabled = false, active = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = disabled;
    button.dataset.active = active ? 'true' : 'false';
    button.addEventListener('click', () => {
      saveCurrentPage(key, page);
      applyPagination(table);
      wrapper.scrollTop = 0;
    });
    return button;
  };
  controls.appendChild(makeButton('Anterior', Math.max(1, current - 1), current === 1));
  for (let page = 1; page <= totalPages; page += 1) controls.appendChild(makeButton(String(page), page, false, page === current));
  controls.appendChild(makeButton('Próxima', Math.min(totalPages, current + 1), current === totalPages));
  pager.appendChild(controls);
}

let activeSettingsTableKey: TableKey | null = null;

function findTableForControl(control: HTMLElement): HTMLTableElement | null {
  let current: HTMLElement | null = control;
  for (let depth = 0; current && depth < 10; depth += 1, current = current.parentElement) {
    const tables = Array.from(current.querySelectorAll<HTMLTableElement>('table')).filter((table) => Boolean(tableKey(table)));
    if (tables.length === 1) return tables[0];
    const visible = tables.find((table) => table.offsetParent !== null);
    if (visible) return visible;
  }
  return null;
}

function syncSettingsPopoverVisual() {
  const popup = document.querySelector<HTMLElement>('.portal-table-settings-popover');
  if (!popup || !activeSettingsTableKey) return;
  const pageSize = readPageSize(activeSettingsTableKey);
  const sections = Array.from(popup.querySelectorAll<HTMLElement>('section'));
  const rowSection = sections.find((section) => normalize(section.textContent || '').includes('linhas por pagina'));
  if (!rowSection) return;
  const status = Array.from(rowSection.querySelectorAll<HTMLElement>('span')).find((node) => normalize(node.textContent || '').startsWith('atual:'));
  if (status) status.textContent = `Atual: ${pageSize === 'all' ? 'Todos' : pageSize}`;
  rowSection.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    const label = normalize(button.textContent || '');
    const value: PageSize | null = label === 'todos' ? 'all' : parsePageSize(label);
    if (!value) return;
    const selected = value === pageSize;
    button.dataset.portalV52Selected = selected ? 'true' : 'false';
  });
}

function handleGlobalCapture(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const gear = target.closest<HTMLButtonElement>('button[aria-label="Configurar exibição da planilha"],button[title*="Exibição da planilha"]');
  if (gear) {
    const table = findTableForControl(gear);
    activeSettingsTableKey = table ? tableKey(table) : null;
    window.setTimeout(syncSettingsPopoverVisual, 0);
    return;
  }

  const popup = target.closest<HTMLElement>('.portal-table-settings-popover');
  const button = target.closest<HTMLButtonElement>('button');
  if (!popup || !button || !activeSettingsTableKey) return;
  const label = normalize(button.textContent || '');
  const size: PageSize | null = label === 'todos' ? 'all' : parsePageSize(label);
  if (!size) return;
  const rowSection = button.closest('section');
  if (!rowSection || !normalize(rowSection.textContent || '').includes('linhas por pagina')) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  savePageSize(activeSettingsTableKey, size);
  const table = Array.from(document.querySelectorAll<HTMLTableElement>('table')).find((candidate) => tableKey(candidate) === activeSettingsTableKey && candidate.offsetParent !== null);
  if (table) applyPagination(table);
  syncSettingsPopoverVisual();
}

function makeAllFilterButton(label: string) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'portal-standard-filter-chip portal-table-filter-chip portal-v52-all-filter flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-wider cursor-pointer h-7 shrink-0 border select-none';
  button.innerHTML = '<span class="portal-filter-dot rounded-full shrink-0"></span><span class="portal-v52-all-label"></span><span class="portal-v52-all-count"></span>';
  const labelNode = button.querySelector<HTMLElement>('.portal-v52-all-label');
  if (labelNode) labelNode.textContent = label;
  return button;
}

function enhanceMyTccFilters() {
  const row = document.querySelector<HTMLElement>('#meus-processos-page-container .portal-meus-processos-filter-row');
  if (!row) return;
  const group = Array.from(row.querySelectorAll<HTMLElement>('div')).find((node) => node.parentElement === row && node.querySelector('button.portal-standard-filter-chip'))
    || row.querySelector<HTMLElement>('div:has(button.portal-standard-filter-chip)');
  if (!group) return;
  const roleButtons = Array.from(group.querySelectorAll<HTMLButtonElement>('button.portal-standard-filter-chip:not(.portal-v52-all-filter)'));
  if (!roleButtons.length) return;
  let all = group.querySelector<HTMLButtonElement>('.portal-v52-all-filter');
  if (!all) {
    all = makeAllFilterButton('Todos');
    all.addEventListener('click', () => {
      roleButtons.forEach((button) => { if (button.getAttribute('aria-pressed') !== 'true') button.click(); });
      window.setTimeout(enhanceMyTccFilters, 0);
    });
    group.insertBefore(all, group.firstChild);
  }
  const selected = roleButtons.every((button) => button.getAttribute('aria-pressed') === 'true');
  all.setAttribute('aria-pressed', selected ? 'true' : 'false');
  all.dataset.selected = selected ? 'true' : 'false';
  const count = roleButtons.reduce((sum, button) => {
    const value = Number(button.querySelector('span:last-child')?.textContent || 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const countNode = all.querySelector<HTMLElement>('.portal-v52-all-count');
  if (countNode) countNode.textContent = String(count);
}

let presidentAllActive = false;
let presidentAllLoading = false;
let presidentAllCount = 0;
const presidentSelection = new Set<string>();

function dateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function deactivatePresidentAll() {
  presidentAllActive = false;
  const row = document.querySelector<HTMLElement>('#coordenador-page-root .portal-coordinator-filter-row');
  const nativeContent = row?.parentElement?.nextElementSibling as HTMLElement | null;
  if (nativeContent) nativeContent.style.display = '';
  document.getElementById('portal-president-all-view')?.remove();
  const all = row?.querySelector<HTMLButtonElement>('.portal-v52-president-all');
  if (all) { all.dataset.selected = 'false'; all.setAttribute('aria-pressed', 'false'); }
}

function updatePresidentSelection(table: HTMLTableElement) {
  const rows = Array.from(table.tBodies[0]?.rows || []);
  rows.forEach((row) => {
    const id = row.dataset.processId || '';
    const selected = presidentSelection.has(id);
    row.dataset.portalSelected = selected ? 'true' : 'false';
    const button = row.cells[0]?.querySelector<HTMLButtonElement>('button');
    if (button) button.textContent = selected ? '☑' : '☐';
    const cell = row.cells[0] as HTMLTableCellElement | undefined;
    if (cell) cell.dataset.portalFilterValue = selected ? 'Selecionado' : 'Não selecionado';
  });
  const headerButton = table.tHead?.rows[0]?.cells[0]?.querySelector<HTMLButtonElement>('button');
  if (headerButton) headerButton.textContent = rows.length > 0 && rows.every((row) => presidentSelection.has(row.dataset.processId || '')) ? '☑' : '☐';
}

async function renderPresidentAllView(filterRow: HTMLElement) {
  if (!presidentAllActive || presidentAllLoading) return;
  const nativeContent = filterRow.parentElement?.nextElementSibling as HTMLElement | null;
  if (!nativeContent) return;
  nativeContent.style.display = 'none';
  let host = document.getElementById('portal-president-all-view');
  if (!host) {
    host = document.createElement('div');
    host.id = 'portal-president-all-view';
    host.innerHTML = '<div class="portal-v52-loading">Carregando todos os registros…</div>';
    nativeContent.insertAdjacentElement('beforebegin', host);
  }
  presidentAllLoading = true;
  try {
    const [queue, processes] = await Promise.all([apiClient.getCoordinatorQueue(), apiClient.getProcesses()]);
    if (!presidentAllActive) return;
    const merged = new Map<string, { process: any; signed: boolean }>();
    (queue || []).forEach((item: any) => { if (item?.process?.id) merged.set(item.process.id, { process: item.process, signed: false }); });
    (processes || []).filter((process: any) => process?.status === 'CONCLUIDO').forEach((process: any) => merged.set(process.id, { process, signed: true }));
    const records = Array.from(merged.values()).sort((a, b) => String(b.process?.defesa?.startAt || '').localeCompare(String(a.process?.defesa?.startAt || '')));
    presidentAllCount = records.length;

    host.replaceChildren();
    const wrapper = document.createElement('div');
    wrapper.className = 'table-sticky-container portal-v52-president-all-scroll';
    const table = document.createElement('table');
    table.className = 'portal-spreadsheet-table portal-v52-president-all-table w-full min-w-[1100px] border-collapse text-xs';
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
        const selectAll = document.createElement('button');
        selectAll.type = 'button'; selectAll.textContent = '☐'; selectAll.title = 'Selecionar/Deselecionar todos';
        selectAll.addEventListener('click', () => {
          const ids = records.map((record) => String(record.process.id));
          const allSelected = ids.length > 0 && ids.every((id) => presidentSelection.has(id));
          ids.forEach((id) => allSelected ? presidentSelection.delete(id) : presidentSelection.add(id));
          updatePresidentSelection(table);
        });
        th.appendChild(selectAll);
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
      checkbox.type = 'button'; checkbox.textContent = presidentSelection.has(process.id) ? '☑' : '☐';
      checkbox.addEventListener('click', () => { presidentSelection.has(process.id) ? presidentSelection.delete(process.id) : presidentSelection.add(process.id); updatePresidentSelection(table); });
      selection.appendChild(checkbox);

      const processCell = row.insertCell();
      const pill = document.createElement('span');
      pill.className = `portal-process-pill ${signed ? 'portal-tone-signed' : 'portal-tone-pending'}`;
      pill.textContent = String(process.protocolo || process.id || '—').replace(/^TCC\s*[-/]?\s*/i, '');
      processCell.appendChild(pill);

      const envio = row.insertCell();
      envio.dataset.portalV52NeutralStatus = 'true';
      const envioSpan = document.createElement('span'); envioSpan.textContent = signed ? 'Assinada' : 'Pendente'; envio.appendChild(envioSpan);
      row.insertCell().textContent = dateTime(process.defesa?.startAt);
      row.insertCell().textContent = String(process.titulo || '—');
      row.insertCell().textContent = String(process.aluno1?.nome || '—');
      row.insertCell().textContent = String(process.aluno2?.nome || '—');
      row.insertCell().textContent = String(process.orientador?.nome || '—');
    });
    wrapper.appendChild(table);
    host.appendChild(wrapper);
    updatePresidentSelection(table);
    markSpreadsheetStructure(table);
    applyPagination(table);
  } catch (error) {
    host.innerHTML = `<div class="portal-v52-loading">Não foi possível carregar a visão “Todos”. ${error instanceof Error ? error.message : ''}</div>`;
  } finally {
    presidentAllLoading = false;
    enhancePresidentFilters();
  }
}

function enhancePresidentFilters() {
  const row = document.querySelector<HTMLElement>('#coordenador-page-root .portal-coordinator-filter-row');
  if (!row) return;
  const existingButtons = Array.from(row.querySelectorAll<HTMLButtonElement>('button.portal-standard-filter-chip:not(.portal-v52-president-all)'));
  if (!existingButtons.length) return;
  const group = existingButtons[0].parentElement;
  if (!group) return;
  let all = group.querySelector<HTMLButtonElement>('.portal-v52-president-all');
  if (!all) {
    all = makeAllFilterButton('Todos');
    all.classList.add('portal-v52-president-all');
    all.addEventListener('click', () => {
      presidentAllActive = true;
      all!.dataset.selected = 'true';
      all!.setAttribute('aria-pressed', 'true');
      existingButtons.forEach((button) => { button.dataset.selected = 'false'; button.setAttribute('aria-pressed', 'false'); });
      void renderPresidentAllView(row);
    });
    group.insertBefore(all, group.firstChild);
  }
  existingButtons.forEach((button) => {
    if (button.dataset.portalV52NativeBound === 'true') return;
    button.dataset.portalV52NativeBound = 'true';
    button.addEventListener('click', deactivatePresidentAll, true);
  });
  all.dataset.selected = presidentAllActive ? 'true' : 'false';
  all.setAttribute('aria-pressed', presidentAllActive ? 'true' : 'false');
  const countNode = all.querySelector<HTMLElement>('.portal-v52-all-count');
  if (countNode) countNode.textContent = presidentAllCount ? String(presidentAllCount) : '';
}

let desiredSyncPane: 'identity' | 'integrations' = 'identity';

function replaceText(node: HTMLElement, from: RegExp, to: string) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) texts.push(current as Text);
  texts.forEach((text) => { if (from.test(text.data)) text.data = text.data.replace(from, to); });
}

function enhanceSettingsHub() {
  const hub = document.getElementById('portal-settings-hub');
  if (!hub) return;
  let identity = hub.querySelector<HTMLButtonElement>('button[data-portal-v52-settings-identity="true"]');
  if (!identity) {
    identity = Array.from(hub.querySelectorAll<HTMLButtonElement>('button.portal-settings-title-bar')).find((button) => normalize(button.textContent || '').includes('sincronizacao')) || null;
    if (identity) {
      identity.dataset.portalV52SettingsIdentity = 'true';
      identity.addEventListener('click', () => { desiredSyncPane = 'identity'; });
    }
  }
  if (!identity) return;
  replaceText(identity, /Sincronização/gi, 'Rodapé e Identidade');
  replaceText(identity, /Rodapé, Asten, Google, Supabase, Vercel e demais integrações\./gi, 'Responsáveis, contatos, rodapé e identidade operacional.');

  let integrations = hub.querySelector<HTMLButtonElement>('button[data-portal-v52-settings-integrations="true"]');
  if (!integrations) {
    integrations = identity.cloneNode(true) as HTMLButtonElement;
    integrations.removeAttribute('id');
    integrations.dataset.portalV52SettingsIdentity = 'false';
    integrations.dataset.portalV52SettingsIntegrations = 'true';
    replaceText(integrations, /Rodapé e Identidade/gi, 'Integrações e Plataforma');
    replaceText(integrations, /Responsáveis, contatos, rodapé e identidade operacional\./gi, 'Asten, Google, Supabase, Vercel e demais integrações da plataforma.');
    integrations.addEventListener('click', (event) => {
      event.preventDefault(); event.stopPropagation();
      desiredSyncPane = 'integrations';
      identity!.click();
      window.setTimeout(configureSettingsWorkspace, 0);
    });
    identity.insertAdjacentElement('afterend', integrations);
  }
}

function configureSettingsWorkspace() {
  const workspace = document.querySelector<HTMLElement>('.portal-settings-workspace');
  if (!workspace) return;
  const heading = workspace.querySelector<HTMLElement>('.portal-settings-workspace-header h2');
  const title = normalize(heading?.textContent || '');
  workspace.removeAttribute('data-portal-v52-settings-kind');

  const navButtons = Array.from(workspace.querySelectorAll<HTMLButtonElement>('aside button'));
  const syncWorkspace = title.includes('sincronizacao') || navButtons.some((button) => normalize(button.textContent || '').includes('rodape e identidade'));
  if (syncWorkspace) {
    workspace.dataset.portalV52SettingsKind = desiredSyncPane === 'identity' ? 'identity' : 'integrations';
    const wanted = navButtons.find((button) => normalize(button.textContent || '').includes(desiredSyncPane === 'identity' ? 'rodape e identidade' : 'integracoes e plataformas'));
    if (wanted && !wanted.classList.contains('text-white')) wanted.click();
    if (heading) heading.textContent = desiredSyncPane === 'identity' ? 'Rodapé e Identidade' : 'Integrações e Plataforma';
    return;
  }
  if (title.includes('acesso')) workspace.dataset.portalV52SettingsKind = 'access';
  else if (title.includes('modelos e variaveis')) workspace.dataset.portalV52SettingsKind = 'models';
  else if (title.includes('registros de assinatura')) workspace.dataset.portalV52SettingsKind = 'signatures';
  else if (title.includes('registro de logs')) workspace.dataset.portalV52SettingsKind = 'logs';
}

function enhanceTables() {
  document.querySelectorAll<HTMLTableElement>('#portal-app-root table, .portal-settings-workspace table').forEach((table) => {
    if (!tableKey(table)) return;
    markSpreadsheetStructure(table);
    applyPagination(table);
  });
}

function enhanceAll() {
  enhanceSettingsHub();
  configureSettingsWorkspace();
  enhanceMyTccFilters();
  enhancePresidentFilters();
  enhanceTables();
  syncSettingsPopoverVisual();
}

export function PortalVersion1052Enhancer() {
  useEffect(() => {
    document.addEventListener('click', handleGlobalCapture, true);
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(enhanceAll);
    };
    enhanceAll();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-pressed', 'data-selected', 'data-portal-filter-value'] });
    window.addEventListener('portal:table-layout-changed', schedule as EventListener);
    window.addEventListener('global_table_layouts_changed', schedule as EventListener);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener('click', handleGlobalCapture, true);
      window.removeEventListener('portal:table-layout-changed', schedule as EventListener);
      window.removeEventListener('global_table_layouts_changed', schedule as EventListener);
    };
  }, []);
  return null;
}
