import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const main = read('src/main.tsx');
const indexCss = read('src/index.css');
const tokens = read('src/styles/portal-tokens.css');
const visualCss = [
  tokens,
  read('src/styles/portal-layout.css'),
  read('src/styles/portal-components.css'),
  read('src/styles/portal-sheet.css'),
  read('src/styles/portal-pages.css'),
  read('src/styles/portal-responsive.css'),
].join('\n');
const auth = read('src/context/AuthContext.tsx');
const session = read('server/security/firebaseAuth.ts');
const personalizationHub = read('src/components/PortalPersonalizationHubModal.tsx');
const editor = read('src/components/UnifiedPortalEditorModal.tsx');
const access = read('src/components/AuthorizedStudentsPanel.tsx');
const importUtil = read('src/utils/studentImport.ts');
const integrations = read('src/components/InfrastructureIntegrationsPanel.tsx');
const evaluation = read('src/components/AdvisorEvaluationPanel.tsx');
const studio = read('src/components/IntegrationStudioPanel.tsx');
const masterModels = read('src/components/MasterDocumentModelsPanel.tsx');
const googleWorkspace = read('server/integrations/googleWorkspace.ts');
const visualQa = read('scripts/test-visual.mjs');
const types = read('src/types/index.ts');
const server = read('server.ts');
const vercel = JSON.parse(read('vercel.json'));

assert.match(main, /import ['"]\.\/index\.css['"]/);
assert.doesNotMatch(main, /portal-(?:finalization|update-|version-).*\.css/);
for (const canonicalImport of [
  './styles/portal-tokens.css',
  './styles/portal-layout.css',
  './styles/portal-components.css',
  './styles/portal-sheet.css',
  './styles/portal-pages.css',
  './styles/portal-responsive.css',
]) assert.ok(indexCss.includes(canonicalImport), `Folha canônica ausente do entrypoint: ${canonicalImport}`);

for (const [token, value] of [
  ['--portal-surface-page', '#f1f5f9'],
  ['--portal-surface-panel', '#e1e6e9'],
  ['--portal-surface-card', '#d5dce0'],
  ['--portal-surface-inner', '#ffffff'],
  ['--portal-brand-header', '#005830'],
  ['--portal-brand-action', '#337959'],
  ['--portal-sidebar-footer', '#011f17'],
  ['--portal-sidebar-active', '#154d41'],
  ['--portal-sheet-title-height', '45px'],
  ['--portal-sheet-title-divider', '5px'],
  ['--portal-sheet-filter-height', '45px'],
  ['--portal-sheet-content-divider', '15px'],
  ['--portal-sheet-column-header-height', '35px'],
  ['--portal-sheet-row-min-height', '30px'],
  ['--portal-sheet-pagination-height', '24px'],
  ['--portal-sheet-column-control-size', '15px'],
]) {
  assert.ok(tokens.toLowerCase().includes(`${token}: ${value}`.toLowerCase()), `Token canônico divergente: ${token}`);
}

assert.doesNotMatch(visualCss, /!important/);

assert.match(session, /SESSION_IDLE_TTL_SECONDS\s*=\s*3\s*\*\s*60\s*\*\s*60/);
assert.match(session, /expiresAt:\s*now\s*\+\s*SESSION_IDLE_TTL_SECONDS/);
assert.match(session, /requestPath\s*===\s*['"]\/api\/me['"]/);
assert.match(session, /HttpOnly/);
assert.match(session, /SameSite=Lax/);
assert.match(session, /Priority=High/);
assert.doesNotMatch(session, /SESSION_TTL_SECONDS\s*=\s*12\s*\*\s*60\s*\*\s*60/);
assert.doesNotMatch(session, /SESSION_REFRESH_AFTER_SECONDS/);

assert.match(auth, /getIdentityWithRetry/);
assert.match(auth, /AUTH_CACHE_KEY/);
assert.match(auth, /AUTH_CACHE_MAX_AGE_MS\s*=\s*3\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
assert.match(auth, /SESSION_ACTIVITY_TOUCH_INTERVAL_MS\s*=\s*60\s*\*\s*1000/);
assert.match(auth, /pointerdown/);
assert.match(auth, /keydown/);
assert.match(auth, /touchstart/);
assert.match(auth, /ApiRequestError/);
assert.match(auth, /window\.addEventListener\('online'/);
assert.match(auth, /syncPortalFavicon/);

assert.match(personalizationHub, /onOpenAppearance\('site_header'\)/);
assert.doesNotMatch(personalizationHub, /onOpenAppearance\('quick_presets'\)/);
assert.doesNotMatch(personalizationHub, /role="dialog"/);
assert.doesNotMatch(main, /PortalUiEnhancer|PortalTableTextPolicy/);
for (const removedLabel of ['Botões no Topo', 'Estilo Base Planilhas', 'Colunas, ordem e linhas', 'Estilo Base Pop-ups', 'Análise Hipoar', 'Solicitação de Correção']) {
  assert.ok(!editor.includes(`renderNavRow('${removedLabel}`) && !editor.includes(`, '${removedLabel}',`), `O editor não pode voltar a expor “${removedLabel}”.`);
}
for (const canonicalSheet of ["sheet_calendar", "sheet_repository", "sheet_my_tccs", "sheet_coordinator"]) assert.ok(editor.includes(canonicalSheet));

assert.match(access, /Matrícula — opcional/);
assert.match(access, /planilha Excel normal/);
assert.match(access, /Modelo Excel/);
assert.match(access, /Modelo Google Planilhas/);
assert.match(access, /Selecionar planilha/);
assert.doesNotMatch(access, />Tipo</);
assert.doesNotMatch(access, />TCCs</);
assert.match(importUtil, /parseStudentImportText/);
assert.match(importUtil, /extension==='xlsx'/);
assert.doesNotMatch(server, /!record\.matricula\|\|!isValidPortalEmail/, 'Matrícula não pode bloquear a importação em lote.');

assert.match(integrations, /<h4[^>]*>Asten<\/h4>/);
assert.match(integrations, /Token da API Asten/);
assert.match(integrations, /Google Drive/);
assert.match(integrations, /Supabase/);
assert.match(integrations, /Vercel/);
assert.doesNotMatch(integrations, /Operação e confiabilidade/);

assert.match(evaluation, /portal_tcc_evaluation_draft_v1/);
assert.match(evaluation, /Rascunho recuperado automaticamente/);
assert.match(evaluation, /clearDraft\(process\.id\)/);

assert.match(studio, /Rascunho automático/);
assert.match(studio, /saveLocalStudio\(draft\)/);
assert.match(studio, /localTime > remoteTime/);
assert.match(studio, /'Publicando…' : 'Publicar'/);
assert.match(studio, /createEmailTemplate/);
assert.match(studio, /deleteSelectedEmail/);
assert.match(studio, />Anexos /);
assert.match(studio, /Somente após assinatura/);
assert.match(studio, /Anexar quando gerado/);
assert.match(studio, /createFormTemplate/);
assert.match(studio, /deleteSelectedForm/);
assert.match(studio, /moveSelectedFormQuestion/);
assert.match(studio, /application\/x-portal-workflow/);
assert.match(studio, /Arraste para uma etapa/);
assert.match(studio, /handleWorkflowStageDrop/);
assert.match(studio, /moveWorkflowAction/);
assert.match(studio, /similarVariableSuggestions/);
assert.match(studio, /Sugestões inteligentes de normalização/);
assert.match(studio, /Nada é alterado sem confirmação explícita/);
assert.match(studio, /buildVariableMergeImpact/);
assert.doesNotMatch(studio, />Salvar metadados do fluxo</);
assert.doesNotMatch(studio, />Salvar modelo de e-mail</);
assert.doesNotMatch(studio, />Salvar formulário</);
assert.doesNotMatch(studio, /<strong>Fonte oficial única\.<\/strong>/);
assert.doesNotMatch(studio, />Finalidade no fluxo</);

assert.match(masterModels, /Nome do novo documento/);
assert.match(masterModels, /Novo documento/);
assert.match(masterModels, /addSlot/);
assert.match(masterModels, /removeModel/);
assert.match(masterModels, /deleteDocumentModel/);
assert.match(masterModels, /normalizeModelKey/);
assert.match(types, /documentModels\?: Record<string/);
assert.match(googleWorkspace, /ensureDocumentModelFolders/);
assert.match(googleWorkspace, /publishMasterDocumentModel\(input:\{type:string/);
assert.match(googleWorkspace, /registerMasterDocumentModelFromDrive\(input:\{type:string/);
assert.match(googleWorkspace, /99_\$\{type\}/);
assert.match(googleWorkspace, /drive\.readonly/);

assert.match(server, /STUDENT_TCC_ALREADY_EXISTS/);
assert.match(server, /ACCESS_LINKED_TO_PROCESS/);
assert.match(server, /GOOGLE_ALLOW_EXISTING_MODEL_LINKS/);
assert.doesNotMatch(server, /if\(role==='STUDENT'&&!matricula\)/, 'Matrícula não pode bloquear o cadastro individual prévio.');
assert.match(server, /entry\.accessType=role/, 'O papel escolhido precisa se tornar a qualidade administrativa principal.');
assert.match(server, /replaceRole===true\?requestedRole/, 'A troca de qualidade deve atualizar accessType no backend.');
assert.match(server, /app\.delete\('\/api\/admin\/models\/:type'/);
assert.match(server, /DOCUMENT_MODEL_IN_USE/);
assert.match(server, /MODELO_DOCUMENTAL_REMOVIDO/);
assert.match(server, /type\.length<2/);
assert.doesNotMatch(server, /Public web scrape fallback/, 'A varredura de modelos não pode recorrer a scraping público do Drive.');

for (const persona of ['master@portal.local', 'mariana.silva@aluno.ufes.br', 'ana.santos@ufes.br', 'presidente@portal.local']) assert.ok(visualQa.includes(persona), `QA visual precisa cobrir ${persona}.`);
for (const status of ['AGUARDANDO_DEFESA', 'EM_AVALIACAO', 'AGUARDANDO_ASSINATURA']) assert.ok(visualQa.includes(status), `QA visual precisa exigir o estado ${status}.`);
assert.match(visualQa, /overflowElements/);
assert.match(visualQa, /forcedColors: 'active'/);
assert.match(visualQa, /page\.keyboard\.press\('Tab'\)/);

assert.equal(vercel.git?.deploymentEnabled?.['work/finalizacao-portal-tcc'], false, 'A branch de trabalho não pode disparar deployment na Vercel.');

console.log('Contrato da finalização do backlog aprovado.');
