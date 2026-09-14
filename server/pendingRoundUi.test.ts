import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const source = (file: string) => readFile(path.join(root, file), 'utf8');

test('guia não repete botão de acesso e usa cabeçalho musgo com texto claro', async () => {
  const tutorial = await source('src/pages/PortalTutorialPage.tsx');
  assert.ok(!tutorial.includes('Acessar o Portal'));
  assert.ok(tutorial.includes('bg-[#435649]'));
  assert.ok(tutorial.includes('text-white'));
  assert.ok(tutorial.includes('bg-slate-700'));
});

test('comissão reúne ações e QR Code, sem duplicar a personalização do símbolo', async () => {
  const panel = await source('src/components/CommissionIdentityPanel.tsx');
  assert.ok(panel.includes('Adicionar membro'));
  assert.ok(panel.includes('Salvar Comissão'));
  assert.ok(panel.includes('QRCode.toDataURL'));
  assert.ok(panel.includes('margin: 0'));
  assert.ok(!panel.includes('courseLogoDataUrl'));
  assert.ok(!panel.includes('Adicionar / substituir símbolo'));
  assert.ok(!panel.includes("file.type !== 'image/png'"));
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
  assert.ok(infrastructure.includes('Replicar para outra secretaria'));
});

test('paleta usa musgo estrutural e cinzas esverdeados sem oliva fluorescente', async () => {
  const css = await source('src/index.css');
  assert.ok(css.includes('--portal-moss: #435649'));
  assert.ok(css.includes('--portal-neutral-action: #5f6763'));
  assert.ok(css.includes('table thead th { background-color: var(--portal-moss)'));
  for (const deprecated of ['#5f6937', '#4f582e', '#343b20', '#252a16']) assert.ok(!css.includes(deprecated));
});

test('barra lateral usa subtítulo legível e não reintroduz verde fluorescente', async () => {
  const [sidebar, layout] = await Promise.all([
    source('src/components/Sidebar.tsx'),
    source('src/utils/siteLayoutConfig.ts')
  ]);
  assert.ok(sidebar.includes('ENFERMAGEM E OBSTETRÍCIA · UFES'));
  assert.ok(sidebar.includes("color: '#d9dfdc'"));
  assert.ok(layout.includes("sidebarSubtitle: 'ENFERMAGEM E OBSTETRÍCIA · UFES'"));
  assert.ok(layout.includes("sidebarActiveBgColor: '#435649'"));
});

test('transferência administrativa permite recuperação pelo Presidente sem reduzir a segurança', async () => {
  const server = await source('server.ts');
  const transferLines = server.split(/\r?\n/).filter((line) => line.includes('/api/admin/administration-transfers') || line.includes('/api/administration-transfers/pending'));
  assert.ok(transferLines.length >= 5);
  for (const line of transferLines) assert.ok(!line.includes("requireFeature('ADMIN_TRANSFER')"));
  assert.ok(server.includes('hasRecentAuthentication(identity)'));
  assert.ok(server.includes("actorRoles.includes('COMMISSION_PRESIDENT')"));
  assert.ok(server.includes('masterRecoveryEmails:[identity.email]'));
});

test('símbolo configurado pelo Master tem prioridade na lateral', async () => {
  const sidebar = await source('src/components/Sidebar.tsx');
  assert.ok(sidebar.includes('const courseLogo ='));
  assert.ok(sidebar.includes('const sidebarLogoSrc = courseLogo ||'));
});

test('assinatura oferece Asten e Gov.br como vias independentes', async () => {
  const [detail, signatures, handler] = await Promise.all([
    source('src/pages/ProcessoDetailPage.tsx'),
    source('src/types/signatures.ts'),
    source('api/index.ts')
  ]);
  assert.ok(detail.includes("handleSignDocument(doc,'ASTEN')"));
  assert.ok(detail.includes("handleSignDocument(doc,'GOVBR_EXTERNAL')"));
  assert.ok(detail.includes('Enviar assinado'));
  assert.ok(signatures.includes("'ASTEN' | 'GOVBR_EXTERNAL'"));
  assert.ok(signatures.includes("'AWAITING_EXTERNAL_SIGNATURE'"));
  assert.ok(!handler.includes("process.env.ASTEN_INTEGRATION_ENABLED === 'true' && (!configured('ASTEN_CALLBACK_URL')"));
});
