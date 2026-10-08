import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('shell canônico de popup preserva cabeçalho verde, tarja branca e fundo branco-gelo',()=>{
  const shell=read('src/components/PortalModalShell.tsx');
  const css=read('src/styles/portal-components.css');
  assert.match(shell,/portal-modal-header/);
  assert.match(shell,/portal-modal-divider/);
  assert.match(shell,/portal-modal-body/);
  assert.match(shell,/event\.key === 'Escape'/);
  assert.match(css,/\.portal-modal-divider\s*\{[\s\S]*background:\s*var\(--portal-surface-inner\)/);
  assert.match(css,/\.portal-modal-body\s*\{[\s\S]*background:\s*var\(--portal-surface-page\)/);
  assert.match(css,/\.portal-standard-modal\s*\{[\s\S]*background:\s*var\(--portal-surface-page\)/);
});

test('popups tabulares não usam X de fechamento e usam a hierarquia canônica',()=>{
  for(const path of ['src/components/SearchPopover.tsx','src/components/HeaderSettingsPopover.tsx']){
    const source=read(path);
    assert.doesNotMatch(source,/<X\b/);
    assert.doesNotMatch(source,/aria-label="Fechar/);
    assert.match(source,/portal-modal-divider/);
  }
});

test('cadastro de TCC abre em popup flutuante, não como navegação normal',()=>{
  const app=read('src/App.tsx');
  assert.match(app,/isRegistrationModalOpen/);
  assert.match(app,/tab === 'novo-processo'/);
  assert.match(app,/title="Cadastrar Trabalho de TCC"/);
  assert.match(app,/<WizardCadastroPage/);
  const handler=app.slice(app.indexOf("const handleNavigate"),app.indexOf("useEffect",app.indexOf("const handleNavigate")));
  assert.match(handler,/setIsRegistrationModalOpen\(true\)/);
  assert.match(handler,/return;/);
});

test('estúdio operacional não conserva backdrops e botões X dos antigos modais',()=>{
  const studio=read('src/components/UnifiedFlowSystem.tsx');
  assert.doesNotMatch(studio,/fixed inset-0 z-50 bg-slate-900\/60/);
  assert.doesNotMatch(studio,/aria-label="Fechar configuração da variável"/);
  assert.match(studio,/portal-flow-modal/);
  assert.match(studio,/portal-flow-modal-header/);
});

test('popups principais abandonam superfícies estruturais escuras',()=>{
  const paths=[
    'src/components/AIAnalyzerModal.tsx',
    'src/components/CorrectionRequestModal.tsx',
    'src/components/DocumentPreviewModal.tsx',
    'src/components/EmergencyRecoveryModal.tsx',
    'src/components/NewFileModal.tsx',
    'src/components/NewFolderModal.tsx',
  ];
  for(const path of paths){
    const source=read(path);
    assert.match(source,/PortalModalShell/);
    assert.doesNotMatch(source,/<X\b/);
    assert.doesNotMatch(source,/bg-slate-9(?:00|50).*rounded-2xl/);
  }
});

test('popups públicos e administrativos usam superfície canônica',()=>{
  const home=read('src/pages/HomePage.tsx');
  const access=read('src/components/AuthorizedStudentsPanel.tsx');
  const audit=read('src/components/AuditAndSecuritySection.tsx');
  assert.match(home,/Selecionar mês/);
  assert.match(home,/Selecionar data/);
  assert.match(home,/portal-modal-divider/);
  assert.match(access,/portal-standard-modal portal-modal-surface/);
  assert.match(audit,/portal-standard-modal portal-modal-surface/);
});


test('editores e workspaces restantes seguem o mesmo shell e não reintroduzem botão X',()=>{
  const modalPaths=[
    'src/components/CalendarPopupEditorModal.tsx',
    'src/components/LoginPopupEditorModal.tsx',
    'src/components/TccDetailPopupEditorModal.tsx',
    'src/components/UnifiedPortalEditorModal.tsx',
    'src/components/SettingsWorkspaceModal.tsx',
  ];
  for(const path of modalPaths){
    const source=read(path);
    assert.match(source,/portal-modal-backdrop/);
    assert.doesNotMatch(source,/aria-label="Fechar/);
    assert.doesNotMatch(source,/<X\b/);
  }
  const columns=read('src/components/TableColumnSelectorPanel.tsx');
  assert.doesNotMatch(columns,/bg-slate-8(?:00|50)/);
  assert.doesNotMatch(columns,/aria-label="Fechar configuração de colunas"/);
});

test('Indicadores usa título full-width, faixa branca e respiro antes das caixas',()=>{
  const page=read('src/pages/IndicadoresPage.tsx');
  assert.match(page,/portal-public-header/);
  assert.match(page,/<PortalSectionDivider \/>/);
  assert.match(page,/px-3 pb-4 pt-3 sm:px-4 sm:pt-4/);
});


test('editor do popup de login usa autosave e não exibe salvar ou X',()=>{
  const source=read('src/components/LoginPopupEditorModal.tsx');
  assert.match(source,/window\.setTimeout\(\(\) => \{/);
  assert.match(source,/saveLoginPopupConfig\(config\)/);
  assert.doesNotMatch(source,/Salvar Alterações/);
  assert.doesNotMatch(source,/<X\b/);
  assert.doesNotMatch(source,/handleSave/);
});


test('os três workspaces de registros são popups-planilha full-bleed com rolagem interna',()=>{
  const modal=read('src/components/SettingsWorkspaceModal.tsx');
  const scroll=read('src/components/TableScrollWrapper.tsx');
  assert.match(modal,/new Set\(\['authorizations', 'signature-ledger', 'audit-ledger'\]\)/);
  assert.match(modal,/sheetWorkspace \? 'flex flex-col overflow-hidden'/);
  assert.match(modal,/sheetWorkspace \? 'h-\[min\(82vh,760px\)\] max-w-\[1500px\]'/);
  assert.match(scroll,/fillHeight \? 'none'/);
  assert.match(scroll,/fillHeight \? '100%' : undefined/);

  for(const file of [
    'src/components/AuthorizedStudentsPanel.tsx',
    'src/pages/AstenLogsPage.tsx',
    'src/pages/AuditLogsPage.tsx',
  ]){
    const source=read(file);
    assert.match(source,/flex h-full min-h-0 flex-col/);
    assert.match(source,/TableScrollWrapper fillHeight/);
  }
});

test('toolbars dos popups-planilha usam ações circulares sem botões retangulares com texto',()=>{
  const access=read('src/components/AuthorizedStudentsPanel.tsx');
  const audit=read('src/pages/AuditLogsPage.tsx');
  assert.match(access,/className="portal-toolbar-icon-button" title="Adicionar acesso"/);
  assert.match(access,/className="portal-toolbar-icon-button" title="Enviar lista de acessos"/);
  assert.match(audit,/className="portal-toolbar-icon-button" title="Baixar backup JSON"/);
  assert.match(audit,/className="portal-toolbar-icon-button" title="Restaurar backup JSON"/);
});

test('planilhas dentro do popup recebem ordenar, filtrar e resize do runtime canônico',()=>{
  const dom=read('src/utils/portalTableDom.ts');
  assert.match(dom,/const sheetDialog = dialog\?\.dataset\.portalSheetWorkspace === 'true'/);
  assert.match(dom,/dialog && !sheetDialog/);
  assert.match(dom,/Ordenar A → Z \/ menor → maior/);
  assert.match(dom,/Ordenar Z → A \/ maior → menor/);
  assert.match(dom,/Filtrar/);
  assert.match(dom,/installResizer/);
});

test('ajustes estéticos recentes preservam autosave silencioso e integrações em 3 mais 2',()=>{
  const identity=read('src/components/CommissionIdentityPanel.tsx');
  const integrations=read('src/components/InfrastructureIntegrationsPanel.tsx');
  assert.doesNotMatch(identity,/Alterações salvas automaticamente/);
  assert.match(identity,/portal-identity-panel space-y-2/);
  assert.match(integrations,/lg:col-span-2/);
  assert.match(integrations,/lg:col-span-3/);
  assert.match(integrations,/bg-\[var\(--portal-surface-page\)\]/);
  assert.match(integrations,/border border-white bg-white[\s\S]*text-slate-950/);
});

test('fila da Presidência valida Asten e Gov.br separadamente e Gov funciona com uma seleção',()=>{
  const page=read('src/pages/CoordenadorPage.tsx');
  assert.match(page,/canSendDeclarationToAsten/);
  assert.match(page,/canPrepareDeclarationForGovBr/);
  assert.match(page,/selectedIds\.filter\(\(id\) => pendingIds\.has\(id\) && canSendAsten\(id\)\)/);
  assert.match(page,/selectedIds\.filter\(id=>pendingIds\.has\(id\)&&canPrepareGov\(id\)\)/);
  assert.doesNotMatch(page,/ids\.length<2/);
  assert.match(page,/Selecione ao menos uma declaração disponível para assinatura Gov\.br/);
});

test('editor de fluxo usa timeline clicável e planilha da etapa sem paleta de arraste',()=>{
  const studio=read('src/components/IntegrationStudioPanel.tsx');
  assert.match(studio,/data-portal-workflow-editor="true"/);
  assert.match(studio,/id="workflow-timeline-title"/);
  assert.match(studio,/onClick=\{\(\)=>setSelectedWorkflowStageId\(stage\.id\)\}/);
  assert.match(studio,/title="Adicionar etapa"/);
  assert.match(studio,/data-portal-workflow-stage-sheet="true"/);
  assert.match(studio,/>Usar<\/th>/);
  assert.match(studio,/>Ordem<\/th>/);
  assert.match(studio,/>Condição para execução<\/th>/);
  assert.match(studio,/type="checkbox" checked=\{Boolean\(action\)\}/);
  assert.match(studio,/pb-5/);
  assert.doesNotMatch(studio,/Arraste para uma etapa/);
  assert.doesNotMatch(studio,/application\/x-portal-workflow/);
});


test('editor de formulário é o próprio formulário e não um painel lateral de configuração',()=>{
  const studio=read('src/components/IntegrationStudioPanel.tsx');
  assert.match(studio,/data-portal-form-direct-editor="true"/);
  assert.match(studio,/aria-label="Selecionar formulário"/);
  assert.match(studio,/title="Adicionar formulário"/);
  assert.match(studio,/title="Excluir formulário"/);
  assert.match(studio,/universityLogoUrl/);
  assert.match(studio,/title="Alterar logo da UFES"/);
  assert.match(studio,/title="Alterar logo do curso"/);
  assert.match(studio,/Duplo clique para editar a pergunta/);
  assert.match(studio,/title="Configurar campo"/);
  assert.match(studio,/Adicionar campo vinculado a uma variável/);
  assert.match(studio,/Verificar e criar/);
  assert.match(studio,/Já existem variáveis semelhantes/);
  assert.doesNotMatch(studio,/Construtor de formulário/);
  assert.doesNotMatch(studio,/Pré-visualização/);
});

test('campos de formulário exigem variável canônica e não aceitam chave livre',()=>{
  const studio=read('src/components/IntegrationStudioPanel.tsx');
  const editorStart=studio.indexOf('const FormQuestionEditor');
  const editorEnd=studio.indexOf('export const IntegrationStudioPanel',editorStart);
  const editor=studio.slice(editorStart,editorEnd);
  assert.match(editor,/aria-label="Variável vinculada"/);
  assert.match(editor,/<select aria-label="Variável vinculada"/);
  assert.doesNotMatch(editor,/placeholder="CHAVE_DA_VARIAVEL"/);
  assert.match(studio,/addFormQuestionFromVariable/);
  assert.match(studio,/Essa variável já está vinculada a um campo deste formulário/);
});

test('design de formulário suporta logos separados de universidade e curso',()=>{
  const types=read('src/types/integrationStudio.ts');
  const service=read('src/services/integrationStudioService.ts');
  assert.match(types,/universityLogoUrl: string/);
  assert.match(service,/universityLogoUrl: brand\.universityLogoUrl/);
});


test('editor de e-mail usa modelo único autoeditável e autocomplete sem criar variável',()=>{
  const studio=read('src/components/IntegrationStudioPanel.tsx');
  assert.match(studio,/data-portal-email-direct-editor="true"/);
  assert.match(studio,/aria-label="Selecionar e-mail"/);
  assert.match(studio,/title="Adicionar e-mail"/);
  assert.match(studio,/title="Excluir e-mail"/);
  assert.match(studio,/HTML avançado/);
  assert.match(studio,/Digite &lt;&lt; para escolher uma variável disponível/);
  assert.match(studio,/const TemplateVariableControl/);
  assert.match(studio,/role="listbox" aria-label="Variáveis disponíveis"/);
  assert.match(studio,/templateVariables/);
  assert.doesNotMatch(studio,/Editor profissional de e-mail/);
  assert.doesNotMatch(studio,/Pré-visualização/);
});

test('formulário separa campos internos dos campos publicáveis para templates',()=>{
  const page=read('src/pages/ConfiguracoesPage.tsx');
  const studio=read('src/components/IntegrationStudioPanel.tsx');
  const service=read('src/services/integrationStudioService.ts');
  assert.match(page,/availableToTemplates\?: boolean/);
  assert.match(studio,/Disponível para e-mails e documentos/);
  assert.match(studio,/question\.availableToTemplates===false/);
  assert.match(service,/question\.availableToTemplates === false/);
  assert.match(page,/fieldKey: 'PALAVRAS_CHAVE'[\s\S]*availableToTemplates: false/);
});

test('documentos e variáveis exibem um documento por vez e sem consolidar manualmente',()=>{
  const docs=read('src/components/MasterDocumentModelsPanel.tsx');
  assert.match(docs,/data-portal-document-direct-editor="true"/);
  assert.match(docs,/aria-label="Selecionar documento"/);
  assert.match(docs,/title="Adicionar documento"/);
  assert.match(docs,/title="Excluir documento"/);
  assert.match(docs,/Atualizar variáveis/);
  assert.match(docs,/sincronizada\(s\) automaticamente/);
  assert.match(docs,/variableUsageTitle/);
  assert.doesNotMatch(docs,/Modelos oficiais e variáveis/);
  assert.doesNotMatch(docs,/Descoberta e consolidação/);
  assert.doesNotMatch(docs,/>Consolidar</);
  assert.doesNotMatch(docs,/Abrir no Drive/);
});

test('editores integrados salvam automaticamente no servidor',()=>{
  const studio=read('src/components/IntegrationStudioPanel.tsx');
  const docs=read('src/components/MasterDocumentModelsPanel.tsx');
  assert.match(studio,/hideTabs[\s\S]*apiClient\.updateSettings\(\{ integrationStudio: snapshot \}\)/);
  assert.match(docs,/apiClient\.getSettings\(\)/);
  assert.match(docs,/apiClient\.updateSettings\(\{integrationStudio:snapshot\}\)/);
});
