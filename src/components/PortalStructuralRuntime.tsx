import { useEffect } from 'react';

type TableState = {
  filters: Map<string, Set<string>>;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
};

const tableState = new WeakMap<HTMLTableElement, TableState>();
const WIDTH_PREFIX = 'portal_tcc_v1043_widths_';
const WRAP_PREFIX = 'portal_tcc_v1043_wrap_';
const MIN_WIDTH = 72;
const MAX_WIDTH = 720;

let activePopup: HTMLElement | null = null;
let activeButton: HTMLButtonElement | null = null;
let activeSettingsTable: HTMLTableElement | null = null;
let calendarProcesses: any[] | null = null;
let calendarFetch: Promise<any[]> | null = null;

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
    .replace(/[↕↑↓⌄]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function slug(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function splitSelectorList(selectorText: string) {
  const out: string[] = [];
  let current = '';
  let round = 0;
  let square = 0;
  let quote = '';
  for (let i = 0; i < selectorText.length; i += 1) {
    const char = selectorText[i];
    const previous = selectorText[i - 1];
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
    if (char === '(') round += 1;
    if (char === ')') round = Math.max(0, round - 1);
    if (char === '[') square += 1;
    if (char === ']') square = Math.max(0, square - 1);
    if (char === ',' && round === 0 && square === 0) {
      if (current.trim()) out.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function stripHoverRules(container: CSSStyleSheet | CSSRule) {
  let rules: CSSRuleList | undefined;
  try {
    rules = (container as CSSStyleSheet).cssRules || (container as CSSRule & { cssRules?: CSSRuleList }).cssRules;
  } catch {
    return;
  }
  if (!rules) return;
  for (let index = rules.length - 1; index >= 0; index -= 1) {
    const rule = rules[index] as CSSRule & { selectorText?: string; cssRules?: CSSRuleList };
    if (typeof rule.selectorText === 'string' && rule.selectorText.includes(':hover')) {
      const keep = splitSelectorList(rule.selectorText).filter((selector) => !selector.includes(':hover'));
      try {
        if (keep.length === 0 && 'deleteRule' in container) {
          (container as CSSStyleSheet & { deleteRule: (index: number) => void }).deleteRule(index);
          continue;
        }
        if (keep.length > 0) rule.selectorText = keep.join(', ');
      } catch {
        // CSS de terceiros pode ser somente leitura; as classes utilitárias ainda são removidas abaixo.
      }
    }
    if (rule.cssRules?.length) stripHoverRules(rule);
  }
}

function neutralizeHover(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[class*="hover:"]').forEach((element) => {
    const removable = Array.from(element.classList).filter((token) =>
      token.startsWith('hover:') || token.startsWith('group-hover:') || token.startsWith('peer-hover:'),
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
      'button,.portal-column-controls,.portal1040-inline-sort,.portal1041-column-menu-button,.portal1043-column-menu-button,.portal-core-column-menu,.portal1041-column-resizer',
    )
    .forEach((node) => node.remove());
  const text = (clone.textContent || '').replace(/[↕↑↓⌄]/g, '').replace(/\s+/g, ' ').trim();
  return normalize(text) === 'progresso' ? 'Etapa' : text || 'Coluna';
}

function keyForHeader(header: HTMLTableCellElement, index: number) {
  if (!header.dataset.portalCoreColumnKey) {
    header.dataset.portalCoreColumnKey = `${index}:${slug(headerLabel(header)) || `coluna-${index + 1}`}`;
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
  closePopup();
  const state = tableState.get(table) || { filters: new Map<string, Set<string>>() };
  tableState.set(table, state);
  const key = keyForHeader(header, index);
  const label = headerLabel(header);
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
      closePopup();
    }),
    menuButton('Ordenar Z → A / maior → menor', 'portal-core-menu-action', () => {
      sortRows(table, key, index, 'desc');
      closePopup();
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
    const normalizedTerm = normalize(term);
    values
      .filter((value) => normalize(value).includes(normalizedTerm))
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
    menuButton('Concluir', 'portal-core-done', closePopup),
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
  if (table.dataset.portalCoreTableKey) return table.dataset.portalCoreTableKey;
  const title = table.closest('section,main,div')?.querySelector<HTMLElement>('h1,h2,h3')?.textContent || '';
  const headers = Array.from(table.tHead?.rows[0]?.cells || []).slice(0, 5).map((cell) => headerLabel(cell as HTMLTableCellElement)).join('|');
  table.dataset.portalCoreTableKey = slug(`${title}-${headers}`) || `table-${Math.random().toString(36).slice(2)}`;
  return table.dataset.portalCoreTableKey;
}

function widthStorageKey(table: HTMLTableElement) {
  return `${WIDTH_PREFIX}${tableKey(table)}`;
}

function wrapStorageKey(table: HTMLTableElement) {
  return `${WRAP_PREFIX}${tableKey(table)}`;
}

function readWidths(table: HTMLTableElement): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(widthStorageKey(table)) || '{}');
  } catch {
    return {};
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
    if (!node.parentElement?.closest('button') && /\bProgresso\b/i.test(node.data)) node.data = node.data.replace(/\bProgresso\b/gi, 'Etapa');
  });
}

function normalizeStage(table: HTMLTableElement) {
  const headers = Array.from(table.tHead?.rows[0]?.cells || []) as HTMLTableCellElement[];
  headers.forEach((header, index) => {
    if (normalize(headerLabel(header)) !== 'etapa') return;
    Array.from(table.tBodies[0]?.rows || []).forEach((row) => {
      const cell = row.cells[index];
      if (!cell) return;
      const marker = cell.querySelector<HTMLElement>('.portal-progress-number,[title*="Etapa"],[aria-label*="Etapa"]');
      const descriptor = `${marker?.getAttribute('title') || ''} ${marker?.getAttribute('aria-label') || ''}`;
      const match = descriptor.match(/Etapa\s+(\d+(?:[.,]\d+)?)/i);
      if (marker && match) {
        marker.textContent = `Etapa ${match[1].replace('.', ',')}`;
        marker.classList.add('portal-core-stage-label');
      }
    });
  });
}

function normalizeDefenseRows(table: HTMLTableElement) {
  const headers = Array.from(table.tHead?.rows[0]?.cells || []) as HTMLTableCellElement[];
  const processIndex = headers.findIndex((header) => normalize(headerLabel(header)) === 'processo');
  const dateIndex = headers.findIndex((header) => normalize(headerLabel(header)).startsWith('data'));
  if (processIndex < 0 || dateIndex < 0) return;
  Array.from(table.tBodies[0]?.rows || []).forEach((row) => {
    row.classList.remove('bg-slate-100/40', 'text-slate-400', 'opacity-60');
    row.style.opacity = '1';
    const match = (row.cells[dateIndex]?.textContent || '').match(/\b(\d{2})\/(\d{2})\/(\d{4})(?:\D+(\d{2}):(\d{2}))?/);
    let defended = false;
    if (match) {
      const [, dd, mm, yyyy, hh = '23', min = '59'] = match;
      defended = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), 59, 999).getTime() < Date.now();
    }
    const cell = row.cells[processIndex] as HTMLTableCellElement;
    cell.dataset.portalCoreProcessState = defended ? 'defended' : 'upcoming';
  });
}

function enhanceTable(table: HTMLTableElement) {
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
      button.title = `Ordenar ou filtrar ${headerLabel(header)}`;
      button.setAttribute('aria-label', `Ordenar ou filtrar ${headerLabel(header)}`);
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (activeButton === button && activePopup) closePopup();
        else openColumnMenu(table, header, index, button);
      });
      header.appendChild(button);
    }
    installResizer(table, header, index);
  });
  restoreWidths(table);
  const wrap = localStorage.getItem(wrapStorageKey(table));
  table.classList.toggle('portal-core-nowrap', wrap === 'nowrap');
  normalizeStage(table);
  normalizeDefenseRows(table);
  applyFilters(table);
}

function findTableForControl(control: HTMLElement) {
  let current: HTMLElement | null = control.parentElement;
  for (let depth = 0; current && depth < 9; depth += 1, current = current.parentElement) {
    const tables = Array.from(current.querySelectorAll<HTMLTableElement>('table')).filter((table) => !table.closest('[role="dialog"]'));
    if (tables.length === 1) return tables[0];
    const visible = tables.find((table) => table.offsetParent !== null);
    if (visible) return visible;
  }
  return null;
}

function bindSettingsButtons() {
  document.querySelectorAll<HTMLButtonElement>('button[title*="Exibição da planilha"],button[aria-label^="Configurar exibição da planilha"]').forEach((button) => {
    if (button.dataset.portalCoreSettingsBound === 'true') return;
    button.dataset.portalCoreSettingsBound = 'true';
    button.addEventListener('click', () => {
      activeSettingsTable = findTableForControl(button);
      if (activeSettingsTable) enhanceTable(activeSettingsTable);
    }, true);
  });
}

function injectWrapSetting() {
  const popup = document.querySelector<HTMLElement>('.portal-table-settings-popover');
  if (!popup || popup.querySelector('.portal-core-wrap-setting') || !activeSettingsTable) return;
  const table = activeSettingsTable;
  const section = document.createElement('section');
  section.className = 'portal-core-wrap-setting';
  section.innerHTML = '<div><strong>Quebra de texto</strong><span>Escolha como o conteúdo ocupa as células.</span></div><div class="portal-core-wrap-actions"><button type="button" data-wrap="wrap">Quebrar texto</button><button type="button" data-wrap="nowrap">Uma linha</button></div>';
  const sync = () => {
    const nowrap = table.classList.contains('portal-core-nowrap');
    section.querySelectorAll<HTMLButtonElement>('button[data-wrap]').forEach((button) => {
      const active = button.dataset.wrap === (nowrap ? 'nowrap' : 'wrap');
      button.dataset.active = active ? 'true' : 'false';
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  };
  section.querySelectorAll<HTMLButtonElement>('button[data-wrap]').forEach((button) => {
    button.addEventListener('click', () => {
      const nowrap = button.dataset.wrap === 'nowrap';
      table.classList.toggle('portal-core-nowrap', nowrap);
      try { localStorage.setItem(wrapStorageKey(table), nowrap ? 'nowrap' : 'wrap'); } catch {}
      sync();
    });
  });
  popup.appendChild(section);
  sync();
}

function removeRefreshControls() {
  document.querySelectorAll<HTMLButtonElement>(
    'button[title*="Atualizar"],button[aria-label*="Atualizar"],button[title*="Sincronizar dados"],button[aria-label*="Sincronizar dados"]',
  ).forEach((button) => {
    if (button.closest('#portal-app-root main')) button.remove();
  });
  const indicators = document.getElementById('indicadores-publicos-page');
  if (indicators) {
    Array.from(indicators.querySelectorAll('p')).forEach((paragraph) => {
      if (normalize(paragraph.textContent || '') === 'panorama estatistico agregado dos tccs') paragraph.remove();
    });
  }
}

function calendarPeriod() {
  const heading = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3')).find((node) => /CALENDÁRIO DE DEFESAS\s*[—-]/i.test(node.textContent || ''));
  const match = heading?.textContent?.match(/CALENDÁRIO DE DEFESAS\s*[—-]\s*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]+)\s+DE\s+(\d{4})/i);
  if (!match) return null;
  const month = MONTHS[match[1].toLocaleLowerCase('pt-BR')];
  const year = Number(match[2]);
  return month === undefined || !year ? null : { month, year };
}

function dateKey(value: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  } catch {
    return '';
  }
}

function timeLabel(value: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  } catch {
    return '';
  }
}

async function loadCalendarProcesses() {
  if (calendarProcesses) return calendarProcesses;
  if (calendarFetch) return calendarFetch;
  calendarFetch = fetch('/api/processes', { credentials: 'include', headers: { Accept: 'application/json' } })
    .then(async (response) => response.ok ? response.json() : [])
    .then((data) => {
      calendarProcesses = Array.isArray(data) ? data : [];
      return calendarProcesses;
    })
    .catch(() => [])
    .finally(() => { calendarFetch = null; });
  return calendarFetch;
}

async function enhanceCalendar() {
  const period = calendarPeriod();
  const firstCell = document.querySelector<HTMLElement>('.portal-calendar-day-cell');
  const grid = firstCell?.parentElement;
  if (!period || !grid) return;
  grid.classList.add('portal-core-calendar-grid');
  const daysHeader = grid.parentElement?.previousElementSibling as HTMLElement | null;
  daysHeader?.classList.add('portal-core-calendar-week-header');
  const processes = await loadCalendarProcesses();
  const latestPeriod = calendarPeriod();
  if (!grid.isConnected || !latestPeriod || latestPeriod.month !== period.month || latestPeriod.year !== period.year) return;
  const byDay = new Map<number, any[]>();
  processes.forEach((proc) => {
    const start = proc?.defesa?.startAt;
    if (!start) return;
    const key = dateKey(start);
    const expected = `${period.year}-${String(period.month + 1).padStart(2, '0')}-`;
    if (!key.startsWith(expected)) return;
    const day = Number(key.slice(-2));
    const weekday = new Date(period.year, period.month, day).getDay();
    if (weekday === 0 || weekday === 6) return;
    const list = byDay.get(day) || [];
    list.push(proc);
    byDay.set(day, list);
  });

  grid.querySelectorAll<HTMLElement>('.portal-calendar-day-cell').forEach((cell) => {
    const day = Number(cell.querySelector(':scope > div:first-child span')?.textContent?.trim() || cell.querySelector('span')?.textContent?.trim());
    if (!day) return;
    const weekday = new Date(period.year, period.month, day).getDay();
    const weekend = weekday === 0 || weekday === 6;
    cell.classList.toggle('portal-core-calendar-weekend', weekend);
    cell.setAttribute('aria-disabled', weekend ? 'true' : 'false');
    if (!cell.dataset.portalCoreWeekendGuard) {
      cell.dataset.portalCoreWeekendGuard = 'true';
      cell.addEventListener('click', (event) => {
        if (!cell.classList.contains('portal-core-calendar-weekend')) return;
        event.preventDefault();
        event.stopPropagation();
      }, true);
    }
    cell.querySelector('.portal-core-calendar-previews')?.remove();
    // Nunca remova filhos renderizados pelo React. A ocultação do contador nativo é apenas visual.
    if (weekend) return;
    const events = byDay.get(day) || [];
    if (!events.length) return;
    const previews = document.createElement('div');
    previews.className = 'portal-core-calendar-previews';
    events.slice(0, 3).forEach((proc) => {
      const start = String(proc.defesa?.startAt || '');
      const defended = start ? new Date(start).getTime() < Date.now() : false;
      const card = document.createElement('div');
      card.className = `portal-core-calendar-card ${defended ? 'is-defended' : 'is-upcoming'}`;
      const title = document.createElement('strong');
      title.textContent = `HOMOLOGAÇÃO — ${String(proc.titulo || 'Trabalho de Conclusão de Curso')}`;
      const meta = document.createElement('span');
      meta.textContent = `${timeLabel(start)} · ${String(proc.defesa?.local || 'Local a confirmar')}`;
      card.append(title, meta);
      previews.appendChild(card);
    });
    if (events.length > 3) {
      const more = document.createElement('span');
      more.className = 'portal-core-calendar-more';
      more.textContent = `+${events.length - 3} defesa(s)`;
      previews.appendChild(more);
    }
    cell.appendChild(previews);
  });
}

function enhanceAll() {
  neutralizeHover();
  document.querySelectorAll<HTMLTableElement>('#portal-app-root main table').forEach(enhanceTable);
  bindSettingsButtons();
  injectWrapSetting();
  removeRefreshControls();
  void enhanceCalendar();
}

export function PortalStructuralRuntime() {
  useEffect(() => {
    Array.from(document.styleSheets).forEach((sheet) => stripHoverRules(sheet));
    enhanceAll();
    let frame = 0;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) neutralizeHover(node);
      }));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(enhanceAll);
    });
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
