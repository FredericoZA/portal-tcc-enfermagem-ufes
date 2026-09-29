import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Lista de Defesas recebe o estado temporal canônico no próprio botão do processo', () => {
  const home = read('src/pages/HomePage.tsx');
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

test('CSS 1.0.49 faz o estado React vencer qualquer marcação legada conflitante do TD', () => {
  const css = read('src/portal-version-1049.css');
  assert.match(css, /td\[data-portal-core-process-state="upcoming"\] > \.portal-semantic-tone\[data-defense-state="defended"\]/);
  assert.match(css, /background-color: var\(--portal-defense-defended-bg, #bed8c3\) !important/);
  assert.match(css, /td\[data-portal-core-process-state="defended"\] > \.portal-semantic-tone\[data-defense-state="upcoming"\]/);
  assert.match(css, /background-color: var\(--portal-defense-upcoming-bg, #e8dda7\) !important/);
});

test('camada 1.0.49 é carregada depois de todas as folhas que poderiam disputar a primeira coluna', () => {
  const main = read('src/main.tsx');
  const v49 = main.indexOf("portal-version-1049.css");
  assert.ok(v49 > main.indexOf('portal-version-1046.css'));
  assert.ok(v49 > main.indexOf('portal-process-detail.css'));
  assert.ok(v49 > main.indexOf('portal-hotfix-separators-palette.css'));
});
