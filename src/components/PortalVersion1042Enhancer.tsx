import { useEffect } from 'react';

const FADED_ROW_CLASSES = ['bg-slate-100/40', 'text-slate-400', 'opacity-60'];

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[↕↑↓]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function headerLabel(header: HTMLTableCellElement) {
  const clone = header.cloneNode(true) as HTMLTableCellElement;
  clone
    .querySelectorAll(
      'button,.portal-column-controls,.portal1040-inline-sort,.portal1041-column-menu-button,.portal1043-column-menu-button,.portal1042-column-menu-button',
    )
    .forEach((node) => node.remove());
  return normalize(clone.textContent || '');
}

function removeObsoleteHeaderControls(table: HTMLTableElement) {
  const headerRow = table.tHead?.rows[0];
  if (!headerRow) return;

  Array.from(headerRow.cells).forEach((cell) => {
    const header = cell as HTMLTableCellElement;
    header
      .querySelectorAll<HTMLElement>(
        '.portal-column-controls,.portal1040-inline-sort,.portal1041-column-menu-button,.portal-column-sort,.portal-column-filter',
      )
      .forEach((control) => control.remove());

    // Alguns cabeçalhos antigos deixaram setas como texto. O único controle
    // funcional deve ser o menu consolidado criado pela camada de manutenção.
    const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let current: Node | null;
    while ((current = walker.nextNode())) nodes.push(current as Text);
    nodes.forEach((node) => {
      if (node.parentElement?.closest('button')) return;
      if (/[↕↑↓]/.test(node.data)) node.data = node.data.replace(/[↕↑↓]/g, '');
    });
  });
}

function identifyDefenseTable(table: HTMLTableElement) {
  const processCell = table.querySelector<HTMLTableCellElement>(
    'tbody td[title="Clique aqui para abrir os detalhes e documentos deste TCC"]',
  );
  if (!processCell) return false;

  table.dataset.portal1042DefenseTable = 'true';
  return true;
}

function normalizeDefenseRows(table: HTMLTableElement) {
  if (!identifyDefenseTable(table)) return;

  const headers = Array.from(table.tHead?.rows[0]?.cells || []) as HTMLTableCellElement[];
  const processIndex = headers.findIndex((header) => headerLabel(header) === 'processo');

  Array.from(table.tBodies[0]?.rows || []).forEach((row) => {
    const wasFaded = FADED_ROW_CLASSES.some((className) => row.classList.contains(className));
    row.dataset.portal1042DefenseState = wasFaded ? 'defended' : 'upcoming';
    row.classList.remove(...FADED_ROW_CLASSES);
    row.classList.add('portal1042-defense-row');
    row.style.opacity = '1';

    if (processIndex >= 0) {
      const processCell = row.cells[processIndex] as HTMLTableCellElement | undefined;
      if (processCell) {
        processCell.dataset.portal1042ProcessCell = 'true';
        processCell.dataset.portal1042DefenseState = row.dataset.portal1042DefenseState || 'upcoming';
      }
    }
  });
}

function markFilterBands() {
  document
    .querySelectorAll<HTMLElement>(
      '.portal-defense-filter-row,.portal-meus-processos-filter-row,.portal-coordinator-filter-row,.portal-standard-filter-row,[data-portal1040-filter-band="true"],.portal1041-filter-band',
    )
    .forEach((row) => row.classList.add('portal1042-filter-band'));
}

function enhanceTable(table: HTMLTableElement) {
  if (table.closest('[role="dialog"]') || table.closest('.portal1043-column-menu-popup')) return;
  const headerRow = table.tHead?.rows[0];
  if (!headerRow || headerRow.cells.length < 2) return;

  table.classList.add('portal1042-sheet');
  removeObsoleteHeaderControls(table);
  normalizeDefenseRows(table);
}

function enhanceAll() {
  document.querySelectorAll<HTMLTableElement>('#portal-app-root main table').forEach(enhanceTable);
  markFilterBands();
}

export function PortalVersion1042Enhancer() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(enhanceAll);
    };

    enhanceAll();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
