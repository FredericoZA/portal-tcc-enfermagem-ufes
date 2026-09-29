import { useEffect } from 'react';

const INTERACTIVE_SELECTOR = 'button,input,select,textarea,a,[role="button"],[contenteditable="true"]';

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function isVisible(element: HTMLElement | null | undefined) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
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
  const label = headerLabel(header);
  if (label === 'processo' || label === 'protocolo') return;
  const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) nodes.push(current as Text);
  nodes.forEach((node) => {
    if (node.parentElement?.closest('button')) return;
    node.data = node.data
      .replace(/n[º°o]?\.?\s*do\s*processo/gi, 'Processo')
      .replace(/n[uú]mero\s+do\s+processo/gi, 'Processo')
      .replace(/^\s*protocolo\s*$/gi, 'Processo');
  });
}

function markSpreadsheet(table: HTMLTableElement) {
  if (!table.tHead?.rows.length || !table.tBodies.length) return;
  const headerRow = table.tHead.rows[table.tHead.rows.length - 1];
  const headers = Array.from(headerRow.cells) as HTMLTableCellElement[];
  if (!headers.length) return;

  table.dataset.portalV53StickyTable = 'true';
  headers.forEach((header) => { header.dataset.portalV53StickyHeader = 'true'; });

  const selectionIndex = headers.findIndex((header) =>
    header.dataset.portalSelectionColumn === 'true'
    || normalize(header.dataset.portalColumnLabel || '') === 'selecao'
    || headerLabel(header) === 'selecao');
  const processIndex = headers.findIndex(isProcessHeader);

  if (selectionIndex >= 0) {
    const selectionHeader = headers[selectionIndex];
    selectionHeader.dataset.portalV53StickySelection = 'true';
    selectionHeader.querySelectorAll<HTMLButtonElement>('button').forEach((button) => button.classList.add('portal-v53-selection-button'));
    Array.from(table.tBodies[0].rows).forEach((row) => {
      const cell = row.cells[selectionIndex] as HTMLTableCellElement | undefined;
      if (!cell) return;
      cell.dataset.portalV53StickySelection = 'true';
      cell.querySelectorAll<HTMLButtonElement>('button').forEach((button) => button.classList.add('portal-v53-selection-button'));
    });
  }

  if (processIndex >= 0) {
    const processHeader = headers[processIndex];
    renameProcessHeader(processHeader);
    processHeader.dataset.portalV53StickyProcess = 'true';
    if (selectionIndex >= 0 && selectionIndex < processIndex) processHeader.dataset.portalV53AfterSelection = 'true';
    Array.from(table.tBodies[0].rows).forEach((row) => {
      const cell = row.cells[processIndex] as HTMLTableCellElement | undefined;
      if (!cell) return;
      cell.dataset.portalV53StickyProcess = 'true';
      if (selectionIndex >= 0 && selectionIndex < processIndex) cell.dataset.portalV53AfterSelection = 'true';
    });
  }
}

function findScrollHost(table: HTMLTableElement) {
  const direct = table.closest<HTMLElement>('.table-sticky-container');
  if (direct) return direct;
  let current = table.parentElement;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    if (/(auto|scroll)/.test(`${style.overflowX} ${style.overflowY}`)) return current;
    current = current.parentElement;
  }
  return table.parentElement;
}

function syncMyTccFilterVisual() {
  const row = document.querySelector<HTMLElement>('#meus-processos-page-container .portal-meus-processos-filter-row');
  if (!row) return;
  const all = row.querySelector<HTMLButtonElement>('.portal-v52-all-filter');
  if (!all) return;
  const group = all.parentElement;
  if (!group) return;
  group.classList.add('portal-v53-role-filter-group');
  const roles = Array.from(group.querySelectorAll<HTMLButtonElement>('button.portal-standard-filter-chip:not(.portal-v52-all-filter)'));
  if (!roles.length) return;

  const allRolesSelected = roles.every((button) => button.getAttribute('aria-pressed') === 'true');
  if (!group.dataset.portalV53AllInitialized) {
    group.dataset.portalV53AllInitialized = 'true';
    group.dataset.portalV53AllActive = allRolesSelected ? 'true' : 'false';
  } else if (group.dataset.portalV53AllActive === 'true' && !allRolesSelected) {
    group.dataset.portalV53AllActive = 'false';
  }
}

function syncPagers() {
  const presidentAll = document.getElementById('portal-president-all-view');
  const presidentAllVisible = isVisible(presidentAll);
  document.querySelectorAll<HTMLElement>('.portal-v52-pager').forEach((pager) => {
    let orphan = false;
    const previous = pager.previousElementSibling as HTMLElement | null;
    const ownerTable = previous?.querySelector<HTMLTableElement>('table') || null;
    if (!ownerTable || !isVisible(ownerTable)) orphan = true;
    if (presidentAllVisible && pager.dataset.portalTableKey === 'coordinator' && !pager.closest('#portal-president-all-view')) orphan = true;
    pager.dataset.portalV53Orphan = orphan ? 'true' : 'false';
  });
}

function syncPresidentSelection() {
  document.querySelectorAll<HTMLElement>('#coordenador-page-root [data-portal-selection-column="true"], #coordenador-page-root [data-portal-selection-column-cell="true"]').forEach((cell) => {
    cell.querySelectorAll<HTMLButtonElement>('button').forEach((button) => button.classList.add('portal-v53-selection-button'));
  });
  document.querySelectorAll<HTMLElement>('#portal-president-all-view button').forEach((button) => {
    if (button.closest('th:first-child,td:first-child')) button.classList.add('portal-v53-selection-button');
  });
}

function syncSettingsWorkspaces() {
  document.querySelectorAll<HTMLElement>('.portal-settings-workspace').forEach((workspace) => {
    const kind = workspace.dataset.portalV52SettingsKind || '';
    if (['access', 'signatures', 'logs'].includes(kind)) workspace.dataset.portalV53DirectSheet = 'true';
    if (['identity', 'integrations'].includes(kind)) workspace.dataset.portalV53SettingsPane = kind;
  });
}

export function PortalVersion1053Enhancer() {
  useEffect(() => {
    const unbinders = new Map<HTMLElement, () => void>();
    let frame = 0;
    let activatingMyTccAll = false;

    const bindScrollHost = (host: HTMLElement) => {
      if (unbinders.has(host)) return;
      host.dataset.portalV53ScrollHost = 'true';
      host.classList.add('portal-v53-scroll-host');

      let pointerId: number | null = null;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;
      let dragging = false;
      let suppressClickUntil = 0;

      const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (target.closest(INTERACTIVE_SELECTOR) || target.closest('thead,th')) return;
        const canX = host.scrollWidth > host.clientWidth + 1;
        const canY = host.scrollHeight > host.clientHeight + 1;
        if (!canX && !canY) return;
        pointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        startLeft = host.scrollLeft;
        startTop = host.scrollTop;
        dragging = false;
        try { host.setPointerCapture(pointerId); } catch { /* browser sem captura */ }
        host.classList.add('portal-v53-pointer-down');
      };

      const finishPointer = (event?: PointerEvent) => {
        if (pointerId === null) return;
        if (event && event.pointerId !== pointerId) return;
        if (dragging) suppressClickUntil = performance.now() + 280;
        try { host.releasePointerCapture(pointerId); } catch { /* captura já liberada */ }
        pointerId = null;
        dragging = false;
        host.classList.remove('portal-v53-pointer-down', 'portal-v53-dragging');
      };

      const onPointerMove = (event: PointerEvent) => {
        if (pointerId === null || event.pointerId !== pointerId) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (!dragging && Math.max(Math.abs(dx), Math.abs(dy)) < 4) return;
        dragging = true;
        host.classList.add('portal-v53-dragging');
        event.preventDefault();
        if (host.scrollWidth > host.clientWidth + 1) host.scrollLeft = startLeft - dx;
        if (host.scrollHeight > host.clientHeight + 1) host.scrollTop = startTop - dy;
      };

      const onWheel = (event: WheelEvent) => {
        const canX = host.scrollWidth > host.clientWidth + 1;
        const canY = host.scrollHeight > host.clientHeight + 1;
        if (!canX && !canY) return;

        const horizontalIntent = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
        if (horizontalIntent && canX) {
          const before = host.scrollLeft;
          const delta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY;
          host.scrollLeft += delta;
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

      host.addEventListener('pointerdown', onPointerDown);
      host.addEventListener('pointermove', onPointerMove, { passive: false });
      host.addEventListener('pointerup', finishPointer);
      host.addEventListener('pointercancel', finishPointer);
      host.addEventListener('lostpointercapture', finishPointer);
      host.addEventListener('wheel', onWheel, { passive: false });
      host.addEventListener('click', onClick, true);

      unbinders.set(host, () => {
        host.removeEventListener('pointerdown', onPointerDown);
        host.removeEventListener('pointermove', onPointerMove);
        host.removeEventListener('pointerup', finishPointer);
        host.removeEventListener('pointercancel', finishPointer);
        host.removeEventListener('lostpointercapture', finishPointer);
        host.removeEventListener('wheel', onWheel);
        host.removeEventListener('click', onClick, true);
        host.classList.remove('portal-v53-pointer-down', 'portal-v53-dragging');
        delete host.dataset.portalV53ScrollHost;
      });
    };

    const enhanceAll = () => {
      document.querySelectorAll<HTMLTableElement>(
        '#biblioteca-tccs-section table, #meus-processos-page-container table, #coordenador-page-root table, .portal-settings-workspace table',
      ).forEach((table) => {
        markSpreadsheet(table);
        const host = findScrollHost(table);
        if (host) bindScrollHost(host);
      });
      syncMyTccFilterVisual();
      syncPagers();
      syncPresidentSelection();
      syncSettingsWorkspaces();
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(enhanceAll);
    };

    const onDocumentClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const allButton = target.closest<HTMLButtonElement>('#meus-processos-page-container .portal-v52-all-filter');
      if (allButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const group = allButton.parentElement;
        if (!group) return;
        const roleButtons = Array.from(group.querySelectorAll<HTMLButtonElement>('button.portal-standard-filter-chip:not(.portal-v52-all-filter)'));
        activatingMyTccAll = true;
        roleButtons.filter((button) => button.getAttribute('aria-pressed') !== 'true').forEach((button) => button.click());
        activatingMyTccAll = false;
        group.dataset.portalV53AllActive = 'true';
        window.setTimeout(() => {
          group.dataset.portalV53AllActive = 'true';
          schedule();
        }, 0);
        return;
      }

      const roleButton = target.closest<HTMLButtonElement>('#meus-processos-page-container button.portal-standard-filter-chip:not(.portal-v52-all-filter)');
      if (roleButton && !activatingMyTccAll) {
        const group = roleButton.parentElement;
        if (group) group.dataset.portalV53AllActive = 'false';
      }
    };

    document.addEventListener('click', onDocumentClickCapture, true);
    enhanceAll();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-pressed', 'data-selected', 'data-portal-filter-value'],
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
    };
  }, []);

  return null;
}
