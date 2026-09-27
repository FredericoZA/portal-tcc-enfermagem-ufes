import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path: string) => readFile(path, 'utf8');

test('homologação visual preserva cores semânticas dos filtros e amplia os indicadores', async () => {
  const css = await source('src/portal-version-1046.css');
  assert.match(css, /#formal-monthly-calendar-section button\.portal-table-filter-chip:nth-child\(2\)[\s\S]*--portal-defense-upcoming-bg/);
  assert.match(css, /#formal-monthly-calendar-section button\.portal-table-filter-chip:nth-child\(3\)[\s\S]*--portal-defense-defended-bg/);
  assert.match(css, /#meus-processos-page-container \.portal-standard-filter-chip\[title\*="Aluno"\][\s\S]*--portal-role-student-bg/);
  assert.match(css, /#meus-processos-page-container \.portal-standard-filter-chip\[title\*="Banca"\][\s\S]*--portal-role-board-bg/);
  assert.match(css, /#meus-processos-page-container \.portal-standard-filter-chip\[title\*="Avaliador"\][\s\S]*--portal-role-evaluator-bg/);
  assert.match(css, /#meus-processos-page-container \.portal-standard-filter-chip\[title\*="Visualizador"\][\s\S]*--portal-role-viewer-bg/);
  assert.match(css, /\.portal-filter-dot\s*\{[\s\S]*width:\s*\.65rem\s*!important/);
});

test('Presidência usa a mesma paleta nos filtros e nos status correspondentes', async () => {
  const css = await source('src/portal-version-1046.css');
  assert.match(css, /portal-coordinator-filter-row[\s\S]*nth-child\(1\)[\s\S]*--portal-signature-pending-bg/);
  assert.match(css, /portal-coordinator-filter-row[\s\S]*nth-child\(2\)[\s\S]*--portal-signature-signed-bg/);
  assert.match(css, /tbody span\.bg-amber-50[\s\S]*--portal-signature-pending-bg/);
  assert.match(css, /tbody span\.bg-emerald-100[\s\S]*--portal-signature-signed-bg/);
});

test('Indicadores remove somente o divisor interno redundante', async () => {
  const css = await source('src/portal-version-1046.css');
  assert.match(css, /#indicadores-publicos-page > \.portal-section-divider\s*\{\s*display:\s*none\s*!important/);
});

test('workspaces administrativos não repetem títulos já presentes no modal', async () => {
  const modal = await source('src/components/SettingsWorkspaceModal.tsx');
  const css = await source('src/portal-version-1046.css');
  assert.doesNotMatch(modal, /<h3 className="text-xs font-black uppercase tracking-wide">\{current\.label\}<\/h3>/);
  assert.match(css, /portal-settings-single-pane #audit-logs-page > header > div:first-child[\s\S]*display:\s*none\s*!important/);
  assert.match(css, /portal-settings-single-pane #asten-logs-page > header > div:first-child[\s\S]*display:\s*none\s*!important/);
  assert.match(css, /portal-settings-single-pane #authorized-access-panel > div:first-child > div:first-child[\s\S]*display:\s*none\s*!important/);
});

test('cards de Configurações usam a mesma cor dos títulos', async () => {
  const css = await source('src/portal-version-1046.css');
  assert.match(css, /#portal-settings-hub \.portal-settings-title-bar[\s\S]*background:\s*var\(--portal-v46-green-dark\)\s*!important/);
});
