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
  assert.match(runtime,/portal-core-filter-hidden/);
});

test('progresso é apresentado como etapa regular',()=>{
  const runtime=read('src/components/PortalStructuralRuntime.tsx');
  const css=read('src/portal-core-1043.css');
  assert.match(runtime,/replace\(\/\\bProgresso\\b\/gi, 'Etapa'\)/);
  assert.match(runtime,/marker\.textContent = `Etapa \$\{match\[1\]/);
  assert.match(css,/portal-core-stage-label/);
  assert.match(css,/font-weight: 400 !important/);
});

test('calendário reserva fins de semana estreitos e indisponíveis para defesas',()=>{
  const runtime=read('src/components/PortalStructuralRuntime.tsx');
  const css=read('src/portal-core-1043.css');
  assert.match(runtime,/weekday === 0 \|\| weekday === 6/);
  assert.match(css,/grid-template-columns: \.22fr 1\.356fr 1\.356fr 1\.356fr 1\.356fr 1\.356fr \.22fr/);
  assert.match(css,/portal-core-calendar-weekend/);
  assert.match(css,/background: #f8fafc !important/);
});

test('planilhas têm separadores, texto preto e hover neutro',()=>{
  const runtime=read('src/components/PortalStructuralRuntime.tsx');
  const css=read('src/portal-core-1043.css');
  assert.match(css,/--portal-separator-table: 16px/);
  assert.match(css,/--portal-separator-section: 12px/);
  assert.match(css,/color: #000 !important/);
  assert.match(runtime,/stripHoverRules/);
  assert.match(runtime,/token\.startsWith\('hover:'\)/);
});

test('camadas incrementais conflitantes não são montadas',()=>{
  const main=read('src/main.tsx');
  assert.match(main,/PortalStructuralRuntime/);
  assert.doesNotMatch(main,/PortalSpreadsheetEnhancer/);
  assert.doesNotMatch(main,/PortalMaintenanceEnhancer/);
  assert.doesNotMatch(main,/PortalVersion1041Enhancer/);
  assert.doesNotMatch(main,/PortalVersion1042Enhancer/);
});