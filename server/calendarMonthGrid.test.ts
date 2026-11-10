import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCalendarMonthGrid,CALENDAR_WEEKDAY_LABELS} from '../src/utils/calendarMonthGrid';

const saturday='2026-11-07T14:00:00-03:00',sunday='2026-11-08T14:00:00-03:00';
test('segunda a sexta permanecem sempre visíveis, mesmo no mês vazio',()=>{
  const grid=buildCalendarMonthGrid(2026,10,[]);
  assert.deepEqual(grid.weekdays,[1,2,3,4,5]);assert.equal(grid.leading,0);assert.equal(grid.days[0],2);assert.equal(grid.days.at(-1),30);
  assert.ok(grid.days.every(day=>{const week=new Date(2026,10,day).getDay();return week>=1&&week<=5;}));
});
test('sábado e domingo são colunas independentes; grade permanece alinhada',()=>{
  for(const [starts,expected] of [
    [[saturday],[1,2,3,4,5,6]],[[sunday],[1,2,3,4,5,0]],[[saturday,sunday],[1,2,3,4,5,6,0]],
  ] as const){
    const grid=buildCalendarMonthGrid(2026,10,starts);
    assert.deepEqual(grid.weekdays,expected);
    assert.equal((grid.leading+grid.days.length+grid.trailing)%expected.length,0);
    grid.days.forEach((day,index)=>assert.equal(grid.weekdays[(grid.leading+index)%expected.length],new Date(2026,10,day).getDay()));
    assert.equal(grid.gridTemplateColumns,`repeat(${expected.length}, minmax(0, 1fr))`);
  }
  assert.equal(CALENDAR_WEEKDAY_LABELS[6],'Sáb');assert.equal(CALENDAR_WEEKDAY_LABELS[0],'Dom');
});
test('eventos de outro mês e datas inválidas não acrescentam colunas ao mês atual',()=>{
  assert.deepEqual(buildCalendarMonthGrid(2026,10,['2026-12-05T14:00:00-03:00','invalid']).weekdays,[1,2,3,4,5]);
});
test('calendário inicial e seletor de reserva usam a grade de dias úteis',()=>{
  assert.match(readFileSync('src/pages/HomePage.tsx','utf8'),/buildCalendarMonthGrid\(year,month,\[\]\)/);
  assert.match(readFileSync('src/components/ReservationCalendarPicker.tsx','utf8'),/buildCalendarMonthGrid\(firstDay.getUTCFullYear\(\),firstDay.getUTCMonth\(\),\[\]\)/);
});
