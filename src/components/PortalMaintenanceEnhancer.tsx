import { useEffect } from 'react';

type SheetState = {
  filters: Map<string, Set<string>>;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
};

const sheetState = new WeakMap<HTMLTableElement, SheetState>();
let activePopup: HTMLElement | null = null;
let activeButton: HTMLButtonElement | null = null;

const MONTHS: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  'março': 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function splitSelectorList(selectorText: string) {
  const output: string[] = [];
  let current = '';
  let roundDepth = 0;
  let squareDepth = 0;
  let quote = '';

  for (let index = 0; index < selectorText.length; index += 1) {
    const char = selectorText[index];
    const previous = selectorText[index - 1];

    if (quote) {
      current += char;
      if (char === quote && previous !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(') roundDepth += 1;
    if (char === ')') roundDepth = Math.max(0, roundDepth - 1);
    if (char === '[') squareDepth += 1;
    if (char === ']') squareDepth = Math.max(0, squareDepth - 1);

    if (char === ',' && roundDepth === 0 && squareDepth === 0) {
      if (current.trim()) output.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) output.push(current.trim());
  return output;
}

function stripHoverRulesFrom(container: CSSStyleSheet | CSSRule) {
  let rules: CSSRuleList;
  try {
    rules = (container as CSSStyleSheet).cssRules || (container as CSSRule & { cssRules?: CSSRuleList }).cssRules!;
  } catch {
    return;
  }
  if (!rules) return;

  for (let index = rules.length - 1; index >= 0; index -= 1) {
    const rule = rules[index] as CSSRule & { selectorText?: string; cssRules?: CSSRuleList };
    if (typeof rule.selectorText === 'string' && rule.selectorText.includes(':hover')) {
      const remaining = splitSelectorList(rule.selectorText).filter((selector) => !selector.includes(':hover'));
      try {
        if (remaining.length === 0 && 'deleteRule' in container) {
          (container as CSSStyleSheet & { deleteRule: (index: number) => void }).deleteRule(index);
          continue;
        }
        if (remaining.length > 0) rule.selectorText = remaining.join(', ');
      } catch {
        // Algumas folhas geradas pelo navegador não permitem reescrever seletores.
      }
    }
    if (rule.cssRules?.length) stripHoverRulesFrom(rule);
  }
}

function neutralizeHoverBehavior() {
  Array.from(document.styleSheets).forEach((sheet) => stripHoverRulesFrom(sheet));
  document.querySelectorAll<HTMLElement>('#portal-app-root [class*="hover"]').forEach((element) => {
    const removable = Array.from(element.classList).filter((token) =>
      token.startsWith('hover:') || token.includes(':hover:') || token.startsWith('group-hover:') || token.startsWith('peer-hover:'),
    );
    if (removable.length) element.classList.remove(...removable);
  });
}

function closePopup() {
  activePopup?.remove();
  activePopup = null;
  activeButton?.setAttribute('aria-expanded', 'false');
  activeButton = null;
}

function headerLabel(header: HTMLTableCellElement) {
  const clone = header.cloneNode(true) as HTMLTableCellElement;
  clone
    .querySelectorAll(
      'button,.portal-column-controls,.portal1040-inline-sort,.portal1041-column-menu-button,.portal1043-column-menu-button',
    )
    .forEach((node) => node.remove());
  const raw = (clone.textContent || '').replace(/[↕↑↓⌄]/g, '').replace(/\s+/g, ' ').trim();
  return normalize(raw) === 'progresso' ? 'Etapa' : raw || 'Coluna';
}

function renameProgressHeader(header: HTMLTableCellElement) {
  const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) nodes.push(current as Text);
  nodes.forEach((node) => {
    if (node.parentElement?.closest('button,.portal-column-controls,.portal1041-column-menu-button,.portal1043-column-menu-button')) return;
    if (/\bProgresso\b/i.test(node.data)) node.data = node.data.replace(/\bProgresso\b/gi, 'Etapa');
  });
}

function keyForHeader(header: HTMLTableCellElement, index: number) {
  if (!header.dataset.portal1043ColumnKey) {
    header.dataset.portal1043ColumnKey = `${index}:${normalize(headerLabel(header)) || `coluna-${index + 1}`}`;
  }
  return header.dataset.portal1043ColumnKey;
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
  const state = sheetState.get(table);
  if (!state) return;
  const headers = Array.from(table.tHead?.rows[0]?.cells || []) as HTMLTableCellElement[];
  Array.from(table.tBodies[0]?.rows || []).forEach((row) => {
    const visible = Array.from(state.filters.entries()).every(([key, allowed]) => {
      const index = headers.findIndex((header, headerIndex) => keyForHeader(header, headerIndex) === key);
      return index < 0 || allowed.has(cellValue(row, index));
    });
    row.classList.toggle('portal1043-filter-hidden', !visible);
  });
  headers.forEach((header, index) => {
    const active = state.filters.has(keyForHeader(header, index));
    header.querySelector<HTMLButtonElement>('.portal1043-column-menu-button')?.setAttribute('data-filter-active', active ? 'true' : 'false');
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
    const aValue = comparable(cellValue(a, index));
    const bValue = comparable(cellValue(b, index));
    const result = typeof aValue === 'number' && typeof bValue === 'number'
      ? aValue - bValue
      : collator.compare(String(aValue), String(bValue));
    return direction === 'asc' ? result : -result;
  });
  rows.forEach((row) => body.appendChild(row));
  Array.from(table.tHead?.rows[0]?.cells || []).forEach((cell) => cell.removeAttribute('aria-sort'));
  table.tHead?.rows[0]?.cells[index]?.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
  applyFilters(table);
}

function createMenuAction(label: string, onClick: () => void) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'portal1043-menu-action';
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
  popup.className = 'portal1043-column-menu-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', `Ordenar e filtrar ${label}`);

  const title = document.createElement('div');
  title.className = 'portal1043-menu-title';
  title.textContent = label;
  popup.appendChild(title);

  const sort = document.createElement('div');
  sort.className = 'portal1043-sort-actions';
  sort.append(
    createMenuAction('Ordenar A → Z / menor → maior', () => {
      sortRows(table, key, index, 'asc');
      closePopup();
    }),
    createMenuAction('Ordenar Z → A / maior → menor', () => {
      sortRows(table, key, index, 'desc');
      closePopup();
    }),
  );
  popup.appendChild(sort);

  const filterTitle = document.createElement('div');
  filterTitle.className = 'portal1043-filter-title';
  filterTitle.textContent = 'Filtrar';
  popup.appendChild(filterTitle);

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'portal1043-filter-search';
  search.placeholder = 'Buscar valor…';
  popup.appendChild(search);

  const list = document.createElement('div');
  list.className = 'portal1043-filter-values';
  popup.appendChild(list);

  const renderValues = (term = '') => {
    list.replaceChildren();
    const current = state.filters.get(key);
    const normalizedTerm = normalize(term);
    values.filter((value) => normalize(value).includes(normalizedTerm)).forEach((value) => {
      const labelNode = document.createElement('label');
      labelNode.className = 'portal1043-filter-value';
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
      labelNode.append(checkbox, text);
      list.appendChild(labelNode);
    });
  };
  renderValues();
  search.addEventListener('input', () => renderValues(search.value));

  const footer = document.createElement('div');
  footer.className = 'portal1043-menu-footer';
  const clear = createMenuAction('Limpar filtro', () => {
    state.filters.delete(key);
    applyFilters(table);
    renderValues(search.value);
  });
  clear.classList.add('portal1043-clear-filter');
  const done = createMenuAction('Concluir', closePopup);
  done.classList.add('portal1043-done');
  footer.append(clear, done);
  popup.appendChild(footer);
  document.body.appendChild(popup);

  activePopup = popup;
  activeButton = anchor;
  anchor.setAttribute('aria-expanded', 'true');

  const rect = anchor.getBoundingClientRect();
  const width = 310;
  let left = Math.min(rect.right - width, window.innerWidth - width - 12);
  left = Math.max(12, left);
  let top = rect.bottom + 6;
  if (top + 420 > window.innerHeight) top = Math.max(12, rect.top - 420);
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  window.setTimeout(() => search.focus(), 0);
}

function stageCells(table: HTMLTableElement) {
  const headers = Array.from(table.tHead?.rows[0]?.cells || []) as HTMLTableCellElement[];
  headers.forEach((header, index) => {
    renameProgressHeader(header);
    if (normalize(headerLabel(header)) !== 'etapa') return;
    Array.from(table.tBodies[0]?.rows || []).forEach((row) => {
      const cell = row.cells[index];
      const marker = cell?.querySelector<HTMLElement>('.portal-progress-number,[title*="Etapa"],[aria-label*="Etapa"]');
      if (!marker) return;
      const descriptor = `${marker.getAttribute('title') || ''} ${marker.getAttribute('aria-label') || ''}`;
      const match = descriptor.match(/Etapa\s+(\d+(?:[.,]\d+)?)(?:\/\d+)?/i);
      if (!match) return;
      marker.textContent = `Etapa ${match[1].replace('.', ',')}`;
      marker.classList.add('portal1043-stage-label');
    });
  });
}

function enhanceTable(table: HTMLTableElement) {
  const headerRow = table.tHead?.rows[0];
  const body = table.tBodies[0];
  if (!headerRow || !body || headerRow.cells.length < 2) return;

  table.classList.add('portal1043-sheet');
  if (!sheetState.has(table)) sheetState.set(table, { filters: new Map() });
  stageCells(table);

  Array.from(headerRow.cells).forEach((cell, index) => {
    const header = cell as HTMLTableCellElement;
    header.classList.add('portal1043-header-cell');
    keyForHeader(header, index);

    if (!header.dataset.portal1043NativeClickGuard) {
      header.dataset.portal1043NativeClickGuard = 'true';
      header.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        if (target.closest('.portal1043-column-menu-button,input[type="checkbox"]')) return;
        event.stopPropagation();
      });
    }

    if (header.dataset.portalSelectionColumn === 'true') return;
    if (header.querySelector(':scope > .portal1043-column-menu-button')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'portal1043-column-menu-button';
    button.title = `Ordenar ou filtrar ${headerLabel(header)}`;
    button.setAttribute('aria-label', `Ordenar ou filtrar ${headerLabel(header)}`);
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (activeButton === button && activePopup) {
        closePopup();
        return;
      }
      openColumnMenu(table, header, index, button);
    });
    header.appendChild(button);
  });

  applyFilters(table);
}

function calendarPeriod() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,section,div'));
  const text = candidates.map((node) => node.textContent || '').find((value) => /CALENDÁRIO DE DEFESAS\s*[—-]/i.test(value));
  const match = text?.match(/CALENDÁRIO DE DEFESAS\s*[—-]\s*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]+)\s+DE\s+(\d{4})/i);
  if (!match) return null;
  const month = MONTHS[match[1].toLocaleLowerCase('pt-BR')];
  const year = Number(match[2]);
  return month === undefined || !year ? null : { month, year };
}

function refineCalendarWeekends() {
  const period = calendarPeriod();
  if (!period) return;
  document.querySelectorAll<HTMLElement>('.portal-calendar-day-cell').forEach((cell) => {
    const day = Number(cell.querySelector(':scope > div:first-child span')?.textContent?.trim() || cell.querySelector('span')?.textContent?.trim());
    if (!day) return;
    const weekday = new Date(period.year, period.month, day).getDay();
    const weekend = weekday === 0 || weekday === 6;
    cell.classList.toggle('portal1043-calendar-weekend', weekend);
    if (!weekend) {
      cell.removeAttribute('aria-disabled');
      return;
    }
    cell.setAttribute('aria-disabled', 'true');
    cell.querySelector('.portal-calendar-preview-list')?.remove();
    Array.from(cell.children).forEach((child, childIndex) => {
      if (childIndex === 0) return;
      if ((child.textContent || '').toLocaleUpperCase('pt-BR').includes('DEFESA')) child.remove();
    });
  });
}

function enhanceAll() {
  neutralizeHoverBehavior();
  document.querySelectorAll<HTMLTableElement>('#portal-app-root main table').forEach(enhanceTable);
  refineCalendarWeekends();
}

export function PortalMaintenanceEnhancer() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(enhanceAll);
    };

    enhanceAll();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    const onMouseDown = (event: MouseEvent) => {
      if (!activePopup) return;
      const target = event.target as Node;
      if (activePopup.contains(target) || activeButton?.contains(target)) return;
      closePopup();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePopup();
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
      closePopup();
    };
  }, []);

  return null;
}
