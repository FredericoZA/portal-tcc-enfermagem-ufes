import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { readPortalCss } from './testUtils/portalCss';
const source=(path:string)=>readFile(path,'utf8');

test('login público usa orientação única e exemplo de e-mail neutro',async()=>{
  const home=await source('src/pages/HomePage.tsx');
  assert.ok(home.includes('placeholder="nome@exemplo.com"'));
  assert.ok(home.includes('Como funciona o acesso:'));
  assert.ok(home.includes('Demais usuários:'));
  assert.ok(!home.includes('Master, Presidência'));
  assert.ok(!home.includes('>Acesso sem senha<'));
});

test('redirecionamento pós-login diferencia Master, Presidente e usuário comum',async()=>{
  const redirect=await source('src/components/PortalAccessRedirect.tsx');
  assert.ok(redirect.includes("globalRoles.includes('MASTER_ADMIN')"));
  assert.ok(redirect.includes("globalRoles.includes('COMMISSION_PRESIDENT')"));
  assert.ok(redirect.includes("? 'configuracoes'"));
  assert.ok(redirect.includes("? 'coordenador'"));
  assert.ok(redirect.includes(": 'meus-processos'"));
  assert.ok(!redirect.includes('MutationObserver'));
  assert.ok(!redirect.includes('querySelector'));
});

test('engrenagem permite colunas para usuário comum e persiste por e-mail e planilha',async()=>{
  const settings=await source('src/components/HeaderSettingsPopover.tsx');
  assert.ok(settings.includes('portal_user_table_config_'));
  assert.ok(settings.includes("const isMaster=globalRoles.includes('MASTER_ADMIN')"));
  assert.ok(settings.includes('const canManageColumns=Boolean(storageKey'));
  assert.ok(settings.includes('Colunas e ordem'));
  assert.ok(settings.includes('localStorage.setItem(currentPreferenceKey'));
  assert.ok(settings.includes('localStorage.removeItem(currentPreferenceKey)'));
  assert.ok(settings.includes('Definir padrão'));
});

test('acabamento visual usa identidade canônica sem overrides globais',async()=>{
  const css=await readPortalCss();
  assert.match(css,/--portal-sidebar-active:\s*#154d41/);
  assert.match(css,/--portal-danger:\s*#991b1b/);
  assert.doesNotMatch(css,/!important/);
});
