import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path: string) => readFile(path, 'utf8');

test('versão 1.0.41 ativa a nova camada de interface', async () => {
  const [main, pkg] = await Promise.all([source('src/main.tsx'), source('package.json')]);
  assert.ok(main.includes('PortalVersion1041Enhancer'));
  assert.ok(main.includes('PortalVersion1041AdminModals'));
  assert.ok(main.includes("import './portal-version-1041.css'"));
  assert.equal(JSON.parse(pkg).version, '1.0.41');
});

test('planilhas adotam Etapa, circunflexo, funil no canto e tipografia mais forte', async () => {
  const [enhancer, css] = await Promise.all([
    source('src/components/PortalVersion1041Enhancer.tsx'),
    source('src/portal-version-1041.css'),
  ]);
  assert.ok(enhancer.includes("textContent = '^'"));
  assert.ok(enhancer.includes("replace(/progresso/gi, 'Etapa')"));
  assert.ok(css.includes('.portal-column-filter'));
  assert.match(css, /top:\s*4px\s*!important/);
  assert.match(css, /right:\s*5px\s*!important/);
  assert.match(css, /font-weight:\s*500\s*!important/);
  assert.ok(css.includes("thead th[data-portal-selection-column='true'] .portal-column-controls"));
});

test('filtros gerais sobem à barra superior e hover deixa de simular seleção', async () => {
  const [enhancer, css] = await Promise.all([
    source('src/components/PortalVersion1041Enhancer.tsx'),
    source('src/portal-version-1041.css'),
  ]);
  assert.ok(enhancer.includes('.portal-defense-filter-row'));
  assert.ok(enhancer.includes('.portal-meus-processos-filter-row'));
  assert.ok(enhancer.includes('.portal-coordinator-filter-row'));
  assert.ok(enhancer.includes('portal1041-inline-filters'));
  assert.ok(css.includes('.portal1041-filter-source'));
  assert.ok(css.includes('display: none !important'));
  assert.ok(css.includes('.portal-standard-filter-chip:not([data-selected=\'true\']):hover'));
  assert.ok(css.includes('.portal-spreadsheet-table tbody tr:hover'));
});

test('Configurações reúne cinco entradas e registros abrem como popups', async () => {
  const [enhancer, modals, css] = await Promise.all([
    source('src/components/PortalVersion1041Enhancer.tsx'),
    source('src/components/PortalVersion1041AdminModals.tsx'),
    source('src/portal-version-1041.css'),
  ]);
  assert.ok(enhancer.includes("['portal-personalization-section', '🎨', 'Personalização do Portal']"));
  assert.ok(enhancer.includes("['google-workspace-sync-section', '🔄', 'Sincronização e Acessos']"));
  assert.ok(enhancer.includes("['master-flow-system-section', '🧩', 'Modelos e Variáveis']"));
  assert.ok(enhancer.includes("createRecordsBar('signatures', 'Registros de Assinatura'"));
  assert.ok(enhancer.includes("createRecordsBar('logs', 'Registro de Logs'"));
  assert.ok(modals.includes('<AstenLogsPage />'));
  assert.ok(modals.includes('<AuditLogsPage />'));
  assert.ok(css.includes('.portal1041-admin-modal-header'));
});

test('Sincronização recebe títulos contextuais, salvar no chrome e autosave seguro do rodapé', async () => {
  const enhancer = await source('src/components/PortalVersion1041Enhancer.tsx');
  assert.ok(enhancer.includes("insertPanelIntro('administrative-identity-panel', 'Rodapé'"));
  assert.ok(enhancer.includes("insertPanelIntro('infrastructure-integrations-panel', 'Integrações da Plataforma'"));
  assert.ok(enhancer.includes("insertPanelIntro('authorized-access-panel', 'Autorização de Acesso'"));
  assert.ok(enhancer.includes('portal1041-workspace-save'));
  assert.ok(enhancer.includes('portal1041Autosave'));
});
