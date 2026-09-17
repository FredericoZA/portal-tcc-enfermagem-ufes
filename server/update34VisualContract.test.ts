import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(process.cwd());
const source=(file:string)=>readFile(path.join(root,file),'utf8');

test('Atualização 34 aplica régua visual única às barras e sidebar',async()=>{
  const [main,css]=await Promise.all([source('src/main.tsx'),source('src/portal-update-34.css')]);
  assert.ok(main.includes("import './portal-update-34.css'"));
  assert.ok(css.includes('--portal-toolbar-divider-width:2px'));
  assert.ok(css.includes('--portal-toolbar-divider-color:#fff'));
  assert.ok(css.includes('#sidebar-nav .portal-sidebar-nav-active::before'));
  assert.ok(css.includes('top:0!important'));
  assert.ok(css.includes('bottom:0!important'));
  assert.ok(css.includes('background:#74FF96!important'));
  assert.ok(css.includes('#meus-processos-btn-novo'));
  assert.ok(css.includes('#coordenador-page-root .portal-sign-bulk-btn'));
});

test('Atualização 34 não introduz novas cores de superfície para o calendário',async()=>{
  const css=await source('src/portal-update-34.css');
  assert.ok(css.includes('--portal-sheet-surface:#f0f0f0'));
  assert.ok(css.includes('background:#e5e9ed!important'));
});
