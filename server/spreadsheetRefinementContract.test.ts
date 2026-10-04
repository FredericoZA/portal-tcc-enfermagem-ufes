import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('planilhas usam um único menu por coluna para ordenar e filtrar',()=>{
  const runtime=read('src/components/PortalStructuralRuntime.tsx');
  assert.match(runtime,/portal-core-column-menu/);
  assert.match(runtime,/Ordenar A → Z \/ menor → maior/);
  assert.match(runtime,/Ordenar Z → A \/ maior → menor/);
  assert.match(runtime,/Selecionar tudo/);
  assert.match(runtime,/Limpar tudo/);
});

test('progresso é apresentado como etapa regular sem depender de CSS versionado',()=>{
  const runtime=read('src/components/PortalStructuralRuntime.tsx');
  const css=read('src/index.css');
  assert.match(runtime,/replace\(\/\\bProgresso\\b\/gi, 'Etapa'\)/);
  assert.match(runtime,/marker\.textContent = `Etapa \$\{match\[1\]/);
  assert.match(css,/portal-core-stage-label/);
});

test('calendário usa a mesma família de superfícies do contrato global',()=>{
  const css=read('src/index.css');
  assert.match(css,/\.portal-calendar-empty-cell[\s\S]*var\(--portal-surface-panel\)/);
  assert.match(css,/\.portal-calendar-day-cell[\s\S]*var\(--portal-surface-card\)/);
  assert.match(css,/--portal-brand-header:\s*#005830/);
});

test('planilhas usam separadores e densidade canônicos',()=>{
  const css=read('src/index.css');
  assert.match(css,/--portal-sheet-title-divider:\s*5px/);
  assert.match(css,/--portal-sheet-content-divider:\s*15px/);
  assert.match(css,/--portal-sheet-row-min-height:\s*30px/);
  assert.match(css,/color:\s*var\(--portal-text-dark\)/);
});

test('camadas incrementais conflitantes não são montadas',()=>{
  const main=read('src/main.tsx');
  assert.match(main,/PortalStructuralRuntime/);
  assert.doesNotMatch(main,/PortalSpreadsheetEnhancer/);
  assert.doesNotMatch(main,/PortalMaintenanceEnhancer/);
  assert.doesNotMatch(main,/PortalVersion1041Enhancer/);
  assert.doesNotMatch(main,/PortalVersion1042Enhancer/);
  const cssImports=[...main.matchAll(/import ['"]\.\/([^'"]+\.css)['"];/g)].map(m=>m[1]);
  assert.deepEqual(cssImports,['index.css']);
});
