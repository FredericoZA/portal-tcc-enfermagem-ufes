import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('update 39 UI contract', () => {
  it('keeps green breathing room below the two filter rows', () => {
    const css = read('src/portal-update-39.css');
    expect(css).toContain('.portal-meus-processos-filter-row');
    expect(css).toContain('.portal-coordinator-filter-row');
    expect(css).toMatch(/padding-bottom:\s*0\.95rem\s*!important/);
  });

  it('replaces duplicated administrative identity with president, secretary and commission fields', () => {
    const panel = read('src/components/CommissionIdentityPanel.tsx');
    expect(panel).toContain('Presidente da Comissão');
    expect(panel).toContain('Secretaria');
    expect(panel).toContain('Membros da Comissão');
    expect(panel).toContain('portal-president-master-transfer');
    expect(panel).not.toContain('Nome da Secretaria / Administrador Master');
    expect(panel).toContain("createAdministrationTransfer('MASTER_ADMIN'");
    expect(panel).toContain("createAdministrationTransfer('COMMISSION_PRESIDENT'");
  });

  it('opens access registration and list import in compact modal flows', () => {
    const panel = read('src/components/AuthorizedStudentsPanel.tsx');
    expect(panel).toContain('Adicionar acesso');
    expect(panel).toContain('Envio de lista');
    expect(panel).toContain('CompactModal');
    expect(panel).toContain("setModal('add')");
    expect(panel).toContain("setModal('list')");
  });

  it('keeps infrastructure integrations compact with white actions', () => {
    const panel = read('src/components/InfrastructureIntegrationsPanel.tsx');
    expect(panel).toContain('Integrações da plataforma');
    expect(panel).toContain('Executar testes');
    expect(panel).toContain('xl:grid-cols-[1.6fr_.8fr_.8fr_.65fr]');
    expect(panel).toContain('bg-white');
  });

  it('opens personalization screen-by-screen and prunes legacy general controls', () => {
    const hub = read('src/components/PortalPersonalizationHubModal.tsx');
    const enhancer = read('src/components/PortalUiEnhancer.tsx');
    expect(hub).toContain("onOpenAppearance('site_header')");
    expect(hub).not.toContain("onOpenAppearance('quick_presets')");
    expect(enhancer).toContain('temas prontos 1 clique');
    expect(enhancer).toContain('configuracao global do portal site todo');
    expect(enhancer).toContain('exemplo ao vivo do portal preview em tempo real');
    expect(enhancer).toContain('portal-customization-top-action');
  });

  it('keeps the president settings surface limited to the secure master transfer UI', () => {
    const css = read('src/portal-update-39.css');
    const enhancer = read('src/components/PortalUiEnhancer.tsx');
    expect(enhancer).toContain("portalSettingsRole = 'president-only'");
    expect(css).toContain("html[data-portal-settings-role='president-only'] #configuracoes-page-container > section");
    expect(css).toContain('.portal-president-master-transfer');
  });
});
