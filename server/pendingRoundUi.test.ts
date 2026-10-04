import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const source = (file: string) => readFile(path.join(root, file), 'utf8');

test('guia não repete botão de acesso ao portal', async () => {
  const tutorial = await source('src/pages/PortalTutorialPage.tsx');
  assert.ok(!tutorial.includes('Acessar o Portal'));
});

test('comissão reúne Presidência, Secretaria e membros sem duplicar acessos nem personalização do símbolo', async () => {
  const panel = await source('src/components/CommissionIdentityPanel.tsx');
  assert.ok(panel.includes('Presidência, Secretaria e Comissão'));
  assert.ok(panel.includes('Presidente da Comissão'));
  assert.ok(panel.includes('Secretaria'));
  assert.ok(panel.includes('Membros da Comissão'));
  assert.ok(panel.includes('Adicionar membro'));
  assert.ok(panel.includes('if (!isMaster) return null'));
  assert.ok(panel.includes('apiClient.updateSettings'));
  assert.ok(panel.includes('await refreshAuth()'));
  assert.ok(!panel.includes('createAdministrationTransfer'));
  assert.ok(!panel.includes('QRCode.toDataURL'));
  assert.ok(!panel.includes('courseLogoDataUrl'));
  assert.ok(!panel.includes('ADICIONAR / SUBSTITUIR SÍMBOLO'));
});

test('configurações não exibem blocos redundantes e Indicadores usam somente dados públicos agregados', async () => {
  const [config, infrastructure, indicators, publicApi] = await Promise.all([
    source('src/pages/ConfiguracoesPage.tsx'),
    source('src/components/InfrastructureIntegrationsPanel.tsx'),
    source('src/pages/IndicadoresPage.tsx'),
    source('api/public-indicators.ts')
  ]);
  assert.ok(!config.includes('<OperationsMonitorPanel'));
  assert.ok(!config.includes('Drive gerenciado pelo servidor.'));
  assert.ok(!infrastructure.includes('Central segura de integrações'));
  assert.ok(!indicators.includes('<OperationsMonitorPanel'));
  assert.ok(indicators.includes('/api/public/indicators'));
  assert.ok(publicApi.includes('containsPersonalData:false'));
});

test('paleta principal usa quatro superfícies e identidade canônica sem oliva legado', async () => {
  const css = await source('src/index.css');
  for (const forbidden of ['#5f6937', '#4f582e', '#738044', '#8c9862']) assert.ok(!css.includes(forbidden), `Cor legada ainda presente: ${forbidden}`);
  assert.ok(css.includes('--portal-surface-page: #f1f5f9'));
  assert.ok(css.includes('--portal-surface-panel: #e1e6e9'));
  assert.ok(css.includes('--portal-surface-card: #d5dce0'));
  assert.ok(css.includes('--portal-surface-inner: #ffffff'));
  assert.ok(css.includes('--portal-brand-header: #005830'));
  assert.ok(css.includes('--portal-sidebar-footer: #011f17'));
  assert.ok(css.includes('--portal-header-institution: #d5dce0'));
});

test('transferência administrativa não depende de feature opcional', async () => {
  const server = await source('server.ts');
  const transferLines = server.split(/\r?\n/).filter((line) => line.includes('/api/admin/administration-transfers') || line.includes('/api/administration-transfers/pending'));
  assert.ok(transferLines.length >= 5);
  for (const line of transferLines) assert.ok(!line.includes("requireFeature('ADMIN_TRANSFER')"));
  assert.ok(server.includes('hasRecentAuthentication(identity)'));
});

test('identidade visual é canônica no código e acompanha o favicon', async () => {
  const [sidebar, auth, server, layout] = await Promise.all([
    source('src/components/Sidebar.tsx'),
    source('src/context/AuthContext.tsx'),
    source('server.ts'),
    source('src/utils/siteLayoutConfig.ts'),
  ]);
  assert.ok(sidebar.includes('layoutConfig.sidebarCustomLogoUrl'));
  assert.ok(sidebar.includes("|| '/colenf-logo.png'"));
  assert.ok(auth.includes('syncPortalFavicon'));
  assert.ok(auth.includes('sidebarCustomLogoUrl'));
  assert.ok(!auth.includes('SITE_LAYOUT_EVENT'));
  assert.ok(layout.includes('A aparência estrutural é canônica e versionada no código'));
  assert.ok(server.includes("'portalAppearance','tableAppearance','tableLayouts'"));
  assert.ok(!server.includes('normalizeUnifiedAppearance'));
});
