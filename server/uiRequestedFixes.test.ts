import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { readPortalCss } from './testUtils/portalCss';
const read = (path: string) => readFileSync(path, 'utf8');

const runtime = read('src/components/PortalSpreadsheetRuntime.tsx');
const css = readPortalCss();
const identity = read('src/components/CommissionIdentityPanel.tsx');
const reauthentication = read('src/services/reauthentication.ts');
const workspace = read('src/components/SettingsWorkspaceModal.tsx');
const integrations = read('src/components/InfrastructureIntegrationsPanel.tsx');
const configPage = read('src/pages/ConfiguracoesPage.tsx');
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
  assert.match(css, /portal-spreadsheet-scroll-host thead[\s\S]*position:\s*sticky/);
  assert.match(css, /data-portal-sheet="repository"[\s\S]*:is\(th, td\):first-child[\s\S]*position:\s*sticky/);
  assert.match(css, /data-portal-sheet="president"[\s\S]*data-portal-sticky-process/);
});

test('paginação fica no canto inferior direito e se recompõe após rerender', () => {
  assert.doesNotMatch(runtime, /portal-spreadsheet-pager-info/);
  assert.doesNotMatch(runtime, /portal-spreadsheet-page-size/);
  assert.match(runtime, /readPageSize\(key\)/);
  assert.match(runtime, /pager\.dataset\.portalGenerated = 'true'/);
  assert.match(runtime, /host\.insertAdjacentElement\('afterend', pager\)/);
  assert.match(runtime, /characterData: true/);
  assert.match(css, /\.portal-spreadsheet-pager[\s\S]*justify-content: flex-end/);
  assert.match(css, /\.portal-spreadsheet-pager-controls[\s\S]*gap:\s*0/);
});

test('Meus TCCs mantém combinação de filtros com quatro cores bem separadas e Todos neutro', () => {
  const page = read('src/pages/MeusProcessosPage.tsx');
  const tokens = readPortalCss();
  assert.match(page, /selectedRoleCategories/);
  assert.match(page, /toggleRoleCategory/);
  assert.match(page, /selectedRoleCategories\.includes\(roleCat\)/);
  assert.match(page, /PORTAL_SEMANTIC_COLORS\.processRole\.student/);
  assert.match(page, /PORTAL_SEMANTIC_COLORS\.processRole\.board/);
  assert.match(page, /PORTAL_SEMANTIC_COLORS\.processRole\.evaluator/);
  assert.match(page, /PORTAL_SEMANTIC_COLORS\.processRole\.viewer/);
  for (const border of ['#d4a300', '#ea580c', '#16a34a', '#2563eb']) assert.match(tokens, new RegExp(border));
  assert.match(css, /portal-native-all-filter\[data-selected="true"\][\s\S]*background:\s*var\(--portal-neutral-bg\)/);
});

test('Lista de Defesas e Repositório padronizam o cabeçalho como Processo pela camada canônica', () => {
  const home = read('src/pages/HomePage.tsx');
  const identity = read('src/utils/portalTableIdentity.ts');
  assert.match(identity, /#public-calendar-cards-section/);
  assert.match(identity, /#biblioteca-tccs-section/);
  assert.match(runtime, /function renameProcessHeader/);
  assert.match(runtime, /node\.data = 'Processo'/);
  const processPill = read('src/components/PortalProcessPill.tsx');
  assert.match(home, /formatProcessLabel\(proc\.protocolo \|\| proc\.id\)/);
  assert.doesNotMatch(home, /Abrir TCC ↗/);
  assert.match(processPill, /replace\(\/\^TESTE/);
  assert.match(processPill, /return normalized === '—' \? 'TCC' : `TCC - \$\{normalized\}`/);
  assert.match(home, /portal-semantic-tone/);
});

test('Meus TCCs e Presidente usam o mesmo separador branco canônico após os filtros', () => {
  assert.match(css, /data-portal-has-filter="true"[\s\S]*border-bottom:\s*var\(--portal-sheet-content-divider\) solid var\(--portal-surface-inner\)/);
  assert.doesNotMatch(css, /portal-coordinator-filter-row[\s\S]*border-bottom:\s*2px/);
});

test('tutorial usa somente as superfícies canônicas', () => {
  const tutorial = read('src/pages/PortalTutorialPage.tsx');
  assert.match(tutorial, /portal-layer-panel/);
  assert.match(tutorial, /portal-layer-card/);
  assert.doesNotMatch(tutorial, /bg-\[#(?:e1e6e9|d5dce0|005830|337959)\]/i);
});

test('Rodapé e Identidade é exclusivo do Master, autosalva e preserva troca administrativa segura', () => {
  assert.match(identity, /if \(!isMaster\) return null/);
  assert.match(identity, /apiClient\.updateSettings/);
  assert.match(identity, /commissionPresidentContactEmail/);
  assert.match(identity, /createAdministrationTransfer/);
  assert.match(identity, /retryAfterPortalReauthentication/);
  assert.match(reauthentication, /REAUTHENTICATION_REQUIRED/);
  assert.match(identity, /Salvo automaticamente/);
  assert.doesNotMatch(identity, /Salvar membros|Salvar Contas Administrativas/);
});

test('Rodapé e Integrações são entradas independentes e workspaces diretos', () => {
  assert.match(configPage, /id: 'identity', title: 'Rodapé e Identidade'/);
  assert.match(configPage, /id: 'integrations', title: 'Integrações e Plataforma'/);
  assert.match(configPage, /activeSettingsPanel === 'identity'/);
  assert.match(configPage, /activeSettingsPanel === 'integrations'/);
  const main = read('src/main.tsx');
  assert.doesNotMatch(main, /PortalSettingsRuntime/);
  assert.match(workspace, /data-portal-full-bleed/);
  assert.match(integrations, /flex min-h-full h-full flex-col/);
});

test('e-mail do Departamento é definido no modelo de e-mail e permanece fail-closed', () => {
  assert.match(configPage, /roomReservationDepartmentEmail/);
  assert.match(configPage, /id: 'email-reserva'/);
  assert.match(server, /configuredRoomReservationDepartmentEmail\(studio/);
  assert.match(server, /templateId==='email-reserva'/);
  assert.match(server, /destinatário diverge do e-mail definido no modelo de solicitação de reserva/);
  assert.match(server, /Configurações → Modelos e Variáveis → E-mails/);
  assert.doesNotMatch(operational, /dptenfccs@gmail\.com/);
  assert.match(courseStudioValidator, /Informe diretamente o e-mail do Departamento de Enfermagem/);
});

test('configurações removem personalização global e usam três grupos operacionais', () => {
  assert.doesNotMatch(configPage, /Personalização do Portal/);
  assert.doesNotMatch(configPage, /personalizacao_portal|UnifiedPortalEditorModal|CalendarPopupEditorModal|TccDetailPopupEditorModal|LoginPopupEditorModal|openSections|globalTableConfig|loadGlobalTableConfig|loadSiteLayoutConfig|\{false && \(/);
  assert.match(configPage, /Institucional e Plataforma/);
  assert.match(configPage, /Modelos e Variáveis/);
  assert.match(configPage, /Acesso e Registros/);
  assert.match(configPage, /id: 'models-documents', title: 'Documentos e Variáveis'/);
  assert.match(configPage, /id: 'emails', title: 'E-mails'/);
  assert.match(configPage, /id: 'forms', title: 'Formulários'/);
  assert.match(configPage, /id: 'workflow', title: 'Fluxos'/);
  assert.doesNotMatch(configPage, /id: 'variables', title: 'Variáveis'/);
});

test('modelos e documentos compartilham catálogo, variáveis e visualização segura', () => {
  assert.match(documentModels, /Variáveis deste modelo/);
  assert.match(documentModels, /Visualizar modelo original/);
  assert.match(documentModels, /Detectar variáveis/);
  assert.match(documentModels, /model\.driveFileUrl/);
  assert.match(documentModels, /samplePreview\[type\]/);
  assert.match(configPage, /syncMasterModelCatalog/);
  assert.doesNotMatch(configPage, /initialTab="documents"/);
});

test('aparência antiga fica inerte e planilhas usam padrão estático do código', () => {
  assert.doesNotMatch(authContext, /normalizeUnifiedAppearance|saveGlobalPopupStyle|saveGlobalTableConfig|saveSiteLayoutConfig/);
  assert.match(siteLayout, /A aparência estrutural é canônica e versionada no código/);
  assert.doesNotMatch(siteLayout, /localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(tableFormatters, /STATIC_PORTAL_TABLE_FORMAT/);
  assert.match(tableFormatters, /customHeaderColor: 'var\(--portal-brand-header\)'/);
  assert.doesNotMatch(tableFormatters, /localStorage\.getItem\(GLOBAL_TABLE_CONFIG_KEY\)/);
  assert.match(server, /'portalAppearance','tableAppearance','tableLayouts'/);
  assert.doesNotMatch(server, /normalizeUnifiedAppearance/);
});

test('não existe endereço histórico fixo do Departamento no código operacional', () => {
  assert.doesNotMatch(server, /dptenfccs@gmail\.com|DPTNCCS/i);
  assert.doesNotMatch(operational, /dptenfccs@gmail\.com|DPTNCCS/i);
});



test('contrato visual global usa um único stylesheet autoritativo', () => {
  const main = read('src/main.tsx');
  const imports = [...main.matchAll(/import ['"]\.\/([^'"]+\.css)['"];/g)].map((match) => match[1]);
  assert.deepEqual(imports, ['index.css']);
});

test('contrato visual global mantém quatro superfícies e geometria aprovada', () => {
  assert.match(css, /--portal-surface-page:\s*#f1f5f9/);
  assert.match(css, /--portal-surface-panel:\s*#e1e6e9/);
  assert.match(css, /--portal-surface-card:\s*#d5dce0/);
  assert.match(css, /--portal-surface-inner:\s*#ffffff/);
  assert.match(css, /--portal-sheet-title-height:\s*45px/);
  assert.match(css, /--portal-sheet-title-divider:\s*5px/);
  assert.match(css, /--portal-sheet-filter-height:\s*45px/);
  assert.match(css, /--portal-sheet-content-divider:\s*15px/);
  assert.match(css, /--portal-sheet-column-header-height:\s*35px/);
  assert.match(css, /--portal-sheet-row-min-height:\s*30px/);
  assert.match(css, /--portal-sheet-pagination-height:\s*24px/);
  assert.match(css, /--portal-sheet-column-control-size:\s*15px/);
});


test('todas as planilhas obedecem ao mesmo contrato visual', () => {
  assert.match(css, /\[data-portal-sheet\] \[data-portal-sheet-title="true"\]/);
  assert.match(css, /\[data-portal-sheet\]\[data-portal-has-filter="true"\] \[data-portal-sheet-filter="true"\]/);
  assert.match(css, /\[data-portal-sheet="repository"\] :is\(th, td\):first-child/);
  assert.match(css, /position:\s*sticky/);
  assert.match(css, /width:\s*var\(--portal-sheet-column-control-size\)/);
  assert.match(css, /border-top:\s*var\(--portal-sheet-title-divider\) solid var\(--portal-surface-inner\)/);
  assert.match(css, /border-bottom:\s*var\(--portal-sheet-content-divider\) solid var\(--portal-surface-inner\)/);
  assert.match(css, /#configuracoes-page-container[\s\S]*background:\s*transparent/);
});

test('popups de planilha usam workspace React sem container visual paralelo', () => {
  const workspace = read('src/components/SettingsWorkspaceModal.tsx');
  assert.match(workspace, /SHEET_SECTION_IDS/);
  assert.match(workspace, /data-portal-sheet-workspace/);
  assert.match(workspace, /data-portal-full-bleed/);
  assert.doesNotMatch(read('src/main.tsx'), /PortalSettingsRuntime/);
});

test('estúdio embutido não cria uma caixa principal dentro do popup', () => {
  const studio = read('src/components/IntegrationStudioPanel.tsx');
  assert.match(studio, /hideTabs \? 'mb-0 overflow-visible border-0 bg-transparent shadow-none'/);
  assert.match(studio, /hideTabs \? 'hidden' : 'portal-studio-heading/);
});
