import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('camada final da auditoria é carregada depois do runtime de planilhas', () => {
  const main = read('src/main.tsx');
  const spreadsheet = main.indexOf("import './portal-spreadsheet-runtime.css'");
  const audit = main.indexOf("import './portal-backlog-audit-1055.css'");
  assert.ok(spreadsheet >= 0, 'runtime canônico de planilhas precisa continuar ativo');
  assert.ok(audit > spreadsheet, 'a camada de auditoria precisa ser a última autoridade visual');
  assert.match(main, /PortalBacklogAuditRuntime/);
});

test('separadores deixam de usar a faixa histórica de 16px', () => {
  const css = read('src/portal-backlog-audit-1055.css');
  const access = read('src/components/AuthorizedStudentsPanel.tsx');
  assert.match(css, /--portal-separator-section:\s*4px/);
  assert.match(css, /--portal-separator-table:\s*4px/);
  assert.match(css, /tbody tr:first-child > td[\s\S]*border-top:\s*0 !important/);
  assert.doesNotMatch(css, /--portal-separator-(?:section|table):\s*16px/);
  assert.doesNotMatch(access, /border-b-\[16px\]/);
  assert.match(access, /border-b-4/);
});

test('sidebar tem somente a faixa ativa colada à borda esquerda', () => {
  const css = read('src/portal-backlog-audit-1055.css');
  assert.match(css, /portal-sidebar-nav-item\.portal-sidebar-nav-active::before/);
  assert.match(css, /inset:\s*0 auto 0 0 !important/);
  assert.match(css, /width:\s*4px !important/);
  assert.match(css, /background:\s*#74ff96 !important/);
  assert.match(css, /portal-sidebar-nav-item:not\(\.portal-sidebar-nav-active\)::before[\s\S]*content:\s*none !important/);
});

test('filtros seguem branco em repouso e cinza no selecionado', () => {
  const css = read('src/portal-backlog-audit-1055.css');
  assert.match(css, /button\.portal-standard-filter-chip[\s\S]*background:\s*#fff !important/);
  assert.match(css, /--portal-filter-active:\s*#aeb0b3/);
  assert.match(css, /aria-pressed="true"/);
});

test('ação de novo TCC permanece disponível com múltiplos vínculos e sem trava no servidor', () => {
  const runtime = read('src/components/PortalBacklogAuditRuntime.tsx');
  const meusTccs = read('src/pages/MeusProcessosPage.tsx');
  const server = read('server.ts');
  assert.match(runtime, /#meus-processos-btn-novo/);
  assert.match(runtime, /portal:navigate/);
  assert.match(runtime, /novo-processo/);
  assert.match(runtime, /múltiplos TCCs/);
  assert.doesNotMatch(runtime, /roleCounts\.ALUNO\s*===\s*0/);
  assert.doesNotMatch(meusTccs, /canCreateStudentTcc\s*=\s*roleCounts\.ALUNO\s*===\s*0/);
  assert.match(meusTccs, /const canCreateStudentTcc = true/);
  assert.doesNotMatch(server, /STUDENT_TCC_ALREADY_EXISTS/);
  assert.doesNotMatch(server, /Cada aluno pode participar como autor de apenas um TCC/);
});

test('sugestões de normalização e autosave de variáveis permanecem habilitados', () => {
  const studio = read('src/components/IntegrationStudioPanel.tsx');
  assert.match(studio, /similarVariableSuggestions\.length > 0/);
  assert.doesNotMatch(studio, /false\s*&&\s*similarVariableSuggestions\.length > 0/);
  assert.match(studio, /Sugestões inteligentes de normalização/);
  assert.match(studio, /Impacto antes da mescla/);
  assert.doesNotMatch(studio, /Salvar e propagar variável/);
  assert.match(studio, /Alterações propagadas automaticamente/);
  assert.match(studio, /window\.setTimeout\(\(\) => updateVariableAndPropagate\(\{ \.\.\.variableDraft, name: nextName \}\), 800\)/);
});

test('Presidência mantém Asten e Gov.br em colunas individuais', () => {
  const coordinator = read('src/pages/CoordenadorPage.tsx');
  assert.match(coordinator, /renderSignatureActionCells/);
  assert.doesNotMatch(coordinator, /renderSignatureActionCell\s*=\s*\(/);
  assert.match(coordinator, /<span>Asten<\/span>/);
  assert.match(coordinator, /<span>Gov\.br<\/span>/);
  assert.match(coordinator, /handleSignOne\(proc\.id\)/);
  assert.match(coordinator, /handleGovOne\(proc\.id\)/);
});

test('legado Fluxo completo do TCC é removido do runtime ativo', () => {
  const sidebar = read('src/components/Sidebar.tsx');
  const runtime = read('src/components/PortalBacklogAuditRuntime.tsx');
  assert.match(sidebar, /'Fluxo do TCC'/);
  assert.doesNotMatch(sidebar, /Fluxo completo do TCC/i);
  assert.match(runtime, /fluxo completo do tcc/);
});

test('sessão continua com cookie HttpOnly e renovação por atividade', () => {
  const serverAuth = read('server/security/firebaseAuth.ts');
  const authContext = read('src/context/AuthContext.tsx');
  assert.match(serverAuth, /__Host-portal_tcc_session/);
  assert.match(serverAuth, /HttpOnly/);
  assert.match(serverAuth, /SameSite=Lax/);
  assert.match(serverAuth, /shouldRefreshForUserActivity/);
  assert.match(authContext, /getIdentityWithRetry/);
  assert.match(authContext, /pointerdown/);
  assert.match(authContext, /keydown/);
  assert.match(authContext, /wheel/);
  assert.match(authContext, /focus/);
});
