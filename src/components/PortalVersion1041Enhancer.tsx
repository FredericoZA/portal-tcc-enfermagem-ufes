import { useEffect } from 'react';

const WIDTH_STORAGE_PREFIX = 'portal_tcc_v1041_widths_';
const WRAP_STORAGE_PREFIX = 'portal_tcc_v1041_wrap_';
const MIN_COLUMN_WIDTH = 72;
const MAX_COLUMN_WIDTH = 720;

let activeSettingsTable: HTMLTableElement | null = null;

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLocaleLowerCase('pt-BR');
}

function tableKey(table: HTMLTableElement) {
  if (table.dataset.portal1041TableKey) return table.dataset.portal1041TableKey;

  let scope: HTMLElement | null = table.parentElement;
  let title = '';
  for (let depth = 0; scope && depth < 8; depth += 1, scope = scope.parentElement) {
    const heading = scope.querySelector<HTMLElement>('h1,h2,h3,[data-portal-table-title]');
    if (heading?.textContent?.trim()) {
      title = heading.textContent.trim();
      break;
    }
  }
  const headers = Array.from(table.tHead?.rows[0]?.cells || [])
    .map((cell) => (cell.textContent || '').replace(/\s+/g, ' ').trim())
    .slice(0, 5)
    .join('|');
  const key = normalize(`${title || 'tabela'}-${headers || table.id || 'portal'}`).slice(0, 120) || 'tabela-portal';
  table.dataset.portal1041TableKey = key;
  return key;
}

function widthStorageKey(table: HTMLTableElement) {
  return `${WIDTH_STORAGE_PREFIX}${tableKey(table)}`;
}

function wrapStorageKey(table: HTMLTableElement) {
  return `${WRAP_STORAGE_PREFIX}${tableKey(table)}`;
}

function readWidths(table: HTMLTableElement): Record<string, number> {
  try {
    const raw = localStorage.getItem(widthStorageKey(table));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveWidths(table: HTMLTableElement, widths: Record<string, number>) {
  try {
    localStorage.setItem(widthStorageKey(table), JSON.stringify(widths));
  } catch {
    // Preferência visual local; falha de armazenamento não bloqueia o uso da tabela.
  }
}

function columnStorageKey(header: HTMLTableCellElement, index: number) {
  const label = (header.dataset.portalColumnLabel || header.textContent || `coluna-${index + 1}`)
    .replace(/\s+/g, ' ')
    .trim();
  return `${index}:${normalize(label) || `coluna-${index + 1}`}`;
}

function applyColumnWidth(table: HTMLTableElement, index: number, width: number) {
  const px = `${Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(width)))}px`;
  const header = table.tHead?.rows[0]?.cells[index] as HTMLTableCellElement | undefined;
  if (header) {
    header.style.width = px;
    header.style.minWidth = px;
    header.style.maxWidth = px;
  }
  Array.from(table.tBodies).forEach((body) => {
    Array.from(body.rows).forEach((row) => {
      const cell = row.cells[index] as HTMLTableCellElement | undefined;
      if (!cell) return;
      cell.style.width = px;
      cell.style.minWidth = px;
      cell.style.maxWidth = px;
    });
  });
}

function restoreColumnWidths(table: HTMLTableElement) {
  const widths = readWidths(table);
  const headers = Array.from(table.tHead?.rows[0]?.cells || []) as HTMLTableCellElement[];
  headers.forEach((header, index) => {
    const saved = widths[columnStorageKey(header, index)];
    if (Number.isFinite(saved)) applyColumnWidth(table, index, saved);
  });
}

function installColumnResizer(table: HTMLTableElement, header: HTMLTableCellElement, index: number) {
  if (header.dataset.portalSelectionColumn === 'true') return;
  if (header.querySelector(':scope > .portal1041-column-resizer')) return;

  const handle = document.createElement('span');
  handle.className = 'portal1041-column-resizer';
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', `Redimensionar ${(header.textContent || `coluna ${index + 1}`).trim()}`);
  handle.title = 'Arraste para alterar a largura da coluna';

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = Math.max(MIN_COLUMN_WIDTH, header.getBoundingClientRect().width);
    document.documentElement.classList.add('portal1041-resizing-column');

    const onMove = (moveEvent: PointerEvent) => {
      const width = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX));
      applyColumnWidth(table, index, width);
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.documentElement.classList.remove('portal1041-resizing-column');
      const widths = readWidths(table);
      widths[columnStorageKey(header, index)] = Math.round(header.getBoundingClientRect().width);
      saveWidths(table, widths);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp, { once: true });
  });

  header.appendChild(handle);
}

function enhanceResizableTable(table: HTMLTableElement) {
  if (table.closest('[role="dialog"]') || table.closest('.portal1043-column-menu-popup')) return;
  const headerRow = table.tHead?.rows[0];
  if (!headerRow || headerRow.cells.length < 2) return;

  table.classList.add('portal1041-sheet');
  restoreColumnWidths(table);
  Array.from(headerRow.cells).forEach((cell, index) => installColumnResizer(table, cell as HTMLTableCellElement, index));

  const wrap = localStorage.getItem(wrapStorageKey(table));
  table.classList.toggle('portal1041-nowrap', wrap === 'nowrap');
}

function findTableForControl(control: HTMLElement) {
  let current: HTMLElement | null = control.parentElement;
  for (let depth = 0; current && depth < 9; depth += 1, current = current.parentElement) {
    const tables = Array.from(current.querySelectorAll<HTMLTableElement>('table')).filter((table) => !table.closest('[role="dialog"]'));
    if (tables.length === 1) return tables[0];
    if (tables.length > 1) {
      const visible = tables.find((table) => table.offsetParent !== null);
      if (visible) return visible;
    }
  }
  return null;
}

function registerSettingsButtons() {
  document
    .querySelectorAll<HTMLButtonElement>('button[title*="Exibição da planilha"],button[aria-label^="Configurar exibição da planilha"]')
    .forEach((button) => {
      if (button.dataset.portal1041WrapBound === 'true') return;
      button.dataset.portal1041WrapBound = 'true';
      button.addEventListener(
        'click',
        () => {
          activeSettingsTable = findTableForControl(button);
          if (activeSettingsTable) enhanceResizableTable(activeSettingsTable);
        },
        true,
      );
    });
}

function injectWrapSetting() {
  const popup = document.querySelector<HTMLElement>('.portal-table-settings-popover');
  if (!popup || popup.querySelector('.portal1041-wrap-setting')) return;
  const table = activeSettingsTable;
  if (!table) return;

  const section = document.createElement('section');
  section.className = 'portal1041-wrap-setting';
  section.innerHTML = `
    <div class="portal1041-wrap-setting-copy">
      <strong>Quebra de texto</strong>
      <span>Escolha se as células podem usar várias linhas.</span>
    </div>
    <div class="portal1041-wrap-setting-actions" role="group" aria-label="Quebra de texto das células">
      <button type="button" data-wrap="wrap">Quebrar texto</button>
      <button type="button" data-wrap="nowrap">Uma linha</button>
    </div>
  `;

  const sync = () => {
    const nowrap = table.classList.contains('portal1041-nowrap');
    section.querySelectorAll<HTMLButtonElement>('button[data-wrap]').forEach((button) => {
      const active = button.dataset.wrap === (nowrap ? 'nowrap' : 'wrap');
      button.dataset.active = active ? 'true' : 'false';
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  };

  section.querySelectorAll<HTMLButtonElement>('button[data-wrap]').forEach((button) => {
    button.addEventListener('click', () => {
      const nowrap = button.dataset.wrap === 'nowrap';
      table.classList.toggle('portal1041-nowrap', nowrap);
      try {
        localStorage.setItem(wrapStorageKey(table), nowrap ? 'nowrap' : 'wrap');
      } catch {
        // Preferência local; a tabela continua utilizável mesmo sem persistência.
      }
      sync();
    });
  });

  sync();
  const columnSection = popup.querySelector('[aria-label^="Colunas e ordem"]');
  if (columnSection) columnSection.insertAdjacentElement('beforebegin', section);
  else popup.appendChild(section);
}

function setAllFilterCheckboxes(popup: HTMLElement, checked: boolean) {
  const search = popup.querySelector<HTMLInputElement>('.portal1043-filter-search');
  if (search && search.value) {
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
  }
  queueMicrotask(() => {
    popup.querySelectorAll<HTMLInputElement>('.portal1043-filter-values input[type="checkbox"]').forEach((checkbox) => {
      if (checkbox.checked !== checked) checkbox.click();
    });
  });
}

function augmentColumnFilterPopup() {
  document.querySelectorAll<HTMLElement>('.portal1043-column-menu-popup').forEach((popup) => {
    if (popup.querySelector('.portal1041-filter-bulk')) return;
    const values = popup.querySelector('.portal1043-filter-values');
    if (!values) return;

    const bulk = document.createElement('div');
    bulk.className = 'portal1041-filter-bulk';

    const selectAll = document.createElement('button');
    selectAll.type = 'button';
    selectAll.textContent = 'Selecionar tudo';
    selectAll.addEventListener('click', (event) => {
      event.stopPropagation();
      setAllFilterCheckboxes(popup, true);
    });

    const clearSelection = document.createElement('button');
    clearSelection.type = 'button';
    clearSelection.textContent = 'Limpar seleção';
    clearSelection.addEventListener('click', (event) => {
      event.stopPropagation();
      setAllFilterCheckboxes(popup, false);
    });

    bulk.append(selectAll, clearSelection);
    values.insertAdjacentElement('beforebegin', bulk);
  });
}

function removeTableRefreshButtons() {
  const candidates = document.querySelectorAll<HTMLButtonElement>([
    'button[title="Atualizar dados da tabela"]',
    'button[aria-label="Atualizar dados da tabela"]',
    'button[title^="Sincronizar dados"]',
    'button[aria-label^="Sincronizar dados"]',
  ].join(','));

  candidates.forEach((button) => {
    const scope = findTableForControl(button);
    if (scope) button.remove();
  });
}

function makeCalendarDayClickCanonical() {
  document.querySelectorAll<HTMLElement>('.portal-calendar-preview').forEach((preview) => {
    preview.classList.add('portal1041-calendar-preview-pass-through');
    preview.setAttribute('title', 'Clique no dia para ver todas as defesas');
  });

  document.querySelectorAll<HTMLElement>('.portal-calendar-day-cell').forEach((cell) => {
    const hasPreview = Boolean(cell.querySelector('.portal-calendar-preview'));
    const title = cell.getAttribute('title') || '';
    if (hasPreview || /defesa/i.test(title)) cell.classList.add('portal1041-calendar-clickable');
  });
}

function strengthenFilterBands() {
  document
    .querySelectorAll<HTMLElement>('.portal-defense-filter-row,.portal-meus-processos-filter-row,.portal-coordinator-filter-row,.portal-standard-filter-row,[data-portal1040-filter-band="true"]')
    .forEach((row) => row.classList.add('portal1041-filter-band'));
}

function enhanceAll() {
  document.querySelectorAll<HTMLTableElement>('#portal-app-root main table').forEach(enhanceResizableTable);
  registerSettingsButtons();
  injectWrapSetting();
  augmentColumnFilterPopup();
  removeTableRefreshButtons();
  makeCalendarDayClickCanonical();
  strengthenFilterBands();
}

export function PortalVersion1041Enhancer() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(enhanceAll);
    };

    enhanceAll();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
