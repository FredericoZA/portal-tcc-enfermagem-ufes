import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { execFileSync } from 'node:child_process';

const read = (path: string): string => readFileSync(path, 'utf8');

test('a replicação disponibiliza tutorial de instalação sem exigir serviços de IA', () => {
  const page = read('src/pages/PortalReplicationPage.tsx');
  const guide = read('public/replicacao/GUIA_DE_INSTALACAO.md');
  assert.match(page, /Tutorial de instalação/);
  assert.match(page, /\/replicacao\/GUIA_DE_INSTALACAO\.md/);
  assert.doesNotMatch(page, /Guia para a IA|Baixar guia para a IA/);
  assert.match(guide, /não é necessário contratar, conectar nem fornecer dados/i);
  assert.match(guide, /decisões acadêmicas permanecem sob responsabilidade/i);
  assert.equal(existsSync('public/replicacao/GUIA_PARA_IA.md'), false);
});

test('componentes antigos de IA e dependência generativa não fazem parte do produto', () => {
  assert.equal(existsSync('src/components/AIAnalyzerModal.tsx'), false);
  assert.equal(existsSync('src/components/ContinuousIntelligencePanel.tsx'), false);
  const pkg = JSON.parse(read('package.json')) as {dependencies:Record<string,string>};
  const lock = JSON.parse(read('package-lock.json')) as {packages:Record<string,{dependencies?:Record<string,string>}>};
  assert.equal(pkg.dependencies['@google/genai'], undefined);
  assert.equal(lock.packages[''].dependencies?.['@google/genai'], undefined);
  assert.equal(lock.packages['node_modules/@google/genai'], undefined);
});

test('cron mantém manutenção, indicadores ficam independentes e sugestões humanas preservadas', () => {
  const server = read('server.ts');
  const from = server.indexOf("app.get('/api/cron/storage-cleanup'");
  const to = server.indexOf('// Callback confirmado com commit', from);
  assert.ok(from >= 0 && to > from, 'Rota de manutenção não localizada');
  const cron = server.slice(from, to);
  assert.doesNotMatch(cron, /refreshContinuousIntelligence/);
  assert.match(cron, /cleanupExpiredStagedUploads/);
  assert.match(cron, /cleanupExpiredDownloadTransfers/);
  assert.match(cron, /createVerifiedPortalBackup/);
  assert.match(cron, /runWorkflowMaintenance/);
  assert.match(server, /buildAdvancedAnalytics/);
  const feedback = read('src/components/FeedbackModal.tsx');
  assert.match(feedback, /Enviar sugestão/);
});

test('parecer continua sob revisão humana e não invoca API generativa', () => {
  const component = read('src/components/AdvisorEvaluationPanel.tsx');
  const form = read('src/utils/evaluationForm.ts');
  assert.match(component, /Gerar rascunho de parecer/);
  assert.match(component, /standardOpinion\(\)/);
  assert.match(form, /function standardEvaluationOpinion/);
  assert.match(component, /Confirme que o resultado|Confirmo que o resultado|Confirmo que o resultado, o parecer/);
});

test('inventário crítico da produção corresponde ao tutorial atual', () => {
  const manifest = JSON.parse(read('docs/PRODUCTION_CLI_SOURCE_MANIFEST_2026-11-02.json')) as { criticalSourcePaths: string[] };
  assert.ok(manifest.criticalSourcePaths.includes('public/replicacao/GUIA_DE_INSTALACAO.md'));
  assert.ok(!manifest.criticalSourcePaths.includes('public/replicacao/GUIA_PARA_IA.md'));
  assert.ok(manifest.criticalSourcePaths.includes('src/pages/ProcessoDetailPage.tsx'));
  assert.ok(manifest.criticalSourcePaths.includes('src/components/ProcessSummaryCard.tsx'));
  assert.doesNotThrow(() => execFileSync(process.execPath, ['scripts/verify-production-source.mjs'], {
    env: { ...process.env, PORTAL_REQUIRE_SOURCE_PARITY: 'true' },
    stdio: 'pipe',
  }));
});


test('rotas de recomendações legadas não permitem recriar propostas nem alertas', () => {
  const server = read('server.ts');
  assert.doesNotMatch(server, /function refreshContinuousIntelligence\(/);
  assert.doesNotMatch(server, /buildContinuousIntelligenceState\(/);
  assert.doesNotMatch(server, /upsertLivingIntelligenceFile\(/);
  assert.equal(existsSync('server/continuousIntelligence.ts'),false);
  assert.equal(existsSync('server/integrations/googleWorkspaceLivingReports.test.ts'),false);
  assert.equal(existsSync('server/statisticalSnapshot.ts'),true);
  assert.doesNotMatch(read('src/services/apiClient.ts'), /getContinuousIntelligence|refreshContinuousIntelligence/);

  assert.doesNotMatch(server, /app\.(?:all|get|post)\('\/api\/admin\/continuous-intelligence/);
  assert.doesNotMatch(server, /notifications\.push\(\{id:`intelligence-/);
  assert.doesNotMatch(server, /id:'continuous-intelligence',label:'Arquivos vivos'/);
  assert.match(server, /continuousIntelligence:continuousIntelligenceStore/);
  assert.match(server, /app\.get\('\/api\/admin\/analytics\/advanced'/);
  assert.match(server, /app\.post\('\/api\/public\/feedback'/);
});
