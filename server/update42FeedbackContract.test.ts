import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=(path:string)=>readFile(path,'utf8');

test('login público usa orientação única e exemplo de e-mail neutro',async()=>{
  const controller=await source('src/components/PortalFeedbackController.tsx');
  assert.ok(controller.includes("emailInput.placeholder = 'nome@exemplo.com'"));
  assert.ok(controller.includes('Como funciona o acesso:'));
  assert.ok(controller.includes('Demais usuários:'));
  assert.ok(!controller.includes('Master, Presidência'));
  assert.ok(controller.includes("passwordlessBox.style.display = 'none'"));
});

test('redirecionamento pós-login diferencia Master, Presidente e usuário comum',async()=>{
  const controller=await source('src/components/PortalFeedbackController.tsx');
  assert.ok(controller.includes("globalRoles.includes('MASTER_ADMIN')"));
  assert.ok(controller.includes("globalRoles.includes('COMMISSION_PRESIDENT')"));
  assert.ok(controller.includes("? 'configuracoes'"));
  assert.ok(controller.includes("? 'coordenador'"));
  assert.ok(controller.includes(": 'meus-processos'"));
});

test('engrenagem permite colunas para usuário comum e persiste por e-mail e planilha',async()=>{
  const settings=await source('src/components/HeaderSettingsPopover.tsx');
  assert.ok(settings.includes('portal_user_table_config_'));
  assert.ok(settings.includes("const isMaster=globalRoles.includes('MASTER_ADMIN')"));
  assert.ok(settings.includes('const canManageColumns=Boolean(storageKey'));
  assert.ok(settings.includes('Minha visualização'));
  assert.ok(settings.includes('localStorage.setItem(currentPreferenceKey'));
  assert.ok(settings.includes('localStorage.removeItem(currentPreferenceKey)'));
});

test('acabamento visual aplica faixa lateral fina, filtros simétricos e botão de modelos compacto',async()=>{
  const css=await source('src/portal-update-42.css');
  assert.match(css,/#sidebar-nav \.portal-sidebar-nav-active::before[\s\S]*width:4px!important/);
  assert.match(css,/#portal-replication-page details>summary[\s\S]*padding:6px 10px!important/);
  assert.ok(css.includes('padding-bottom:.55rem!important'));
  assert.ok(css.includes('--portal-danger:#c62828'));
});
