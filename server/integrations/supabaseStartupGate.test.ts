import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifySupabaseStartupRequirements } from './supabase';

test('cold start valida capacidades em uma chamada e falha fechado em incompatibilidade',async()=>{
  const originalFetch=globalThis.fetch;
  const vars=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','PORTAL_PERSISTENCE_PROVIDER'] as const;
  const previous=Object.fromEntries(vars.map(name=>[name,process.env[name]]));
  let calls=0;
  const capabilities={
    schema_version:6,transactional_runtime:true,optimistic_concurrency:true,
    normalized_core_projection:true,secure_file_transport:'SUPABASE_PRIVATE_STORAGE',
    asten_transactional_outbox:true,
  };
  let status=200;
  let result={...capabilities};
  try{
    process.env.SUPABASE_URL='https://startup-gate-test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY='local-test-key';
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.PORTAL_PERSISTENCE_PROVIDER='supabase';
    globalThis.fetch=async(url,init)=>{
      calls++;
      assert.match(String(url),/\/rest\/v1\/rpc\/portal_runtime_capabilities$/);
      assert.equal(init?.method,'POST');
      return Response.json(result,{status});
    };
    await assert.doesNotReject(verifySupabaseStartupRequirements());
    assert.equal(calls,1,'nenhuma das 20 tabelas é sondada individualmente');
    result={...capabilities,asten_transactional_outbox:false};
    await assert.rejects(verifySupabaseStartupRequirements(),/incompatível/);
    status=503;
    await assert.rejects(verifySupabaseStartupRequirements(),/\(503\)/);
    assert.equal(calls,3);
  }finally{
    globalThis.fetch=originalFetch;
    for(const name of vars){const value=previous[name];if(value===undefined)delete process.env[name];else process.env[name]=value;}
  }
});

test('o servidor hidrata dados depois do gate e preserva diagnóstico completo para Master',()=>{
  const content=readFileSync(new URL('../../server.ts',import.meta.url),'utf8');
  const gate=content.indexOf('await verifySupabaseStartupRequirements()');
  const hydrate=content.indexOf('const remote = await loadPortalRuntimeState<PersistedPortalState>();',gate);
  assert.ok(gate>=0&&hydrate>gate);
  assert.match(content,/getSupabaseRuntimeConnectionStatus/);
});
