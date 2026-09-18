import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=(path:string)=>readFile(path,'utf8');

test('update 42 afina a faixa lateral pela direita e mantém a borda esquerda fixa',async()=>{
  const [main,css]=await Promise.all([source('src/main.tsx'),source('src/portal-update-42.css')]);
  assert.ok(main.includes("import './portal-update-42.css';"));
  assert.match(css,/#sidebar-nav \.portal-sidebar-nav-active::before[\s\S]*left:\s*0\s*!important[\s\S]*width:\s*4px\s*!important/);
});

test('update 42 compacta Baixar modelos e equilibra as barras de filtro',async()=>{
  const css=await source('src/portal-update-42.css');
  assert.ok(css.includes('#portal-replication-page details > summary'));
  assert.ok(css.includes('height: 28px !important'));
  assert.ok(css.includes('.portal-meus-processos-filter-row'));
  assert.ok(css.includes('.portal-coordinator-filter-row'));
  assert.ok(css.includes('padding-bottom: .70rem !important'));
});

test('login pós-autenticação roteia Master Presidência e usuário comum para áreas distintas',async()=>{
  const [app,auth]=await Promise.all([source('src/App.tsx'),source('src/context/AuthContext.tsx')]);
  assert.ok(auth.includes("new CustomEvent('portal:identity'"));
  assert.ok(app.includes("roles.includes('MASTER_ADMIN')"));
  assert.ok(app.includes("setCurrentTab('configuracoes')"));
  assert.ok(app.includes("roles.includes('COMMISSION_PRESIDENT')"));
  assert.ok(app.includes("setCurrentTab('coordenador')"));
  assert.ok(app.includes("setCurrentTab('meus-processos')"));
});

test('preferências de planilha são duráveis, por usuário e com padrão global do Master',async()=>{
  const [popover,panel,api,migration]=await Promise.all([
    source('src/components/HeaderSettingsPopover.tsx'),
    source('src/components/PortalColumnPreferencesPanel.tsx'),
    source('api/table-preferences.ts'),
    source('supabase/migrations/20260918203000_portal_table_preferences_v11.sql'),
  ]);
  assert.ok(popover.includes('/api/preferences/table'));
  assert.ok(panel.includes('A primeira coluna estrutural do TCC permanece sempre visível'));
  assert.ok(panel.includes('Definir padrão para todos'));
  assert.ok(panel.includes('Restaurar padrão'));
  assert.ok(api.includes("preference_scope text not null")===false);
  assert.ok(api.includes("scope === 'DEFAULT' && !user.globalRoles.includes('MASTER_ADMIN')"));
  assert.ok(migration.includes('portal_table_preferences'));
  assert.ok(migration.includes("preference_scope in ('USER','DEFAULT')"));
});

test('autorização de acesso não impõe qualidade global e modal fecha no canto direito',async()=>{
  const panel=await source('src/components/AuthorizedStudentsPanel.tsx');
  assert.ok(panel.includes('os papéis são determinados em cada TCC'));
  assert.ok(!panel.includes('Membro da banca'));
  assert.ok(!panel.includes('Qualidade'));
  assert.ok(panel.includes('absolute right-2 top-1/2'));
});

test('sincronização do rodapé e integrações usam hierarquia compacta',async()=>{
  const [identity,infra]=await Promise.all([source('src/components/CommissionIdentityPanel.tsx'),source('src/components/InfrastructureIntegrationsPanel.tsx')]);
  assert.ok(identity.includes('Sincronização do rodapé'));
  assert.ok(identity.includes('Presidência da Comissão'));
  assert.ok(identity.includes('WhatsApp'));
  assert.ok(infra.includes('Conexões'));
  assert.ok(infra.includes('Token da API Asten'));
});

test('modelos documentais abandonam ações pretas e usam a linguagem visual do Portal',async()=>{
  const [panel,css]=await Promise.all([source('src/components/MasterDocumentModelsPanel.tsx'),source('src/portal-update-42.css')]);
  assert.ok(panel.includes('portal-model-action-primary'));
  assert.ok(panel.includes('portal-model-action-secondary'));
  assert.ok(!panel.includes('bg-slate-900'));
  assert.ok(css.includes('--portal-danger: #b42318'));
  assert.ok(css.includes('.portal-master-document-models'));
});

test('runtime pesado só é compactado após backup explícito e commit transacional',async()=>{
  const supabase=await source('server/integrations/supabase.ts');
  assert.ok(supabase.includes('ensureRuntimeBackup'));
  assert.ok(supabase.includes('portal_runtime_state_backups'));
  assert.ok(supabase.includes('externalizeRuntimeImages'));
  assert.ok(supabase.includes('commitRuntimePayload'));
  assert.ok(supabase.includes('Compactação automática não concluída; mantendo estado original sem perda de dados.'));
});
