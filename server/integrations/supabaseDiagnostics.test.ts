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
  const batchSize=22; // one state probe, twenty private tables and one capability RPC
  try{
    process.env.SUPABASE_URL='https://diagnostic-test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY='fake-diagnostic-key';
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.PORTAL_PERSISTENCE_PROVIDER='supabase';
    Date.now=()=>now;
    globalThis.fetch=async(url)=>{
      requests++;
      if(fail)return new Response('{}',{status:503});
      if(String(url).includes('/rpc/portal_runtime_capabilities'))return Response.json({schema_version:6,transactional_runtime:true,secure_file_transport:'SUPABASE_PRIVATE_STORAGE',asten_transactional_outbox:true});
      return Response.json([]);
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
