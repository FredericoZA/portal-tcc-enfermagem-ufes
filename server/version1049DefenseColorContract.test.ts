import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Lista de Defesas recebe o estado temporal canônico no próprio botão do processo', () => {
  const home = read('src/pages/HomePage.tsx');
  assert.match(home, /<section id="public-calendar-cards-section"/);
  assert.match(home, /const defenseState = getDefenseState\(proc\)/);
  assert.match(home, /className=\{`\$\{defStyles\.firstColBtnClass\} portal-semantic-tone`\}/);
  assert.match(home, /style=\{getPortalToneCssVars\(defenseState\)\}/);
  assert.match(home, /data-defense-state=\{defenseState\}/);
});

test('estado temporal depende somente do início da defesa comparado ao agora', () => {
  const semantics = read('src/utils/defenseSemantics.ts');
  assert.match(semantics, /return start !== null && start < now \? 'defended' : 'upcoming'/);
  assert.match(semantics, /return getDefenseStateFromTimes\(process\.defesa\?\.startAt, process\.defesa\?\.endAt, now\)/);
});

test('CSS 1.0.50 aponta para a seção real da Lista de Defesas', () => {
  const css = read('src/portal-version-1050.css');
  assert.match(css, /#public-calendar-cards-section \.portal-core-table tbody td > \.portal-semantic-tone\[data-defense-state="defended"\]/);
  assert.match(css, /background-color: var\(--portal-defense-defended-bg, #bed8c3\) !important/);
  assert.match(css, /#public-calendar-cards-section \.portal-core-table tbody td > \.portal-semantic-tone\[data-defense-state="upcoming"\]/);
  assert.match(css, /background-color: var\(--portal-defense-upcoming-bg, #e8dda7\) !important/);
});

test('camada 1.0.50 é carregada depois da correção 1.0.49 e das folhas legadas', () => {
  const main = read('src/main.tsx');
  const v50 = main.indexOf("portal-version-1050.css");
  assert.ok(v50 > main.indexOf('portal-version-1049.css'));
  assert.ok(v50 > main.indexOf('portal-version-1046.css'));
  assert.ok(v50 > main.indexOf('portal-process-detail.css'));
  assert.ok(v50 > main.indexOf('portal-hotfix-separators-palette.css'));
});
