import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tokens = readFileSync(new URL('../src/portal-tokens.css', import.meta.url), 'utf8').toLowerCase();
const docs = readFileSync(new URL('../docs/ARQUITETURA_VISUAL_CANONICA.md', import.meta.url), 'utf8').toLowerCase();

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
  const matches = tokens.match(/--ptcc-surface-(page|panel|card|inner):/g) || [];
  assert.equal(matches.length, 4);
});

test('sidebar e rodapé compartilham um único token', () => {
  assert.match(tokens, /--ptcc-sidebar-footer:\s*#011f17/);
});

test('sticky possui três níveis explícitos', () => {
  assert.match(tokens, /--ptcc-z-sticky-column:\s*30/);
  assert.match(tokens, /--ptcc-z-sticky-header:\s*40/);
  assert.match(tokens, /--ptcc-z-sticky-intersection:\s*60/);
});
