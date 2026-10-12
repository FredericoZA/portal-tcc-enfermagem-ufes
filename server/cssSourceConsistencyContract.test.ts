import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string): string => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const stylesheets = [
  'portal-tokens.css',
  'portal-layout.css',
  'portal-components.css',
  'portal-sheet.css',
  'portal-pages.css',
  'portal-responsive.css',
] as const;

test('CSS possui uma única entrada com módulos por responsabilidade', () => {
  const index = read('src/index.css');
  const imports = [...index.matchAll(/^@import\s+["']([^"']+)["'];/gm)].map(match => match[1]);
  assert.deepEqual(imports, ['tailwindcss', ...stylesheets.map(name => './styles/' + name)]);
  // Não concatenar manualmente CSS: a compilação Vite agrupa e otimiza o asset final.
});

test('CSS legado não redefine fontes fora da escala 18/14/11', () => {
  const tokens = read('src/styles/portal-tokens.css');
  for (const [role, px] of [['title', 18], ['navigation', 14], ['content', 11]] as const) {
    assert.match(tokens, new RegExp('--portal-type-' + role + ':\\s*' + px + 'px'));
  }
  for (const name of stylesheets) {
    const css = read('src/styles/' + name);
    const literals = [...css.matchAll(/font-size:\s*([0-9]+(?:\.[0-9]+)?)px\s*;/g)].map(m => Number(m[1]));
    for (const size of literals) {
      // Única exceção: 16px em campos de entrada mobile/iOS, para evitar zoom no foco.
      assert.ok([11, 14, 18].includes(size) || (name === 'portal-responsive.css' && size === 16),
        name + ': fonte literal obsoleta de ' + size + 'px');
    }
    assert.doesNotMatch(css, /!important\b/, name + ': evitar cascata de remendos !important');
  }
});
