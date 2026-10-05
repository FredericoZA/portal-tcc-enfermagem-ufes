import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { readPortalCss } from './testUtils/portalCss';
const root = path.resolve(process.cwd());
const source = (file: string) => readFile(path.join(root, file), 'utf8');

test('divisor de Meus TCCs e Presidência segue o contrato único de planilha', async () => {
  const css = await readPortalCss();
  assert.match(css, /--portal-sheet-title-divider:\s*5px/);
  assert.match(css, /--portal-sheet-content-divider:\s*15px/);
  assert.match(css, /data-portal-has-filter="true"/);
});

test('Configurações abre workspaces por componentes React dedicados', async () => {
  const [config, modal] = await Promise.all([
    source('src/pages/ConfiguracoesPage.tsx'),
    source('src/components/SettingsWorkspaceModal.tsx'),
  ]);
  assert.ok(config.includes('SettingsWorkspaceModal'));
  assert.ok(config.includes("activeSettingsPanel"));
  assert.ok(modal.includes('portal-settings-workspace'));
  assert.ok(modal.includes('portal-settings-workspace-main'));
  assert.ok(modal.includes('data-portal-full-bleed'));
});

test('Personalização usa o verde institucional canônico sem enhancer global', async () => {
  const [main, css] = await Promise.all([
    source('src/main.tsx'),
    readPortalCss(),
  ]);
  assert.doesNotMatch(main, /PortalUiEnhancer/);
  assert.match(css, /--portal-brand-header:\s*#005830/);
  assert.doesNotMatch(css, /!important/);
});

test('Registro de logs é página própria com toolbar de planilha', async () => {
  const [app, logs] = await Promise.all([
    source('src/App.tsx'),
    source('src/pages/AuditLogsPage.tsx'),
  ]);
  assert.ok(app.includes("case 'logs'"));
  assert.ok(app.includes('<AuditLogsPage />'));
  assert.ok(logs.includes('id="audit-logs-page"'));
  assert.ok(logs.includes('<SearchPopover'));
  assert.ok(logs.includes('<HeaderSettingsPopover'));
  assert.ok(logs.includes('Backup'));
  assert.ok(logs.includes('Restaurar'));
});

test('Indicadores adicionam estatística descritiva, séries e distribuições temporais', async () => {
  const [page, api] = await Promise.all([source('src/pages/IndicadoresPage.tsx'), source('api/public-indicators.ts')]);
  assert.ok(page.includes('const LineTrend'));
  assert.ok(page.includes('const Funnel'));
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