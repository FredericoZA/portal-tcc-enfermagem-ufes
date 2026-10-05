import { normalizePortalTableText, readPortalHeaderLabel, slugPortalTableText, stableTableIdentity } from './portalTableIdentity';

type TableState = {
  filters: Map<string, Set<string>>;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
};

const tableState = new WeakMap<HTMLTableElement, TableState>();
const WIDTH_PREFIX = 'portal_table_widths_';
const WRAP_PREFIX = 'portal_table_wrap_';
const LEGACY_WIDTH_PREFIX = 'portal_tcc_v1043_widths_';
const LEGACY_WRAP_PREFIX = 'portal_tcc_v1043_wrap_';
const MIN_WIDTH = 72;
const MAX_WIDTH = 720;

let activePopup: HTMLElement | null = null;
let activeButton: HTMLButtonElement | null = null;




export function closePortalTablePopup() {
  activePopup?.remove();
  activePopup = null;
  activeButton?.setAttribute('aria-expanded', 'false');
  activeButton = null;
}

function keyForHeader(header: HTMLTableCellElement, index: number) {
  if (!header.dataset.portalCoreColumnKey) {
    header.dataset.portalCoreColumnKey = `${index}:${slugPortalTableText(readPortalHeaderLabel(header)) || `coluna-${index + 1}`}`;
  }
  return header.dataset.portalCoreColumnKey;
}

function cellValue(row: HTMLTableRowElement, index: number) {
  const cell = row.cells[index];
  return (cell?.dataset.portalFilterValue || cell?.textContent || '—').replace(/\s+/g, ' ').trim() || '—';
}

function comparable(value: string): string | number {
  const date = value.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (date) return Number(`${date[3]}${date[2]}${date[1]}`);
  const stage = value.match(/^Etapa\s+(\d+(?:[.,]\d+)?)/i);
  if (stage) return Number(stage[1].replace(',', '.'));
  const percent = value.match(/^(-?\d+(?:[.,]\d+)?)\s*%$/);
  if (percent) return Number(percent[1].replace(',', '.'));
  const pure = value.replace(/\./g, '').replace(',', '.');
  if (/^[-+]?\d+(?:\.\d+)?$/.test(pure)) return Number(pure);
  return value.toLocaleLowerCase('pt-BR');
}

function applyFilters(table: HTMLTableElement) {
  const state = tableState.get(table);
  if (!state) return;
  const headers = Array.from(table.tHead?.rows[0]?.cells || []) as HTMLTableCellElement[];
  Array.from(table.tBodies[0]?.rows || []).forEach((row) => {
    const visible = Array.from(state.filters.entries()).every(([key, allowed]) => {
      const index = headers.findIndex((header, idx) => keyForHeader(header, idx) === key);
      return index < 0 || allowed.has(cellValue(row, index));
    });
    row.classList.toggle('portal-core-filter-hidden', !visible);
  });
  headers.forEach((header, index) => {
    const active = state.filters.has(keyForHeader(header, index));
    header.querySelector<HTMLButtonElement>('.portal-core-column-menu')?.setAttribute('data-filter-active', active ? 'true' : 'false');
  });
}

function sortRows(table: HTMLTableElement, key: string, index: number, direction: 'asc' | 'desc') {
  const state = tableState.get(table) || { filters: new Map<string, Set<string>>() };
  state.sortKey = key;
  state.sortDirection = direction;
  tableState.set(table, state);
  const body = table.tBodies[0];
  if (!body) return;
  const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
  const rows = Array.from(body.rows);
  rows.sort((a, b) => {
    const av = comparable(cellValue(a, index));
    const bv = comparable(cellValue(b, index));
    const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : collator.compare(String(av), String(bv));
    return direction === 'asc' ? result : -result;
  });
  rows.forEach((row) => body.appendChild(row));
  Array.from(table.tHead?.rows[0]?.cells || []).forEach((cell) => cell.removeAttribute('aria-sort'));
  table.tHead?.rows[0]?.cells[index]?.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
  applyFilters(table);
}

function menuButton(label: string, className: string, onClick: () => void) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

function openColumnMenu(table: HTMLTableElement, header: HTMLTableCellElement, index: number, anchor: HTMLButtonElement) {
  closePortalTablePopup();
  const state = tableState.get(table) || { filters: new Map<string, Set<string>>() };
  tableState.set(table, state);
  const key = keyForHeader(header, index);
  const label = readPortalHeaderLabel(header);
  const values = Array.from(new Set(Array.from(table.tBodies[0]?.rows || []).map((row) => cellValue(row, index))))
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }));

  const popup = document.createElement('div');
  popup.className = 'portal-core-column-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', `Ordenar e filtrar ${label}`);

  const title = document.createElement('div');
  title.className = 'portal-core-popup-title';
  title.textContent = label;
  popup.appendChild(title);

  const sortActions = document.createElement('div');
  sortActions.className = 'portal-core-sort-actions';
  sortActions.append(
    menuButton('Ordenar A → Z / menor → maior', 'portal-core-menu-action', () => {
      sortRows(table, key, index, 'asc');
      closePortalTablePopup();
    }),
    menuButton('Ordenar Z → A / maior → menor', 'portal-core-menu-action', () => {
      sortRows(table, key, index, 'desc');
      closePortalTablePopup();
    }),
  );
  popup.appendChild(sortActions);

  const filterTitle = document.createElement('div');
  filterTitle.className = 'portal-core-filter-title';
  filterTitle.textContent = 'Filtrar';
  popup.appendChild(filterTitle);

  const selectionActions = document.createElement('div');
  selectionActions.className = 'portal-core-selection-actions';
  const selectAll = menuButton('Selecionar tudo', 'portal-core-selection-action', () => {
    state.filters.delete(key);
    applyFilters(table);
    renderValues(search.value);
  });
  const clearAll = menuButton('Limpar tudo', 'portal-core-selection-action', () => {
    state.filters.set(key, new Set());
    applyFilters(table);
    renderValues(search.value);
  });
  selectionActions.append(selectAll, clearAll);
  popup.appendChild(selectionActions);

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'portal-core-filter-search';
  search.placeholder = 'Buscar valor…';
  popup.appendChild(search);

  const list = document.createElement('div');
  list.className = 'portal-core-filter-values';
  popup.appendChild(list);

  const renderValues = (term = '') => {
    list.replaceChildren();
    const allowed = state.filters.get(key);
    const normalizedTerm = normalizePortalTableText(term);
    values
      .filter((value) => normalizePortalTableText(value).includes(normalizedTerm))
      .forEach((value) => {
        const labelNode = document.createElement('label');
        labelNode.className = 'portal-core-filter-value';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !allowed || allowed.has(value);
        checkbox.addEventListener('change', () => {
          const next = state.filters.has(key) ? new Set(state.filters.get(key)!) : new Set(values);
          if (checkbox.checked) next.add(value);
          else next.delete(value);
          if (next.size === values.length) state.filters.delete(key);
          else state.filters.set(key, next);
          applyFilters(table);
          renderValues(search.value);
        });
        const text = document.createElement('span');
        text.textContent = value;
        labelNode.append(checkbox, text);
        list.appendChild(labelNode);
      });
  };

  search.addEventListener('input', () => renderValues(search.value));
  renderValues();

  const footer = document.createElement('div');
  footer.className = 'portal-core-popup-footer';
  footer.append(
    menuButton('Limpar filtro', 'portal-core-clear-filter', () => {
      state.filters.delete(key);
      applyFilters(table);
      renderValues(search.value);
    }),
    menuButton('Concluir', 'portal-core-done', closePortalTablePopup),
  );
  popup.appendChild(footer);
  document.body.appendChild(popup);

  activePopup = popup;
  activeButton = anchor;
  anchor.setAttribute('aria-expanded', 'true');
  const rect = anchor.getBoundingClientRect();
  const width = 320;
  const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
  let top = rect.bottom + 6;
  if (top + 460 > window.innerHeight) top = Math.max(12, rect.top - 460);
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  window.setTimeout(() => search.focus(), 0);
}

function tableKey(table: HTMLTableElement) {
  if (!table.dataset.portalCoreTableKey) {
    table.dataset.portalCoreTableKey = stableTableIdentity(table);
  }
  return table.dataset.portalCoreTableKey;
}

function widthStorageKey(table: HTMLTableElement) {
  return `${WIDTH_PREFIX}${tableKey(table)}`;
}

function legacyWidthStorageKey(table: HTMLTableElement) {
  return `${LEGACY_WIDTH_PREFIX}${tableKey(table)}`;
}

function wrapStorageKey(table: HTMLTableElement) {
  return `${WRAP_PREFIX}${tableKey(table)}`;
}

function legacyWrapStorageKey(table: HTMLTableElement) {
  return `${LEGACY_WRAP_PREFIX}${tableKey(table)}`;
}

function readWidths(table: HTMLTableElement): Record<string, number> {
  try {
    const currentKey = widthStorageKey(table);
    const current = localStorage.getItem(currentKey);
    if (current) return JSON.parse(current);

    const legacyKey = legacyWidthStorageKey(table);
    const legacy = localStorage.getItem(legacyKey);
    if (!legacy) return {};

    const parsed = JSON.parse(legacy);
    localStorage.setItem(currentKey, JSON.stringify(parsed));
    localStorage.removeItem(legacyKey);
    return parsed;
  } catch {
    return {};
  }
}

function readWrapMode(table: HTMLTableElement) {
  try {
    const currentKey = wrapStorageKey(table);
    const current = localStorage.getItem(currentKey);
    if (current) return current;

    const legacyKey = legacyWrapStorageKey(table);
    const legacy = localStorage.getItem(legacyKey);
    if (!legacy) return null;

    localStorage.setItem(currentKey, legacy);
    localStorage.removeItem(legacyKey);
    return legacy;
  } catch {
    return null;
  }
}

function applyColumnWidth(table: HTMLTableElement, index: number, width: number) {
  const px = `${Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(width)))}px`;
  const header = table.tHead?.rows[0]?.cells[index] as HTMLTableCellElement | undefined;
  if (header) header.style.width = header.style.minWidth = header.style.maxWidth = px;
  Array.from(table.tBodies).forEach((body) => Array.from(body.rows).forEach((row) => {
    const cell = row.cells[index] as HTMLTableCellElement | undefined;
    if (cell) cell.style.width = cell.style.minWidth = cell.style.maxWidth = px;
  }));
}

function installResizer(table: HTMLTableElement, header: HTMLTableCellElement, index: number) {
  if (header.dataset.portalSelectionColumn === 'true' || header.querySelector(':scope > .portal-core-resizer')) return;
  const handle = document.createElement('span');
  handle.className = 'portal-core-resizer';
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.title = 'Arraste para alterar a largura da coluna';
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = Math.max(MIN_WIDTH, header.getBoundingClientRect().width);
    document.documentElement.classList.add('portal-core-resizing');
    const onMove = (moveEvent: PointerEvent) => applyColumnWidth(table, index, startWidth + moveEvent.clientX - startX);
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.documentElement.classList.remove('portal-core-resizing');
      const widths = readWidths(table);
      widths[keyForHeader(header, index)] = Math.round(header.getBoundingClientRect().width);
      try { localStorage.setItem(widthStorageKey(table), JSON.stringify(widths)); } catch {}
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp, { once: true });
  });
  header.appendChild(handle);
}

function restoreWidths(table: HTMLTableElement) {
  const widths = readWidths(table);
  Array.from(table.tHead?.rows[0]?.cells || []).forEach((cell, index) => {
    const header = cell as HTMLTableCellElement;
    const saved = widths[keyForHeader(header, index)];
    if (Number.isFinite(saved)) applyColumnWidth(table, index, saved);
  });
}

function stripLegacyHeaderControls(header: HTMLTableCellElement) {
  header.querySelectorAll<HTMLElement>(
    '.portal-column-controls,.portal1040-inline-sort,.portal1041-column-menu-button,.portal1043-column-menu-button,.portal-column-sort,.portal-column-filter,button[aria-label*="Ordenar"],button[aria-label*="Filtrar"]',
  ).forEach((node) => {
    if (!node.classList.contains('portal-core-column-menu')) node.remove();
  });
  header.querySelectorAll('svg').forEach((svg) => {
    if (!svg.closest('.portal-core-column-menu')) svg.remove();
  });
  const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) nodes.push(current as Text);
  nodes.forEach((node) => {
    if (!node.parentElement?.closest('button') && /[↕↑↓]/.test(node.data)) node.data = node.data.replace(/[↕↑↓]/g, '');
  });
}

export function enhancePortalTable(table: HTMLTableElement) {
  if (table.closest('[role="dialog"]') || table.closest('.portal-core-column-popup') || table.closest('[data-portal-workspace-open="true"]')) return;
  const headerRow = table.tHead?.rows[0];
  if (!headerRow || headerRow.cells.length < 2 || !table.tBodies[0]) return;
  table.classList.add('portal-core-table');
  if (!tableState.has(table)) tableState.set(table, { filters: new Map() });
  Array.from(headerRow.cells).forEach((cell, index) => {
    const header = cell as HTMLTableCellElement;
    stripLegacyHeaderControls(header);
    header.classList.add('portal-core-header-cell');
    keyForHeader(header, index);
    if (!header.dataset.portalCoreClickGuard) {
      header.dataset.portalCoreClickGuard = 'true';
      header.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        if (target.closest('.portal-core-column-menu,.portal-core-resizer,input[type="checkbox"]')) return;
        event.stopPropagation();
      }, true);
    }
    if (header.dataset.portalSelectionColumn !== 'true' && !header.querySelector(':scope > .portal-core-column-menu')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'portal-core-column-menu';
      button.title = `Ordenar ou filtrar ${readPortalHeaderLabel(header)}`;
      button.setAttribute('aria-label', `Ordenar ou filtrar ${readPortalHeaderLabel(header)}`);
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (activeButton === button && activePopup) closePortalTablePopup();
        else openColumnMenu(table, header, index, button);
      });
      header.appendChild(button);
    }
    installResizer(table, header, index);
  });
  restoreWidths(table);
  const wrap = readWrapMode(table);
  table.classList.toggle('portal-core-nowrap', wrap === 'nowrap');
  applyFilters(table);
}
