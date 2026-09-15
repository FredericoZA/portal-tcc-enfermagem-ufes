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

test('comissão reúne ações e QR Code sem duplicar personalização do símbolo', async () => {
  const panel = await source('src/components/CommissionIdentityPanel.tsx');
  assert.ok(panel.includes('Adicionar membro'));
  assert.ok(panel.includes('Salvar Comissão'));
  assert.ok(panel.includes('QRCode.toDataURL'));
  assert.ok(panel.includes("margin: 0"));
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

test('paleta principal usa musgo, cinza e contraste claro sem oliva fluorescente', async () => {
  const css = await source('src/index.css');
  for (const forbidden of ['#5f6937', '#4f582e', '#738044', '#8c9862']) assert.ok(!css.includes(forbidden), `Cor legada ainda presente: ${forbidden}`);
  assert.ok(css.includes('--color-emerald-800: #344125'));
  assert.ok(css.includes('--portal-popup-header: #f1f5f9'));
  assert.ok(css.includes('--portal-popup-header-text: #0f172a'));
  assert.ok(css.includes('--portal-popup-action: #475569'));
});

test('transferência administrativa não depende de feature opcional', async () => {
  const server = await source('server.ts');
  const transferLines = server.split(/\r?\n/).filter((line) => line.includes('/api/admin/administration-transfers') || line.includes('/api/administration-transfers/pending'));
  assert.ok(transferLines.length >= 5);
  for (const line of transferLines) assert.ok(!line.includes("requireFeature('ADMIN_TRANSFER')"));
  assert.ok(server.includes('hasRecentAuthentication(identity)'));
});

test('símbolo configurado pelo Master tem prioridade na lateral', async () => {
  const sidebar = await source('src/components/Sidebar.tsx');
  assert.ok(sidebar.includes('const courseLogo ='));
  assert.ok(sidebar.includes('const sidebarLogoSrc = courseLogo ||'));
});
