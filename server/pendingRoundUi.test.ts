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

test('comissão reúne ações, QR Code e símbolo sem deformação', async () => {
  const panel = await source('src/components/CommissionIdentityPanel.tsx');
  assert.ok(panel.includes('Adicionar membro'));
  assert.ok(panel.includes('Salvar Comissão'));
  assert.ok(panel.includes('QRCode.toDataURL'));
  assert.ok(panel.includes('width !== 1024 || height !== 1024'));
  assert.ok(panel.includes("file.type !== 'image/png'"));
  assert.ok(panel.includes('object-contain'));
  assert.ok(panel.includes('courseLogoDataUrl'));
});

test('configurações não exibem blocos redundantes e monitor fica em Indicadores', async () => {
  const [config, infrastructure, indicators] = await Promise.all([
    source('src/pages/ConfiguracoesPage.tsx'),
    source('src/components/InfrastructureIntegrationsPanel.tsx'),
    source('src/pages/IndicadoresPage.tsx')
  ]);
  assert.ok(!config.includes('<OperationsMonitorPanel'));
  assert.ok(!config.includes('Drive gerenciado pelo servidor.'));
  assert.ok(!infrastructure.includes('Central segura de integrações'));
  assert.ok(indicators.includes('<OperationsMonitorPanel'));
});

test('paleta principal é verde militar fosco', async () => {
  const css = await source('src/index.css');
  for (const color of ['#5f6937', '#4f582e', '#343b20', '#252a16']) assert.ok(css.includes(color));
  assert.ok(css.includes('--color-emerald-700: #5f6937'));
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
