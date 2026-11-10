import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {createPublicCalendarDataReader,installPublicCalendarDataRoute,projectPublicCalendarData} from './publicCalendarData';
import {createRuntimeRequestQueue,attachRuntimeRequestLifecycle,beginRuntimeRequestTask} from './runtimeRequestQueue';
function snapshot(){const p=structuredClone(DEMO_PROCESSES[0]);Object.assign(p,{id:'private-unit-id',protocolo:'TCC - 00002',status:'AGUARDANDO_ASSINATURA',createdByEmail:'private-author@example.invalid'});p.defesa={...p.defesa,startAt:'2026-11-09T13:00:00Z',localStatus:'CONFIRMADO',departmentEmail:'private-department@example.invalid'} as any;p.acervo={trabalhoCompletoFileId:'secret-file',trabalhoCompletoFileUrl:'https://private.invalid',publishFullWork:false} as any;return{processes:[p],settings:{masterEmail:'private-master@example.invalid'} as any,auditLogs:[{secret:'private-log'}]};}
function fixture(){let revision=1,reads=0,checks=0,fail=false;let value=snapshot();const ports={durable:()=>true,readRevision:async()=>{checks++;if(fail)throw Error('database unavailable');return revision;},readDurable:async()=>{reads++;return {...structuredClone(value),revision};},readLocal:()=>assert.fail('No local fallback for unavailable database')};return{ports,read:createPublicCalendarDataReader(ports),state:()=>({reads,checks}),setRevision:(r:number)=>{revision=r;},setFailure:(v:boolean)=>{fail=v;},setValue:(v:typeof value)=>{value=v;}};}
test('public projection omits private contacts, identifiers, documents and draft/declined entries while preserving completed defenses',()=>{
 const state=snapshot();const draft=structuredClone(state.processes[0]);draft.status='EM_RASCUNHO';const declined=structuredClone(state.processes[0]);declined.defesa.localStatus='RECUSADO';const completed=structuredClone(state.processes[0]);completed.status='CONCLUIDO';state.processes.push(draft,declined,completed);
 const data=projectPublicCalendarData(state);assert.equal(data.processes.length,2);assert.equal(data.googleEvents.length,2);assert.equal(data.googleEvents[0].portalTccProtocol,'TCC - 00002');
 const json=JSON.stringify(data);assert.doesNotMatch(json,/@|secret-file|private\.invalid|private-log|private-unit-id|matricula|driveFileId|departmentEmail/);assert.ok(!Object.hasOwn(data.processes[0],'avaliacao'));
});
test('unchanged revisions reuse only public projection; each read checks current revision and caller cannot mutate cache',async()=>{
 const h=fixture();const first=await h.read();first.processes[0].titulo='Caller mutation';await h.read();assert.deepEqual(h.state(),{reads:1,checks:2});assert.notEqual((await h.read()).processes[0].titulo,'Caller mutation');
 h.setRevision(2);const changed=snapshot();changed.processes[0].titulo='New committed title';h.setValue(changed);assert.equal((await h.read()).processes[0].titulo,'New committed title');assert.equal(h.state().reads,2);
 h.setFailure(true);await assert.rejects(h.read(),/database unavailable/);h.setFailure(false);assert.equal((await h.read()).processes[0].titulo,'New committed title');
});
test('simultaneous callers share one revision/snapshot read without retaining result as a TTL cache',async()=>{
 const h=fixture();await Promise.all(Array.from({length:30},()=>h.read()));assert.deepEqual(h.state(),{reads:1,checks:1});await h.read();assert.deepEqual(h.state(),{reads:1,checks:2});
});
test('a concurrent commit caches the revision returned with the projection',async()=>{
 const h=fixture();
 const readDurable=h.ports.readDurable;
 h.ports.readDurable=async()=>{h.setRevision(2);return readDurable();};
 const read=createPublicCalendarDataReader(h.ports);
 await read();await read();assert.deepEqual(h.state(),{reads:1,checks:2});
});
test('local snapshots are cloned and never returned by reference',async()=>{
 const state=snapshot();const read=createPublicCalendarDataReader({durable:()=>false,readRevision:async()=>assert.fail(),readDurable:async()=>assert.fail(),readLocal:()=>state});const data=await read();data.processes[0].titulo='caller mutation';assert.notEqual(state.processes[0].titulo,'caller mutation');state.processes[0].titulo='local update';assert.equal((await read()).processes[0].titulo,'local update');
});
test('real HTTP public route finishes while a background lease still blocks private runtime reads',async t=>{
 const app=express();const h=fixture();installPublicCalendarDataRoute(app,h.read);
 let expire!:()=>void;const acquire=createRuntimeRequestQueue({schedule:callback=>{expire=callback;return callback;},cancel:()=>{}});const release=await acquire();let releases=0;const req={};const lifecycle=attachRuntimeRequestLifecycle(req,()=>{releases++;release();});const settle=beginRuntimeRequestTask(req);lifecycle.hydrationFinished();lifecycle.responseFinished();
 app.use('/api',async(_req,res)=>{try{const done=await acquire();done();res.json({private:true});}catch{res.status(503).json({code:'RUNTIME_BUSY'});}});
 const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())));const address=server.address() as any;const url=`http://127.0.0.1:${address.port}`;
 const result=await fetch(url+'/api/public/calendar-data');assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');assert.equal((await result.json()).processes.length,1);assert.equal(releases,0,'public read cannot release or modify active mutation lease');
 const privateRead=acquire().then(done=>{done();return 'ok';},error=>error.code);expire();assert.equal(await privateRead,'RUNTIME_REQUEST_QUEUE_TIMEOUT');settle();assert.equal(releases,1);
 h.setFailure(true);const failed=await fetch(url+'/api/public/calendar-data');assert.equal(failed.status,503);assert.equal((await failed.json()).code,'PUBLIC_CALENDAR_UNAVAILABLE');assert.equal(failed.headers.get('retry-after'),'5');
});
test('server installs public snapshot route before FIFO and uses untracked durable reads',()=>{
 const source=readFileSync('server.ts','utf8');const start=source.indexOf('  installPublicCalendarDataRoute(app,');const end=source.indexOf('  const acquireRuntimeRequest=',start);assert.ok(start>0&&end>start);const registration=source.slice(start,end);assert.match(registration,/loadPortalRuntimeState<PersistedPortalState>\(false\)/);assert.match(registration,/readRevision:readPortalRuntimeRevision/);assert.doesNotMatch(registration,/applyPersistedState/);
});
