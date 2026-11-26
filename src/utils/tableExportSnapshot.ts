import { isPortalTableRowFilteredOut } from './portalTableDom';
import { readPortalHeaderLabel } from './portalTableIdentity';
import type { TableExportSnapshot } from './tableExportFiles';

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'SECTION', 'ARTICLE', 'H1', 'H2', 'H3', 'H4']);
const OMIT_TAGS = new Set(['BUTTON', 'SVG', 'SCRIPT', 'STYLE', 'INPUT', 'SELECT', 'TEXTAREA']);

function normalizeCellText(value: string) {
  return value.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ')
    .split('\n').map(line => line.replace(/[\t ]+/g, ' ').trim())
    .filter(Boolean).join('\n');
}

function computedStyle(element: HTMLElement): CSSStyleDeclaration | undefined {
  try { return element.ownerDocument?.defaultView?.getComputedStyle(element); }
  catch { return undefined; }
}

function explicitlyHidden(element: HTMLElement) {
  return element.hidden || element.getAttribute('aria-hidden') === 'true'
    || element.dataset.portalExport === 'false'
    || element.style.display === 'none' || element.style.visibility === 'hidden';
}

/** Unlike innerText, this also works for rows hidden only by the current page. */
function contentText(node: Node): string {
  if (node.nodeType === 3) return node.textContent || '';
  if (node.nodeType !== 1) return '';
  const element = node as HTMLElement;
  if (explicitlyHidden(element) || OMIT_TAGS.has(element.tagName)
    || element.classList.contains('portal-core-column-menu')
    || element.classList.contains('portal-core-resizer')) return '';
  const style = computedStyle(element);
  if (style?.display === 'none' || style?.visibility === 'hidden') return '';
  if (element.tagName === 'BR') return '\n';
  const text = Array.from(element.childNodes, contentText).join('');
  return BLOCK_TAGS.has(element.tagName) ? `\n${text}\n` : text;
}

function cellText(cell?: HTMLTableCellElement) {
  if (!cell || explicitlyHidden(cell)) return '';
  // An icon/popover may represent a value already authorized by the list API.
  // Never export button labels, URLs, tooltip attributes or hidden form values.
  return normalizeCellText(cell.dataset.portalExportValue ?? contentText(cell));
}

function visibleHeader(header: HTMLTableCellElement) {
  if (explicitlyHidden(header) || header.dataset.portalSelectionColumn === 'true') return false;
  const style = computedStyle(header);
  return style?.display !== 'none' && style?.visibility !== 'hidden';
}

function colorHex(value?: string): string | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  if (/^#[\da-f]{6}$/i.test(text)) return text.toLowerCase();
  if (/^#[\da-f]{3}$/i.test(text)) return '#' + [...text.slice(1)].map(char => char + char).join('').toLowerCase();
  const rgb = text.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (!rgb || (rgb[4] !== undefined && Number(rgb[4]) < 1)) return undefined;
  return '#' + rgb.slice(1, 4).map(channel => Math.min(255, Math.max(0, Math.round(Number(channel)))).toString(16).padStart(2, '0')).join('');
}

function backgroundColor(element: HTMLElement | null | undefined, table: HTMLTableElement): string | undefined {
  for (let current = element; current; current = current.parentElement) {
    const color = colorHex(computedStyle(current)?.backgroundColor);
    if (color) return color;
    if (current === table) break;
  }
  return undefined;
}

/**
 * Read exactly the configured table, including column filters and DOM sorting.
 * Pagination is a viewing limit only: every matching row is included. Nothing
 * is fetched, and omitted columns and filtered records never enter the file.
 */
export function captureTableExportSnapshot(
  table: HTMLTableElement,
  { title, columnOrder }: { title: string; columnOrder?: readonly string[] },
): TableExportSnapshot {
  const headers = Array.from(table.tHead?.rows[0]?.cells || []);
  const visible = headers.map((header, index) => ({ header, index }))
    .filter(({ header }) => visibleHeader(header));
  const byKey = new Map(visible.map(column => [column.header.dataset.portalColumnKey, column]));
  const selected = columnOrder
    ? columnOrder.flatMap(key => {
        const column = byKey.get(key);
        return column ? [column] : [];
      })
    : visible;
  const rows = Array.from(table.tBodies).flatMap(body => Array.from(body.rows))
    .filter(row => !isPortalTableRowFilteredOut(row) && row.dataset.portalExport !== 'false');
  const firstHeader = selected[0]?.header;
  const firstCell = rows[0]?.cells[selected[0]?.index ?? 0];
  const appearance: NonNullable<TableExportSnapshot['appearance']> = {
    headerBackground: backgroundColor(firstHeader, table),
    headerColor: firstHeader ? colorHex(computedStyle(firstHeader)?.color) : undefined,
    bodyColor: firstCell ? colorHex(computedStyle(firstCell)?.color) : undefined,
    alternateBackground: backgroundColor(rows[1], table),
  };
  return {
    title: normalizeCellText(title).replace(/\n/g, ' '),
    columns: selected.map(({ header, index }) => {
      const measured = header.getBoundingClientRect().width;
      const width = Number.isFinite(measured) && measured > 0 ? measured : Number.parseFloat(header.style.width);
      return {
        key: header.dataset.portalColumnKey || `column-${index + 1}`,
        label: readPortalHeaderLabel(header),
        ...(Number.isFinite(width) && width > 0 ? { width } : {}),
      };
    }),
    rows: selected.length ? rows.map(row => selected.map(({ index }) => cellText(row.cells[index]))) : [],
    ...(Object.values(appearance).some(Boolean) ? { appearance } : {}),
  };
}
