import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';
import {synchronizeDefenseCalendar} from './googleWorkspace';
import type {ProcessData} from '../../src/types';

interface CalendarFixtureEvent {
  id:string;
  summary?:string;
  description?:string;
  location?:string;
  start?:{dateTime?:string;date?:string};
  end?:{dateTime?:string;date?:string};
  extendedProperties?:{private?:Record<string,string>;shared?:Record<string,string>};
}

function calendarFixture(t:TestContext,initial:CalendarFixtureEvent[],patchError?:string){
  const events=structuredClone(initial);
  const calls:Array<{method:string;path:string;body?:Record<string,unknown>}>=[];
  t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
    const url=new URL(String(input));
    assert.equal(url.origin,'https://www.googleapis.com');
    const method=init?.method||'GET';
    const body=init?.body?JSON.parse(String(init.body)):undefined;
    calls.push({method,path:url.pathname,body});
    const base='/calendar/v3/calendars/synthetic-calendar/events';
    if(method==='GET'&&url.pathname===base)return Response.json({items:structuredClone(events)});
    if(method==='POST'&&url.pathname===base){const created={id:`synthetic-event-${events.length+1}`,...body};events.push(created);return Response.json(created);}
    if(method==='PATCH'&&url.pathname.startsWith(base+'/')){
      if(patchError)throw new Error(patchError);
      const id=decodeURIComponent(url.pathname.slice(base.length+1));
      const index=events.findIndex(event=>event.id===id);assert.ok(index>=0);
      events[index]={...events[index],...body};return Response.json(events[index]);
    }
    throw new Error('Unexpected request in the isolated calendar fixture.');
  });
  return {events,calls};
}

function processFixture():ProcessData{
  const process=structuredClone(DEMO_PROCESSES[0]);
  process.id='stable-calendar-process';process.protocolo='TCC-2026-0001';process.previousProtocols=['TCC-2026-0006'];process.aluno2=null;
  process.defesa={startAt:'2026-12-07T17:00:00Z',endAt:'2026-12-07T18:30:00Z',local:'Sala de Teste',localStatus:'CONFIRMADO'};
  return process;
}

function eventFixture(process:ProcessData,protocol=process.protocolo,withProcessId=true):CalendarFixtureEvent{
  return {id:'existing-calendar-event',summary:`Defesa de TCC — ${process.aluno1.nome}`,description:[`Trabalho: ${process.titulo}`,`Orientador: ${process.orientador.nome}`,`Banca: ${process.banca.map(member=>member.nome).join(', ')}`,`Protocolo: ${protocol}`].join('\n'),location:process.defesa.local,
    start:{dateTime:process.defesa.startAt},end:{dateTime:process.defesa.endAt},
    extendedProperties:{private:{portalTccProtocol:protocol,...(withProcessId?{portalTccProcessId:process.id}:{}),calendarNote:'Preserve this value'},shared:{department:'synthetic'}}};
}

test('calendar renumbering updates the existing process event without creating a duplicate',async t=>{
  const process=processFixture();
  const fixture=calendarFixture(t,[eventFixture(process,'TCC-2026-0006')]);
  const input={accessToken:'synthetic-calendar-token',calendarId:'synthetic-calendar',processes:[process]};
  const result=await synchronizeDefenseCalendar(input);
  assert.equal(result.created,0);
  assert.equal(fixture.calls.filter(call=>call.method==='POST').length,0);
  assert.equal(fixture.calls.filter(call=>call.method==='PATCH').length,1);
  assert.equal(fixture.events.length,1);
  assert.equal(fixture.events[0].id,'existing-calendar-event');
  assert.equal(fixture.events[0].extendedProperties?.private?.portalTccProtocol,process.protocolo);
  assert.equal(fixture.events[0].extendedProperties?.private?.calendarNote,'Preserve this value');
  assert.equal(fixture.events[0].extendedProperties?.shared?.department,'synthetic');
  assert.match(fixture.events[0].description||'',/Protocolo: TCC-2026-0001/);
  assert.equal(result.events[0].portalTccProtocol,process.protocolo);
  fixture.calls.length=0;
  fixture.events[0].start={dateTime:'2026-12-07T14:00:00-03:00'};
  fixture.events[0].end={dateTime:'2026-12-07T15:30:00-03:00'};
  await synchronizeDefenseCalendar(input);
  assert.deepEqual(fixture.calls.map(call=>call.method),['GET']);
});

test('calendar compatibility binds an unassigned event only when its protocol, schedule and location agree',async t=>{
  const process=processFixture();
  const fixture=calendarFixture(t,[eventFixture(process,'TCC-2026-0006',false)]);
  const result=await synchronizeDefenseCalendar({accessToken:'synthetic-calendar-token',calendarId:'synthetic-calendar',processes:[process]});
  assert.equal(result.created,0);
  assert.equal(fixture.calls.filter(call=>call.method==='PATCH').length,1);
  assert.equal(fixture.events[0].extendedProperties?.private?.portalTccProcessId,process.id);
  assert.equal(fixture.events[0].extendedProperties?.private?.portalTccProtocol,process.protocolo);
});

test('calendar does not adopt an event already linked to another process',async t=>{
  const process=processFixture();
  const other=eventFixture(process);other.extendedProperties!.private!.portalTccProcessId='another-stable-process';
  const fixture=calendarFixture(t,[other]);
  const result=await synchronizeDefenseCalendar({accessToken:'synthetic-calendar-token',calendarId:'synthetic-calendar',processes:[process]});
  assert.equal(result.created,1);
  assert.equal(fixture.calls.filter(call=>call.method==='PATCH').length,0);
  assert.deepEqual(fixture.events[0],other);
  assert.equal(fixture.events[1].extendedProperties?.private?.portalTccProcessId,process.id);
});

test('calendar does not claim an unassigned alias when another current process owns that protocol',async t=>{
  const process=processFixture();
  const later=structuredClone(process);later.id='new-sixth-process';later.protocolo='TCC-2026-0006';later.previousProtocols=[];later.defesa.localStatus='PENDENTE';
  const historical=eventFixture(process,'TCC-2026-0006',false);
  const fixture=calendarFixture(t,[historical]);
  const result=await synchronizeDefenseCalendar({accessToken:'synthetic-calendar-token',calendarId:'synthetic-calendar',processes:[process,later]});
  assert.equal(result.created,1);
  assert.equal(fixture.calls.filter(call=>call.method==='PATCH').length,0);
  assert.deepEqual(fixture.events[0],historical);
});

test('calendar updates the same linked event after a confirmed defense is rescheduled',async t=>{
  const process=processFixture();
  const original=eventFixture(process);
  process.defesa.startAt='2026-12-08T17:00:00Z';process.defesa.endAt='2026-12-08T18:30:00Z';process.defesa.local='Outra Sala de Teste';
  const fixture=calendarFixture(t,[original]);
  const result=await synchronizeDefenseCalendar({accessToken:'synthetic-calendar-token',calendarId:'synthetic-calendar',processes:[process]});
  assert.equal(result.created,0);
  assert.equal(fixture.calls.filter(call=>call.method==='PATCH').length,1);
  assert.equal(fixture.events[0].id,original.id);
  assert.equal(fixture.events[0].start?.dateTime,process.defesa.startAt);
  assert.equal(fixture.events[0].location,process.defesa.local);
});

test('calendar refuses to bind a protocol-only event with incompatible reservation facts',async t=>{
  const process=processFixture();
  const incompatible=eventFixture(process,process.protocolo,false);incompatible.location='Sala de Outro Trabalho';
  const fixture=calendarFixture(t,[incompatible]);
  const result=await synchronizeDefenseCalendar({accessToken:'synthetic-calendar-token',calendarId:'synthetic-calendar',processes:[process]});
  assert.equal(result.created,1);
  assert.equal(fixture.calls.filter(call=>call.method==='PATCH').length,0);
  assert.deepEqual(fixture.events[0],incompatible);
});

test('an uncertain calendar update never falls back to creating another event',async t=>{
  const process=processFixture();
  const fixture=calendarFixture(t,[eventFixture(process,'TCC-2026-0006')],'Synthetic calendar update timeout');
  await assert.rejects(synchronizeDefenseCalendar({accessToken:'synthetic-calendar-token',calendarId:'synthetic-calendar',processes:[process]}),/Synthetic calendar update timeout/);
  assert.equal(fixture.calls.filter(call=>call.method==='POST').length,0);
  assert.equal(fixture.events.length,1);
});
