import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const main = read('src/main.tsx');
const css = read('src/portal-finalization.css');
const auth = read('src/context/AuthContext.tsx');
const session = read('server/security/firebaseAuth.ts');
const personalizationHub = read('src/components/PortalPersonalizationHubModal.tsx');
const enhancer = read('src/components/PortalUiEnhancer.tsx');
const access = read('src/components/AuthorizedStudentsPanel.tsx');
const importUtil = read('src/utils/studentImport.ts');
const integrations = read('src/components/InfrastructureIntegrationsPanel.tsx');
const evaluation = read('src/components/AdvisorEvaluationPanel.tsx');
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

assert.match(personalizationHub, /onOpenAppearance\('quick_presets'\)/);
assert.doesNotMatch(personalizationHub, /role="dialog"/);
for (const legacy of ['botoes no topo', 'estilo base das planilhas', 'colunas ordem e linhas', 'estilo base pop ups', 'analise hipoar', 'solicitacao de correcao']) {
  assert.ok(enhancer.includes(`'${legacy}'`), `O item legado “${legacy}” precisa ser removido da navegação.`);
}

assert.match(access, /Matrícula — opcional/);
assert.match(access, /Interpretar dados colados/);
assert.doesNotMatch(access, />Tipo</);
assert.doesNotMatch(access, />TCCs</);
assert.match(importUtil, /parseStudentImportText/);
assert.match(importUtil, /extension==='xlsx'/);

assert.match(integrations, /Asten — assinatura eletrônica/);
assert.match(integrations, /Google Drive/);
assert.match(integrations, /Supabase/);
assert.match(integrations, /Vercel/);
assert.doesNotMatch(integrations, /Operação e confiabilidade/);

assert.match(evaluation, /portal_tcc_evaluation_draft_v1/);
assert.match(evaluation, /Rascunho recuperado automaticamente/);
assert.match(evaluation, /clearDraft\(process\.id\)/);

assert.match(server, /STUDENT_TCC_ALREADY_EXISTS/);
assert.match(server, /ACCESS_LINKED_TO_PROCESS/);
assert.match(server, /GOOGLE_ALLOW_EXISTING_MODEL_LINKS/);
assert.doesNotMatch(server, /if\(role==='STUDENT'&&!matricula\)/, 'Matrícula não pode bloquear o cadastro individual prévio.');
assert.match(server, /entry\.accessType=role/, 'O papel escolhido precisa se tornar a qualidade administrativa principal.');
assert.match(server, /replaceRole===true\?requestedRole/, 'A troca de qualidade deve atualizar accessType no backend.');
assert.doesNotMatch(server, /Public web scrape fallback/, 'A varredura de modelos não pode recorrer a scraping público do Drive.');

assert.equal(vercel.git?.deploymentEnabled?.['work/finalizacao-portal-tcc'], false, 'A branch de trabalho não pode disparar deployment na Vercel.');

console.log('Contrato da Atualização 34 aprovado.');
