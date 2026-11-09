import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {performance} from 'node:perf_hooks';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

const original='supabase/migrations/20261106001943_runtime_audit_delta.sql';
const projection='supabase/migrations/20261107194035_runtime_audit_chunk_projection.sql';
type Snapshot={revision:number;payload:unknown;audit_chunks:Array<{fingerprint:string;events?:unknown[]}>|null};
async function fixture(initial?:unknown){
  const db=new PGlite({extensions:{pgcrypto}});
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create extension pgcrypto;
    create table portal_runtime_state(id text primary key,payload jsonb,revision bigint,updated_at timestamptz);
    grant select,insert,update on portal_runtime_state to service_role;
    create function commit_fixture(expected bigint,next jsonb) returns bigint language plpgsql as $$
      declare result bigint;
      begin
        update portal_runtime_state set payload=next,revision=revision+1 where id='global' and revision=expected returning revision into result;
        if result is null then raise exception 'revision mismatch' using errcode='PT409'; end if;
        return result;
      end $$;`);
  await db.exec(await readFile(original,'utf8'));
  if(initial!==undefined)await db.query("insert into portal_runtime_state values('global',$1::jsonb,7,now())",[JSON.stringify(initial)]);
  await db.exec(await readFile(projection,'utf8'));
  return db;
}
async function parity(db:PGlite,known:string[]=[]){
  const baseline=await db.query<Snapshot>('select * from portal_read_runtime_snapshot_uncached_v1($1::text[])',[known]);
  const current=await db.query<Snapshot>('select * from portal_read_runtime_snapshot_v1($1::text[])',[known]);
  assert.deepEqual(current.rows,baseline.rows);
  return current.rows[0];
}
async function write(db:PGlite,payload:unknown){
  await db.query("update portal_runtime_state set payload=$1::jsonb,revision=revision+1 where id='global'",[JSON.stringify(payload)]);
}

test('projeção atual mantém contrato cold/warm, ordem, correções, retenção e rollback',async()=>{
  const initial={settings:{value:1},auditLogs:Array.from({length:600},(_,i)=>({id:`audit-${i}`,before:{x:i},after:{x:i+1},unknown:'preservado'}))};
  const db=await fixture(initial);
  try{
    const cold=await parity(db);
    const known=cold.audit_chunks!.map(chunk=>chunk.fingerprint);
    const warm=await parity(db,known);
    assert.ok(warm.audit_chunks!.every(chunk=>!chunk.events));
    type ChunkVersion={chunk:number;fingerprint:string;row_version:string};
    const before=await db.query<ChunkVersion>('select chunk,fingerprint,xmin::text as row_version from portal_runtime_audit_chunks order by chunk');
    await write(db,{...initial,settings:{value:2},drafts:{student:{revision:2}}});
    assert.deepEqual((await db.query('select chunk,fingerprint,xmin::text as row_version from portal_runtime_audit_chunks order by chunk')).rows,before.rows,'draft/config-only update leaves the physical projection untouched');
    await parity(db,known);
    await assert.rejects(db.query('select commit_fixture($1,$2::jsonb)',[7,JSON.stringify({auditLogs:[]})]),/revision mismatch/);
    assert.deepEqual((await db.query('select chunk,fingerprint,xmin::text as row_version from portal_runtime_audit_chunks order by chunk')).rows,before.rows,'stale CAS cannot change the projection');
    const next={...initial,auditLogs:[...initial.auditLogs.slice(1),{...initial.auditLogs[0],unknown:'corrigido'}]};
    await write(db,next);
    const after=await db.query<ChunkVersion>('select chunk,fingerprint,xmin::text as row_version from portal_runtime_audit_chunks order by chunk');
    const unchanged=after.rows.filter(row=>before.rows.some(old=>old.chunk===row.chunk&&old.fingerprint===row.fingerprint));
    assert.ok(unchanged.length>0);
    for(const row of unchanged)assert.deepEqual(row,before.rows.find(old=>old.chunk===row.chunk),'unchanged chunks remain physically immutable after an audit update');
    const changed=await parity(db,known);
    assert.ok(changed.audit_chunks!.some(chunk=>chunk.events));
    const stable=await parity(db,changed.audit_chunks!.map(chunk=>chunk.fingerprint));
    await db.exec('begin');
    await write(db,{...initial,auditLogs:[]});
    await db.exec('rollback');
    assert.deepEqual(await parity(db,changed.audit_chunks!.map(chunk=>chunk.fingerprint)),stable);
    assert.equal((await db.query<{n:number}>('select count(*)::int as n from portal_runtime_audit_projection')).rows[0].n,1);
  }finally{await db.close();}
});

test('histórico ausente, nulo, objeto e vazio preservam exatamente o contrato e estado ausente',async()=>{
  const db=await fixture();
  try{
    assert.deepEqual((await db.query('select * from portal_read_runtime_snapshot_v1(null)')).rows,[]);
    await db.query("insert into portal_runtime_state values('global','{}',1,now())");
    for(const payload of [{},{auditLogs:null},{auditLogs:{unexpected:true}},{auditLogs:[]},{auditLogs:[{id:'a'}]}]){
      await write(db,payload);
      await parity(db);
      await parity(db,['x'.repeat(64)]);
    }
    await db.exec('delete from portal_runtime_audit_projection');
    await parity(db);
    await write(db,{auditLogs:[{id:'a'}]});
    assert.equal((await db.query<{ready:boolean}>('select ready from portal_runtime_audit_projection')).rows[0].ready,true,'same audit rebuilds missing projection');
  }finally{await db.close();}
});

test('limites de bytes e blocos usam fallback completo, sem truncar auditoria',async()=>{
  const db=await fixture({auditLogs:[]});
  try{
    const payload={auditLogs:[{id:'oversized',detail:'x'.repeat(16_777_216)}]};
    await write(db,payload);
    assert.equal((await db.query<{ready:boolean}>('select ready from portal_runtime_audit_projection')).rows[0].ready,false);
    assert.equal((await db.query<{n:number}>('select count(*)::int as n from portal_runtime_audit_chunks')).rows[0].n,0);
    assert.deepEqual((await parity(db)).payload,{});
    // Repeated identical IDs deliberately create a boundary at every entry.
    const boundary=await db.query<{id:string}>("select i::text as id from generate_series(1,1000) i where get_byte(digest(i::text,'sha256'),0)<8 limit 1");
    await write(db,{auditLogs:Array.from({length:5001},()=>({id:boundary.rows[0].id}))});
    assert.equal((await db.query<{ready:boolean}>('select ready from portal_runtime_audit_projection')).rows[0].ready,false);
    assert.equal((await parity(db)).audit_chunks!.length,5001);
    await write(db,{auditLogs:[]});
    assert.equal((await db.query<{ready:boolean}>('select ready from portal_runtime_audit_projection')).rows[0].ready,true);
  }finally{await db.close();}
});

test('RPC/projeções/trigger são service-only, RLS forçado e invoker',async()=>{
  const db=await fixture({auditLogs:[{id:'private',before:{private:true}}]});
  try{
    for(const role of ['anon','authenticated']){
      await db.exec(`set role ${role}`);
      for(const sql of ["select * from portal_read_runtime_snapshot_v1('{}')","select * from portal_read_runtime_snapshot_uncached_v1('{}')",'select * from portal_runtime_audit_chunks','select * from portal_runtime_audit_projection','select portal_refresh_runtime_audit_projection()']){
        await assert.rejects(db.query(sql),/permission denied/);
      }
      await db.exec('reset role');
    }
    const security=await db.query<{proname:string;prosecdef:boolean}>("select proname,prosecdef from pg_proc where proname in ('portal_refresh_runtime_audit_projection','portal_read_runtime_snapshot_v1')");
    assert.ok(security.rows.every(row=>!row.prosecdef));
    assert.ok((await db.query<{relrowsecurity:boolean;relforcerowsecurity:boolean}>("select relrowsecurity,relforcerowsecurity from pg_class where relname in ('portal_runtime_audit_projection','portal_runtime_audit_chunks')")).rows.every(row=>row.relrowsecurity&&row.relforcerowsecurity));
    await db.exec('set role service_role');
    await parity(db);
    await write(db,{auditLogs:[{id:'service-new'}]});
    await parity(db);
  }finally{await db.close();}
});

test('benchmark local SQL: delta conhecido evita hash/ordenação repetidos sem ampliar bytes',async t=>{
  const payload={settings:{label:'s'.repeat(1_870_000)},auditLogs:Array.from({length:271},(_,i)=>({id:`event-${i}`,after:{value:'x'.repeat(9000)}}))};
  const db=await fixture(payload);
  try{
    const known=(await parity(db)).audit_chunks!.map(chunk=>chunk.fingerprint);
    const measure=async(sql:string,args:unknown[])=>{
      const values:number[]=[];
      for(let i=0;i<6;i++){
        const started=performance.now();
        await db.query(sql,args);
        if(i)values.push(performance.now()-started);
      }
      return values.sort((a,b)=>a-b)[2];
    };
    const originalMs=await measure('select octet_length(row_to_json(s)::text) from portal_read_runtime_snapshot_uncached_v1($1::text[]) s',[known]);
    const projectedMs=await measure('select octet_length(row_to_json(s)::text) from portal_read_runtime_snapshot_v1($1::text[]) s',[known]);
    const originalColdMs=await measure('select octet_length(row_to_json(s)::text) from portal_read_runtime_snapshot_uncached_v1($1::text[]) s',[[]]);
    const projectedColdMs=await measure('select octet_length(row_to_json(s)::text) from portal_read_runtime_snapshot_v1($1::text[]) s',[[]]);
    const sql="update portal_runtime_state set payload=jsonb_set(payload,'{draftCounter}',to_jsonb(revision)),revision=revision+1 where id='global'";
    await db.exec('alter table portal_runtime_state disable trigger portal_runtime_audit_projection_refresh');
    const baselineWrite=await measure(sql,[]);
    await db.exec('alter table portal_runtime_state enable trigger portal_runtime_audit_projection_refresh');
    const projectedWrite=await measure(sql,[]);
    await parity(db,known);
    const auditWriteSql="update portal_runtime_state set payload=jsonb_set(payload,'{auditLogs,0,after,counter}',to_jsonb(revision)),revision=revision+1 where id='global'";
    await db.exec('alter table portal_runtime_state disable trigger portal_runtime_audit_projection_refresh');
    const baselineAuditWrite=await measure(auditWriteSql,[]);
    await db.exec('alter table portal_runtime_state enable trigger portal_runtime_audit_projection_refresh');
    const projectedAuditWrite=await measure(auditWriteSql,[]);
    await parity(db);
    t.diagnostic(JSON.stringify({environment:'PGlite local, medians of 5 after warmup; no network/production claim',auditBytes:Buffer.byteLength(JSON.stringify(payload.auditLogs)),originalMs,projectedMs,speedup:originalMs/projectedMs,originalColdMs,projectedColdMs,baselineDraftWriteMs:baselineWrite,projectedDraftWriteMs:projectedWrite,baselineAuditWriteMs:baselineAuditWrite,projectedAuditWriteMs:projectedAuditWrite}));
    // Timing is evidence, not a CI assertion: shared-runner load can vary.
  }finally{await db.close();}
});
