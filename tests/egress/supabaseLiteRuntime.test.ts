import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {loadPortalRuntimeLiteState,refreshPortalRuntimeLiteState} from '../../server/integrations/supabase';

const fixtureServerKey='local-test-key-without-real-credentials';
const migration='supabase/migrations/20261111113000_runtime_lite_snapshot.sql';
const rpc='/rest/v1/rpc/portal_read_runtime_lite_v1';

test('lite RPC entrega uma revisão atômica, preserva o banco e nega usuários públicos',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create table portal_runtime_state(id text primary key,payload jsonb not null,revision bigint not null);
      alter table portal_runtime_state enable row level security;
      alter table portal_runtime_state force row level security;
      revoke all on portal_runtime_state from public,anon,authenticated;
      grant select on portal_runtime_state to service_role;
      insert into portal_runtime_state values('global','{"settings":{"version":1},"auditLogs":[{"id":"1","sensitive":"private"}],"legacyAcademicRecords":[{"id":"old"}]}',7);`);
    await db.exec(await readFile(migration,'utf8'));
    const get=()=>db.query<{revision:number;payload:any}>('select * from portal_read_runtime_lite_v1()');
    assert.deepEqual((await get()).rows,[{revision:7,payload:{settings:{version:1},legacyAcademicRecords:[{id:'old'}]}}]);
    const full=await db.query<{payload:any}>('select payload from portal_runtime_state');
    assert.equal(full.rows[0].payload.auditLogs[0].sensitive,'private','nenhuma evidência é apagada');
    await db.exec('set role anon');
    await assert.rejects(get(),/permission denied/);
    await db.exec('reset role;set role authenticated');
    await assert.rejects(get(),/permission denied/);
    await db.exec('reset role;set role service_role');
    assert.equal((await get()).rows[0].revision,7);
    await db.exec('reset role');
    await db.exec(`update portal_runtime_state set payload=jsonb_set(payload,'{settings,version}','2'::jsonb),revision=8 where id='global'`);
    assert.deepEqual((await get()).rows,[{revision:8,payload:{settings:{version:2},legacyAcademicRecords:[{id:'old'}]}}]);
  }finally{await db.close();}
});

test('snapshot leve armazena cache apenas quando a revisão é confirmada; não usa histórico',async t=>{
  const env={SUPABASE_URL:'https://lite-egress.invalid',SUPABASE_SECRET_KEY:String(fixtureServerKey),PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_RUNTIME_WIRE_SNAPSHOT:'false',PORTAL_RUNTIME_AUDIT_DELTA:'false'};
  for(const [key,value] of Object.entries(env)){
    const prev=process.env[key];process.env[key]=value;
    t.after(()=>{if(prev===undefined)delete process.env[key];else process.env[key]=prev;});
  }
  let revision=7,denied=false;
  const calls:string[]=[];
  t.mock.method(globalThis,'fetch',async(url:any,init?:RequestInit)=>{
    const path=new URL(url).pathname;calls.push(path);
    if(denied)return Response.json({code:'42501'},{status:403});
    if(path===rpc){
      assert.equal(init?.method,'POST');
      return Response.json([{revision,payload:{settings:{version:revision},processes:[]}}]);
    }
    assert.equal(path,'/rest/v1/portal_runtime_state');
    assert.equal(new URL(url).searchParams.get('select'),'revision');
    return Response.json([{revision}]);
  });
  assert.deepEqual(await loadPortalRuntimeLiteState(),{settings:{version:7},processes:[]});
  assert.deepEqual(await refreshPortalRuntimeLiteState(),{settings:{version:7},processes:[]});
  assert.deepEqual(calls,[rpc,'/rest/v1/portal_runtime_state']);
  revision=8;
  assert.deepEqual(await refreshPortalRuntimeLiteState(),{settings:{version:8},processes:[]});
  assert.deepEqual(calls.slice(-2),['/rest/v1/portal_runtime_state',rpc]);
  denied=true;
  await assert.rejects(loadPortalRuntimeLiteState(),error=>error instanceof Error&&error.message.includes('Supabase (403)'));
});

test('RPC ausente usa leitura canônica; payload inválido falha sem aceitar cache',async t=>{
  const env={SUPABASE_URL:'https://lite-missing.invalid',SUPABASE_SECRET_KEY:String(fixtureServerKey),PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_RUNTIME_WIRE_SNAPSHOT:'false',PORTAL_RUNTIME_AUDIT_DELTA:'false'};
  for(const [key,value] of Object.entries(env)){
    const prev=process.env[key];process.env[key]=value;
    t.after(()=>{if(prev===undefined)delete process.env[key];else process.env[key]=prev;});
  }
  const paths:string[]=[];
  let mode:'missing'|'bad'='missing';
  t.mock.method(globalThis,'fetch',async(url:any)=>{
    const path=new URL(url).pathname;paths.push(path);
    if(path===rpc)return mode==='missing'
      ?Response.json({code:'PGRST202'},{status:404})
      :Response.json([{revision:3,payload:{auditLogs:[{id:'leak'}]}}]);
    return Response.json([{revision:3,payload:{settings:{safe:true},auditLogs:[{id:'preserved'}]}}]);
  });
  assert.deepEqual(await loadPortalRuntimeLiteState(),{settings:{safe:true},auditLogs:[{id:'preserved'}]});
  assert.deepEqual(paths,[rpc,'/rest/v1/portal_runtime_state']);
  mode='bad';
  await assert.rejects(loadPortalRuntimeLiteState(),/projeção reduzida/);
});
