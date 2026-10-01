import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

const css = read('src/portal-spreadsheet-runtime.css');
const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
const settingsModal = read('src/components/SettingsWorkspaceModal.tsx');
const settingsRuntime = read('src/components/PortalSettingsRuntime.tsx');
const integrations = read('src/components/InfrastructureIntegrationsPanel.tsx');
const tokens = read('src/utils/portalSemanticTokens.ts');

test('paginação canônica usa rodapé branco e controles finos sem margem vertical', () => {
  assert.match(css, /\.portal-spreadsheet-pager\s*\{[\s\S]*height:\s*20px\s*!important/);
  assert.match(css, /\.portal-spreadsheet-pager\s*\{[\s\S]*background:\s*#fff\s*!important/);
  assert.match(css, /\.portal-spreadsheet-pager-controls button\s*\{[\s\S]*height:\s*16px\s*!important/);
  assert.match(css, /\.portal-spreadsheet-pager-controls button\s*\{[\s\S]*margin:\s*0\s*!important/);
  assert.match(css, /\.portal-spreadsheet-pager-controls button\s*\{[\s\S]*padding:\s*0 5px\s*!important/);
});

test('sticky é aplicado a todas as linhas, incluindo primeira linha, e respeita seleção', () => {
  assert.match(runtime, /row\.dataset\.portalFirstSpreadsheetRow\s*=\s*rowIndex === 0 \? 'true' : 'false'/);
  assert.match(runtime, /processCell\.dataset\.portalStickyProcess\s*=\s*'true'/);
  assert.match(runtime, /selectionCell\.dataset\.portalStickySelection\s*=\s*'true'/);
  assert.match(css, /tbody tr:first-child > td\[data-portal-sticky-process="true"\]/);
  assert.match(css, /\[data-portal-sticky-process="true"\]\[data-portal-after-selection="true"\][\s\S]*left:\s*54px/);
});

test('runtime mantém uma única paginação por planilha', () => {
  assert.match(runtime, /allExisting\.forEach\(\(duplicate\) => duplicate\.remove\(\)\)/);
  assert.match(runtime, /pager\.dataset\.portalGenerated\s*=\s*'true'/);
});

test('Todos em Meus TCCs permanece branco com texto preto e filtros deixam faixa verde', () => {
  assert.match(css, /portal-native-all-filter[\s\S]*background:\s*#fff\s*!important/);
  assert.match(css, /portal-native-all-filter[\s\S]*color:\s*#111827\s*!important/);
  assert.match(css, /portal-meus-processos-filter-row[\s\S]*padding-bottom:\s*2px\s*!important/);
});

test('cores de assinatura reproduzem exatamente calendário amarelo e verde', () => {
  assert.match(tokens, /upcoming:\s*\{ bg: '#e8dda7', border: '#b49d4f', text: '#4a4020' \}/);
  assert.match(tokens, /defended:\s*\{ bg: '#bed8c3', border: '#719a79', text: '#23472b' \}/);
  assert.match(tokens, /pending:\s*\{ bg: '#e8dda7', border: '#b49d4f', text: '#4a4020' \}/);
  assert.match(tokens, /signed:\s*\{ bg: '#bed8c3', border: '#719a79', text: '#23472b' \}/);
});

test('Rodapé e Integrações abrem como destinos diretos sem navegação lateral interna', () => {
  assert.match(settingsRuntime, /Rodapé e Identidade/);
  assert.match(settingsRuntime, /Integrações e Plataforma/);
  assert.match(settingsRuntime, /portal-settings-open-pane/);
  assert.match(settingsModal, /isIdentityIntegrationWorkspace/);
  assert.match(settingsModal, /const directPane = singlePane \|\| isIdentityIntegrationWorkspace/);
});

test('Acesso, assinaturas e logs são superfícies de planilha, não popup genérico', () => {
  assert.match(settingsModal, /SHEET_SECTION_IDS = new Set\(\['authorizations', 'signature-ledger', 'audit-ledger'\]\)/);
  assert.match(settingsModal, /embedded: sheetSurface \? false : singlePane/);
});

test('Integrações possui quinto campo para e-mail institucional de reserva', () => {
  assert.match(integrations, /E-mail do Departamento/);
  assert.match(integrations, /departmentReservationEmail/);
  assert.match(integrations, /apiClient\.updateSettings\(\{ emailConfig: nextEmailConfig \}\)/);
});
