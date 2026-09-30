import { useEffect } from 'react';
import { GraduationCap } from 'lucide-react';
import { createRoot, Root } from 'react-dom/client';

const injectedRoots = new WeakMap<Element, Root>();
const defenseScrollHosts = new WeakSet<HTMLElement>();

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function navigateToNewTcc() {
  window.dispatchEvent(new CustomEvent('portal:navigate', { detail: 'novo-processo' }));
}

function ensureNewTccAction() {
  const page = document.querySelector<HTMLElement>('#meus-processos-page-container');
  if (!page) return;

  /*
   * A regra atual do produto permite que um aluno participe de múltiplos TCCs.
   * Versões anteriores escondiam a ação quando já existia um vínculo estudantil.
   * Enquanto a tela antiga ainda estiver montada, este runtime canônico garante
   * que a ação de cadastro permaneça disponível independentemente da quantidade
   * de vínculos existentes, sem duplicar o botão nativo quando ele já existe.
   */
  if (page.querySelector('#meus-processos-btn-novo')) return;

  const filterRow = page.querySelector<HTMLElement>('.portal-meus-processos-filter-row');
  const titleRow = filterRow?.previousElementSibling as HTMLElement | null;
  const toolbarHost = titleRow?.lastElementChild as HTMLElement | null;
  if (!toolbarHost || toolbarHost.querySelector('.portal-backlog-new-tcc-button-host')) return;

  const host = document.createElement('div');
  host.className = 'portal-backlog-new-tcc-button-host flex items-center shrink-0 mr-3';
  toolbarHost.prepend(host);

  const root = createRoot(host);
  injectedRoots.set(host, root);
  root.render(
    <button
      id="meus-processos-btn-novo"
      type="button"
      onClick={navigateToNewTcc}
      className="portal-backlog-new-tcc-button inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-[10px] font-black uppercase tracking-wide shadow-sm"
      title="Cadastrar novo trabalho de TCC"
    >
      <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Cadastrar TCC</span>
    </button>,
  );
}

function removeLegacyFlowLabels() {
  document.querySelectorAll<HTMLElement>('#portal-sidebar .portal-sidebar-nav-item').forEach((item) => {
    if ((item.textContent || '').trim().toLocaleLowerCase('pt-BR').includes('fluxo completo do tcc')) item.remove();
  });
}

function findProcessColumn(table: HTMLTableElement) {
  const headerRow = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!headerRow) return -1;
  return Array.from(headerRow.cells).findIndex((cell) => {
    const label = normalize(cell.textContent || '');
    const key = normalize((cell as HTMLElement).dataset.portalColumnKey || (cell as HTMLElement).dataset.portalCoreColumnKey || '');
    return key === 'protocolo'
      || key === 'processo'
      || label === 'processo'
      || label === 'protocolo'
      || label.includes('numero do processo')
      || label.includes('nº do processo')
      || label.includes('n° do processo')
      || label.includes('no do processo');
  });
}

function replaceHeaderLabel(header: HTMLTableCellElement) {
  const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);

  for (const text of nodes) {
    if (text.parentElement?.closest('button,.portal-core-column-menu,.portal-core-resizer')) continue;
    if (!/processo|protocolo/i.test(text.data)) continue;
    text.data = text.data
      .replace(/n[º°o]?\.?\s*do\s*processo/gi, 'Processo')
      .replace(/n[uú]mero\s+do\s+processo/gi, 'Processo')
      .replace(/protocolo/gi, 'Processo');
    return;
  }
}

function canonicalProcessLabel(raw: string) {
  const clean = raw
    .replace(/^TCC\s*[-–—/]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '';
  return `TCC - ${clean}`;
}

function replaceProcessCellLabel(cell: HTMLTableCellElement) {
  const current = (cell.textContent || '').replace(/\s+/g, ' ').trim();
  if (!current || current === '—') return;
  const desired = canonicalProcessLabel(current);
  if (!desired || current === desired) return;

  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);

  const target = nodes.find((text) => /\d/.test(text.data) || /TCC/i.test(text.data));
  if (target) target.data = desired;
}

function bindDefenseWheel(host: HTMLElement) {
  if (defenseScrollHosts.has(host)) return;
  defenseScrollHosts.add(host);

  host.addEventListener('wheel', (event) => {
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

    if (canY && event.deltaY !== 0) {
      const before = host.scrollTop;
      host.scrollTop += event.deltaY;
      if (host.scrollTop !== before) event.preventDefault();
    }
  }, { passive: false });
}

function reconcileDefenseSpreadsheet() {
  const section = document.querySelector<HTMLElement>('#public-calendar-cards-section');
  if (!section) return;

  section.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    const processIndex = findProcessColumn(table);
    if (processIndex < 0) return;

    table.dataset.portalDefenseSpreadsheet = 'true';
    const headerRow = table.tHead?.rows[table.tHead.rows.length - 1];
    const header = headerRow?.cells[processIndex] as HTMLTableCellElement | undefined;
    if (header) {
      replaceHeaderLabel(header);
      header.dataset.portalStickyHeader = 'true';
      header.dataset.portalStickyProcess = 'true';
    }

    Array.from(table.tBodies).forEach((tbody) => {
      Array.from(tbody.rows).forEach((row) => {
        const cell = row.cells[processIndex] as HTMLTableCellElement | undefined;
        if (!cell) return;
        cell.dataset.portalStickyProcess = 'true';
        replaceProcessCellLabel(cell);
      });
    });

    const host = table.closest<HTMLElement>('.portal-spreadsheet-scroll-host,[data-portal-scroll-host="true"],.table-sticky-container');
    if (host) bindDefenseWheel(host);
  });
}

function reconcile() {
  ensureNewTccAction();
  removeLegacyFlowLabels();
  reconcileDefenseSpreadsheet();
}

export function PortalBacklogAuditRuntime() {
  useEffect(() => {
    reconcile();
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reconcile);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.querySelectorAll('.portal-backlog-new-tcc-button-host').forEach((host) => {
        injectedRoots.get(host)?.unmount();
        host.remove();
      });
    };
  }, []);

  return null;
}
