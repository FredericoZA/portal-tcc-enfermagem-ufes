import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Documentos e Variáveis compartilham o mesmo workspace',()=>{
  const config=read('src/pages/ConfiguracoesPage.tsx');
  assert.match(config,/title: 'Documentos e Variáveis'/);
  assert.match(config,/id: 'documents'.*MasterDocumentModelsPanel/s);
  assert.match(config,/key="studio-variables-unified".*initialTab="variables"/s);
  assert.doesNotMatch(config,/title: 'Variáveis', text: 'Definições canônicas/);
});

test('workspace de configurações tem cabeçalho compacto e fechamento explícito',()=>{
  const modal=read('src/components/SettingsWorkspaceModal.tsx');
  const css=read('src/styles/portal-components.css');
  assert.match(modal,/portal-settings-workspace-divider/);
  assert.match(modal,/aria-label="Fechar janela"/);
  assert.doesNotMatch(modal,/>Navegação</);
  assert.match(css,/height: var\(--portal-sheet-title-height\)/);
  assert.match(css,/\.portal-settings-backdrop \{[\s\S]*rgba\(1, 31, 23, \.72\)/);
});

test('pop-ups usam a hierarquia cromática canônica',()=>{
  const css=read('src/styles/portal-components.css');
  assert.match(css,/\.portal-modal-surface,[\s\S]*background: var\(--portal-surface-panel\)/);
  assert.match(css,/\.portal-modal-body,[\s\S]*background: var\(--portal-surface-panel\)/);
  assert.match(css,/\.portal-modal-body > \.portal-layer-panel,[\s\S]*background: var\(--portal-surface-card\)/);
  assert.match(css,/\.portal-modal-body \.portal-layer-card,[\s\S]*background: var\(--portal-surface-inner\)/);
});

test('e-mail e formulário usam apresentação institucional UFES',()=>{
  const studio=read('src/components/IntegrationStudioPanel.tsx');
  assert.match(studio,/UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO/);
  assert.match(studio,/const institutionalGreen = '#005830'/);
  assert.match(studio,/portal-official-preview/);
  assert.match(studio,/bg-\[var\(--portal-brand-header\)\]/);
  assert.match(studio,/portal-artifact-editor-email/);
  assert.match(studio,/portal-artifact-editor-form/);
  assert.match(studio,/portal-artifact-editor-document/);
});

test('release Portal TCC é 1.0.79',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'1.0.79');
});
