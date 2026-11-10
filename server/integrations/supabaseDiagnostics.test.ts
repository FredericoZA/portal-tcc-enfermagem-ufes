import test from 'node:test';
import assert from 'node:assert/strict';
import {getSupabaseRuntimeConnectionStatus,testSupabaseRuntimeConnection} from './supabase';

test('diagnóstico administrativo agrupa consultas e expira sem guardar falha ou ignorar troca de projeto',async()=>{
  const originalFetch=globalThis.fetch;
  const originalNow=Date.now;
  const envNames=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','PORTAL_PERSISTENCE_PROVIDER'] as const;
  const previous=Object.fromEntries(envNames.map(key=>[key,process.env[key]]));
  let now=100_000;
  let requests=0;
  let fail=false;
  const batchSize=1; // The RPC validates tables, grants and capabilities in the database.
  try{
    process.env.SUPABASE_URL='https://diagnostic-test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY='fake-diagnostic-key';
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.PORTAL_PERSISTENCE_PROVIDER='supabase';
    Date.now=()=>now;
    globalThis.fetch=async(url)=>{
      requests++;
      if(fail)return new Response('{}',{status:503});
      assert.match(String(url), /\/rpc\/portal_check_runtime_v1$/);
      return Response.json({normalized_tables_ready:true,schema_version:6,transactional_runtime:true,secure_file_transport:'SUPABASE_PRIVATE_STORAGE',asten_transactional_outbox:true});
    };
    const [one,two]=await Promise.all([getSupabaseRuntimeConnectionStatus(),getSupabaseRuntimeConnectionStatus()]);
    assert.equal(one.transactionalRuntimeReady,true);
    assert.equal(two.transactionalRuntimeReady,true);
    assert.equal(requests,batchSize);
    one.connected=false;
    assert.equal((await getSupabaseRuntimeConnectionStatus()).connected,true);
    assert.equal(requests,batchSize);
    now+=30_001;
    await getSupabaseRuntimeConnectionStatus();
    assert.equal(requests,batchSize*2);
    // Explicit tests and startup do not use a potentially stale cached success.
    fail=true;
    assert.equal((await testSupabaseRuntimeConnection()).connected,false);
    assert.equal(requests,batchSize*2+1);
    now+=30_001;
    assert.equal((await getSupabaseRuntimeConnectionStatus()).connected,false);
    assert.equal((await getSupabaseRuntimeConnectionStatus()).connected,false);
    assert.equal(requests,batchSize*2+3);
    fail=false;
    process.env.SUPABASE_URL='https://different-diagnostic-test.supabase.co';
    await getSupabaseRuntimeConnectionStatus();
    assert.equal(requests,batchSize*3+3);
    process.env.SUPABASE_SERVICE_ROLE_KEY='fake-rotated-diagnostic-key';
    await getSupabaseRuntimeConnectionStatus();
    assert.equal(requests,batchSize*4+3);
  }finally{
    globalThis.fetch=originalFetch;
    Date.now=originalNow;
    for(const key of envNames){const value=previous[key];if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});

test('preflight SQL blocks anonymous callers and detects missing tables and SELECT grants', async () => {
  const {PGlite} = await import('@electric-sql/pglite');
  const {readFile} = await import('node:fs/promises');
  const migration = await readFile('supabase/migrations/20261106012000_portal_runtime_preflight.sql', 'utf8');
  const tables = Array.from(migration.matchAll(/'(portal_[a-z_]+)'/g), match => match[1]);
  assert.equal(tables.length, 20);
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table public.portal_runtime_state(id text);
      grant select on public.portal_runtime_state to service_role;
      create function public.portal_runtime_capabilities() returns jsonb language sql
        as $$ select '{"schema_version":6}'::jsonb $$;
    `);
    await db.exec(migration);
    const check = async (ready: boolean) => {
      await db.exec('set role service_role');
      const result = await db.query('select public.portal_check_runtime_v1() as readiness');
      assert.deepEqual(result.rows, [{readiness: {schema_version: 6, normalized_tables_ready: ready}}]);
      await db.exec('reset role');
    };
    await check(false);
    for (const table of tables) {
      await db.exec(`create table public.${table}(id text); grant select on public.${table} to service_role;`);
    }
    await check(true);
    await db.exec('revoke select on public.portal_users from service_role');
    await check(false);
    await db.exec('set role anon');
    await assert.rejects(db.query('select public.portal_check_runtime_v1()'), /permission denied/);
  } finally {
    await db.close();
  }
});
