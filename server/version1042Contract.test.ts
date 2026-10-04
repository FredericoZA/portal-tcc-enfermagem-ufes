import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('camadas históricas são sucedidas por uma única folha visual',()=>{
  const main=read('src/main.tsx');
  assert.match(main,/PortalStructuralRuntime/);
  assert.match(main,/import '\.\/index\.css'/);
  assert.doesNotMatch(main,/portal-core-|portal-version-|portal-update-|hotfix/);
});

test('defesas passadas mantêm contraste integral e processo usa paleta do calendário',()=>{
  const runtime=read('src/components/PortalStructuralRuntime.tsx');
  const css=read('src/index.css');
  assert.match(runtime,/row\.classList\.remove\('bg-slate-100\/40', 'text-slate-400', 'opacity-60'\)/);
  assert.match(css,/--portal-defense-defended-bg:\s*#bed8c3/);
  assert.match(css,/--portal-defense-defended-border:\s*#719a79/);
  assert.match(css,/--portal-defense-upcoming-bg:\s*#e8dda7/);
  assert.match(css,/--portal-defense-upcoming-border:\s*#b49d4f/);
});

test('todas as tabelas recebem separação branca pelo padrão estrutural',()=>{
  const runtime=read('src/components/PortalStructuralRuntime.tsx');
  const css=read('src/index.css');
  assert.match(runtime,/table\.classList\.add\('portal-core-table'\)/);
  assert.match(css,/--portal-sheet-title-divider:\s*5px/);
  assert.match(css,/--portal-sheet-content-divider:\s*15px/);
});
