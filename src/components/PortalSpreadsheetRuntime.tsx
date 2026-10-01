import { useEffect } from 'react';

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

function migrateLegacyLimits() {
  if (typeof window === 'undefined') return;
  try {
    for (const key of TABLE_KEYS) {
      const masterKey = `default_table_config_${key}`;
      const raw = localStorage.getItem(masterKey);
      const config = raw ? JSON.parse(raw) : {};
      const legacy = parsePageSize(config.recordsLimit);
      if (!localStorage.getItem(pageSizeKey(key))) {
        localStorage.setItem(pageSizeKey(key), String(legacy || DEFAULT_PAGE_SIZE[key]));
      }
      if (config.recordsLimit !== 'all') {
        config.recordsLimit = 'all';
        localStorage.setItem(masterKey, JSON.stringify(config));
      }
    }

    const localKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(Boolean) as string[];
    for (const storageKey of localKeys) {
      if (!storageKey.startsWith('portal_user_table_config_')) continue;
      const key = TABLE_KEYS.find((candidate) => storageKey.endsWith(`_${candidate}`));
      if (!key) continue;
      try {
        const config = JSON.parse(localStorage.getItem(storageKey) || '{}');
        const legacy = parsePageSize(config.recordsLimit);
        if (!localStorage.getItem(pageSizeKey(key)) && legacy) {
          localStorage.setItem(pageSizeKey(key), String(legacy));
        }
        if (config.recordsLimit !== 'all') {
          config.recordsLimit = 'all';
          localStorage.setItem(storageKey, JSON.stringify(config));
        }
      } catch {
        // Preferência individual inválida não pode bloquear a planilha.
      }
    }
  } catch {
    // localStorage pode estar indisponível em alguns ambientes.
  }
}

migrateLegacyLimits();

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

function readPageSize(key: TableKey): PageSize {
  try {
    return parsePageSize(localStorage.getItem(pageSizeKey(key))) || DEFAULT_PAGE_SIZE[key];
  } catch {
    return DEFAULT_PAGE_SIZE[key];
  }
}

function readCurrentPage(key: TableKey) {
  try {
    return Math.max(1, Number(localStorage.getItem(currentPageKey(key))) || 1);
  } catch {
    return 1;
  }
}

function saveCurrentPage(key: TableKey, page: number) {
  try {
    localStorage.setItem(currentPageKey(key), String(Math.max(1, page)));
  } catch {
    // noop
  }
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

function markSpreadsheet(table: HTMLTableElement) {
  const key = tableKey(table);
  if (!key || !table.tHead?.rows.length || !table.tBodies.length) return;

  table.dataset.portalSpreadsheet = key;
  table.classList.add('portal-runtime-spreadsheet');

  const headerRow = table.tHead.rows[table.tHead.rows.length - 1];
  const headers = Array.from(headerRow.cells) as HTMLTableCellElement[];
  headers.forEach((header) => {
    header.dataset.portalStickyHeader = 'true';
  });

  const selectionIndex = headers.findIndex((header) =>
    header.dataset.portalSelectionColumn === 'true'
    || normalize(header.dataset.portalColumnLabel || '') === 'selecao'
    || headerLabel(header) === 'selecao');

  const processIndex = headers.findIndex(isProcessHeader);

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
    if (selectionIndex >= 0 && selectionIndex < processIndex) {
      processHeader.dataset.portalAfterSelection = 'true';
    }
  }

  Array.from(table.tBodies).forEach((tbody) => {
    Array.from(tbody.rows).forEach((row) => {
      row.style.setProperty('--portal-sticky-row-bg', rowBackground(row));

      if (selectionIndex >= 0) {
        const selectionCell = row.cells[selectionIndex] as HTMLTableCellElement | undefined;
        if (selectionCell) {
          selectionCell.dataset.portalStickySelection = 'true';
          selectionCell.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
            button.classList.add('portal-sheet-checkbox');
          });
        }
      }

      if (processIndex >= 0) {
        const processCell = row.cells[processIndex] as HTMLTableCellElement | undefined;
        if (processCell) {
          processCell.dataset.portalStickyProcess = 'true';
          if (selectionIndex >= 0 && selectionIndex < processIndex) {
            processCell.dataset.portalAfterSelection = 'true';
          }
        }
      }
    });
  });
}

function findScrollHost(table: HTMLTableElement) {
  return table.closest<HTMLElement>('.table-sticky-container,[data-portal-scroll-host="true"],.overflow-x-auto') || table.parentElement;
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
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

function ensureSinglePager(host: HTMLElement, key: TableKey) {
  const parent = host.parentElement;
  if (!parent) return null;

  const existing = Array.from(parent.children).filter((node): node is HTMLElement =>
    node instanceof HTMLElement
    && node.classList.contains('portal-spreadsheet-pager')
    && node.dataset.portalTableKey === key);

  const pager = existing.shift() || document.createElement('nav');
  existing.forEach((duplicate) => duplicate.remove());

  pager.className = 'portal-spreadsheet-pager';
  pager.dataset.portalTableKey = key;
  pager.setAttribute('aria-label', 'Paginação da planilha');

  if (!pager.parentElement) host.insertAdjacentElement('afterend', pager);
  else if (pager.previousElementSibling !== host) host.insertAdjacentElement('afterend', pager);

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

function removeOrphanPagers() {
  document.querySelectorAll<HTMLElement>('.portal-spreadsheet-pager').forEach((pager) => {
    const key = pager.dataset.portalTableKey;
    if (!key) return;
    const hasOwner = Array.from(document.querySelectorAll<HTMLTableElement>('table[data-portal-spreadsheet]'))
      .some((table) => table.dataset.portalSpreadsheet === key && findScrollHost(table)?.nextElementSibling === pager);
    if (!hasOwner) pager.remove();
  });
}

function syncPageSizeFromSettings() {
  document.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    const key = tableKey(table);
    if (!key) return;
    const configKeys = [
      `default_table_config_${key}`,
      ...Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index) || '')
        .filter((storageKey) => storageKey.startsWith('portal_user_table_config_') && storageKey.endsWith(`_${key}`)),
    ];

    for (const storageKey of configKeys) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) continue;
        const config = JSON.parse(raw);
        const size = parsePageSize(config.recordsLimit);
        if (size) {
          localStorage.setItem(pageSizeKey(key), String(size));
          config.recordsLimit = 'all';
          localStorage.setItem(storageKey, JSON.stringify(config));
          saveCurrentPage(key, 1);
          break;
        }
      } catch {
        // noop
      }
    }
  });
}

export const PortalSpreadsheetRuntime = () => {
  useEffect(() => {
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

      const stop = () => {
        dragging = false;
        armed = false;
        host.classList.remove('portal-sheet-pointer-down', 'portal-sheet-dragging');
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', stop);
      };

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

      host.addEventListener('mousedown', down);
      unbinders.set(host, () => {
        host.removeEventListener('mousedown', down);
        stop();
      });
    };

    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        syncPageSizeFromSettings();
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
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('storage', refresh);
    window.addEventListener('portal-table-layouts-updated', refresh as EventListener);

    refresh();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('storage', refresh);
      window.removeEventListener('portal-table-layouts-updated', refresh as EventListener);
      unbinders.forEach((unbind) => unbind());
      unbinders.clear();
    };
  }, []);

  return null;
};
