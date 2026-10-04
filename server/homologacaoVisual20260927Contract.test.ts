import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path: string) => readFile(path, 'utf8');

test('Lista de Defesas recebe cor semântica pelo componente, sem regra CSS por posição', async () => {
  const css = await source('src/index.css');
  const tableFormatter = await source('src/utils/tableFormatters.ts');
  const home = await source('src/pages/HomePage.tsx');
  assert.match(tableFormatter, /resolvePortalFilterTone\(key\)/);
  assert.match(tableFormatter, /getPortalToneStyle\(semanticTone\)/);
  assert.match(home, /getFilterChipProps\(statusKey, isSelected, defensesTextFormat/);
  assert.doesNotMatch(css, /portal-table-filter-chip:nth-child/);
  assert.match(css, /\.portal-filter-dot\s*\{[\s\S]*width:\s*10px/);
});

test('Meus TCCs usa cor do vínculo somente na bolinha do filtro', async () => {
  const css = await source('src/index.css');
  const page = await source('src/pages/MeusProcessosPage.tsx');
  assert.match(css, /\.portal-table-filter-chip,[\s\S]*background:\s*var\(--portal-surface-inner\)/);
  assert.match(css, /portal-native-all-filter\[data-selected="true"\][\s\S]*background:\s*var\(--portal-neutral-bg\)/);
  assert.match(page, /className="portal-filter-dot[^"]*"[^\n]*style=\{\{ backgroundColor: cfg\.borderColor \}\}/);
  assert.doesNotMatch(css, /title\*="Aluno"/);
});

test('Presidência preserva a paleta semântica de assinatura sem seletores posicionais', async () => {
  const css = await source('src/index.css');
  const tokens = await source('src/utils/portalSemanticTokens.ts');
  assert.match(tokens, /signature:[\s\S]*pending:[\s\S]*--portal-signature-pending-bg/);
  assert.match(tokens, /signature:[\s\S]*signed:[\s\S]*--portal-signature-signed-bg/);
  assert.doesNotMatch(css, /portal-coordinator-filter-row[\s\S]*nth-child/);
});

test('Indicadores usa o mesmo cabeçalho canônico das páginas públicas', async () => {
  const css = await source('src/index.css');
  const page = await source('src/pages/IndicadoresPage.tsx');
  assert.match(page, /portal-public-header/);
  assert.match(css, /\.portal-public-header,[\s\S]*background:\s*var\(--portal-brand-header\)/);
});

test('workspaces administrativos usam modo embedded em vez de esconder títulos via CSS', async () => {
  const modal = await source('src/components/SettingsWorkspaceModal.tsx');
  const audit = await source('src/pages/AuditLogsPage.tsx');
  const signatures = await source('src/pages/AstenLogsPage.tsx');
  const access = await source('src/components/AuthorizedStudentsPanel.tsx');
  const css = await source('src/index.css');
  assert.match(modal, /React\.cloneElement[\s\S]*embedded:\s*true/);
  assert.match(audit, /embedded\?: boolean/);
  assert.match(signatures, /embedded\?: boolean/);
  assert.match(access, /embedded\?: boolean/);
  assert.doesNotMatch(css, /display:\s*none[^}]*audit-logs-page/);
});

test('Configurações usa o verde institucional único nos títulos', async () => {
  const css = await source('src/index.css');
  assert.match(css, /\.portal-settings-title-bar[\s\S]*background:\s*var\(--portal-brand-header\)/);
  assert.match(css, /--portal-brand-header:\s*#005830/);
});
