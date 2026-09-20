import { useEffect } from 'react';

const FILTER_ROWS = [
  '.portal-defense-filter-row',
  '.portal-meus-processos-filter-row',
  '.portal-coordinator-filter-row',
] as const;

const CONFIG_SECTIONS: Array<[string, string, string]> = [
  ['portal-personalization-section', '🎨', 'Personalização do Portal'],
  ['google-workspace-sync-section', '🔄', 'Sincronização e Acessos'],
  ['master-flow-system-section', '🧩', 'Modelos e Variáveis'],
];

const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();

function getStageCount() {
  try {
    const candidates = ['workflow_pipeline_stages', 'portal_workflow_stages', 'tcc_workflow_stages'];
    for (const key of candidates) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 2) return parsed.length;
      if (Array.isArray(parsed?.stages) && parsed.stages.length >= 2) return parsed.stages.length;
    }
  } catch {}
  return 7;
}

function replaceProgressWithStage(table: HTMLTableElement) {
  const header = table.tHead?.rows[0];
  const body = table.tBodies[0];
  if (!header || !body) return;
  Array.from(header.cells).forEach((cell, index) => {
    const th = cell as HTMLTableCellElement;
    const raw = normalize(th.dataset.portalColumnLabel || th.textContent || '').replace(/[↕↑↓^]/g, '').trim();
    if (!/^progresso$/i.test(raw) && !/^etapa$/i.test(raw)) return;
    if (/^progresso$/i.test(raw)) {
      const walker = document.createTreeWalker(th, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node as Text;
        if (/progresso/i.test(text.data)) text.data = text.data.replace(/progresso/gi, 'Etapa');
      }
      th.dataset.portalColumnLabel = 'Etapa';
    }
    const stages = getStageCount();
    Array.from(body.rows).forEach((row) => {
      const td = row.cells[index];
      if (!td || td.dataset.portal1041Stage === 'true') return;
      const match = normalize(td.textContent || '').match(/(\d+(?:[.,]\d+)?)\s*%/);
      if (!match) return;
      const percent = Number(match[1].replace(',', '.'));
      if (!Number.isFinite(percent)) return;
      const stage = Math.max(1, Math.min(stages, Math.round((percent / 100) * stages)));
      td.replaceChildren(document.createTextNode(String(stage)));
      td.dataset.portal1041Stage = 'true';
      td.classList.add('portal1041-stage-cell');
    });
  });
}

function normalizeSortControls(table: HTMLTableElement) {
  const header = table.tHead?.rows[0];
  if (!header) return;
  Array.from(header.cells).forEach((cell) => {
    const th = cell as HTMLTableCellElement;
    if (th.dataset.portalSelectionColumn === 'true') {
      th.classList.add('portal1041-selection-header');
      return;
    }
    th.querySelectorAll<HTMLElement>('.portal-column-sort').forEach((button) => {
      if (button.textContent !== '^') button.textContent = '^';
      button.classList.add('portal1041-sort-caret');
    });
    const nativeSvg = th.querySelector<SVGElement>(
      'svg.lucide-arrow-up-down,svg.lucide-arrow-up,svg.lucide-arrow-down,svg.lucide-chevron-up,svg.lucide-chevron-down'
    );
    if (nativeSvg) {
      nativeSvg.classList.add('portal1041-native-sort-icon');
      const host = th.querySelector<HTMLElement>('.portal-column-header-content') || th;
      if (!host.querySelector(':scope > .portal1041-native-caret')) {
        const caret = document.createElement('span');
        caret.className = 'portal1041-native-caret';
        caret.textContent = '^';
        caret.setAttribute('aria-hidden', 'true');
        const controls = host.querySelector(':scope > .portal-column-controls');
        host.insertBefore(caret, controls || null);
      }
    }
  });
}

function compactCoordinatorProcessCell(table: HTMLTableElement) {
  if (!table.closest('#coordenador-page-root')) return;
  const headers = Array.from(table.tHead?.rows[0]?.cells || []);
  const processIndex = headers.findIndex((cell) => /^processo$/i.test(normalize((cell as HTMLElement).dataset.portalColumnLabel || cell.textContent || '').replace(/[↕↑↓^]/g, '').trim()));
  if (processIndex < 0) return;
  Array.from(table.tBodies[0]?.rows || []).forEach((row) => {
    const cell = row.cells[processIndex];
    if (!cell || cell.dataset.portal1041CompactProcess === 'true') return;
    const text = normalize(cell.textContent || '');
    const match = text.match(/\b\d{4}-\d{3,}\b/);
    if (!match) return;
    const pill = document.createElement('span');
    pill.className = 'portal1041-process-pill';
    pill.textContent = match[0];
    cell.replaceChildren(pill);
    cell.dataset.portal1041CompactProcess = 'true';
  });
}

function enhanceTables() {
  document.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    if (!table.tHead || !table.tBodies.length) return;
    if (table.closest('[role="dialog"]') && !table.closest('.portal1041-admin-modal')) return;
    table.classList.add('portal1041-table');
    replaceProgressWithStage(table);
    normalizeSortControls(table);
    compactCoordinatorProcessCell(table);
  });
}

function ensureProxyFilters(selector: string) {
  const source = document.querySelector<HTMLElement>(selector);
  if (!source) return;
  source.classList.add('portal1041-filter-source');
  const banner = source.parentElement;
  if (!banner) return;
  const titleRow = Array.from(banner.children).find((child) => child !== source) as HTMLElement | undefined;
  if (!titleRow) return;
  titleRow.classList.add('portal1041-title-row');
  const actionHost = titleRow.lastElementChild as HTMLElement | null;
  if (!actionHost) return;
  actionHost.classList.add('portal1041-action-host');

  let proxy = actionHost.querySelector<HTMLElement>(':scope > .portal1041-inline-filters');
  const originalButtons = Array.from(source.querySelectorAll<HTMLButtonElement>('button.portal-standard-filter-chip, button[aria-pressed]'));
  if (!originalButtons.length) return;

  if (!proxy) {
    proxy = document.createElement('div');
    proxy.className = 'portal1041-inline-filters';
    const last = actionHost.lastElementChild as HTMLElement | null;
    if (last) {
      last.classList.add('portal1041-standard-actions');
      actionHost.insertBefore(proxy, last);
    } else {
      actionHost.appendChild(proxy);
    }
  }

  if (proxy.children.length !== originalButtons.length) {
    proxy.replaceChildren();
    originalButtons.forEach((_, index) => {
      const clone = document.createElement('button');
      clone.type = 'button';
      clone.className = 'portal1041-proxy-filter';
      clone.dataset.portal1041Index = String(index);
      clone.addEventListener('click', () => {
        const currentSource = document.querySelector<HTMLElement>(selector);
        const buttons = currentSource ? Array.from(currentSource.querySelectorAll<HTMLButtonElement>('button.portal-standard-filter-chip, button[aria-pressed]')) : [];
        buttons[index]?.click();
      });
      proxy!.appendChild(clone);
    });
  }

  Array.from(proxy.children).forEach((child, index) => {
    const clone = child as HTMLButtonElement;
    const original = originalButtons[index];
    if (!original) return;
    const html = original.innerHTML;
    if (clone.innerHTML !== html) clone.innerHTML = html;
    const selected = original.getAttribute('aria-pressed') === 'true' || original.dataset.selected === 'true';
    clone.dataset.selected = selected ? 'true' : 'false';
    clone.setAttribute('aria-pressed', selected ? 'true' : 'false');
    clone.disabled = original.disabled;
    const nextStyle = original.getAttribute('style') || '';
    if (clone.getAttribute('style') !== nextStyle) clone.setAttribute('style', nextStyle);
    clone.title = original.title || normalize(original.textContent || 'Filtro');
  });

  if (source.classList.contains('portal-coordinator-filter-row')) proxy.classList.add('portal1041-after-provider');
}

function moveGeneralFilters() {
  FILTER_ROWS.forEach((selector) => ensureProxyFilters(selector));
}

function markToggleArtifacts(button: HTMLButtonElement) {
  button.querySelectorAll<HTMLElement>('span,div,strong').forEach((node) => {
    if (/^(expandir|recolher)$/i.test(normalize(node.textContent || ''))) node.classList.add('portal1041-hide-toggle-copy');
  });
  button.querySelectorAll<SVGElement>('svg').forEach((svg, index, list) => {
    if (index === list.length - 1) svg.classList.add('portal1041-hide-chevron');
  });
}

function decorateConfigSection(sectionId: string, icon: string, label: string) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const button = section.querySelector<HTMLButtonElement>(':scope > button');
  if (!button) return;
  button.classList.add('portal1041-config-bar');
  markToggleArtifacts(button);
  if (!button.querySelector(':scope > .portal1041-config-leading-icon')) {
    const leading = document.createElement('span');
    leading.className = 'portal1041-config-leading-icon';
    leading.textContent = icon;
    leading.setAttribute('aria-hidden', 'true');
    button.insertBefore(leading, button.firstChild);
  }
  if (!button.querySelector(':scope > .portal1041-config-action-icon')) {
    const action = document.createElement('span');
    action.className = 'portal1041-config-action-icon';
    action.textContent = '⚙';
    action.setAttribute('aria-hidden', 'true');
    button.appendChild(action);
  }
  button.dataset.portal1041Label = label;
}

function createRecordsBar(type: 'signatures' | 'logs', label: string, icon: string) {
  const section = document.createElement('section');
  section.id = `portal1041-config-${type}`;
  section.className = 'portal1041-injected-config-section';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'portal1041-config-bar portal1041-injected-config-bar';
  button.innerHTML = `<span class="portal1041-config-leading-icon" aria-hidden="true">${icon}</span><span class="portal1041-injected-label">${label}</span><span class="portal1041-config-action-icon" aria-hidden="true">⚙</span>`;
  button.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('portal:open-config-records', { detail: { type } }));
  });
  section.appendChild(button);
  return section;
}

function insertRecordBars() {
  const models = document.getElementById('master-flow-system-section');
  if (!models?.parentElement) return;
  let signatures = document.getElementById('portal1041-config-signatures');
  if (!signatures) {
    signatures = createRecordsBar('signatures', 'Registros de Assinatura', '✍️');
    models.insertAdjacentElement('afterend', signatures);
  }
  let logs = document.getElementById('portal1041-config-logs');
  if (!logs) {
    logs = createRecordsBar('logs', 'Registro de Logs', '🧾');
    signatures.insertAdjacentElement('afterend', logs);
  }
  document.getElementById('system-audit-logs-section')?.classList.add('portal1041-inline-logs-hidden');
}

function removeLegacySidebarRecords() {
  document.getElementById('nav-item-logs')?.remove();
  document.getElementById('nav-item-asten-logs')?.remove();
}

function insertPanelIntro(id: string, title: string, description: string) {
  const panel = document.getElementById(id);
  if (!panel || panel.querySelector(':scope > .portal1041-panel-intro')) return;
  const intro = document.createElement('div');
  intro.className = 'portal1041-panel-intro';
  intro.innerHTML = `<strong>${title}</strong><span>${description}</span>`;
  panel.insertBefore(intro, panel.firstChild);
}

function visibleSaveButton(section: HTMLElement) {
  return Array.from(section.querySelectorAll<HTMLButtonElement>('button')).find((button) => /salvar/i.test(normalize(button.textContent || '')) && !button.classList.contains('portal1041-workspace-save')) || null;
}

function enhanceSyncWorkspace() {
  const section = document.getElementById('google-workspace-sync-section');
  if (!section) return;
  insertPanelIntro('administrative-identity-panel', 'Rodapé', 'Presidência, Secretaria e Comissão: dados institucionais exibidos no rodapé do Portal.');
  insertPanelIntro('infrastructure-integrations-panel', 'Integrações da Plataforma', 'Conexões externas do Portal, testes de comunicação e estado operacional.');
  insertPanelIntro('authorized-access-panel', 'Autorização de Acesso', 'Cadastre acessos individuais ou envie uma lista autorizada de usuários.');

  const close = section.querySelector<HTMLButtonElement>('.portal-settings-workspace-close');
  if (close) {
    close.textContent = '×';
    close.title = 'Fechar';
    close.setAttribute('aria-label', 'Fechar');
  }
  if (section.dataset.portalWorkspaceOpen === 'true' && !section.querySelector(':scope > .portal1041-workspace-save')) {
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'portal1041-workspace-save';
    save.textContent = '💾';
    save.title = 'Salvar alterações';
    save.setAttribute('aria-label', 'Salvar alterações');
    save.addEventListener('click', () => visibleSaveButton(section)?.click());
    section.appendChild(save);
  }

  const originalSave = visibleSaveButton(section);
  if (originalSave) originalSave.classList.add('portal1041-original-save');

  if (section.dataset.portal1041Autosave !== 'true') {
    section.dataset.portal1041Autosave = 'true';
    let timer = 0;
    section.addEventListener('change', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.matches('#administrative-identity-panel input,#administrative-identity-panel select,#administrative-identity-panel textarea')) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => visibleSaveButton(section)?.click(), 750);
    });
  }
}

function enhanceConfig() {
  CONFIG_SECTIONS.forEach(([id, icon, label]) => decorateConfigSection(id, icon, label));
  insertRecordBars();
  removeLegacySidebarRecords();
  enhanceSyncWorkspace();
}

export default function PortalVersion1041Enhancer() {
  useEffect(() => {
    let frame = 0;
    let running = false;
    const apply = () => {
      if (running) return;
      running = true;
      try {
        enhanceTables();
        moveGeneralFilters();
        enhanceConfig();
      } finally {
        running = false;
      }
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        apply();
      });
    };
    apply();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('portal:navigation', schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener('portal:navigation', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
