import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('calendário usa tipografia canônica do Portal nos dias e controles',()=>{
  const page=read('src/pages/HomePage.tsx');
  const css=read('src/styles/portal-sheet.css');
  assert.match(page,/portal-calendar-weekdays-grid/);
  assert.doesNotMatch(page,/grid grid-cols-5 text-center font-black text-\[11px\] uppercase tracking-wider/);
  assert.match(css,/\.portal-calendar-weekdays-grid\s*\{[\s\S]*font-family:\s*var\(--portal-font-family\)/);
  assert.match(css,/\.portal-calendar-weekdays-grid\s*\{[\s\S]*font-size:\s*var\(--portal-sheet-column-font-size\)/);
  assert.match(css,/\.portal-calendar-weekdays-grid\s*\{[\s\S]*font-weight:\s*800/);
  assert.match(css,/\.portal-calendar-period-button,[\s\S]*font-family:\s*var\(--portal-font-family\)/);
});
