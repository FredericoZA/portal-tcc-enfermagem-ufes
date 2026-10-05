import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { readPortalCss } from './testUtils/portalCss';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('release 1.0.45 preserva o runtime estrutural único consolidado',()=>{
  const main=read('src/main.tsx');
  assert.match(main,/PortalSpreadsheetRuntime/);
  assert.doesNotMatch(main,/PortalStructuralRuntime/);
  assert.match(main,/import '\.\/index\.css'/);
  assert.doesNotMatch(main,/PortalSpreadsheetEnhancer/);
  assert.doesNotMatch(main,/PortalMaintenanceEnhancer/);
  assert.doesNotMatch(main,/PortalVersion1041Enhancer/);
  assert.doesNotMatch(main,/PortalVersion1042Enhancer/);
});

test('tabelas têm um único menu Excel-like, resize e quebra de texto',()=>{
  const runtime=read('src/utils/portalTableDom.ts');
  const settings=read('src/components/HeaderSettingsPopover.tsx');
  assert.match(runtime,/portal-core-column-menu/);
  assert.match(runtime,/Ordenar A → Z \/ menor → maior/);
  assert.match(runtime,/Ordenar Z → A \/ maior → menor/);
  assert.match(runtime,/Selecionar tudo/);
  assert.match(runtime,/Limpar tudo/);
  assert.match(runtime,/Limpar filtro/);
  assert.match(runtime,/portal-core-resizer/);
  assert.match(settings,/Quebra de texto/);
  assert.match(settings,/Quebrar texto/);
  assert.match(settings,/Uma linha/);
});

test('separadores usam apenas 5px e 15px do contrato canônico',()=>{
  const css=readPortalCss();
  assert.match(css,/--portal-sheet-title-divider:\s*5px/);
  assert.match(css,/--portal-sheet-content-divider:\s*15px/);
  assert.match(css,/border-top:\s*var\(--portal-sheet-title-divider\)/);
  assert.match(css,/border-bottom:\s*var\(--portal-sheet-content-divider\)/);
});

test('paleta de calendário e processo é compartilhada e não fluorescente',()=>{
  const css=readPortalCss();
  assert.match(css,/--portal-defense-defended-bg:\s*#bed8c3/);
  assert.match(css,/--portal-defense-defended-border:\s*#719a79/);
  assert.match(css,/--portal-defense-upcoming-bg:\s*#e8dda7/);
  assert.match(css,/--portal-defense-upcoming-border:\s*#b49d4f/);
  assert.match(css,/td\[data-portal-core-process-state="defended"\]/);
  assert.match(css,/portal-core-calendar-card\.is-defended/);
});

test('calendário remove fins de semana da grade e preserva popup nativo por clique do dia',()=>{
  const runtime=read('src/utils/portalTableDom.ts');
  const home=read('src/pages/HomePage.tsx');
  assert.match(home,/const businessDays = Array\.from/);
  assert.match(home,/dayOfWeek >= 1 && dayOfWeek <= 5/);
  assert.match(home,/businessDays\.map/);
  assert.doesNotMatch(home,/portal-core-calendar-weekend|<div>DOM<\/div>|<div>SÁB<\/div>/);
  assert.doesNotMatch(runtime,/enhanceCalendar|weekday === 0/);
  assert.match(home,/setSelectedDayDefenses\(dayDefenses\.length > 0 \? dayDefenses : null\)/);
  assert.match(home,/id="day-defenses-modal"/);
  assert.match(home,/selectedDayDefenses\.map/);
});

test('fluxo do TCC usa caminho responsivo em minhoca',()=>{
  const flow=read('src/pages/FluxoTccPage.tsx');
  const css=readPortalCss();
  assert.match(flow,/max-w-none/);
  assert.match(flow,/portal-flow-snake/);
  assert.match(flow,/portal-flow-step/);
  assert.match(css,/grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css,/nth-child\(4\)::before/);
  assert.match(css,/content:\s*["']↓["']/);
});

test('replicar portal mantém somente download agregado dos modelos',()=>{
  const page=read('src/pages/PortalReplicationPage.tsx');
  assert.match(page,/replication-models\/all\/download/);
  assert.doesNotMatch(page,/models\.map/);
});