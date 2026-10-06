import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { readPortalCss } from './testUtils/portalCss';
const source = (path: string) => readFile(path, 'utf8');

test('filtros de Meus TCCs e Presidência usam a geometria canônica', async () => {
  const css = await readPortalCss();
  assert.match(css, /data-portal-sheet-filter="true"/);
  assert.match(css, /--portal-sheet-filter-height:\s*45px/);
  assert.match(css, /--portal-sheet-content-divider:\s*15px/);
});

test('identidade centraliza Master, Presidência, Secretaria e Comissão com autosave seguro', async () => {
  const panel = await source('src/components/CommissionIdentityPanel.tsx');
  assert.ok(panel.includes('Nome da Secretaria / Administrador Master'));
  assert.ok(panel.includes('Nome da Presidente da Comissão'));
  assert.ok(panel.includes('E-mail de contato da Secretaria'));
  assert.ok(panel.includes('Membros da Comissão'));
  assert.ok(panel.includes('if (!isMaster) return null'));
  assert.ok(panel.includes('apiClient.updateSettings'));
  assert.ok(panel.includes('createAdministrationTransfer'));
  assert.ok(panel.includes('Salvo automaticamente'));
});

test('update 39 abre cadastro individual e envio de lista em popups compactos', async () => {
  const panel = await source('src/components/AuthorizedStudentsPanel.tsx');
  assert.ok(panel.includes('Adicionar acesso'));
  assert.ok(panel.includes('Envio de lista'));
  assert.ok(panel.includes('CompactModal'));
  assert.ok(panel.includes("setModal('add')"));
  assert.ok(panel.includes("setModal('list')"));
});

test('integrações mantêm Asten visível e exibem infraestrutura diretamente', async () => {
  const panel = await source('src/components/InfrastructureIntegrationsPanel.tsx');
  assert.ok(panel.includes('Executar testes'));
  assert.ok(panel.includes('Asten'));
  assert.ok(panel.includes('Google Drive'));
  assert.ok(panel.includes('Supabase'));
  assert.ok(panel.includes('Vercel'));
  assert.ok(panel.includes('Testar conexão'));
  assert.ok(panel.includes('bg-white'));
  assert.ok(!panel.includes('>Conexões<'));
});

test('personalização expõe apenas superfícies atuais sem camada corretiva global', async () => {
  const [hub, main] = await Promise.all([
    source('src/components/PortalPersonalizationHubModal.tsx'),
    source('src/main.tsx'),
  ]);
  assert.ok(hub.includes("onOpenAppearance('site_header')"));
  assert.ok(!hub.includes("onOpenAppearance('quick_presets')"));
  assert.ok(!main.includes('PortalUiEnhancer'));
});

test('administração institucional permanece restrita ao Master com reautenticação em trocas sensíveis', async () => {
  const identity = await source('src/components/CommissionIdentityPanel.tsx');
  assert.ok(identity.includes('if (!isMaster) return null'));
  assert.ok(identity.includes('createAdministrationTransfer'));
  assert.ok(identity.includes('REAUTHENTICATION_REQUIRED'));
});