import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { readPortalCss } from './testUtils/portalCss';
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('não existe hotfix visual carregado em runtime', () => {
  const main = read('src/main.tsx');
  const imports = [...main.matchAll(/import ['"]\.\/([^'"]+\.css)['"];/g)].map((match) => match[1]);
  assert.deepEqual(imports, ['index.css']);
  assert.doesNotMatch(main, /hotfix|portal-update-|portal-version-|portal-core-/);
});

test('separadores são definidos uma única vez no CSS canônico', () => {
  const css = readPortalCss();
  assert.match(css, /--portal-sheet-title-divider:\s*5px/);
  assert.match(css, /--portal-sheet-content-divider:\s*15px/);
  assert.match(css, /border-top:\s*var\(--portal-sheet-title-divider\)/);
  assert.match(css, /border-bottom:\s*var\(--portal-sheet-content-divider\)/);
});

test('processos e calendário compartilham a mesma paleta semântica', () => {
  const css = readPortalCss();
  assert.match(css, /--portal-defense-defended-bg:\s*#bed8c3/);
  assert.match(css, /--portal-defense-upcoming-bg:\s*#e8dda7/);
  assert.match(css, /portal-core-calendar-card\.is-defended/);
  assert.match(css, /data-defense-state="defended"/);
});
