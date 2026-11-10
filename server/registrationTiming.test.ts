import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import express from 'express';
import type {ProcessData} from '../src/types';
import {beginRegistrationRequestTiming,registrationRequestTiming} from './registrationTiming';
import {reservationRuntimeUnavailablePage,reservationAlreadyAnsweredPage,readSavedReservationDecision,reservationToken} from './workflow/reservationConfirmation';
import {createRuntimeRequestQueue,attachRuntimeRequestLifecycle,settlePreviousRuntimeWrites} from './runtimeRequestQueue';

test('registration timing measures fixed stages and response status without retaining request data',async()=>{
  let clock=10;const reports:unknown[]=[];
  const server=createServer((req,res)=>{
    const path=new URL(req.url!,'http://fixture.invalid').pathname.replace(/^\/api/,'');
    const timing=beginRegistrationRequestTiming(Object.assign(req,{path}),res,()=>clock,value=>reports.push(value));
    assert.equal(registrationRequestTiming(req),timing);
    if(timing){
      assert.equal(beginRegistrationRequestTiming(Object.assign(req,{path}),res,()=>clock,value=>reports.push(value)),timing);
      for(const [name,duration] of [['queue_wait',25],['previous_writes',9],['hydrate',50],['apply_state',6],['draft_commit',100]] as const){const finish=timing.measure(name);clock+=duration;finish();finish();}
    }
    res.statusCode=503;res.end('fixture');
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const port=(server.address() as {port:number}).port;
  try{
    const response=await fetch(`http://127.0.0.1:${port}/api/registration/draft?email=private@example.invalid`,{method:'PUT',headers:{authorization:'Bearer PRIVATE_SECRET','content-type':'application/json'},body:JSON.stringify({name:'PRIVATE_PERSON'})});
    assert.equal(response.status,503);
    assert.equal(response.headers.get('server-timing'),'queue_wait;dur=25, previous_writes;dur=9, hydrate;dur=50, apply_state;dur=6, draft_commit;dur=100, total;dur=190');
    assert.deepEqual(reports,[{route:'PUT /api/registration/draft',status:503,timings:{queue_wait:25,previous_writes:9,hydrate:50,apply_state:6,draft_commit:100,total:190}}]);
    assert.doesNotMatch(JSON.stringify(reports),/PRIVATE|private@|email=|Bearer/);
    const unrelated=await fetch(`http://127.0.0.1:${port}/api/processes`);
    assert.equal(unrelated.headers.get('server-timing'),null);assert.equal(reports.length,1);
  }finally{server.close();await once(server,'close');}
});

test('bootstrap emits total without fabricated hydration timings; reporter failure does not change its response',async()=>{
  const server=createServer((req,res)=>{
    beginRegistrationRequestTiming(Object.assign(req,{path:'/registration/bootstrap'}),res,()=>20,()=>{throw Error('logger failed');});
    res.end('normal response');
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const port=(server.address() as {port:number}).port;
    const response=await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(await response.text(),'normal response');assert.equal(response.headers.get('server-timing'),'total;dur=0');
  }finally{server.close();await once(server,'close');}
});

test('actual runtime middleware keeps the lock and records busy admission and hydration failure',async()=>{
  const source=readFileSync('server.ts','utf8');
  const start=source.indexOf('  const showSavedReservationDecision=');
  const middleware=source.slice(start,source.indexOf("\n\n  app.use('/api', (req, res, next) => {",start));
  assert.ok(middleware.includes('beginRegistrationRequestTiming'));
  const app=express();const reports:any[]=[];
  let release!:()=>void,entered!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});const started=new Promise<void>(resolve=>{entered=resolve;});
  let reads=0,failRead=false;
  const secret='fixture-reservation-secret-0123456789';
  const recipient='approver@example.invalid';
  const token=reservationToken({processId:'fixture',revision:2,recipient,expiresAt:Date.now()+60_000},secret);
  const otherRevision=reservationToken({processId:'fixture',revision:1,recipient,expiresAt:Date.now()+60_000},secret);
  let decision='CONFIRMED';
  const loadPortalCalendarSnapshot=async()=>({processes:[{
    id:'fixture',defesa:{reservationRevision:2,departmentResponse:{revision:2,respondedBy:recipient,attribution:'EMAIL_LINK',decision}},
  } as ProcessData]});
  const context={app,AbortController,reservationRuntimeUnavailablePage,reservationAlreadyAnsweredPage,readSavedReservationDecision,reservationSecret:()=>secret,loadPortalCalendarSnapshot,console:{error:()=>{}},createRuntimeRequestQueue:()=>createRuntimeRequestQueue({waitTimeoutMs:20}),attachRuntimeRequestLifecycle,settlePreviousRuntimeWrites,remotePersistenceQueue:Promise.resolve(),getSupabaseRuntimeStatus:()=>({durablePersistenceReady:true}),beginRegistrationRequestTiming:(req:any,res:any)=>beginRegistrationRequestTiming(req,res,()=>performance.now(),value=>reports.push(value)),refreshPortalRuntimeState:async()=>{reads++;if(failRead)throw Error('PRIVATE_DATABASE_DETAIL');if(reads===1){entered();await held;}return {};},applyPersistedState:()=>{}};
  runInNewContext(ts.transpileModule(middleware,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  app.use((_req,res)=>{res.json({ok:true});});
  const server=createServer(app);server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  let first:Promise<Response>|undefined;
  try{
    first=fetch(base+'/api/registration/bootstrap');await started;
    const busy=await fetch(base+'/api/registration/bootstrap');
    assert.equal(busy.status,503);assert.equal((await busy.json()).code,'RUNTIME_BUSY');assert.equal(reads,1);
    assert.match(busy.headers.get('server-timing')||'',/queue_wait;dur=/);assert.doesNotMatch(busy.headers.get('server-timing')||'',/hydrate/);
    const reservation=await fetch(base+'/api/reservation-confirmation/fixture-token?decision=decline');
    assert.equal(reservation.status,503);assert.match(reservation.headers.get('content-type')||'',/text\/html/);
    assert.equal(reservation.headers.get('cache-control'),'no-store');assert.equal(reservation.headers.get('retry-after'),'5');
    const reservationHtml=await reservation.text();assert.match(reservationHtml,/Consultando reserva/);assert.match(reservationHtml,/Consultar reserva/);
    assert.doesNotMatch(reservationHtml,/RUNTIME_BUSY|data-reservation-response|<script|Reserva aceita|Reserva recusada/);
    const savedPath=base+'/api/reservation-confirmation/'+token;
    const accepted=await fetch(savedPath+'?decision=decline');
    assert.equal(accepted.status,200);
    assert.equal(accepted.headers.get('retry-after'),null);
    assert.match(await accepted.text(),/A reserva já foi aceita/);
    decision='UNAVAILABLE';
    const declined=await fetch(savedPath,{method:'POST',body:'decision=accept&confirmed=yes'});
    assert.equal(declined.status,409);
    assert.equal(declined.headers.get('x-reservation-decision'),'UNAVAILABLE');
    assert.match(await declined.text(),/A reserva já foi recusada/);
    const superseded=await fetch(base+'/api/reservation-confirmation/'+otherRevision);
    assert.equal(superseded.status,503);
    assert.doesNotMatch(await superseded.text(),/A reserva já foi/);
    assert.equal(reads,1,'busy reservation does not read mutable runtime outside its lock');
    release();const ok=await first;assert.equal(ok.status,200);await ok.json();
    for(const stage of ['queue_wait','previous_writes','hydrate','apply_state','total'])assert.match(ok.headers.get('server-timing')||'',new RegExp(stage+';dur='));
    failRead=true;const failed=await fetch(base+'/api/registration/bootstrap');assert.equal(failed.status,503);await failed.json();
    const unavailableReservation=await fetch(base+'/api/reservation-confirmation/fixture-token/receipt');
    assert.equal(unavailableReservation.status,503);assert.match(await unavailableReservation.text(),/Consultar reserva/);
    assert.match(failed.headers.get('server-timing')||'',/hydrate;dur=/);assert.doesNotMatch(failed.headers.get('server-timing')||'',/apply_state/);
    assert.equal(reports.length,3);assert.doesNotMatch(JSON.stringify(reports),/PRIVATE_DATABASE_DETAIL/);
  }finally{release();await first?.catch(()=>{});server.close();await once(server,'close');}
});
