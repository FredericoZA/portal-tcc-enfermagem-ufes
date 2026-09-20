import { useEffect } from 'react';

type SheetState = {
  filters: Map<string, Set<string>>;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
};

const sheetState = new WeakMap<HTMLTableElement, SheetState>();
let activePopup: HTMLElement | null = null;
let activeButton: HTMLButtonElement | null = null;

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function closePopup() {
  activePopup?.remove();
  activePopup = null;
  if (activeButton) activeButton.setAttribute('aria-expanded', 'false');
  activeButton = null;
}

function renameProgressHeader(header: HTMLTableCellElement) {
  const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) nodes.push(current as Text);

  nodes.forEach((node) => {
    if (node.parentElement?.closest('button,.portal-column-controls,.portal1041-column-menu-button')) return;
    const next = node.data.replace(/\bProgresso\b/gi, 'Etapa');
    if (next !== node.data) node.data = next;
  });

  if (normalize(header.dataset.portalColumnLabel || '') === 'progresso') {
    header.dataset.portalColumnLabel = 'Etapa';
  }
}

function headerLabel(header: HTMLTableCellElement) {
  const explicit = header.dataset.portalColumnLabel;
  if (explicit && normalize(explicit) !== 'progresso') return explicit;

  const clone = header.cloneNode(true) as HTMLTableCellElement;
  clone.querySelectorAll('button,.portal-column-controls,.portal1040-inline-sort,.portal1041-column-menu-button').forEach((node) => node.remove());
  const label = (clone.textContent || '').replace(/[↕↑↓⌄]/g, '').replace(/\s+/g, ' ').trim();
  return normalize(label) === 'progresso' ? 'Etapa' : label || 'Coluna';
}

function keyForHeader(header: HTMLTableCellElement, index: number) {
  if (!header.dataset.portal1041ColumnKey) {
    header.dataset.portal1041ColumnKey = `${index}:${normalize(headerLabel(header)) || `coluna-${index + 1}`}`;
  }
  return header.dataset.portal1041ColumnKey;
}

function cellValue(row: HTMLTableRowElement, index: number) {
  const cell = row.cells[index];
  return (cell?.dataset.portalFilterValue || cell?.textContent || '—').replace(/\s+/g, ' ').trim() || '—';
}

function parseComparable(raw: string): string | number {
  const value = raw.trim();
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
  const state = sheetState.get(table);
  if (!state) return;

  const headers = Array.from(table.tHead?.rows[0]?.cells || []) as HTMLTableCellElement[];
  const rows = Array.from(table.tBodies[0]?.rows || []);

  rows.forEach((row) => {
    const visible = Array.from(state.filters.entries()).every(([key, allowed]) => {
      const index = headers.findIndex((header, idx) => keyForHeader(header, idx) === key);
      return index < 0 || allowed.has(cellValue(row, index));
    });
    row.classList.toggle('portal1041-filter-hidden', !visible);
  });

  headers.forEach((header, index) => {
    const key = keyForHeader(header, index);
    header.classList.toggle('portal1041-filter-active', state.filters.has(key));
    header.querySelector<HTMLButtonElement>('.portal1041-column-menu-button')?.setAttribute(
      'data-filter-active',
      state.filters.has(key) ? 'true' : 'false',
    );
  });
}

function sortRows(table: HTMLTableElement, key: string, index: number, direction: 'asc' | 'desc') {
  const state = sheetState.get(table) || { filters: new Map<string, Set<string>>() };
  state.sortKey = key;
  state.sortDirection = direction;
  sheetState.set(table, state);

  const body = table.tBodies[0];
  if (!body) return;

  const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
  const rows = Array.from(body.rows);
  rows.sort((a, b) => {
    const av = parseComparable(cellValue(a, index));
    const bv = parseComparable(cellValue(b, index));
    const result = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : collator.compare(String(av), String(bv));
    return direction === 'asc' ? result : -result;
  });

  rows.forEach((row) => body.appendChild(row));
  Array.from(table.tHead?.rows[0]?.cells || []).forEach((cell) => cell.removeAttribute('aria-sort'));
  table.tHead?.rows[0]?.cells[index]?.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
  applyFilters(table);
}

function stageTextFromCell(cell: HTMLTableCellElement) {
  const marker = cell.querySelector<HTMLElement>('.portal-progress-number,[title*="Etapa"],[aria-label*="Etapa"]');
  if (!marker) return;

  const descriptor = `${marker.getAttribute('title') || ''} ${marker.getAttribute('aria-label') || ''}`;
  const match = descriptor.match(/Etapa\s+(\d+(?:[.,]\d+)?)/i);
  if (!match) return;

  const stage = `Etapa ${match[1].replace('.', ',')}`;
  if (marker.textContent?.trim() !== stage) marker.textContent = stage;
  marker.classList.add('portal1041-stage-label');
  marker.setAttribute('aria-label', descriptor.trim() || stage);
}

function normalizeStageColumns(table: HTMLTableElement) {
  const headers = Array.from(table.tHead?.rows[0]?.cells || []) as HTMLTableCellElement[];
  headers.forEach((header, index) => {
    renameProgressHeader(header);
    const label = normalize(headerLabel(header));
    if (label !== 'etapa') return;
    Array.from(table.tBodies[0]?.rows || []).forEach((row) => {
      const cell = row.cells[index] as HTMLTableCellElement | undefined;
      if (cell) stageTextFromCell(cell);
    });
  });
}

function createSortButton(label: string, direction: 'asc' | 'desc', onClick: () => void) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'portal1041-menu-action';
  button.textContent = label;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

function openColumnMenu(table: HTMLTableElement, header: HTMLTableCellElement, index: number, anchor: HTMLButtonElement) {
  closePopup();
  const state = sheetState.get(table) || { filters: new Map<string, Set<string>>() };
  sheetState.set(table, state);

  const key = keyForHeader(header, index);
  const label = headerLabel(header);
  const values = Array.from(new Set(Array.from(table.tBodies[0]?.rows || []).map((row) => cellValue(row, index))))
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }));

  const popup = document.createElement('div');
  popup.className = 'portal1041-column-menu-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', `Opções da coluna ${label}`);

  const title = document.createElement('div');
  title.className = 'portal1041-column-menu-title';
  title.textContent = label;
  popup.appendChild(title);

  const sortGroup = document.createElement('div');
  sortGroup.className = 'portal1041-column-menu-sort';
  sortGroup.append(
    createSortButton('Ordenar A → Z / menor → maior', 'asc', () => {
      sortRows(table, key, index, 'asc');
      closePopup();
    }),
    createSortButton('Ordenar Z → A / maior → menor', 'desc', () => {
      sortRows(table, key, index, 'desc');
      closePopup();
    }),
  );
  popup.appendChild(sortGroup);

  const filterTitle = document.createElement('div');
  filterTitle.className = 'portal1041-column-filter-title';
  filterTitle.textContent = 'Filtrar';
  popup.appendChild(filterTitle);

  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Buscar valor…';
  search.className = 'portal1041-column-filter-search';
  popup.appendChild(search);

  const list = document.createElement('div');
  list.className = 'portal1041-column-filter-values';
  popup.appendChild(list);

  const renderValues = (term = '') => {
    list.replaceChildren();
    const normalizedTerm = normalize(term);
    const current = state.filters.get(key);
    values
      .filter((value) => normalize(value).includes(normalizedTerm))
      .forEach((value) => {
        const option = document.createElement('label');
        option.className = 'portal1041-column-filter-value';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !current || current.has(value);
        checkbox.addEventListener('change', () => {
          const allowed = state.filters.has(key) ? new Set(state.filters.get(key)!) : new Set(values);
          if (checkbox.checked) allowed.add(value);
          else allowed.delete(value);

          if (allowed.size === values.length) state.filters.delete(key);
          else state.filters.set(key, allowed);
          applyFilters(table);
        });

        const text = document.createElement('span');
        text.textContent = value;
        option.append(checkbox, text);
        list.appendChild(option);
      });
  };

  renderValues();
  search.addEventListener('input', () => renderValues(search.value));

  const footer = document.createElement('div');
  footer.className = 'portal1041-column-menu-footer';

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.textContent = 'Limpar filtro';
  clear.addEventListener('click', (event) => {
    event.stopPropagation();
    state.filters.delete(key);
    applyFilters(table);
    renderValues(search.value);
  });

  const done = document.createElement('button');
  done.type = 'button';
  done.textContent = 'Concluir';
  done.addEventListener('click', (event) => {
    event.stopPropagation();
    closePopup();
  });

  footer.append(clear, done);
  popup.appendChild(footer);
  document.body.appendChild(popup);

  activePopup = popup;
  activeButton = anchor;
  anchor.setAttribute('aria-expanded', 'true');

  const rect = anchor.getBoundingClientRect();
  const width = 300;
  let left = Math.min(rect.right - width, window.innerWidth - width - 12);
  left = Math.max(12, left);
  let top = rect.bottom + 6;
  if (top + 410 > window.innerHeight) top = Math.max(12, rect.top - 410);
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  window.setTimeout(() => search.focus(), 0);
}

function addColumnMenu(table: HTMLTableElement, header: HTMLTableCellElement, index: number) {
  if (header.dataset.portalSelectionColumn === 'true') return;

  header.classList.add('portal1041-column-header');
  const key = keyForHeader(header, index);
  void key;

  if (!header.dataset.portal1041NativeClickGuard) {
    header.dataset.portal1041NativeClickGuard = 'true';
    header.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('.portal1041-column-menu-button')) return;
      if (target.closest('input[type="checkbox"]')) return;
      event.stopPropagation();
    });
  }

  let button = header.querySelector<HTMLButtonElement>(':scope > .portal1041-column-menu-button');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'portal1041-column-menu-button';
    button.title = `Ordenar ou filtrar ${headerLabel(header)}`;
    button.setAttribute('aria-label', `Ordenar ou filtrar ${headerLabel(header)}`);
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (activeButton === button && activePopup) {
        closePopup();
        return;
      }
      openColumnMenu(table, header, index, button!);
    });
    header.appendChild(button);
  }
}

function enhanceTable(table: HTMLTableElement) {
  const headerRow = table.tHead?.rows[0];
  const body = table.tBodies[0];
  if (!headerRow || !body || headerRow.cells.length < 2) return;

  table.classList.add('portal1041-sheet');
  if (!sheetState.has(table)) sheetState.set(table, { filters: new Map() });

  normalizeStageColumns(table);
  Array.from(headerRow.cells).forEach((cell, index) => addColumnMenu(table, cell as HTMLTableCellElement, index));
  applyFilters(table);
}

function markCalendarWeekends() {
  const grids = new Set<HTMLElement>();
  document.querySelectorAll<HTMLElement>('.portal-calendar-grid').forEach((grid) => grids.add(grid));
  document.querySelectorAll<HTMLElement>('.portal-calendar-day-cell').forEach((cell) => {
    if (cell.parentElement) grids.add(cell.parentElement);
  });

  grids.forEach((grid) => {
    grid.classList.add('portal1041-calendar-grid');
    const header = grid.parentElement?.previousElementSibling as HTMLElement | null;
    header?.classList.add('portal1041-calendar-week-header');

    Array.from(grid.children).forEach((child, index) => {
      if (!(child instanceof HTMLElement)) return;
      const column = index % 7;
      const weekend = column === 0 || column === 6;
      child.classList.toggle('portal1041-calendar-weekend', weekend);
      if (weekend) child.setAttribute('aria-disabled', 'true');
      else child.removeAttribute('aria-disabled');
    });
  });
}

function classifyDefenseFilterChips() {
  document.querySelectorAll<HTMLButtonElement>('.portal-defense-filter-row button').forEach((button) => {
    const text = normalize(button.textContent || '');
    button.classList.remove('portal1041-defense-filter-all', 'portal1041-defense-filter-pending', 'portal1041-defense-filter-defended');
    if (text.includes('ja defendid') || text.includes('defendida')) button.classList.add('portal1041-defense-filter-defended');
    else if (text.includes('a defender') || text.includes('pendente')) button.classList.add('portal1041-defense-filter-pending');
    else if (text === 'todas' || text === 'todos') button.classList.add('portal1041-defense-filter-all');
  });
}

function renameProgressInSettings() {
  document.querySelectorAll<HTMLElement>('.portal-table-settings-popover').forEach((popover) => {
    const walker = document.createTreeWalker(popover, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let current: Node | null;
    while ((current = walker.nextNode())) nodes.push(current as Text);
    nodes.forEach((node) => {
      if (normalize(node.data) === 'progresso') node.data = node.data.replace(/Progresso/gi, 'Etapa');
    });
  });
}

function lockHoverPaint(element: HTMLElement) {
  element.classList.remove('portal1041-hover-lock');
  const computed = window.getComputedStyle(element);
  element.style.setProperty('--portal1041-lock-bg', computed.backgroundColor);
  element.style.setProperty('--portal1041-lock-color', computed.color);
  element.style.setProperty('--portal1041-lock-border', computed.borderColor);
  element.classList.add('portal1041-hover-lock');
}

function freezeSpreadsheetHoverColors() {
  const selector = [
    '.portal-standard-filter-chip',
    '.portal-table-filter-chip',
    '.portal-defense-filter-row button',
    '.portal-meus-processos-filter-row button',
    '.portal-coordinator-filter-row button',
    'button[title^="Buscar"]',
    'button[aria-label^="Buscar"]',
    'button[title*="Atualizar dados da tabela"]',
    'button[title*="Exibição da planilha"]',
    'button[aria-label*="Exibição da planilha"]',
  ].join(',');

  document.querySelectorAll<HTMLElement>(`#portal-app-root main ${selector}`).forEach(lockHoverPaint);
}

function enhanceAll() {
  document.querySelectorAll<HTMLTableElement>('#portal-app-root main .portal-spreadsheet-table, #portal-app-root main table.portal1041-sheet').forEach(enhanceTable);
  markCalendarWeekends();
  classifyDefenseFilterChips();
  renameProgressInSettings();
  freezeSpreadsheetHoverColors();
}

export function PortalSpreadsheetRefinementEnhancer() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(enhanceAll);
    };

    enhanceAll();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-pressed', 'data-selected'],
    });

    const onPointerDown = (event: MouseEvent) => {
      if (!activePopup) return;
      const target = event.target as Node;
      if (activePopup.contains(target) || activeButton?.contains(target)) return;
      closePopup();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePopup();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      closePopup();
    };
  }, []);

  return null;
}
