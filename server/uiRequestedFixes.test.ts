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

test('paginação fica somente no canto inferior direito e quantidade de linhas é controlada pela engrenagem', () => {
  assert.doesNotMatch(runtime, /portal-spreadsheet-pager-info/);
  assert.doesNotMatch(runtime, /portal-spreadsheet-page-size/);
  assert.match(runtime, /linhas por pagina/);
  assert.match(runtime, /savePageSize\(key, size\)/);
  assert.match(css, /\.portal-spreadsheet-pager[\s\S]*justify-content: flex-end/);
  assert.match(css, /\.portal-spreadsheet-pager-left,[\s\S]*display: none/);
});

test('Meus TCCs permite combinação livre de filtros e mantém cores semânticas distintas', () => {
  assert.match(runtime, /selectedMyTccRoles\.has\(tone\)\) selectedMyTccRoles\.delete\(tone\); else selectedMyTccRoles\.add\(tone\)/);
  assert.match(runtime, /selectedMyTccRoles\.clear\(\)/);
  assert.match(css, /data-portal-role-tone="student"/);
  assert.match(css, /data-portal-role-tone="board"/);
  assert.match(css, /data-portal-role-tone="evaluator"/);
  assert.match(css, /data-portal-role-tone="viewer"/);
});

test('Lista de Defesas usa Processo e normaliza botão para TCC - número', () => {
  assert.match(runtime, /replace\(\/n\[º°o\]\?/);
  assert.match(runtime, /parts\[0\]\.textContent = `TCC - \$\{number\}`/);
  assert.match(runtime, /if \(key === 'defenses'\) normalizeDefenseProcessCell\(cell\)/);
});

test('tutorial remove a caixa redundante de visão selecionada', () => {
  assert.match(css, /#portal-tutorial-page \.portal-layer-panel > \.portal-layer-card:first-child \{ display: none/);
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
