import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('1.0.42 é sucedida por uma única camada estrutural',()=>{
  const main=read('src/main.tsx');
  assert.match(main,/PortalStructuralRuntime/);
  assert.match(main,/portal-core-1043\.css/);
  assert.doesNotMatch(main,/PortalVersion1042Enhancer/);
  assert.doesNotMatch(main,/portal-version-1042\.css/);
});

test('defesas passadas mantêm contraste integral e processo usa paleta do calendário',()=>{
  const runtime=read('src/components/PortalStructuralRuntime.tsx');
  const css=read('src/portal-core-1043.css');
  assert.match(runtime,/row\.classList\.remove\('bg-slate-100\/40', 'text-slate-400', 'opacity-60'\)/);
  assert.match(css,/#c2d0c2/);
  assert.match(css,/#7e907e/);
  assert.match(css,/#d8c58e/);
  assert.match(css,/#a38a4b/);
});

test('todas as tabelas recebem separação branca pelo padrão estrutural',()=>{
  const runtime=read('src/components/PortalStructuralRuntime.tsx');
  const css=read('src/portal-core-1043.css');
  assert.match(runtime,/table\.classList\.add\('portal-core-table'\)/);
  assert.match(css,/--portal-separator-table: 16px/);
  assert.match(css,/--portal-separator-section: 12px/);
});

test('package publica a versão 1.0.44',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'1.0.45');
});