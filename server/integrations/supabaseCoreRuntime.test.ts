import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {loadPortalRuntimeCoreState,refreshPortalRuntimeCoreState} from './supabase';

test('RPC operacional omite auditoria e catalogo, nao altera estado nem concede acesso publico',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
   create table portal_runtime_state(id text primary key,payload jsonb not null,revision bigint not null);
   alter table portal_runtime_state enable row level security;
   alter table portal_runtime_state force row level security;
   revoke all on portal_runtime_state from public,anon,authenticated;
   grant select on portal_runtime_state to service_role;
   insert into portal_runtime_state values ('global','{"processes":[{"id":"tcc-1"}],"legacyAcademicRecords":[{"id":"legacy"}],"auditLogs":[{"id":"audit-1"}],"settings":{"name":"Portal"}}',14);`);
  await db.exec(await readFile('supabase/migrations/20261111191000_runtime_core_read_model.sql','utf8'));
  const read=()=>db.query<{revision:number;payload:any}>('select * from portal_read_runtime_core_v1()');
  assert.deepEqual((await read()).rows,[{revision:14,payload:{processes:[{id:'tcc-1'}],settings:{name:'Portal'}}}]);
  assert.equal((await db.query<{payload:any}>('select payload from portal_runtime_state')).rows[0].payload.legacyAcademicRecords.length,1);
  await db.exec('set role anon');
  await assert.rejects(read(),/permission denied/);
  await db.exec('reset role; set role authenticated');
  await assert.rejects(read(),/permission denied/);
  await db.exec('reset role; set role service_role');
  assert.equal((await read()).rows[0].revision,14);
 }finally{await db.close();}
});

test('core cache verifica revisao e isola transporte da leitura integral',async t=>{
 const env={SUPABASE_URL:'https://core-egress.invalid',SUPABASE_SECRET_KEY:'fixture',PORTAL_PERSISTENCE_PROVIDER:'supabase'};
 for(const [k,v] of Object.entries(env)){const old=process.env[k];process.env[k]=v;t.after(()=>{if(old===undefined)delete process.env[k];else process.env[k]=old;});}
 const calls:string[]=[];
 let revision=15;
 t.mock.method(globalThis,'fetch',async(url:any,init?:RequestInit)=>{
  const path=new URL(url).pathname;calls.push(path);
  if(path.endsWith('portal_read_runtime_core_v1')){
    assert.equal(init?.method,'POST');
    return Response.json([{revision,payload:{processes:[],settings:{v:revision}}}]);
  }
  assert.equal(path,'/rest/v1/portal_runtime_state');
  assert.equal(new URL(url).searchParams.get('select'),'revision');
  return Response.json([{revision}]);
 });
 assert.deepEqual(await loadPortalRuntimeCoreState(),{processes:[],settings:{v:15}});
 assert.deepEqual(await refreshPortalRuntimeCoreState(),{processes:[],settings:{v:15}});
 revision=16;
 assert.deepEqual(await refreshPortalRuntimeCoreState(),{processes:[],settings:{v:16}});
 assert.deepEqual(calls.map(x=>x.endsWith('core_v1')?'core':x),['core','/rest/v1/portal_runtime_state','/rest/v1/portal_runtime_state','core']);
});
