import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
const css = read('src/portal-spreadsheet-runtime.css');
const identity = read('src/components/CommissionIdentityPanel.tsx');
const workspace = read('src/components/SettingsWorkspaceModal.tsx');
const integrations = read('src/components/InfrastructureIntegrationsPanel.tsx');

test('planilhas congelam cabeçalho e coluna Processo e mantêm rolagem vertical/horizontal', () => {
  assert.match(runtime, /dataset\.portalStickyHeader = 'true'/);
  assert.match(runtime, /dataset\.portalStickyProcess = 'true'/);
  assert.match(runtime, /host\.scrollTop \+= event\.deltaY/);
  assert.match(runtime, /host\.scrollLeft \+=/);
  assert.match(css, /th\[data-portal-sticky-process="true"\][\s\S]*left: 0/);
  assert.match(css, /td\[data-portal-sticky-process="true"\][\s\S]*left: 0/);
});

test('paginação fica somente no canto inferior direito e quantidade é sincronizada pela configuração', () => {
  assert.doesNotMatch(runtime, /portal-spreadsheet-pager-info/);
  assert.doesNotMatch(runtime, /portal-spreadsheet-page-size/);
  assert.match(runtime, /syncPageSizeFromSettings/);
  assert.match(runtime, /localStorage\.setItem\(pageSizeKey\(key\), String\(size\)\)/);
  assert.match(runtime, /config\.recordsLimit = 'all'/);
  assert.match(css, /\.portal-spreadsheet-pager[\s\S]*justify-content: flex-end/);
  assert.match(css, /\.portal-spreadsheet-pager-left,[\s\S]*display: none/);
});

test('Meus TCCs mantém combinação de filtros e cores semânticas na página', () => {
  const page = read('src/pages/MeusProcessosPage.tsx');
  const tokens = read('src/utils/portalSemanticTokens.ts');
  assert.match(page, /selectedRoleCategories/);
  assert.match(page, /toggleRoleCategory/);
  assert.match(page, /selectedRoleCategories\.includes\(roleCat\)/);
  assert.match(page, /PORTAL_SEMANTIC_COLORS\.processRole\.student/);
  assert.match(page, /PORTAL_SEMANTIC_COLORS\.processRole\.board/);
  assert.match(page, /PORTAL_SEMANTIC_COLORS\.processRole\.evaluator/);
  assert.match(page, /PORTAL_SEMANTIC_COLORS\.processRole\.viewer/);
  for (const border of ['#9a7600', '#a04444', '#2e718d', '#6e4a94']) assert.match(tokens, new RegExp(border));
});

test('Lista de Defesas usa cabeçalho Processo pela camada canônica e botão nativo de TCC', () => {
  const home = read('src/pages/HomePage.tsx');
  assert.match(runtime, /function renameProcessHeader/);
  assert.match(runtime, /replace\(\/n\[º°o\]/);
  assert.match(runtime, /'Processo'/);
  assert.match(home, /const clean = rawStr\.replace\(\/\^TCC/);
  assert.match(home, /line1 = `TCC - \$\{parts\[0\]\}`/);
  assert.match(home, /portal-semantic-tone/);
});

test('tutorial remove a caixa redundante de visão selecionada', () => {
  assert.match(css, /#portal-tutorial-page \.portal-layer-panel > \.portal-layer-card:first-child\s*\{\s*display: none !important/);
});

test('Rodapé e Identidade é exclusivo do Master, persiste e atualiza o rodapé', () => {
  assert.match(identity, /if \(!isMaster\) return null/);
  assert.match(identity, /apiClient\.updateSettings/);
  assert.match(identity, /await refreshAuth\(\)/);
  assert.match(identity, /commissionPresidentContactEmail/);
  assert.match(identity, /bg-\[#d5dce0\]/);
  assert.doesNotMatch(identity, /Acessos administrativos/i);
  assert.doesNotMatch(identity, /createAdministrationTransfer/);
});

test('Integrações e Plataforma usa modo full-bleed no workspace', () => {
  assert.match(workspace, /data-portal-full-bleed/);
  assert.match(integrations, /flex min-h-full h-full flex-col/);
});