import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const main = read('src/main.tsx');
const css = read('src/portal-finalization.css');
const auth = read('src/context/AuthContext.tsx');
const session = read('server/security/firebaseAuth.ts');
const personalizationHub = read('src/components/PortalPersonalizationHubModal.tsx');
const editor = read('src/components/UnifiedPortalEditorModal.tsx');
const enhancer = read('src/components/PortalUiEnhancer.tsx');
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

assert.ok(main.indexOf("./portal-finalization.css") > main.indexOf("./portal-update-33.css"), 'A camada final precisa ser carregada depois da Atualização 33.');
assert.match(css, /--portal-divider-width:\s*2px/);
assert.match(css, /--portal-filter-selected:\s*#AEB0B3/i);
assert.match(css, /--portal-sidebar-accent:\s*#74FF96/i);
assert.match(css, /#meus-processos-btn-novo[\s\S]*order:\s*-1/);

assert.match(session, /SESSION_TTL_SECONDS\s*=\s*12\s*\*\s*60\s*\*\s*60/);
assert.match(session, /HttpOnly/);
assert.match(session, /SameSite=Lax/);
assert.match(session, /Priority=High/);
assert.doesNotMatch(session, /SESSION_REFRESH_AFTER_SECONDS/);

assert.match(auth, /getIdentityWithRetry/);
assert.match(auth, /AUTH_CACHE_KEY/);
assert.match(auth, /ApiRequestError/);
assert.match(auth, /window\.addEventListener\('online'/);
assert.match(auth, /syncPortalFavicon/);

assert.match(personalizationHub, /onOpenAppearance\('site_header'\)/);
assert.doesNotMatch(personalizationHub, /onOpenAppearance\('quick_presets'\)/);
assert.doesNotMatch(personalizationHub, /role="dialog"/);
for (const legacy of ['botoes no topo', 'estilo base das planilhas', 'colunas ordem e linhas', 'estilo base pop ups', 'analise hipoar', 'solicitacao de correcao']) {
  assert.ok(enhancer.includes(`'${legacy}'`), `A camada de compatibilidade precisa continuar removendo o item legado “${legacy}”.`);
}
for (const removedLabel of ['Botões no Topo', 'Estilo Base Planilhas', 'Colunas, ordem e linhas', 'Estilo Base Pop-ups', 'Análise Hipoar', 'Solicitação de Correção']) {
  assert.ok(!editor.includes(`renderNavRow('${removedLabel}`) && !editor.includes(`, '${removedLabel}',`), `O editor não pode voltar a expor “${removedLabel}”.`);
}
for (const canonicalSheet of ["sheet_calendar", "sheet_repository", "sheet_my_tccs", "sheet_coordinator"]) assert.ok(editor.includes(canonicalSheet));

assert.match(access, /Matrícula — opcional/);
assert.match(access, /Cole dados do Excel/);
assert.doesNotMatch(access, />Tipo</);
assert.doesNotMatch(access, />TCCs</);
assert.match(importUtil, /parseStudentImportText/);
assert.match(importUtil, /extension==='xlsx'/);
assert.doesNotMatch(server, /!record\.matricula\|\|!isValidPortalEmail/, 'Matrícula não pode bloquear a importação em lote.');

assert.match(integrations, /Asten — assinatura eletrônica/);
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
assert.match(studio, /Anexos gerados pelo Portal/);
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

assert.match(masterModels, /Cadastre quantos modelos DOCX forem necessários/);
assert.match(masterModels, /Novo tipo de documento/);
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
