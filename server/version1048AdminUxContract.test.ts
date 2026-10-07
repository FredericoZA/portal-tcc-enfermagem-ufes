import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { readPortalCss } from './testUtils/portalCss';
const source = (path: string) => readFile(path, 'utf8');

test('superfícies administrativas usam a paleta canônica do Portal', async () => {
  const [tokens, modal, css] = await Promise.all([
    source('src/utils/portalSemanticTokens.ts'),
    source('src/components/SettingsWorkspaceModal.tsx'),
    readPortalCss(),
  ]);
  assert.ok(tokens.includes('PORTAL_THEME.surface.panel'));
  assert.ok(css.includes('--portal-surface-panel: #e1e6e9'));
  assert.ok(css.includes('--portal-surface-card: #d5dce0'));
  assert.ok(css.includes('--portal-surface-inner: #ffffff'));
  assert.ok(css.includes('--portal-brand-action: #337959'));
  assert.ok(css.includes('--portal-brand-header: #005830'));
  assert.ok(modal.includes("var(--portal-surface-panel)"));
  assert.ok(modal.includes("var(--portal-surface-card)"));
  assert.ok(modal.includes("var(--portal-surface-inner)"));
  assert.ok(css.includes('.portal-settings-launcher'));
  assert.ok(css.includes('background: var(--portal-surface-card)'));
});

test('Modelos e Variáveis usa popups específicos e une modelos com documentos', async () => {
  const [studio, config, models] = await Promise.all([
    source('src/components/IntegrationStudioPanel.tsx'),
    source('src/pages/ConfiguracoesPage.tsx'),
    source('src/components/MasterDocumentModelsPanel.tsx'),
  ]);
  assert.ok(studio.includes('portal-studio-tabs'));
  assert.ok(studio.includes('hideTabs'));
  const studioReturn = studio.slice(studio.indexOf('portal-workspace portal-studio'));
  assert.equal((studioReturn.match(/<aside/g) || []).length, 0);
  for (const title of ['Documentos e Variáveis', 'E-mails', 'Formulários', 'Fluxos']) {
    assert.ok(config.includes(`title: '${title}'`));
  }
  assert.ok(config.includes("activeSettingsPanel === 'models-documents'"));
  assert.ok(config.includes("key=\"studio-variables-unified\""));
  assert.ok(!config.includes("id: 'variables', title: 'Variáveis'"));
  assert.ok(!config.includes('initialTab="documents"'));
  assert.ok(models.includes('Variáveis deste modelo'));
  assert.ok(models.includes('Visualizar modelo'));
});

test('calendário e Lista de Defesas compartilham estado, tons e resumo solicitado', async () => {
  const [home, semantics, css] = await Promise.all([
    source('src/pages/HomePage.tsx'),
    source('src/utils/defenseSemantics.ts'),
    readPortalCss(),
  ]);
  assert.ok(home.includes('data-defense-state={defenseState}'));
  assert.ok(css.includes('data-defense-state="defended"'));
  assert.ok(css.includes('data-defense-state="upcoming"'));
  assert.ok(css.includes('background: var(--portal-surface-panel)'));
  assert.ok(semantics.includes('getDefenseCalendarSummaryParts'));
  assert.ok(semantics.includes('process.aluno1?.nome'));
  assert.ok(semantics.includes('process.aluno2?.nome'));
  assert.ok(home.includes('portal-calendar-defense-primary'));
  assert.ok(home.includes('portal-calendar-defense-secondary'));
});

test('Registros de Assinatura mostra a linha completa e somente ações suportadas', async () => {
  const [page, client, server] = await Promise.all([
    source('src/pages/AstenLogsPage.tsx'),
    source('src/services/apiClient.ts'),
    source('server.ts'),
  ]);
  assert.ok(page.includes("{ key: 'actions', label: 'Ações', isFixed: true }"));
  assert.ok(page.includes('min-w-[1900px]'));
  assert.ok(page.includes('sticky right-0'));
  assert.ok(page.includes('Reenviar'));
  assert.ok(page.includes('Reconciliar'));
  assert.ok(client.includes('reconcileSignatureJob'));
  assert.ok(server.includes("app.post('/api/signatures/jobs/:id/reconcile'"));
  assert.ok(!page.includes('Excluir assinatura'));
  assert.ok(!page.includes('Editar assinatura'));
});

test('Registro de Logs mantém tabela compacta e camada final branca', async () => {
  const [logs, css] = await Promise.all([
    source('src/pages/AuditLogsPage.tsx'),
    readPortalCss(),
  ]);
  assert.ok(logs.includes("px-3 py-1 text-slate-950"));
  assert.ok(logs.includes("px-2 py-0.5 text-[9px]"));
  assert.ok(css.includes('--portal-surface-inner: #ffffff'));
  assert.ok(logs.includes('data-settings-sheet="true"'));
});
