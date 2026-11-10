import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test, {type TestContext} from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {currentPortalRuntimeRevision,loadPortalRuntimeState,refreshPortalRuntimeState,savePortalRuntimeState} from './supabase';

const migration='supabase/migrations/20261106001943_runtime_audit_delta.sql';
const rpc='/rest/v1/rpc/portal_read_runtime_snapshot_v1';

function mockEnvironment(t: TestContext, origin:string){
  for(const [key,value] of Object.entries({
    SUPABASE_URL:origin,SUPABASE_SECRET_KEY:'test-audit-delta-key',
    PORTAL_PERSISTENCE_PROVIDER:'supabase',PORTAL_RUNTIME_AUDIT_DELTA:'true',
  })){
    const previous=process.env[key];process.env[key]=value;
    t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
  }
}

test('reconstitui um snapshot de auditoria grande com retenção e correções; mantém CAS e backups',async t=>{
  mockEnvironment(t,'https://audit-chunks.invalid');
  const db=new PGlite({extensions:{pgcrypto}});
  try{
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create extension pgcrypto;
      create table portal_runtime_state(id text primary key,payload jsonb,revision bigint,updated_at timestamptz);
      create table runtime_backup(payload jsonb);
      grant select on portal_runtime_state to service_role;
      create function commit_fixture(expected bigint,next jsonb) returns bigint language plpgsql as $$
      declare result bigint;
      begin
        update portal_runtime_state set payload=next,revision=revision+1 where id='global' and revision=expected returning revision into result;
        if result is null then raise exception 'revision mismatch' using errcode='PT409';end if;
        insert into runtime_backup values(next);
        return result;
      end $$;`);
    await db.exec(await readFile(migration,'utf8'));
    const event=(i:number)=>({id:'registro-'+i, action:'REGISTRO', detail:'x'.repeat(445), timestamp:'2026-11-05T12:00:00Z'});
    const initial={settings:{label:'y'.repeat(1_700_000)},auditLogs:Array.from({length:5000},(_,i)=>event(i))};
    const write=(expected:number,payload:object)=>db.query<{revision:number}>('select commit_fixture($1,$2::jsonb) as revision',[expected,JSON.stringify(payload)]);
    await db.query("insert into portal_runtime_state(id,payload,revision) values('global',$1::jsonb,1)",[JSON.stringify(initial)]);
    const records:Array<{bytes:number;includedEvents:number}>=[];const committed:object[]=[];
    t.mock.method(globalThis,'fetch',async(url:string,init?:RequestInit)=>{
      const target=new URL(url);
      if(target.pathname===rpc){
        const {known_audit_chunks}=JSON.parse(String(init?.body));
        const {rows}=await db.query<{revision:number;payload:object;audit_chunks:Array<{events?:unknown[]}>|null}>('select * from portal_read_runtime_snapshot_v1($1::text[])',[known_audit_chunks]);
        const bytes=Buffer.byteLength(JSON.stringify(rows));
        records.push({bytes,includedEvents:rows[0]?.audit_chunks?.reduce((count,chunk)=>count+(chunk.events?.length||0),0)||0});
        return Response.json(rows);
      }
      if(target.pathname.endsWith('/portal_commit_runtime_state')){
        const {expected_revision,next_payload}=JSON.parse(String(init?.body));
        committed.push(next_payload);
        const result=await write(expected_revision,next_payload);
        return Response.json(result.rows[0].revision);
      }
      const selection=target.searchParams.get('select');
      assert.ok(selection==='revision'||selection==='payload,revision');
      return Response.json((await db.query(`select ${selection} from portal_runtime_state where id='global'`)).rows);
    });
    const cold=await loadPortalRuntimeState<typeof initial>();
    assert.deepEqual(cold,initial);
    assert.equal(records.length,0,'cold worker reads the canonical row without audit hashing');
    cold!.auditLogs[0].detail='modificação local';
    assert.deepEqual(await refreshPortalRuntimeState(),initial);
    assert.equal(records.length,0);

    const next={...initial,auditLogs:[...initial.auditLogs.slice(1),event(5000)]};
    next.auditLogs[117]={...next.auditLogs[117],detail:'corrigido'};
    await write(1,next);
    assert.deepEqual(await loadPortalRuntimeState(false),next);
    assert.equal(currentPortalRuntimeRevision(),1);
    const firstRefresh=await refreshPortalRuntimeState<typeof initial>();
    assert.deepEqual(firstRefresh,next);
    assert.equal(currentPortalRuntimeRevision(),2);
    assert.equal(records[0].includedEvents,5000,'untracked RPC read does not populate the confirmed cache');
    assert.equal(records[1].includedEvents,5000,'first tracked refresh establishes chunk fingerprints');
    const third={...next,auditLogs:[...next.auditLogs.slice(1),event(5001)]};
    third.auditLogs[217]={...third.auditLogs[217],detail:'segunda correção'};
    await write(2,third);
    const loaded=await refreshPortalRuntimeState<typeof initial>();
    assert.deepEqual(loaded,third);
    assert.equal(currentPortalRuntimeRevision(),3);
    assert.ok(records[2].includedEvents<400,JSON.stringify(records[2]));
    assert.ok(records[2].bytes<records[0].bytes*0.52,JSON.stringify(records));
    t.diagnostic(`RPC completa: ${records[0].bytes} B; RPC com delta: ${records[2].bytes} B; ${records[2].includedEvents} de 5000 logs reenviados.`);

    await savePortalRuntimeState(loaded!);
    assert.deepEqual(committed,[],'unchanged durable barrier confirms revision without a redundant write');
    assert.equal(currentPortalRuntimeRevision(),3);
    const backups=await db.query<{payload:object}>('select payload from runtime_backup');
    assert.deepEqual(backups.rows.map(row=>row.payload),[next,third]);

    await db.exec('set role anon;');
    await assert.rejects(db.query("select * from portal_read_runtime_snapshot_v1('{}')"),/permission denied/);
    await db.exec('reset role; set role service_role;');
    assert.equal((await db.query("select revision from portal_read_runtime_snapshot_v1('{}')")).rows.length,1);
  }finally{await db.close();}
});

test('fallback de deploy lê a tabela canônica quando a RPC está ausente',async t=>{
  mockEnvironment(t,'https://audit-rollout.invalid');
  const requests:string[]=[];
  t.mock.method(globalThis,'fetch',async(url:string)=>{
    const path=new URL(url).pathname;requests.push(path);
    return path===rpc
      ? Response.json({code:'PGRST202'},{status:404})
      : Response.json([{revision:7,payload:{auditLogs:[{id:'preservado'}]}}]);
  });
  await loadPortalRuntimeState();
  requests.length=0;
  assert.deepEqual(await loadPortalRuntimeState(false),{auditLogs:[{id:'preservado'}]});
  assert.deepEqual(await loadPortalRuntimeState(false),{auditLogs:[{id:'preservado'}]});
  assert.deepEqual(requests,[rpc,'/rest/v1/portal_runtime_state','/rest/v1/portal_runtime_state']);
});

test('negações de acesso e blocos ausentes falham sem entregar snapshot desatualizado',async t=>{
  mockEnvironment(t,'https://audit-invalid.invalid');
  let status=403,calls=0;
  t.mock.method(globalThis,'fetch',async()=>Response.json([{revision:7,payload:{}}]));
  await loadPortalRuntimeState();
  t.mock.method(globalThis,'fetch',async(url:string)=>{
    calls++;assert.equal(new URL(url).pathname,rpc);
    if(status===403)return Response.json({code:'42501'},{status});
    return Response.json([{revision:8,payload:{},audit_chunks:[{fingerprint:'f'.repeat(64)}]}]);
  });
  await assert.rejects(loadPortalRuntimeState(false),/Supabase \(403\)/);
  status=200;
  await assert.rejects(loadPortalRuntimeState(false),/Bloco do histórico de auditoria ausente/);
  assert.equal(calls,2);
});

for (const timeoutSource of ['rede', 'postgres'] as const) test(`timeout da RPC (${timeoutSource}) lê a tabela canônica sem repetir a RPC`, async t => {
  mockEnvironment(t, `https://audit-timeout-${timeoutSource}.invalid`);
  const requests: string[] = [];
  t.mock.method(globalThis,'fetch',async()=>Response.json([{revision:7,payload:{}}]));
  await loadPortalRuntimeState();
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    const target = new URL(url);
    requests.push(target.pathname);
    if (target.pathname === rpc) {
      if (timeoutSource === 'rede') throw new DOMException('Request timed out', 'TimeoutError');
      return Response.json({code:'57014',message:'canceling statement due to statement timeout'},{status:500});
    }
    assert.equal(target.searchParams.get('select'), 'payload,revision');
    return Response.json([{revision: 8, payload: {auditLogs: [{id: 'atual'}]}}]);
  });
  assert.deepEqual(await loadPortalRuntimeState(false), {auditLogs: [{id: 'atual'}]});
  assert.deepEqual(await loadPortalRuntimeState(false), {auditLogs: [{id: 'atual'}]});
  assert.deepEqual(requests, [rpc, '/rest/v1/portal_runtime_state', '/rest/v1/portal_runtime_state']);
});


test('leitura inicial canônica recusa 403 e payload inválido sem RPC nem cache de sucesso',async t=>{
  mockEnvironment(t,'https://audit-cold-rejected.invalid');
  const requests:string[]=[];
  let mode:'denied'|'invalid'|'valid'='denied';
  t.mock.method(globalThis,'fetch',async(url:string)=>{
    requests.push(new URL(url).pathname);
    if(mode==='denied')return Response.json({code:'42501'},{status:403});
    return Response.json([{revision:4,payload:mode==='invalid'?[]:{safe:true}}]);
  });
  await assert.rejects(loadPortalRuntimeState(),/Supabase \(403\)/);
  mode='invalid';
  await assert.rejects(loadPortalRuntimeState(),/estado ou uma revisão inválida/);
  mode='valid';
  assert.deepEqual(await loadPortalRuntimeState(),{safe:true});
  assert.deepEqual(requests,Array(3).fill('/rest/v1/portal_runtime_state'));
});

test('troca de endpoint exige nova leitura canônica mesmo com revisão coincidente',async t=>{
  mockEnvironment(t,'https://audit-first-endpoint.invalid');
  const requests:string[]=[];
  t.mock.method(globalThis,'fetch',async(url:string)=>{
    const target=new URL(url);requests.push(target.host+target.pathname);
    assert.equal(target.searchParams.get('select'),'payload,revision');
    return Response.json([{revision:9,payload:{origin:target.host}}]);
  });
  assert.deepEqual(await loadPortalRuntimeState(),{origin:'audit-first-endpoint.invalid'});
  process.env.SUPABASE_URL='https://audit-second-endpoint.invalid';
  assert.deepEqual(await loadPortalRuntimeState(),{origin:'audit-second-endpoint.invalid'});
  assert.deepEqual(requests,['audit-first-endpoint.invalid/rest/v1/portal_runtime_state','audit-second-endpoint.invalid/rest/v1/portal_runtime_state']);
});
