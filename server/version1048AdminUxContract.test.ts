import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path: string) => readFile(path, 'utf8');

test('superfícies administrativas usam a paleta canônica do Portal', async () => {
  const [tokens, modal, css] = await Promise.all([
    source('src/utils/portalSemanticTokens.ts'),
    source('src/components/SettingsWorkspaceModal.tsx'),
    source('src/portal-semantic-ui.css'),
  ]);
  assert.ok(tokens.includes("layer1: '#e1e6e9'"));
  assert.ok(tokens.includes("layer2: '#d5dce0'"));
  assert.ok(tokens.includes("inner: '#ffffff'"));
  assert.ok(tokens.includes("action: '#337959'"));
  assert.ok(tokens.includes("header: '#005830'"));
  assert.ok(modal.includes("var(--portal-surface-layer-1)"));
  assert.ok(modal.includes("var(--portal-surface-layer-2)"));
  assert.ok(modal.includes("var(--portal-surface-inner)"));
  assert.ok(css.includes('#portal-settings-hub .portal-settings-title-bar'));
  assert.ok(css.includes('background: var(--portal-green-action) !important;'));
});

test('Modelos e Variáveis possui uma única sidebar e navegação interna horizontal', async () => {
  const studio = await source('src/components/IntegrationStudioPanel.tsx');
  assert.ok(studio.includes('portal-studio-tabs'));
  assert.ok(studio.includes('Selecione uma área acima'));
  const studioReturn = studio.slice(studio.indexOf('portal-workspace portal-studio'));
  assert.equal((studioReturn.match(/<aside/g) || []).length, 0);
});

test('calendário e Lista de Defesas compartilham estado e tons semânticos', async () => {
  const [home, semantics, css] = await Promise.all([
    source('src/pages/HomePage.tsx'),
    source('src/utils/defenseSemantics.ts'),
    source('src/portal-semantic-ui.css'),
  ]);
  assert.ok(home.includes('data-defense-state={defenseState}'));
  assert.ok(css.includes('.portal-semantic-tone[data-defense-state="defended"]'));
  assert.ok(css.includes('.portal-semantic-tone[data-defense-state="upcoming"]'));
  assert.ok(css.includes('background: var(--portal-surface-layer-1) !important;'));
  assert.ok(semantics.includes('process.aluno1?.nome'));
  assert.ok(semantics.includes('process.defesa?.local'));
  assert.ok(css.includes('-webkit-line-clamp: 2'));
});

test('Registros de Assinatura mostra a linha completa e somente ações suportadas', async () => {
  const [page, client, server] = await Promise.all([
    source('src/pages/AstenLogsPage.tsx'),
    source('src/services/apiClient.ts'),
    source('server.ts'),
  ]);
  assert.ok(page.includes("{ key: 'actions', label: 'Ações', isFixed: true }"));
  assert.ok(page.includes('min-w-[1560px]'));
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
    source('src/portal-semantic-ui.css'),
  ]);
  assert.ok(logs.includes("px-3 py-1 text-slate-950"));
  assert.ok(logs.includes("px-2 py-0.5 text-[9px]"));
  assert.ok(css.includes('#audit-logs-page .portal-spreadsheet-table tbody'));
  assert.ok(css.includes('background: var(--portal-surface-inner) !important;'));
});
