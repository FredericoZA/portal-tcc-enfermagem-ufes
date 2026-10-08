import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('workspaces de configuração usam faixa branca de 15px e fundo branco-gelo',()=>{
  const css=read('src/styles/portal-components.css');
  const tokens=read('src/styles/portal-tokens.css');
  assert.match(tokens,/--portal-sheet-content-divider:\s*15px/);
  assert.match(css,/\.portal-settings-workspace-divider\s*\{[\s\S]*height:\s*var\(--portal-sheet-content-divider\)[\s\S]*background:\s*var\(--portal-surface-inner\)/);
  assert.match(css,/\.portal-settings-single-pane,[\s\S]*background:\s*var\(--portal-surface-page\)/);
});

test('workspaces com autosave não exibem X redundante',()=>{
  const modal=read('src/components/SettingsWorkspaceModal.tsx');
  assert.doesNotMatch(modal,/aria-label="Fechar janela"/);
  assert.doesNotMatch(modal,/<X\b/);
  assert.match(modal,/onMouseDown=.*onClose/);
  assert.match(modal,/event\.key !== 'Escape'/);
});

test('documentos e variáveis são um único workspace contextual e editam um modelo por vez',()=>{
  const config=read('src/pages/ConfiguracoesPage.tsx');
  const panel=read('src/components/MasterDocumentModelsPanel.tsx');
  assert.match(config,/id: 'documents', label: 'Documentos e variáveis'/);
  assert.doesNotMatch(config,/key="studio-variables-unified"/);
  assert.match(panel,/data-portal-document-direct-editor="true"/);
  assert.match(panel,/aria-label="Selecionar documento"/);
  assert.match(panel,/SettingsWorkspaceHeaderPortal/);
  assert.match(panel,/mergeVariableAcrossArtifacts/);
  assert.match(panel,/Atualizar variáveis/);
  assert.doesNotMatch(panel,/>Consolidar</);
  assert.doesNotMatch(panel,/Abrir no Drive/);
});

test('editor de e-mail usa o próprio modelo como editor direto',()=>{
  const studio=read('src/components/IntegrationStudioPanel.tsx');
  assert.match(studio,/data-portal-email-direct-editor="true"/);
  assert.match(studio,/aria-label="Selecionar e-mail"/);
  assert.match(studio,/title="Adicionar e-mail"/);
  assert.match(studio,/title="Excluir e-mail"/);
  assert.match(studio,/HTML avançado/);
  assert.match(studio,/TemplateVariableControl/);
  assert.match(studio,/Digite &lt;&lt; para escolher uma variável disponível/);
  assert.match(studio,/SettingsWorkspaceHeaderPortal/);
  assert.doesNotMatch(studio,/Editor profissional de e-mail/);
  assert.doesNotMatch(studio,/Pré-visualização/);
});

test('detalhes do TCC seguem a nova hierarquia visual',()=>{
  const detail=read('src/pages/ProcessoDetailPage.tsx');
  assert.match(detail,/>Detalhes do TCC</);
  assert.match(detail,/Enfermagem e Obstetrícia UFES, Maruípe UFES/);
  assert.doesNotMatch(detail,/Painel de Gestão e Detalhes do TCC/);
  assert.match(detail,/EtapaProgressBar currentEtapa/);
  assert.match(detail,/Conceito:/);
  assert.match(detail,/Ficha Cadastral & Defesa/);
  assert.doesNotMatch(detail,/ProcessFlowPanel/);
});

test('seleção da planilha habilita ações em lote e servidor serializa criação idempotente',()=>{
  const coordinator=read('src/pages/CoordenadorPage.tsx');
  const server=read('server.ts');
  assert.match(coordinator,/disabled=\{!selectedIds\.some\(\(id\)=>canSendAsten\(id\)\) \|\| signingIds\.length > 0\}/);
  assert.match(coordinator,/disabled=\{!selectedIds\.some\(\(id\)=>canPrepareGov\(id\)\) \|\| signingIds\.length > 0\}/);
  assert.match(server,/const signatureJobCreationLocks=new Map<string,Promise<SignatureJob>>\(\)/);
  assert.match(server,/createSignatureJobUnlocked/);
  assert.match(server,/const inFlight=signatureJobCreationLocks\.get\(lockKey\)/);
  assert.match(server,/if\(inFlight\)return inFlight/);
  assert.match(server,/signatureJobCreationLocks\.set\(lockKey,task\)/);
});
