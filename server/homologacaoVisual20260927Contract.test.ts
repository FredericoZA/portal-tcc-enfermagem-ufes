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
  assert.doesNotMatch(css, /portal-table-filter-chip:nth-child\(2\)[\s\S]*--portal-defense-upcoming-bg/);
  assert.doesNotMatch(css, /portal-table-filter-chip:nth-child\(3\)[\s\S]*--portal-defense-defended-bg/);
  assert.match(css, /\.portal-filter-dot\s*\{[\s\S]*width:\s*\.65rem\s*!important/);
});

test('Meus TCCs usa cor do vínculo somente na bolinha do filtro', async () => {
  const css = await source('src/index.css');
  const page = await source('src/pages/MeusProcessosPage.tsx');
  assert.match(css, /#meus-processos-page-container \.portal-standard-filter-chip\s*\{[\s\S]*background:\s*#ffffff\s*!important/);
  assert.match(css, /#meus-processos-page-container \.portal-standard-filter-chip\[aria-pressed="true"\][\s\S]*background:\s*#AEB0B3\s*!important/);
  assert.match(css, /#meus-processos-page-container \.portal-standard-filter-chip > span:last-child\s*\{[\s\S]*background:\s*#6b7280\s*!important/);
  assert.match(page, /className="portal-filter-dot[^"]*"[\s\S]*style=\{\{ backgroundColor: cfg\.borderColor \}\}/);
  assert.doesNotMatch(css, /#meus-processos-page-container \.portal-standard-filter-chip\[title\*="Aluno"\][\s\S]*--portal-role-student-bg/);
});

test('Presidência usa a mesma paleta nos filtros e nos status correspondentes', async () => {
  const css = await source('src/index.css');
  assert.match(css, /portal-coordinator-filter-row[\s\S]*nth-child\(1\)[\s\S]*--portal-signature-pending-bg/);
  assert.match(css, /portal-coordinator-filter-row[\s\S]*nth-child\(2\)[\s\S]*--portal-signature-signed-bg/);
  assert.match(css, /tbody span\.bg-amber-50[\s\S]*--portal-signature-pending-bg/);
  assert.match(css, /tbody span\.bg-emerald-100[\s\S]*--portal-signature-signed-bg/);
});

test('Indicadores remove somente o divisor interno redundante', async () => {
  const css = await source('src/index.css');
  assert.match(css, /#indicadores-publicos-page > \.portal-section-divider\s*\{\s*display:\s*none\s*!important/);
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
  assert.doesNotMatch(css, /#audit-logs-page > header > div:first-child[\s\S]*display:\s*none/);
  assert.doesNotMatch(css, /#asten-logs-page > header > div:first-child[\s\S]*display:\s*none/);
});

test('cards de Configurações usam a mesma cor dos títulos', async () => {
  const css = await source('src/index.css');
  assert.match(css, /#portal-settings-hub \.portal-settings-title-bar[\s\S]*background:\s*var\(--portal-v46-green-dark\)\s*!important/);
});
