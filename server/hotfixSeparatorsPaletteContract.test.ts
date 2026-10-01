import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('camada final de auditoria é carregada depois do hotfix histórico', () => {
  const main = read('src/main.tsx');
  const coreIndex = main.indexOf("import './portal-core-1043.css'");
  const hotfixIndex = main.indexOf("import './portal-hotfix-separators-palette.css'");
  const auditIndex = main.indexOf("import './portal-backlog-audit-1055.css'");
  assert.ok(coreIndex >= 0);
  assert.ok(hotfixIndex > coreIndex);
  assert.ok(auditIndex > hotfixIndex);
});

test('separadores efetivos ficam em 4px sem somar bordas legadas à primeira linha', () => {
  const legacyCss = read('src/portal-hotfix-separators-palette.css');
  const finalCss = read('src/portal-backlog-audit-1055.css');
  assert.match(legacyCss, /--portal-separator-section: 16px/);
  assert.match(legacyCss, /--portal-separator-table: 16px/);
  assert.match(finalCss, /--portal-separator-section:\s*4px/);
  assert.match(finalCss, /--portal-separator-table:\s*4px/);
  assert.match(finalCss, /tbody tr:first-child > td[\s\S]*?border-top:\s*0 !important/);
  assert.ok(
    finalCss.indexOf('--portal-separator-section: 4px') > -1,
    'a camada final deve neutralizar a faixa histórica de 16px',
  );
});

test('processos e calendário compartilham verde e amarelo foscos', () => {
  const css = read('src/portal-hotfix-separators-palette.css');
  assert.match(css, /--portal-defended-bg: #bed8c3/);
  assert.match(css, /--portal-defended-border: #719a79/);
  assert.match(css, /--portal-upcoming-bg: #e8dda7/);
  assert.match(css, /--portal-upcoming-border: #b49d4f/);
  assert.match(css, /data-defense-state="defended"/);
  assert.match(css, /data-defense-state="upcoming"/);
  assert.match(css, /portal-core-calendar-card\.is-defended/);
  assert.match(css, /portal-core-calendar-card\.is-upcoming/);
});