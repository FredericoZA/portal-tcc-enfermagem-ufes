import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const source = (file: string) => readFile(path.join(root, file), 'utf8');

test('divisor de Meus TCCs e Presidência mantém margem verde acima da linha branca', async () => {
  const [css39, css42] = await Promise.all([source('src/portal-update-39.css'), source('src/portal-update-42.css')]);
  assert.ok(css39.includes('.portal-meus-processos-filter-row'));
  assert.ok(css39.includes('.portal-coordinator-filter-row'));
  assert.match(css39, /margin-top:\s*0\.6rem\s*!important/);
  assert.ok(css42.includes('#meus-processos-page-container .portal-meus-processos-filter-row'));
  assert.ok(css42.includes('#coordenador-page-root .portal-coordinator-filter-row'));
  assert.match(css42, /margin-top:\s*\.6rem\s*!important/);
});

test('Configurações abre Sincronização e Modelos como workspaces modais com navegação lateral', async () => {
  const [enhancer, css] = await Promise.all([source('src/components/PortalUiEnhancer.tsx'), source('src/portal-update-39.css')]);
  assert.ok(enhancer.includes("enhanceSettingsWorkspace('google-workspace-sync-section', 'sync')"));
  assert.ok(enhancer.includes("enhanceSettingsWorkspace('master-flow-system-section', 'models')"));
  assert.ok(enhancer.includes('portal-settings-workspace-sidebar'));
  assert.ok(enhancer.includes("['identity', '👥', 'Administração']"));
  assert.ok(enhancer.includes("['catalog', '📄', 'Catálogo DOCX']"));
  assert.ok(css.includes("[data-portal-workspace-open='true']"));
  assert.ok(css.includes('.portal-studio-tab-strip'));
});

test('Personalização usa cabeçalho verde, título à esquerda, ícone branco sem caixa e ações brancas', async () => {
  const [enhancer, css39, css42] = await Promise.all([
    source('src/components/PortalUiEnhancer.tsx'),
    source('src/portal-update-39.css'),
    source('src/portal-update-42.css'),
  ]);
  assert.ok(enhancer.includes('portal-customization-header'));
  assert.ok(enhancer.includes('portal-customization-icon-shell'));
  assert.ok(enhancer.includes('portal-customization-top-action'));
  assert.ok(css39.includes('text-align: left !important'));
  assert.ok(css39.includes('background: #005830 !important'));
  assert.ok(css39.includes('background: #fff !important'));
  assert.ok(css42.includes('.portal-customization-header'));
});

test('Registro de logs sai de Configurações e vira página Master com toolbar de planilha', async () => {
  const [app, logs, enhancer, css] = await Promise.all([
    source('src/App.tsx'),
    source('src/pages/AuditLogsPage.tsx'),
    source('src/components/PortalUiEnhancer.tsx'),
    source('src/portal-update-39.css'),
  ]);
  assert.ok(app.includes("case 'logs'"));
  assert.ok(app.includes('<AuditLogsPage />'));
  assert.ok(logs.includes('id="audit-logs-page"'));
  assert.ok(logs.includes('<SearchPopover'));
  assert.ok(logs.includes('<HeaderSettingsPopover'));
  assert.ok(logs.includes('Backup'));
  assert.ok(logs.includes('Restaurar'));
  assert.ok(enhancer.includes("readGlobalRoles().includes('MASTER_ADMIN')"));
  assert.ok(enhancer.includes("detail: 'logs'"));
  assert.match(css, /#system-audit-logs-section\s*\{\s*display:\s*none\s*!important/);
});

test('Indicadores adicionam estatística descritiva, donuts e distribuições temporais', async () => {
  const [page, api] = await Promise.all([source('src/pages/IndicadoresPage.tsx'), source('api/public-indicators.ts')]);
  assert.ok(page.includes('const Donut'));
  assert.ok(page.includes('monthlyStdDev'));
  assert.ok(page.includes('completionDaysMedian'));
  assert.ok(page.includes('data.weekdays'));
  assert.ok(page.includes('data.dayparts'));
  assert.ok(api.includes('monthlyMean'));
  assert.ok(api.includes('monthlyMedian'));
  assert.ok(api.includes('monthlyStdDev'));
  assert.ok(api.includes('weekdays:'));
  assert.ok(api.includes('dayparts:'));
  assert.ok(api.includes('coauthorRate'));
  assert.ok(api.includes('containsPersonalData:false'));
});

test('migrações corrigem ambiguidades SQL reveladas pela primeira carga de processos', async () => {
  const [projection, integrity] = await Promise.all([
    source('supabase/migrations/202609190001_portal_publication_projection_requested_at_fix_v12.sql'),
    source('supabase/migrations/202609190002_portal_publication_integrity_file_alias_fix_v13.sql'),
  ]);
  assert.ok(projection.includes('j.requested_at desc'));
  assert.ok(projection.includes('selected_requested_at'));
  assert.ok(integrity.includes('f.file_kind'));
  assert.ok(integrity.includes('selected_file_kind'));
});
