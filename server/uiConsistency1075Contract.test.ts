import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('modal de acesso usa cabeçalho institucional e ícone branco sem cápsula', () => {
  const home = read('src/pages/HomePage.tsx');
  assert.match(home, /portal-modal-header border-b/);
  assert.match(home, /<GraduationCap className="h-5 w-5 shrink-0 text-white"/);
  assert.doesNotMatch(home, />🎓<|currentTheme\.headerBg|cardBgColor \?/);
  assert.match(home, /className="portal-modal-header-close"/);
});

test('chips de filtro usam somente a geometria canônica', () => {
  const css = read('src/styles/portal-components.css');
  const tutorial = read('src/pages/PortalTutorialPage.tsx');
  assert.match(css, /\.portal-table-filter-chip > span[\s\S]*align-items: center/);
  assert.doesNotMatch(tutorial, /portal-table-filter-chip[^"]*px-3|portal-table-filter-chip[^"]*py-1/);
});

test('engrenagem usa layout compacto e mantém Definir padrão restrito ao Master', () => {
  const component = read('src/components/HeaderSettingsPopover.tsx');
  const css = read('src/styles/portal-components.css');
  assert.match(component, /portal-settings-page-size-options/);
  assert.match(component, /portal-settings-date-grid/);
  assert.match(component, /isMaster&&<button[^>]*portal-popup-action[^>]*>[\s\S]*Definir padrão/);
  assert.match(component, /portal-settings-close-button/);
  assert.match(css, /\.portal-table-settings-popover \{[\s\S]*620px/);
  assert.match(css, /\.portal-settings-page-size-options \{[\s\S]*flex-wrap: nowrap/);
});

test('menu de coluna é compacto e possui ação concluir verde', () => {
  const css = read('src/styles/portal-components.css');
  assert.match(css, /\.portal-core-column-popup \{[\s\S]*300px/);
  assert.match(css, /\.portal-core-menu-action \{[\s\S]*font-size: 10px/);
  assert.match(css, /\.portal-core-done \{[\s\S]*background: var\(--portal-brand-header\)/);
});

test('ações internas de configuração usam verde institucional e não caixa alta', () => {
  const css = read('src/styles/portal-components.css');
  const commission = read('src/components/CommissionIdentityPanel.tsx');
  const audit = read('src/components/AuditAndSecuritySection.tsx');
  assert.match(css, /\.portal-popup-action \{[\s\S]*text-transform: none/);
  assert.match(commission, /const actionClass = 'portal-popup-action/);
  assert.match(audit, /className="portal-popup-action/);
});

test('lista da Comissão usa superfície do popup e mantém branco nos campos e lixeira', () => {
  const commission = read('src/components/CommissionIdentityPanel.tsx');
  assert.match(commission, /bg-\[var\(--portal-surface-panel\)\]/);
  assert.match(commission, /const inputClass = '[^']*bg-white/);
  assert.match(commission, /bg-white p-1\.5 text-rose-700/);
});

test('release é 1.0.75', () => {
  assert.equal(JSON.parse(read('package.json')).version, '1.0.75');
});
