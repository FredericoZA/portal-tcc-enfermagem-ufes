import {criticalAuditExcludedActions} from '../criticalAuditPolicy';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {buildPagedAuditFeed,decodeAuditCursor} from '../auditFeed';
import {readCriticalAuditPage} from './supabase';
const migration='supabase/migrations/20261115140000_paged_critical_audit.sql';
const query={search:'',kind:'',start:'',end:'',focusId:''};
test('database pages match canonical critical history, preserve cursor ties and responsibilities, reject stale revisions and public roles',async()=>{
 const db=new PGlite();
 try{
 await db.exec('create role anon;create role authenticated;create role service_role;create table public.portal_runtime_state(id text primary key,revision bigint,payload jsonb);alter table public.portal_runtime_state enable row level security;grant select on public.portal_runtime_state to service_role;create policy service_read on public.portal_runtime_state for select to service_role using(true);');
 await db.exec(await readFile(migration,'utf8'));
 const logs=Array.from({length:1500},(_,i)=>({id:'log-'+String(i).padStart(5,'0'),processId:i%2?'p1':'p2',actorEmail:'actor@example.invalid',actorRoles:['MASTER_ADMIN'],action:i%7?'REVISAO_DADOS_PARA_ATA':'SALVAMENTO_AUTOMATICO_ESTUDIO',entityType:'processo',entityId:i%2?'p1':'p2',timestamp:new Date(Date.UTC(2026,10,15)-Math.floor(i/4)*1000).toISOString(),after:{detail:'x'.repeat(6000)}}));
 logs.push(...criticalAuditExcludedActions.map((action,i)=>({...logs[0],id:'excluded-'+i,action})));
 const deliveries=[{id:'pending',processId:'p1',recipient:'a@example.invalid',subject:'Pendente',status:'FAILED',createdAt:'2026-11-15T00:00:00.000Z',attempts:[],renderedText:'private '.repeat(10000)}, {id:'accepted',processId:'p2',recipient:'a@example.invalid',subject:'Aceito',status:'ACCEPTED_BY_GMAIL',createdAt:'2026-11-15T00:00:00.000Z',attempts:[]}, {id:'expired',processId:'p1',recipient:'a@example.invalid',subject:'Incerto',status:'ACCEPTED_BY_GMAIL',dispatchState:'SENDING',dispatchLeaseUntil:'2020-01-01T00:00:00Z',createdAt:'2026-11-15T00:00:00Z',attempts:[]} ] as any[];
 const payload={auditLogs:logs,emailDeliveries:deliveries,settings:{secret:'never return'},processes:[]};
 await db.query("insert into public.portal_runtime_state values('global',7,$1)",[JSON.stringify(payload)]);
 const input={criticalOnly:true,logs,deliveries,processes:[]} as any;
 for(const processId of [null,'p1']){
  let before:ReturnType<typeof decodeAuditCursor>=null;let seen=0;
  for(let n=0;n<16;n++){
   const result=await db.query<{page:any}>('select public.portal_read_critical_audit_page_v1(7,$1,$2,$3,1794700800000) as page',[processId,before?.at??null,before?.id??null]);
   const page=result.rows[0].page;
   assert.ok(page.logs.length+page.deliveries.length<=101);assert.equal(page.settings,undefined);
   assert.ok(page.deliveries.every((m:any)=>!Object.hasOwn(m,'renderedText')));
   const actual=buildPagedAuditFeed({...input,logs:page.logs,deliveries:page.deliveries.map((r:any)=>deliveries.find(d=>d.id===r.id))},query);
   const expected=buildPagedAuditFeed({...input,logs:logs.filter(l=>!processId||l.processId===processId),deliveries:deliveries.filter(d=>!processId||d.processId===processId)},{...query,before:before??undefined});
   assert.deepEqual({...actual,total:page.total},expected);
   seen+=actual.items.length;
   if(!actual.nextCursor){assert.equal(seen,page.total);break;}
   before=decodeAuditCursor(actual.nextCursor);
  }
 }
 const sample=(await db.query<{page:any}>('select public.portal_read_critical_audit_page_v1(7) as page')).rows[0].page;
 console.log(JSON.stringify({measurement:'audit-page-fixture',canonicalBytes:Buffer.byteLength(JSON.stringify(payload)),pageBytes:Buffer.byteLength(JSON.stringify(sample)),returnedRows:sample.logs.length+sample.deliveries.length}));
 await assert.rejects(db.query('select public.portal_read_critical_audit_page_v1(6)'),/revision changed/);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select public.portal_read_critical_audit_page_v1(7)'),/permission denied/);await db.exec('reset role');}
 await db.exec('set role service_role');assert.equal((await db.query<{page:any}>('select public.portal_read_critical_audit_page_v1(7) as page')).rows[0].page.revision,7);
 }finally{await db.close();}
});
test('RPC loader bounds results and only falls back for a missing migration, never for denied access or changed snapshot',async t=>{
 for(const [key,value] of Object.entries({PORTAL_PERSISTENCE_PROVIDER:'supabase',SUPABASE_URL:'https://audit-page.invalid',SUPABASE_SECRET_KEY:'fixture-not-a-secret'})){const old=process.env[key];process.env[key]=value;t.after(()=>{if(old===undefined)delete process.env[key];else process.env[key]=old;});}
 let mode='ok';
 t.mock.method(globalThis,'fetch',async(url:any,init:any)=>{
  assert.match(String(url),/portal_read_critical_audit_page_v1$/);assert.equal(JSON.parse(init.body).expected_revision,7);
  if(mode==='missing')return Response.json({code:'PGRST202'},{status:404});
  if(mode==='denied')return Response.json({code:'42501'},{status:403});
  return Response.json({revision:mode==='stale'?8:7,total:0,logs:mode==='oversize'?Array(102).fill({}):[],deliveries:[]});
 });
 assert.equal((await readCriticalAuditPage({revision:7}))!.total,0);
 mode='missing';assert.equal(await readCriticalAuditPage({revision:7}),null);
 for(const value of ['denied','stale','oversize']){mode=value;await assert.rejects(readCriticalAuditPage({revision:7}));}
});
