import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('release 1.0.43 substitui enhancers concorrentes por um runtime estrutural único',()=>{
  const pkg=JSON.parse(read('package.json'));
  const main=read('src/main.tsx');
  assert.equal(pkg.version,'1.0.43');
  assert.match(main,/PortalStructuralRuntime/);
  assert.match(main,/portal-core-1043\.css/);
  assert.doesNotMatch(main,/PortalSpreadsheetEnhancer/);
  assert.doesNotMatch(main,/PortalMaintenanceEnhancer/);
  assert.doesNotMatch(main,/PortalVersion1041Enhancer/);
  assert.doesNotMatch(main,/PortalVersion1042Enhancer/);
});

test('tabelas têm um único menu Excel-like, resize e quebra de texto',()=>{
  const runtime=read('src/components/PortalStructuralRuntime.tsx');
  assert.match(runtime,/portal-core-column-menu/);
  assert.match(runtime,/Ordenar A → Z \/ menor → maior/);
  assert.match(runtime,/Ordenar Z → A \/ maior → menor/);
  assert.match(runtime,/Selecionar tudo/);
  assert.match(runtime,/Limpar tudo/);
  assert.match(runtime,/Limpar filtro/);
  assert.match(runtime,/portal-core-resizer/);
  assert.match(runtime,/Quebra de texto/);
  assert.match(runtime,/Quebrar texto/);
  assert.match(runtime,/Uma linha/);
});

test('padrão visual usa 12px para seções, 16px para cabeçalhos e texto preto',()=>{
  const css=read('src/portal-core-1043.css');
  assert.match(css,/--portal-separator-section: 12px/);
  assert.match(css,/--portal-separator-table: 16px/);
  assert.match(css,/border-bottom: var\(--portal-separator-table\) solid #fff !important/);
  assert.match(css,/color: #000 !important/);
});

test('paleta de calendário e processo é compartilhada e não fluorescente',()=>{
  const css=read('src/portal-core-1043.css');
  assert.match(css,/--portal-defended-bg: #c2d0c2/);
  assert.match(css,/--portal-defended-border: #7e907e/);
  assert.match(css,/--portal-upcoming-bg: #d8c58e/);
  assert.match(css,/--portal-upcoming-border: #a38a4b/);
  assert.match(css,/td\[data-portal-core-process-state="defended"\]/);
  assert.match(css,/portal-core-calendar-card\.is-defended/);
});

test('calendário bloqueia fins de semana e preserva popup nativo por clique do dia',()=>{
  const runtime=read('src/components/PortalStructuralRuntime.tsx');
  const home=read('src/pages/HomePage.tsx');
  const css=read('src/portal-core-1043.css');
  assert.match(runtime,/weekday === 0 \|\| weekday === 6/);
  assert.match(runtime,/portal-core-calendar-weekend/);
  assert.match(css,/background: #f8fafc !important/);
  assert.match(css,/grid-template-columns: \.22fr 1\.356fr 1\.356fr 1\.356fr 1\.356fr 1\.356fr \.22fr/);
  assert.match(home,/setSelectedDayDefenses\(dayDefenses\.length > 0 \? dayDefenses : null\)/);
  assert.match(home,/id="day-defenses-modal"/);
  assert.match(home,/selectedDayDefenses\.map/);
});

test('fluxo do TCC usa caminho responsivo em minhoca',()=>{
  const flow=read('src/pages/FluxoTccPage.tsx');
  const css=read('src/portal-core-1043.css');
  assert.match(flow,/max-w-none/);
  assert.match(flow,/portal-flow-snake/);
  assert.match(flow,/portal-flow-step/);
  assert.match(css,/grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css,/nth-child\(4\)::before/);
  assert.match(css,/content: '↓'/);
});

test('replicar portal mantém somente download agregado dos modelos',()=>{
  const page=read('src/pages/PortalReplicationPage.tsx');
  assert.match(page,/replication-models\/all\/download/);
  assert.doesNotMatch(page,/models\.map/);
});