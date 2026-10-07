import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('release 1.0.78 usa contrato global de pop-up',()=>{
  const css=read('src/styles/portal-components.css');
  const modal=read('src/components/SettingsWorkspaceModal.tsx');
  assert.match(css,/Portal TCC 1\.0\.78 — contrato visual único para pop-ups/);
  assert.match(css,/\.portal-modal-header \{[\s\S]*background: var\(--portal-brand-header\)/);
  assert.match(modal,/backgroundColor: 'var\(--portal-surface-page\)'/);
  assert.doesNotMatch(modal,/portal-modal-header-close/);
});

test('configuração de planilha ficou mais estreita, autosalva e fecha pelo entorno',()=>{
  const css=read('src/styles/portal-components.css');
  const popover=read('src/components/HeaderSettingsPopover.tsx');
  assert.match(css,/\.portal-table-settings-popover \{[\s\S]*460px/);
  assert.match(css,/\.portal-core-popup-title \{[\s\S]*background: var\(--portal-brand-header\)/);
  assert.match(popover,/document\.addEventListener\('mousedown',outside\)/);
  assert.doesNotMatch(popover,/portal-settings-close-button|>Concluir</);
  assert.match(popover,/text-white[^\n]*Exibição da planilha/);
});

test('identidade do rodapé é única e usa autosave',()=>{
  const config=read('src/pages/ConfiguracoesPage.tsx');
  const identity=read('src/components/CommissionIdentityPanel.tsx');
  assert.match(config,/content: settings \? <CommissionIdentityPanel isMaster \/>/);
  assert.doesNotMatch(config,/MasterAndPresidentConfigForm/);
  assert.match(identity,/Salvo automaticamente/);
  assert.match(identity,/setTimeout\(\(\) => \{ void persistRegularFields\(\); \}, 700\)/);
  assert.doesNotMatch(identity,/Salvar membros|Salvar Contas Administrativas/);
});

test('integrações não duplicam título nem editam destino do departamento',()=>{
  const integrations=read('src/components/InfrastructureIntegrationsPanel.tsx');
  assert.match(integrations,/SettingsWorkspaceHeaderPortal/);
  assert.match(integrations,/Executar testes/);
  assert.doesNotMatch(integrations,/Salvar destino/);
  assert.doesNotMatch(integrations,/saveDepartmentEmail/);
  assert.match(integrations,/bg-\[var\(--portal-brand-header\)\]/);
});

test('catálogo mestre propaga modelos e detecta variáveis',()=>{
  const models=read('src/components/MasterDocumentModelsPanel.tsx');
  const config=read('src/pages/ConfiguracoesPage.tsx');
  const api=read('src/services/apiClient.ts');
  const server=read('server.ts');
  assert.match(models,/onCatalogChanged/);
  assert.match(models,/Detectar variáveis/);
  assert.match(models,/model\.driveFileUrl/);
  assert.match(config,/syncMasterModelCatalog/);
  assert.match(api,/detectDocumentModelVariables/);
  assert.match(server,/\/api\/admin\/models\/:type\/detect-variables/);
});

test('e-mail usa cabeçalho configurável, anexos dinâmicos e sintaxe canônica',()=>{
  const studio=read('src/components/IntegrationStudioPanel.tsx');
  const config=read('src/pages/ConfiguracoesPage.tsx');
  const service=read('src/services/integrationStudioService.ts');
  assert.match(studio,/Texto do cabeçalho/);
  assert.match(studio,/docTemplates\.map\(doc=>/);
  assert.match(studio,/similarVariableSuggestions\.length > 0/);
  assert.doesNotMatch(studio,/false && similarVariableSuggestions/);
  assert.match(config,/recipient: String\(settings\?\.emailConfig\?\.roomReservationDepartmentEmail \|\| ''\)/);
  assert.match(config,/<<PROTOCOLO>>/);
  assert.match(service,/Comissão de TCC do Departamento de Enfermagem • UFES/);
});

test('registros administrativos são planilhas full-bleed',()=>{
  const config=read('src/pages/ConfiguracoesPage.tsx');
  const app=read('src/App.tsx');
  assert.match(config,/<AuthorizedStudentsPanel canManage embedded \/>/);
  assert.match(config,/<AstenLogsPage embedded \/>/);
  assert.match(config,/<AuditLogsPage embedded \/>/);
  assert.match(app,/\['logs','asten-logs'\]\.includes\(currentTab\) \? 'p-0 max-w-none'/);
});

test('histórico do processo abre direto, é full-bleed e fecha pelo backdrop',()=>{
  const detail=read('src/pages/ProcessoDetailPage.tsx');
  assert.match(detail,/Histórico de Auditoria/);
  assert.match(detail,/setShowAuditLogModal\(true\)/);
  assert.match(detail,/event\.target === event\.currentTarget/);
  assert.match(detail,/isModal \? 'space-y-0'/);
  assert.doesNotMatch(detail,/Fechar Histórico/);
  assert.doesNotMatch(detail,/process-audit-title[\s\S]{0,1200}overflow-y-auto p-3/);
});

test('Indicadores preserva margens por ser página de cards',()=>{
  const page=read('src/pages/IndicadoresPage.tsx');
  assert.match(page,/px-3 pb-4 pt-3 sm:px-4 sm:pt-4/);
});

test('release Portal TCC é 1.0.78',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'1.0.78');
});
