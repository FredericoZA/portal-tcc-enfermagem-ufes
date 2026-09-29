import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('hotfix visual é carregado depois da camada estrutural', () => {
  const main = read('src/main.tsx');
  const coreIndex = main.indexOf("import './portal-core-1043.css'");
  const hotfixIndex = main.indexOf("import './portal-hotfix-separators-palette.css'");
  assert.ok(coreIndex >= 0);
  assert.ok(hotfixIndex > coreIndex);
});

test('separadores efetivos ficam em 16px sem somar bordas legadas à primeira linha', () => {
  const css = read('src/portal-hotfix-separators-palette.css');
  assert.match(css, /--portal-separator-section: 16px/);
  assert.match(css, /--portal-separator-table: 16px/);
  assert.match(css, /\.portal-core-table thead \{[\s\S]*?border-top: 0 !important;[\s\S]*?border-bottom: 0 !important;/);
  assert.match(css, /tbody tr:first-child > td \{[\s\S]*?border-top: 0 !important;[\s\S]*?box-shadow: none !important;/);
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