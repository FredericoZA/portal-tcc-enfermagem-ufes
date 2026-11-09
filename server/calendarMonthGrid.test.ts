import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {buildCalendarMonthGrid,CALENDAR_WEEKDAY_LABELS} from '../src/utils/calendarMonthGrid';
import {calendarLocationKey,matchesCalendarLocation,calendarGoogleEventLocation,calendarStandaloneGoogleEvents} from '../src/utils/calendarDefenseLocations';
import {isDefenseOnCalendar} from '../src/utils/defenseReservationState';

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
test('código real da grade respeita local, recusa e deduplicação Google antes de mostrar fins de semana',()=>{
  const processes:any[]=[
    {id:'sat',protocolo:'TCC - 00001',titulo:'Título A',aluno1:{nome:'Ana Silva'},defesa:{startAt:saturday,local:'Sala A',localStatus:'CONFIRMADO'}},
    {id:'sun',protocolo:'TCC - 00002',titulo:'Título B',aluno1:{nome:'Bia Silva'},defesa:{startAt:sunday,local:'Sala B',localStatus:'PENDENTE'}},
    {id:'refused',protocolo:'TCC - 00003',defesa:{startAt:saturday,local:'Sala B',localStatus:'RECUSADO'}},
  ];
  const google:any[]=[{id:'gcal-sat',start:saturday,description:'Local: Sala B'}];
  const source=readFileSync('src/pages/HomePage.tsx','utf8');
  const start=source.indexOf('  const calendarStarts='),end=source.indexOf('  const monthNamesPt =',start);
  const code=ts.transpileModule(`(function(){${source.slice(start,end)};return calendarGrid;})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const base={ownsCalendarData:true,filteredProcesses:processes,standaloneGoogleEvents:calendarStandaloneGoogleEvents(processes,google),isDefenseOnCalendar,matchesCalendarLocation,calendarGoogleEventLocation,buildCalendarMonthGrid,year:2026,month:10};
  assert.deepEqual(vm.runInNewContext(code,{...base,calendarLocations:[calendarLocationKey('Sala B')]}).weekdays,[1,2,3,4,5,0]);
  assert.deepEqual(vm.runInNewContext(code,{...base,calendarLocations:[calendarLocationKey('Sala A')]}).weekdays,[1,2,3,4,5,6]);
  assert.deepEqual(vm.runInNewContext(code,{...base,calendarLocations:null}).weekdays,[1,2,3,4,5,6,0]);
});
