import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
const css = read('src/portal-spreadsheet-runtime.css');
const identity = read('src/components/CommissionIdentityPanel.tsx');
const workspace = read('src/components/SettingsWorkspaceModal.tsx');
const integrations = read('src/components/InfrastructureIntegrationsPanel.tsx');
const configPage = read('src/pages/ConfiguracoesPage.tsx');
const settingsRuntime = read('src/components/PortalSettingsRuntime.tsx');
const server = read('server.ts');
const operational = read('src/utils/operationalConfig.ts');
const courseStudioValidator = read('src/utils/courseStudioValidator.ts');
const authContext = read('src/context/AuthContext.tsx');
const documentModels = read('src/components/MasterDocumentModelsPanel.tsx');
const siteLayout = read('src/utils/siteLayoutConfig.ts');
const tableFormatters = read('src/utils/tableFormatters.ts');

test('planilhas congelam cabeçalho e coluna Processo e mantêm rolagem vertical/horizontal', () => {
  assert.match(runtime, /dataset\.portalStickyHeader = 'true'/);
  assert.match(runtime, /dataset\.portalStickyThead = 'true'/);
  assert.match(runtime, /dataset\.portalStickyProcess = 'true'/);
  assert.match(runtime, /host\.scrollTop \+= event\.deltaY/);
  assert.match(runtime, /host\.scrollLeft \+=/);
  assert.match(css, /thead\[data-portal-sticky-thead="true"\][\s\S]*position: sticky/);
  assert.match(css, /th\[data-portal-sticky-process="true"\][\s\S]*left: 0/);
  assert.match(css, /td\[data-portal-sticky-process="true"\][\s\S]*left: 0/);
});

test('paginação fica no canto inferior direito e se recompõe após rerender', () => {
  assert.doesNotMatch(runtime, /portal-spreadsheet-pager-info/);
  assert.doesNotMatch(runtime, /portal-spreadsheet-page-size/);
  assert.match(runtime, /readPageSize\(key\)/);
  assert.match(runtime, /pager\.dataset\.portalGenerated = 'true'/);
  assert.match(runtime, /host\.insertAdjacentElement\('afterend', pager\)/);
  assert.match(runtime, /characterData: true/);
  assert.match(css, /\.portal-spreadsheet-pager[\s\S]*justify-content: flex-end/);
  assert.match(css, /\.portal-spreadsheet-pager-left,[\s\S]*display: none/);
});

test('Meus TCCs mantém combinação de filtros com quatro cores bem separadas e Todos neutro', () => {
  const page = read('src/pages/MeusProcessosPage.tsx');
  const tokens = read('src/utils/portalSemanticTokens.ts');
  assert.match(page, /selectedRoleCategories/);
  assert.match(page, /toggleRoleCategory/);
  assert.match(page, /selectedRoleCategories\.includes\(roleCat\)/);
  assert.match(page, /PORTAL_SEMANTIC_COLORS\.processRole\.student/);
  assert.match(page, /PORTAL_SEMANTIC_COLORS\.processRole\.board/);
  assert.match(page, /PORTAL_SEMANTIC_COLORS\.processRole\.evaluator/);
  assert.match(page, /PORTAL_SEMANTIC_COLORS\.processRole\.viewer/);
  for (const border of ['#d4a300', '#ea580c', '#16a34a', '#2563eb']) assert.match(tokens, new RegExp(border));
  assert.match(css, /portal-native-all-filter\[data-selected="true"\][\s\S]*background: #fff !important[\s\S]*color: #111827 !important/);
});

test('Lista de Defesas e Repositório padronizam o cabeçalho como Processo pela camada canônica', () => {
  const home = read('src/pages/HomePage.tsx');
  assert.match(runtime, /#public-calendar-cards-section/);
  assert.match(runtime, /#biblioteca-tccs-section/);
  assert.match(runtime, /function renameProcessHeader/);
  assert.match(runtime, /node\.data = 'Processo'/);
  assert.match(home, /const clean = rawStr\.replace\(\/\^TCC/);
  assert.match(home, /line1 = `TCC - \$\{parts\[0\]\}`/);
  assert.match(home, /portal-semantic-tone/);
});

test('Meus TCCs e Presidente usam o mesmo separador branco canônico após os filtros', () => {
  const contract = read('src/portal-surface-contract.css');
  assert.match(contract, /data-portal-has-filter="true"[\s\S]*border-bottom:var\(--portal-sheet-content-divider\) solid #fff!important/);
  assert.doesNotMatch(css, /portal-coordinator-filter-row[\s\S]*border-bottom: 2px solid/);
});

test('tutorial remove a caixa redundante de visão selecionada', () => {
  assert.match(css, /#portal-tutorial-page \.portal-layer-panel > \.portal-layer-card:first-child\s*\{\s*display: none !important/);
});

test('Rodapé e Identidade é exclusivo do Master, persiste e atualiza o rodapé', () => {
  assert.match(identity, /if \(!isMaster\) return null/);
  assert.match(identity, /apiClient\.updateSettings/);
  assert.match(identity, /await refreshAuth\(\)/);
  assert.match(identity, /commissionPresidentContactEmail/);
  assert.match(identity, /bg-\[#d5dce0\]/);
  assert.doesNotMatch(identity, /Acessos administrativos/i);
  assert.doesNotMatch(identity, /createAdministrationTransfer/);
});

test('Rodapé e Integrações são entradas independentes e workspaces diretos', () => {
  assert.match(configPage, /id: 'identity', title: 'Rodapé e Identidade'/);
  assert.match(configPage, /id: 'integrations', title: 'Integrações e Plataforma'/);
  assert.match(configPage, /activeSettingsPanel === 'identity'/);
  assert.match(configPage, /activeSettingsPanel === 'integrations'/);
  assert.doesNotMatch(settingsRuntime, /cloneNode|insertAdjacentElement\('afterend'/);
  assert.match(workspace, /data-portal-full-bleed/);
  assert.match(integrations, /flex min-h-full h-full flex-col/);
});

test('e-mail do Departamento persiste, é fail-closed e nunca cai em destinatário fixo', () => {
  assert.match(integrations, /roomReservationDepartmentEmail/);
  assert.match(integrations, /E-mail do Departamento de Enfermagem/);
  assert.match(server, /emailConfigPatch\.roomReservationDepartmentEmail=departmentEmail/);
  assert.match(server, /configuredRoomReservationDepartmentEmail/);
  assert.match(server, /templateId==='email-reserva'/);
  assert.match(server, /destinatário publicado diverge do e-mail cadastrado em Integrações/);
  assert.match(server, /normalizedEvent==='TCC_CREATED'\?reservationWorkflowStudio\(currentSettings\.integrationStudio\):currentSettings\.integrationStudio/);
  assert.doesNotMatch(server, /roomReservationDepartmentEmail\|\|operationalConfig\(studio\)\.reservation\.departmentEmail/);
  assert.doesNotMatch(operational, /dptenfccs@gmail\.com/);
  assert.match(courseStudioValidator, /RESERVATION_EMAIL_RECIPIENT_MUST_BE_CONFIGURED/);
});

test('configurações removem personalização global e usam três grupos operacionais', () => {
  assert.doesNotMatch(configPage, /Personalização do Portal/);
  assert.doesNotMatch(configPage, /personalizacao_portal|UnifiedPortalEditorModal|CalendarPopupEditorModal|TccDetailPopupEditorModal|LoginPopupEditorModal|openSections|globalTableConfig|loadGlobalTableConfig|loadSiteLayoutConfig|\{false && \(/);
  assert.match(configPage, /Institucional e Plataforma/);
  assert.match(configPage, /Modelos e Variáveis/);
  assert.match(configPage, /Acesso e Registros/);
  assert.match(configPage, /id: 'models-documents', title: 'Modelos e Documentos'/);
  assert.match(configPage, /id: 'emails', title: 'E-mails'/);
  assert.match(configPage, /id: 'forms', title: 'Formulários'/);
  assert.match(configPage, /id: 'workflow', title: 'Fluxos'/);
  assert.match(configPage, /id: 'variables', title: 'Variáveis'/);
});

test('modelos e documentos compartilham arquivo, variáveis e visualização', () => {
  assert.match(documentModels, /Variáveis deste modelo/);
  assert.match(documentModels, /Visualizar modelo/);
  assert.match(documentModels, /const previewUrl = \(driveFileId\?: string\)/);
  assert.match(documentModels, /<iframe title=/);
  assert.doesNotMatch(configPage, /initialTab="documents"/);
});

test('aparência antiga fica inerte e planilhas usam padrão estático do código', () => {
  assert.doesNotMatch(authContext, /normalizeUnifiedAppearance|saveGlobalPopupStyle|saveGlobalTableConfig|saveSiteLayoutConfig/);
  assert.match(siteLayout, /A aparência estrutural é canônica e versionada no código/);
  assert.doesNotMatch(siteLayout, /localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(tableFormatters, /STATIC_PORTAL_TABLE_FORMAT/);
  assert.match(tableFormatters, /customHeaderColor: '#154d41'/);
  assert.doesNotMatch(tableFormatters, /localStorage\.getItem\(GLOBAL_TABLE_CONFIG_KEY\)/);
  assert.match(server, /'portalAppearance','tableAppearance','tableLayouts'/);
  assert.doesNotMatch(server, /normalizeUnifiedAppearance/);
});

test('não existe endereço histórico fixo do Departamento no código operacional', () => {
  assert.doesNotMatch(server, /dptenfccs@gmail\.com|DPTNCCS/i);
  assert.doesNotMatch(operational, /dptenfccs@gmail\.com|DPTNCCS/i);
});



test('contrato visual global carrega por último a folha autoritativa de superfícies', () => {
  const main = read('src/main.tsx');
  assert.match(main, /import '\.\/portal-surface-contract\.css';/);
  assert.ok(main.lastIndexOf('portal-surface-contract.css') > main.lastIndexOf('portal-spreadsheet-runtime.css'));
});

test('contrato visual global mantém a paleta anterior e a nova geometria aprovada', () => {
  const surfaceContract = read('src/portal-surface-contract.css');
  assert.match(surfaceContract, /--portal-surface-page:#f1f5f9/);
  assert.match(surfaceContract, /--portal-surface-layer-1:#e1e6e9/);
  assert.match(surfaceContract, /--portal-surface-layer-2:#d5dce0/);
  assert.match(surfaceContract, /--portal-surface-inner:#fff/);
  assert.match(surfaceContract, /--portal-separator-size:15px/);
  assert.match(surfaceContract, /--portal-sheet-title-height:45px/);
  assert.match(surfaceContract, /--portal-sheet-title-divider:5px/);
  assert.match(surfaceContract, /--portal-sheet-filter-height:45px/);
  assert.match(surfaceContract, /--portal-sheet-content-divider:15px/);
  assert.match(surfaceContract, /--portal-sheet-column-header-height:35px/);
  assert.match(surfaceContract, /--portal-sheet-row-min-height:30px/);
  assert.match(surfaceContract, /--portal-sheet-pagination-height:24px/);
  assert.match(surfaceContract, /--portal-sheet-column-control-size:15px/);
  assert.match(surfaceContract, /#meus-processos-table tbody td:first-child/);
  assert.match(surfaceContract, /#coordenador-page-root tbody td:nth-child\(2\)/);
});


test('todas as planilhas obedecem ao mesmo contrato visual', () => {
  const css = read('src/portal-surface-contract.css');
  assert.match(css, /--portal-sheet-header:var\(--portal-green-header/);
  assert.match(css, /TCC8 — CONTRATO CANÔNICO DAS CINCO PLANILHAS/);
  assert.match(css, /\[data-portal-sheet\] \[data-portal-sheet-title="true"\]/);
  assert.match(css, /\[data-portal-sheet\]\[data-portal-has-filter="true"\] \[data-portal-sheet-filter="true"\]/);
  assert.match(css, /\[data-portal-sheet="repository"\] table th:first-child/);
  assert.match(css, /position:sticky!important/);
  assert.match(css, /--portal-sheet-pagination:#fff/);
  assert.match(css, /width:var\(--portal-sheet-column-control-size\)!important/);
  assert.match(css, /border-top:var\(--portal-sheet-title-divider\) solid #fff!important/);
  assert.match(css, /border-bottom:var\(--portal-sheet-content-divider\) solid #fff!important/);
  assert.match(css, /data-portal-sheet="repository"[\s\S]*tbody td:nth-child\(2\)[\s\S]*background-color:transparent!important/);
  assert.match(css, /#configuracoes-page-container[\s\S]*background:transparent!important/);
});

test('popups de planilha usam a própria planilha como caixa principal', () => {
  const css = read('src/portal-surface-contract.css');
  const workspace = read('src/components/SettingsWorkspaceModal.tsx');
  assert.match(css, /\[data-settings-sheet="true"\]\{/);
  assert.match(css, /border:0!important/);
  assert.match(css, /portal-settings-single-pane\[data-portal-sheet-workspace="true"\]/);
  assert.doesNotMatch(workspace, /<div className=\{fullBleed \? 'min-h-full w-full'/);
});

test('estúdio embutido não cria uma caixa principal dentro do popup', () => {
  const studio = read('src/components/IntegrationStudioPanel.tsx');
  assert.match(studio, /hideTabs \? 'mb-0 overflow-visible border-0 bg-transparent shadow-none'/);
  assert.match(studio, /hideTabs \? 'hidden' : 'portal-studio-heading/);
});
