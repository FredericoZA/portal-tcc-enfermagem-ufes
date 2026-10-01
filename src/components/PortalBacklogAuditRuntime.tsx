import { useEffect } from 'react';
import { GraduationCap } from 'lucide-react';
import { createRoot, Root } from 'react-dom/client';

const injectedRoots = new WeakMap<Element, Root>();

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

function replaceProcessCellLabel(cell: HTMLTableCellElement) {
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);

  const processNodes = nodes.filter((text) => {
    const value = text.data.replace(/\s+/g, ' ').trim();
    return value && !/abrir\s+tcc/i.test(value);
  });
  if (processNodes.length === 0) return;

  const combined = processNodes.map((text) => text.data).join(' ');
  const numericTokens = combined.match(/\d+/g) || [];
  const rawCode = numericTokens[numericTokens.length - 1] || '';
  if (!rawCode) return;

  const code = /^\d{1,4}$/.test(rawCode) ? rawCode.padStart(4, '0') : rawCode;
  const desired = `TCC - ${code}`;
  const target = processNodes.find((text) => /TCC/i.test(text.data)) || processNodes.find((text) => /\d/.test(text.data));
  if (!target) return;

  target.data = desired;
  processNodes.forEach((text) => {
    if (text === target) return;
    if (/TCC/i.test(text.data) || /\d/.test(text.data)) text.data = '';
  });
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
