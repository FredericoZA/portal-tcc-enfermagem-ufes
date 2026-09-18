import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path: string) => readFile(path, 'utf8');

test('update 39 mantém espaço verde abaixo das duas barras de filtro', async () => {
  const css = await source('src/portal-update-39.css');
  assert.ok(css.includes('.portal-meus-processos-filter-row'));
  assert.ok(css.includes('.portal-coordinator-filter-row'));
  assert.match(css, /padding-bottom:\s*0\.95rem\s*!important/);
});

test('rodapé administrativo reúne Presidência Secretaria e Comissão', async () => {
  const panel = await source('src/components/CommissionIdentityPanel.tsx');
  assert.ok(panel.includes('Sincronização do rodapé'));
  assert.ok(panel.includes('Presidência da Comissão'));
  assert.ok(panel.includes('Secretaria'));
  assert.ok(panel.includes('Membros da Comissão'));
  assert.ok(panel.includes('portal-president-master-transfer'));
  assert.ok(!panel.includes('Nome da Secretaria / Administrador Master'));
  assert.ok(panel.includes("createAdministrationTransfer('MASTER_ADMIN'"));
  assert.ok(panel.includes("createAdministrationTransfer('COMMISSION_PRESIDENT'"));
});

test('cadastro individual e envio de lista abrem em popups compactos com fechamento no canto direito', async () => {
  const panel = await source('src/components/AuthorizedStudentsPanel.tsx');
  assert.ok(panel.includes('Adicionar acesso'));
  assert.ok(panel.includes('Envio de lista'));
  assert.ok(panel.includes('CompactModal'));
  assert.ok(panel.includes("setModal('add')"));
  assert.ok(panel.includes("setModal('list')"));
  assert.ok(panel.includes('absolute right-2 top-1/2'));
});

test('integrações mantêm Asten visível e concentram infraestrutura no painel de Conexões', async () => {
  const panel = await source('src/components/InfrastructureIntegrationsPanel.tsx');
  assert.ok(panel.includes('Integrações da plataforma'));
  assert.ok(panel.includes('Executar testes'));
  assert.ok(panel.includes('Conexões'));
  assert.ok(panel.includes('Token da API Asten'));
  assert.ok(panel.includes('Google Drive'));
  assert.ok(panel.includes('Supabase'));
  assert.ok(panel.includes('Vercel'));
  assert.ok(panel.includes('bg-white'));
});

test('update 39 abre personalização por tela e remove controles gerais legados', async () => {
  const [hub, enhancer] = await Promise.all([
    source('src/components/PortalPersonalizationHubModal.tsx'),
    source('src/components/PortalUiEnhancer.tsx'),
  ]);
  assert.ok(hub.includes("onOpenAppearance('site_header')"));
  assert.ok(!hub.includes("onOpenAppearance('quick_presets')"));
  assert.ok(enhancer.includes('temas prontos 1 clique'));
  assert.ok(enhancer.includes('configuracao global do portal site todo'));
  assert.ok(enhancer.includes('exemplo ao vivo do portal preview em tempo real'));
  assert.ok(enhancer.includes('portal-customization-top-action'));
});

test('update 39 limita a superfície da Presidência à troca segura do Master', async () => {
  const [css, enhancer] = await Promise.all([
    source('src/portal-update-39.css'),
    source('src/components/PortalUiEnhancer.tsx'),
  ]);
  assert.ok(enhancer.includes("portalSettingsRole = 'president-only'"));
  assert.ok(css.includes("html[data-portal-settings-role='president-only'] #configuracoes-page-container > section"));
  assert.ok(css.includes('.portal-president-master-transfer'));
});
