import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('v1049 centraliza a paleta e semântica de filtros/processos', () => {
  const tokens = read('src/utils/portalSemanticTokens.ts');
  const css = read('src/portal-semantic-ui.css');
  const meus = read('src/pages/MeusProcessosPage.tsx');
  assert.match(tokens, /processRole:/);
  assert.match(tokens, /defense:/);
  assert.match(tokens, /signature:/);
  assert.match(css, /\.portal-role-process-button/);
  assert.match(css, /\.portal-filter-color-dot/);
  assert.match(meus, /portal-filter-color-dot/);
});

test('v1049 calendário usa duas linhas e fins de semana se fundem ao fundo', () => {
  const home = read('src/pages/HomePage.tsx');
  const semantics = read('src/utils/defenseSemantics.ts');
  const css = read('src/portal-semantic-ui.css');
  assert.match(home, /getDefenseCalendarSummaryParts/);
  assert.match(home, /portal-calendar-defense-headline/);
  assert.match(home, /portal-calendar-defense-students/);
  assert.match(semantics, /aluno2/);
  assert.match(css, /portal-core-calendar-weekend/);
  assert.match(css, /border-color: transparent/);
});

test('v1049 hub de configurações usa seis barras e shell adaptável', () => {
  const config = read('src/pages/ConfiguracoesPage.tsx');
  const modal = read('src/components/SettingsWorkspaceModal.tsx');
  for (const label of ['Personalização do Portal', 'Sincronização', 'Acesso', 'Modelos e Variáveis', 'Registros de Assinatura', 'Registro de Logs']) {
    assert.ok(config.includes(label), `faltou ${label}`);
  }
  assert.match(config, /id: 'models'/);
  assert.match(config, /id: 'documents'/);
  assert.match(config, /id: 'emails'/);
  assert.match(config, /id: 'forms'/);
  assert.match(config, /id: 'workflow'/);
  assert.match(config, /id: 'variables'/);
  assert.match(modal, /navigationMode/);
  assert.match(modal, /portal-settings-workspace-single/);
});

test('v1049 estúdio suporta navegação externa e edição progressiva de formulário', () => {
  const studio = read('src/components/IntegrationStudioPanel.tsx');
  assert.match(studio, /activeTabOverride/);
  assert.match(studio, /hideTabNavigation/);
  assert.match(studio, /selectedQuestionId/);
  assert.match(studio, /portal-form-field-list/);
  assert.match(studio, /sticky top-3 self-start/);
  assert.doesNotMatch(studio, /Sugestões inteligentes de normalização/);
});

test('v1049 mantém planilhas administrativas densas e com dados completos', () => {
  const signatures = read('src/pages/AstenLogsPage.tsx');
  const logs = read('src/pages/AuditLogsPage.tsx');
  const access = read('src/components/AuthorizedStudentsPanel.tsx');
  assert.match(signatures, /min-w-\[1560px\]/);
  assert.match(signatures, /sticky right-0/);
  assert.match(signatures, /DEMO_JOB/);
  assert.match(logs, /border-b-\[16px\]/);
  assert.match(logs, /px-3 py-1/);
  assert.match(access, /overflow-x-auto/);
});
