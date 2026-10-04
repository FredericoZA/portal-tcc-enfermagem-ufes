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

test('CSS canônico aponta para os estados reais da Lista de Defesas', () => {
  const css = read('src/index.css');
  assert.match(css, /data-defense-state="defended"/);
  assert.match(css, /background:\s*var\(--portal-defense-defended-bg\)/);
  assert.match(css, /data-defense-state="upcoming"/);
  assert.match(css, /background:\s*var\(--portal-defense-upcoming-bg\)/);
});

test('não existe mais ordem de precedência entre folhas legadas', () => {
  const main = read('src/main.tsx');
  const imports = [...main.matchAll(/import ['"]\.\/([^'"]+\.css)['"];/g)].map((match) => match[1]);
  assert.deepEqual(imports, ['index.css']);
});
