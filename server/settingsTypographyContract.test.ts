import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Configurações acompanha a escala canônica do portal sem microtextos nos editores', () => {
  const tokens = read('src/styles/portal-tokens.css');
  const css = read('src/styles/portal-components.css');
  assert.match(tokens, /--portal-font-size:\s*14px/);
  assert.match(tokens, /--portal-font-size-small:\s*12px/);
  assert.match(tokens, /--portal-editor-field-font-size:\s*var\(--portal-font-size-small\)/);
  assert.match(tokens, /--portal-editor-action-font-size:\s*var\(--portal-font-size-small\)/);
  assert.match(css, /\.portal-settings-workspace[^\n]*input:not/);
  assert.match(css, /font-size:\s*var\(--portal-editor-field-font-size\)/);
  assert.match(css, /font-size:\s*var\(--portal-editor-action-font-size\)/);
  for (const path of [
    'src/pages/ConfiguracoesPage.tsx',
    'src/components/SettingsWorkspaceModal.tsx',
    'src/components/IntegrationStudioPanel.tsx',
    'src/components/MasterDocumentModelsPanel.tsx',
    'src/components/InfrastructureIntegrationsPanel.tsx',
    'src/components/CommissionIdentityPanel.tsx'
  ]) {
    assert.doesNotMatch(read(path), /\btext-\[(?:8(?:\.5)?|9(?:\.5)?|10|11)px\]/, path);
  }
});

test('Ações de excluir mantêm fundo branco e ícone vermelho sem alterar fontes de planilhas', () => {
  const tokens = read('src/styles/portal-tokens.css');
  const css = read('src/styles/portal-components.css');
  const sheet = read('src/styles/portal-sheet.css');
  assert.match(tokens, /--portal-delete-icon-color:\s*#dc2626/i);
  assert.match(css, /button:has\(svg\[class\*="lucide-trash"\]\)/);
  assert.match(css, /stroke:\s*var\(--portal-delete-icon-color\)/);
  assert.match(sheet, /font-size:\s*var\(--portal-sheet-body-font-size\)/);
  assert.match(tokens, /--portal-sheet-body-font-size:\s*11px/);
});
