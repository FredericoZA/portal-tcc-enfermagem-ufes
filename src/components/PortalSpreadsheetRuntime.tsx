import { useLayoutEffect } from 'react';

const TABLE_KEYS = [
  'defenses',
  'acervo',
  'meus_processos',
  'coordinator',
  'authorized_access',
  'signature_logs',
  'audit_logs',
] as const;

type TableKey = (typeof TABLE_KEYS)[number];
type PageSize = 25 | 50 | 100 | 'all';

const DEFAULT_PAGE_SIZE: Record<TableKey, PageSize> = {
  defenses: 25,
  acervo: 25,
  meus_processos: 25,
  coordinator: 25,
  authorized_access: 25,
  signature_logs: 25,
  audit_logs: 25,
};

const TABLE_CONTAINER_SELECTORS: Record<TableKey, string[]> = {
  defenses: ['#public-calendar-cards-section'],
  acervo: ['#biblioteca-tccs-section'],
  meus_processos: ['#meus-processos-page-container'],
  coordinator: ['#coordenador-page-root'],
  authorized_access: ['#authorized-access-panel'],
  signature_logs: ['#asten-logs-page'],
  audit_logs: ['#audit-logs-page'],
};

const PAGE_SIZE_PREFIX = 'portal_table_page_size_';
const CURRENT_PAGE_PREFIX = 'portal_table_current_page_';
const INTERACTIVE_SELECTOR = 'button,input,select,textarea,a,[role="button"],[contenteditable="true"]';

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

function pageSizeKey(key: TableKey) {
  return `${PAGE_SIZE_PREFIX}${key}`;
}

function currentPageKey(key: TableKey) {
  return `${CURRENT_PAGE_PREFIX}${key}`;
}

function storageKeysForTable(key: TableKey) {
  const keys = [`default_table_config_${key}`];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const candidate = localStorage.key(index);
      if (candidate?.startsWith('portal_user_table_config_') && candidate.endsWith(`_${key}`)) keys.push(candidate);
    }
  } catch {
    // localStorage pode estar indisponível em alguns ambientes.
  }
  return keys;
}

function migrateLegacyLimits() {
  if (typeof window === 'undefined') return;
  for (const key of TABLE_KEYS) {
    let preferred: PageSize | null = null;
    for (const storageKey of storageKeysForTable(key)) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) continue;
        const config = JSON.parse(raw);
        const configured = parsePageSize(config.pageSize ?? config.recordsLimit);
        if (configured) preferred = configured;
        if (config.recordsLimit !== 'all') {
          config.recordsLimit = 'all';
          if (configured) config.pageSize = configured;
          localStorage.setItem(storageKey, JSON.stringify(config));
        }
      } catch {
        // Preferência inválida não pode bloquear a planilha.
      }
    }
    try {
      if (!localStorage.getItem(pageSizeKey(key))) localStorage.setItem(pageSizeKey(key), String(preferred || DEFAULT_PAGE_SIZE[key]));
    } catch {
      // noop
    }
  }
}

migrateLegacyLimits();

function tableKey(table: HTMLTableElement): TableKey | null {
  const explicit = table.dataset.portalTableKey as TableKey | undefined;
  if (explicit && TABLE_KEYS.includes(explicit)) return explicit;
  for (const key of TABLE_KEYS) {
    if (TABLE_CONTAINER_SELECTORS[key].some((selector) => table.closest(selector))) return key;
  }
  return null;
}

function readPageSize(key: TableKey): PageSize {
  try {
    const direct = parsePageSize(localStorage.getItem(pageSizeKey(key)));
    if (direct) return direct;
    for (const storageKey of storageKeysForTable(key)) {
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;
      try {
        const config = JSON.parse(raw);
        const configured = parsePageSize(config.pageSize ?? config.recordsLimit);
        if (configured) {
          localStorage.setItem(pageSizeKey(key), String(configured));
          return configured;
        }
      } catch {
        // continua buscando outra preferência válida
      }
    }
  } catch {
    // noop
  }
  return DEFAULT_PAGE_SIZE[key];
}

function readCurrentPage(key: TableKey) {
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
  for (const node of nodes) {
    if (node.parentElement?.closest('.portal-core-column-menu,.portal-core-resizer')) continue;
    const value = normalize(node.data);
    if (!value) continue;
    if (value.includes('processo') || value === 'protocolo') {
      if (node.data !== 'Processo') node.data = 'Processo';
      return;
    }
  }
}

function opaqueColor(value: string) {
  if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') return '';
  const match = value.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*(?:\.\d+)?))?\s*\)$/i);
  if (!match) return value;
  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);
  const alpha = match[4] === undefined || match[4] === '' ? 1 : Number(match[4]);
  if (alpha >= 1) return `rgb(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)})`;
  if (alpha <= 0) return '';
  const blend = (channel: number) => Math.round((channel * alpha) + (255 * (1 - alpha)));
  return `rgb(${blend(red)}, ${blend(green)}, ${blend(blue)})`;
}

/*
 * O fundo sticky deve reproduzir a superfície visual da linha, não assumir o
 * primeiro td (que no Presidente é a coluna de seleção). Procuramos primeiro
 * uma célula de conteúdo opaca e só então usamos o fundo da própria linha.
 */
function rowBackground(row: HTMLTableRowElement, selectionIndex: number, processIndex: number) {
  const preferredIndexes = Array.from({ length: row.cells.length }, (_, index) => index)
    .filter((index) => index !== selectionIndex && index !== processIndex);
  for (const index of preferredIndexes) {
    const color = opaqueColor(getComputedStyle(row.cells[index]).backgroundColor);
    if (color) return color;
  }
  const processCell = processIndex >= 0 ? row.cells[processIndex] : undefined;
  const processColor = processCell ? opaqueColor(getComputedStyle(processCell).backgroundColor) : '';
  if (processColor) return processColor;
  const rowColor = opaqueColor(getComputedStyle(row).backgroundColor);
  if (rowColor) return rowColor;
  if (row.className.includes('bg-emerald-50')) return '#f0fdf4';
  return '#ffffff';
}

function findScrollHost(table: HTMLTableElement) {
  return table.closest<HTMLElement>('[data-portal-scroll-host="true"],.portal-spreadsheet-scroll-host,.table-sticky-container,.overflow-auto,.overflow-x-auto') || table.parentElement;
}

function markSpreadsheet(table: HTMLTableElement) {
  const key = tableKey(table);
  if (!key || !table.tHead?.rows.length || !table.tBodies.length) return;

  table.dataset.portalTableKey = key;
  table.dataset.portalSpreadsheet = key;
  table.classList.add('portal-runtime-spreadsheet');
  table.tHead.dataset.portalStickyThead = 'true';

  const host = findScrollHost(table);
  if (host) {
    host.dataset.portalScrollHost = 'true';
    host.classList.add('portal-spreadsheet-scroll-host');
  }

  const headerRow = table.tHead.rows[table.tHead.rows.length - 1];
  const headers = Array.from(headerRow.cells) as HTMLTableCellElement[];
  headers.forEach((header) => { header.dataset.portalStickyHeader = 'true'; });

  const selectionIndex = headers.findIndex((header) =>
    header.dataset.portalSelectionColumn === 'true'
    || normalize(header.dataset.portalColumnLabel || '') === 'selecao'
    || headerLabel(header) === 'selecao');

  let processIndex = headers.findIndex(isProcessHeader);
  if (processIndex < 0 && (key === 'defenses' || key === 'acervo' || key === 'meus_processos')) processIndex = 0;

  if (selectionIndex >= 0) {
    const selectionHeader = headers[selectionIndex];
    selectionHeader.dataset.portalStickySelection = 'true';
    selectionHeader.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      button.classList.add('portal-sheet-checkbox');
      button.setAttribute('aria-label', button.getAttribute('title') || 'Selecionar todos');
    });
  }

  if (processIndex >= 0) {
    const processHeader = headers[processIndex];
    renameProcessHeader(processHeader);
    processHeader.dataset.portalStickyProcess = 'true';
    if (selectionIndex >= 0 && selectionIndex < processIndex) processHeader.dataset.portalAfterSelection = 'true';
    else delete processHeader.dataset.portalAfterSelection;
  }

  Array.from(table.tBodies).forEach((tbody) => {
    Array.from(tbody.rows).forEach((row, rowIndex) => {
      const stickyBackground = rowBackground(row, selectionIndex, processIndex);
      row.dataset.portalSpreadsheetRow = 'true';
      row.dataset.portalFirstSpreadsheetRow = rowIndex === 0 ? 'true' : 'false';
      row.style.setProperty('--portal-sticky-row-bg', stickyBackground);

      if (selectionIndex >= 0) {
        const selectionCell = row.cells[selectionIndex] as HTMLTableCellElement | undefined;
        if (selectionCell) {
          selectionCell.dataset.portalStickySelection = 'true';
          selectionCell.style.setProperty('--portal-sticky-row-bg', stickyBackground);
          selectionCell.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
            button.classList.add('portal-sheet-checkbox');
            if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', 'Selecionar item');
          });
        }
      }

      if (processIndex >= 0) {
        const processCell = row.cells[processIndex] as HTMLTableCellElement | undefined;
        if (processCell) {
          processCell.dataset.portalStickyProcess = 'true';
          processCell.style.setProperty('--portal-sticky-row-bg', stickyBackground);
          if (selectionIndex >= 0 && selectionIndex < processIndex) processCell.dataset.portalAfterSelection = 'true';
          else delete processCell.dataset.portalAfterSelection;
        }
      }
    });
  });
}

function rowIsExternallyHidden(row: HTMLTableRowElement) {
  return row.classList.contains('portal-core-filter-hidden')
    || row.dataset.portalFilterHidden === 'true'
    || row.hidden
    || row.style.display === 'none';
}

function pageList(totalPages: number, current: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set<number>([1, totalPages, current - 1, current, current + 1]);
  return Array.from(pages).filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
}

function ensureSinglePager(host: HTMLElement, key: TableKey) {
  const parent = host.parentElement;
  if (!parent) return null;
  const selector = `.portal-spreadsheet-pager[data-portal-table-key="${key}"]`;
  const allExisting = Array.from(document.querySelectorAll<HTMLElement>(selector));
  const pager = allExisting.shift() || document.createElement('nav');
  allExisting.forEach((duplicate) => duplicate.remove());
  pager.className = 'portal-spreadsheet-pager';
  pager.dataset.portalTableKey = key;
  pager.dataset.portalGenerated = 'true';
  pager.setAttribute('aria-label', 'Paginação da planilha');
  if (pager.parentElement !== parent || pager.previousElementSibling !== host) host.insertAdjacentElement('afterend', pager);
  return pager;
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

  const pager = ensureSinglePager(host, key);
  if (!pager) return;
  const signature = `${pageSize}|${current}|${visibleRows.length}|${totalPages}`;
  if (pager.dataset.portalSignature === signature && pager.childElementCount > 0) return;
  pager.dataset.portalSignature = signature;
  pager.dataset.portalTotalPages = String(totalPages);
  pager.replaceChildren();

  const controls = document.createElement('div');
  controls.className = 'portal-spreadsheet-pager-controls';

  const makeButton = (label: string, page: number, disabled = false, active = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = disabled;
    button.dataset.active = active ? 'true' : 'false';
    button.setAttribute('aria-current', active ? 'page' : 'false');
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

function removeOrphanPagers() {
  document.querySelectorAll<HTMLElement>('.portal-spreadsheet-pager[data-portal-generated="true"]').forEach((pager) => {
    const key = pager.dataset.portalTableKey as TableKey | undefined;
    if (!key) { pager.remove(); return; }
    const ownerExists = Array.from(document.querySelectorAll<HTMLTableElement>('table')).some((table) => table.isConnected && tableKey(table) === key);
    if (!ownerExists) pager.remove();
  });
}

export const PortalSpreadsheetRuntime = () => {
  useLayoutEffect(() => {
    const unbinders = new Map<HTMLElement, () => void>();
    let frame = 0;

    const bindScrollHost = (host: HTMLElement) => {
      if (unbinders.has(host)) return;
      let dragging = false;
      let armed = false;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;
      let suppressClickUntil = 0;

      const move = (event: MouseEvent) => {
        if (!armed) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (!dragging && Math.max(Math.abs(dx), Math.abs(dy)) < 3) return;
        dragging = true;
        host.classList.add('portal-sheet-dragging');
        event.preventDefault();
        if (host.scrollWidth > host.clientWidth + 1) host.scrollLeft = startLeft - dx;
        if (host.scrollHeight > host.clientHeight + 1) host.scrollTop = startTop - dy;
      };

      const stop = () => {
        if (dragging) suppressClickUntil = performance.now() + 260;
        dragging = false;
        armed = false;
        host.classList.remove('portal-sheet-pointer-down', 'portal-sheet-dragging');
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', stop);
      };

      const down = (event: MouseEvent) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (target.closest(INTERACTIVE_SELECTOR) || target.closest('thead')) return;
        if (host.scrollWidth <= host.clientWidth + 1 && host.scrollHeight <= host.clientHeight + 1) return;
        armed = true;
        startX = event.clientX;
        startY = event.clientY;
        startLeft = host.scrollLeft;
        startTop = host.scrollTop;
        host.classList.add('portal-sheet-pointer-down');
        window.addEventListener('mousemove', move, { passive: false });
        window.addEventListener('mouseup', stop, { once: true });
      };

      const wheel = (event: WheelEvent) => {
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

      const click = (event: MouseEvent) => {
        if (performance.now() < suppressClickUntil) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
      };

      host.addEventListener('mousedown', down);
      host.addEventListener('wheel', wheel, { passive: false });
      host.addEventListener('click', click, true);
      unbinders.set(host, () => {
        host.removeEventListener('mousedown', down);
        host.removeEventListener('wheel', wheel);
        host.removeEventListener('click', click, true);
        stop();
      });
    };

    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
          if (!tableKey(table)) return;
          markSpreadsheet(table);
          const host = findScrollHost(table);
          if (host) bindScrollHost(host);
          applyPagination(table);
        });
        removeOrphanPagers();
      });
    };

    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    window.addEventListener('storage', refresh);
    window.addEventListener('portal-table-layouts-updated', refresh as EventListener);
    window.addEventListener('global_table_layouts_changed', refresh as EventListener);
    window.addEventListener('resize', refresh);
    window.addEventListener('focus', refresh);
    refresh();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('storage', refresh);
      window.removeEventListener('portal-table-layouts-updated', refresh as EventListener);
      window.removeEventListener('global_table_layouts_changed', refresh as EventListener);
      window.removeEventListener('resize', refresh);
      window.removeEventListener('focus', refresh);
      unbinders.forEach((unbind) => unbind());
      unbinders.clear();
    };
  }, []);

  return null;
};