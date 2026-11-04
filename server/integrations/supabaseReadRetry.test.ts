import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPortalRuntimeState } from './supabase';

test('a leitura do estado tenta novamente apenas após erro transitório do PostgREST', async () => {
  const originalFetch = globalThis.fetch;
  const envNames = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','PORTAL_PERSISTENCE_PROVIDER'] as const;
  const originalEnv = Object.fromEntries(envNames.map(name => [name,process.env[name]]));
  let calls = 0;
  try {
    process.env.SUPABASE_URL = 'https://read-retry-test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-read-retry-key';
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.PORTAL_PERSISTENCE_PROVIDER = 'supabase';
    globalThis.fetch = async (url, options) => {
      assert.match(String(url), /portal_runtime_state\?id=eq\.global/);
      assert.equal(options?.method, undefined, 'somente leitura GET');
      calls++;
      return calls === 1
        ? Response.json({ code:'57014',message:'statement timeout' },{status:500})
        : Response.json([{ revision:9, payload:{safe:'new-state'} }]);
    };
    assert.deepEqual(await loadPortalRuntimeState(false), {safe:'new-state'});
    assert.equal(calls,2);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of envNames) {
      const value = originalEnv[name];
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('negações 403 não são repetidas e indisponibilidade persistente falha fechada', async () => {
  const originalFetch = globalThis.fetch;
  const envNames = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','PORTAL_PERSISTENCE_PROVIDER'] as const;
  const originalEnv = Object.fromEntries(envNames.map(name => [name,process.env[name]]));
  try {
    process.env.SUPABASE_URL = 'https://read-retry-test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-read-retry-key';
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.PORTAL_PERSISTENCE_PROVIDER = 'supabase';
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({}, {status:403}); };
    await assert.rejects(loadPortalRuntimeState(false), /Supabase \(403\)/);
    assert.equal(calls,1);

    calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({code:'57014'}, {status:500}); };
    await assert.rejects(loadPortalRuntimeState(false), /Supabase \(500\)/);
    assert.equal(calls,3, 'no máximo três leituras; sem retorno de dados defasados');
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of envNames) {
      const value = originalEnv[name];
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
