import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').toLowerCase();

const entrypoint = read('../src/index.css');
const tokens = read('../src/styles/portal-tokens.css');
const layout = read('../src/styles/portal-layout.css');
const components = read('../src/styles/portal-components.css');
const sheets = read('../src/styles/portal-sheet.css');
const pages = read('../src/styles/portal-pages.css');
const responsive = read('../src/styles/portal-responsive.css');
const themeBridge = read('../src/constants/theme.ts');
const docs = read('../docs/ARQUITETURA_VISUAL_CANONICA.md');

const required = [
  '#f1f5f9', '#e1e6e9', '#d5dce0', '#ffffff',
  '#005830', '#337959', '#011f17', '#154d41',
  '45px', '5px', '15px', '35px', '30px', '24px'
];

test('fundação visual contém a paleta e a geometria aprovadas', () => {
  for (const value of required) {
    assert.ok(tokens.includes(value), `token obrigatório ausente: ${value}`);
    assert.ok(docs.includes(value.replace('px','')) || docs.includes(value), `documentação não registra: ${value}`);
  }
});

test('tokens mantêm exatamente quatro superfícies estruturais', () => {
  const matches = tokens.match(/--portal-surface-(page|panel|card|inner):/g) || [];
  assert.equal(matches.length, 4);
});

test('sidebar e rodapé compartilham um único token', () => {
  assert.match(tokens, /--portal-sidebar-footer:\s*#011f17/);
});

test('sticky possui três níveis explícitos', () => {
  assert.match(tokens, /--portal-z-sticky-column:\s*30/);
  assert.match(tokens, /--portal-z-sticky-header:\s*40/);
  assert.match(tokens, /--portal-z-sticky-corner:\s*60/);
});

test('entrypoint visual só compõe as folhas canônicas', () => {
  const expected = [
    './styles/portal-tokens.css',
    './styles/portal-layout.css',
    './styles/portal-components.css',
    './styles/portal-sheet.css',
    './styles/portal-pages.css',
    './styles/portal-responsive.css',
  ];
  for (const path of expected) assert.ok(entrypoint.includes(path), `import canônico ausente: ${path}`);
  assert.equal((entrypoint.match(/@import/g) || []).length, 7);
});

test('paleta estrutural concreta existe apenas nos tokens', () => {
  const implementation = [layout, components, sheets, pages, responsive, themeBridge].join('\n');
  for (const hex of ['#f1f5f9', '#e1e6e9', '#d5dce0', '#005830', '#337959', '#011f17', '#154d41']) {
    assert.ok(!implementation.includes(hex), `cor estrutural hardcoded fora dos tokens: ${hex}`);
  }
});

test('bridge TypeScript de tema não define valores visuais', () => {
  assert.doesNotMatch(themeBridge, /#[0-9a-f]{3,8}\b/);
  assert.doesNotMatch(themeBridge, /\bbg-(?:slate|emerald|green|white|gray)-/);
  assert.doesNotMatch(themeBridge, /\btext-(?:slate|emerald|green|white|gray)-/);
  assert.match(themeBridge, /portal-theme-btn-primary/);
});
