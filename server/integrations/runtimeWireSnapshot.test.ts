import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {loadPortalRuntimeState,refreshPortalRuntimeState} from './supabase';

const migration='supabase/migrations/20261108000546_runtime_wire_snapshot.sql';
test('wire JSON acompanha commit e rollback, recusa projeção antiga e mantém deltas nas leituras quentes',async t=>{
 const db=new PGlite();
 const env={SUPABASE_URL:'https://wire-snapshot.invalid',SUPABASE_SECRET_KEY:'fixture',PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_RUNTIME_WIRE_SNAPSHOT:'true',PORTAL_RUNTIME_AUDIT_DELTA:'true'};
 for(const [key,value] of Object.entries(env)){const before=process.env[key];process.env[key]=value;t.after(()=>{if(before===undefined)delete process.env[key];else process.env[key]=before;});}
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create table portal_runtime_state(id text primary key,payload jsonb,revision bigint);
   grant select on portal_runtime_state to service_role;
   insert into portal_runtime_state values('global','{"auditLogs":[],"permissions":{"allowed":true}}',1);`);
  await db.exec(await readFile(migration,'utf8'));
  await db.exec(await readFile('supabase/migrations/20261108000547_runtime_wire_bytes.sql','utf8'));
  await db.exec(await readFile('supabase/migrations/20261108000548_runtime_wire_media_type.sql','utf8'));
  assert.equal((await db.query<{type:string}>("select pg_get_function_result('portal_read_runtime_wire_bytes_v1()'::regprocedure) type")).rows[0].type,'"application/octet-stream"');
  const read=async()=> JSON.parse(new TextDecoder().decode((await db.query<{snapshot:Uint8Array}>('select portal_read_runtime_wire_bytes_v1() snapshot')).rows[0].snapshot));
  assert.deepEqual(await read(),[{revision:1,payload:{auditLogs:[],permissions:{allowed:true}}}]);
  await db.exec(`begin;update portal_runtime_state set payload='{"auditLogs":[],"permissions":{"allowed":false}}',revision=2 where id='global';`);
  assert.equal((await read())[0].payload.permissions.allowed,false);
  await db.exec('rollback');assert.equal((await read())[0].revision,1);
  await db.exec(`update portal_runtime_state set payload='{"auditLogs":[],"permissions":{"allowed":false}}',revision=2 where id='global'`);
  assert.equal((await read())[0].revision,2);
  await db.exec('set role service_role');
  assert.equal((await read())[0].revision,2);
  await db.exec('reset role');
  const requests:string[]=[];
  t.mock.method(globalThis,'fetch',async(url:any,init?:RequestInit)=>{
   assert.equal(new Headers(init?.headers).get('Accept'),new URL(url).pathname.endsWith('portal_read_runtime_wire_bytes_v1')?'application/octet-stream':'application/json');
   const path=new URL(url).pathname;requests.push(path);
   if(path.endsWith('portal_read_runtime_wire_bytes_v1'))return new Response(JSON.stringify(await read()),{headers:{'content-type':'application/octet-stream'}});
   if(path.endsWith('portal_read_runtime_snapshot_v1'))return Response.json([{revision:3,payload:{permissions:{allowed:false}},audit_chunks:[]}]);
   return Response.json([{revision:3}]);
  });
  assert.equal((await loadPortalRuntimeState<any>())?.permissions.allowed,false);
  assert.equal((await refreshPortalRuntimeState<any>())?.permissions.allowed,false);
  assert.deepEqual(requests,['/rest/v1/rpc/portal_read_runtime_wire_bytes_v1','/rest/v1/portal_runtime_state','/rest/v1/rpc/portal_read_runtime_snapshot_v1']);
  await db.exec(`update portal_runtime_wire_snapshot set revision=1;`);
  await assert.rejects(read,/projeção atual/);
  await db.exec(`set role anon;`);
  await assert.rejects(read,/permission denied/);
  await db.exec('reset role');
  await db.exec('set role authenticated');
  await assert.rejects(read,/permission denied/);
  await db.exec('reset role');
  await db.exec('set role service_role');
  await assert.rejects(read,/projeção atual/);
  await db.exec('reset role');
 }finally{await db.close();}
});

for(const mode of ['missing','denied','stale'] as const)test(`cold wire ${mode}: fallback somente para RPC ausente`,async t=>{
 for(const [key,value] of Object.entries({SUPABASE_URL:`https://wire-${mode}.invalid`,SUPABASE_SECRET_KEY:'fixture',PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_RUNTIME_WIRE_SNAPSHOT:'true'})){
  const before=process.env[key];process.env[key]=value;t.after(()=>{if(before===undefined)delete process.env[key];else process.env[key]=before;});
 }
 const calls:string[]=[];
 t.mock.method(globalThis,'fetch',async(url:any)=>{
  calls.push(String(url));
  if(String(url).includes('/rpc/'))return Response.json({code:mode==='missing'?'PGRST202':mode==='denied'?'42501':'PT503'},{status:mode==='missing'?404:mode==='denied'?403:503});
  return Response.json([{revision:8,payload:{safe:true}}]);
 });
 if(mode==='missing'){assert.deepEqual(await loadPortalRuntimeState(),{safe:true});assert.equal(calls.length,2);}
 else{await assert.rejects(loadPortalRuntimeState());assert.ok(calls.every(url=>url.includes('/rpc/')));}
});
