import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('escala tipográfica global: somente 18px, 14px e 11px',()=>{
  const tokens=read('src/styles/portal-tokens.css');
  const scale=read('src/styles/portal-responsive.css');
  const index=read('src/index.css');
  assert.equal(index.trim().split('\n').filter(x=>x.startsWith('@import')).length,7);
  assert.match(tokens,/--portal-sheet-title-font-size:\s*18px/);
  assert.match(tokens,/--portal-sidebar-nav-font-size:\s*14px/);
  assert.match(tokens,/--portal-sheet-body-font-size:\s*11px/);
  assert.match(tokens,/--portal-font-size-small:\s*11px/);
  assert.match(scale,/body #portal-app-root \*/);
  assert.match(scale,/font-size:\s*var\(--portal-type-content\)/);
  assert.match(scale,/#sidebar-nav \*/);
  assert.match(scale,/font-size:\s*var\(--portal-type-navigation\)/);
  assert.match(scale,/font-size:\s*var\(--portal-type-title\)/);
  const typeValues=[...tokens.matchAll(/--portal-type-(?:title|navigation|content):\s*(\d+)px/g)].map(x=>Number(x[1])).sort((a,b)=>a-b);
  assert.deepEqual(typeValues,[11,14,18]);
  assert.doesNotMatch(scale, /!important/);
});

test('espaçamento comum usa tokens e preserva geometria de planilhas',()=>{
  const scale=read('src/styles/portal-responsive.css');
  const tokens=read('src/styles/portal-tokens.css');
  for(const value of [4,8,12,16])assert.match(tokens,new RegExp('--portal-space-[\\w-]+:\\s*'+value+'px'));
  for(const [name,px] of [['--portal-sheet-title-height',45],['--portal-sheet-filter-height',45],['--portal-sheet-column-header-height',35]]){
    assert.match(tokens,new RegExp(name+':\\s*'+px+'px'));
  }
});
