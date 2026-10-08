import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('shell canônico de popup preserva cabeçalho verde, tarja branca e fundo branco-gelo',()=>{
  const shell=read('src/components/PortalModalShell.tsx');
  const css=read('src/styles/portal-components.css');
  assert.match(shell,/portal-modal-header/);
  assert.match(shell,/portal-modal-divider/);
  assert.match(shell,/portal-modal-body/);
  assert.match(shell,/event\.key === 'Escape'/);
  assert.match(css,/\.portal-modal-divider\s*\{[\s\S]*background:\s*var\(--portal-surface-inner\)/);
  assert.match(css,/\.portal-modal-body\s*\{[\s\S]*background:\s*var\(--portal-surface-page\)/);
  assert.match(css,/\.portal-standard-modal\s*\{[\s\S]*background:\s*var\(--portal-surface-page\)/);
});

test('popups tabulares não usam X de fechamento e usam a hierarquia canônica',()=>{
  for(const path of ['src/components/SearchPopover.tsx','src/components/HeaderSettingsPopover.tsx']){
    const source=read(path);
    assert.doesNotMatch(source,/<X\b/);
    assert.doesNotMatch(source,/aria-label="Fechar/);
    assert.match(source,/portal-modal-divider/);
  }
});

test('cadastro de TCC abre em popup flutuante, não como navegação normal',()=>{
  const app=read('src/App.tsx');
  assert.match(app,/isRegistrationModalOpen/);
  assert.match(app,/tab === 'novo-processo'/);
  assert.match(app,/title="Cadastrar Trabalho de TCC"/);
  assert.match(app,/<WizardCadastroPage/);
  const handler=app.slice(app.indexOf("const handleNavigate"),app.indexOf("useEffect",app.indexOf("const handleNavigate")));
  assert.match(handler,/setIsRegistrationModalOpen\(true\)/);
  assert.match(handler,/return;/);
});

test('estúdio operacional não conserva backdrops e botões X dos antigos modais',()=>{
  const studio=read('src/components/UnifiedFlowSystem.tsx');
  assert.doesNotMatch(studio,/fixed inset-0 z-50 bg-slate-900\/60/);
  assert.doesNotMatch(studio,/aria-label="Fechar configuração da variável"/);
  assert.match(studio,/portal-flow-modal/);
  assert.match(studio,/portal-flow-modal-header/);
});

test('popups principais abandonam superfícies estruturais escuras',()=>{
  const paths=[
    'src/components/AIAnalyzerModal.tsx',
    'src/components/CorrectionRequestModal.tsx',
    'src/components/DocumentPreviewModal.tsx',
    'src/components/EmergencyRecoveryModal.tsx',
    'src/components/NewFileModal.tsx',
    'src/components/NewFolderModal.tsx',
  ];
  for(const path of paths){
    const source=read(path);
    assert.match(source,/PortalModalShell/);
    assert.doesNotMatch(source,/<X\b/);
    assert.doesNotMatch(source,/bg-slate-9(?:00|50).*rounded-2xl/);
  }
});

test('popups públicos e administrativos usam superfície canônica',()=>{
  const home=read('src/pages/HomePage.tsx');
  const access=read('src/components/AuthorizedStudentsPanel.tsx');
  const audit=read('src/components/AuditAndSecuritySection.tsx');
  assert.match(home,/Selecionar mês/);
  assert.match(home,/Selecionar data/);
  assert.match(home,/portal-modal-divider/);
  assert.match(access,/portal-standard-modal portal-modal-surface/);
  assert.match(audit,/portal-standard-modal portal-modal-surface/);
});
