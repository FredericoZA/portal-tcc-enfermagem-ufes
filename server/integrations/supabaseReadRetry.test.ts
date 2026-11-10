import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPortalCalendarSnapshot, loadPortalRuntimeState, refreshPortalRuntimeState } from './supabase';

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


test('uma revisão igual restaura o estado confirmado sem reutilizar objetos mutáveis', async t => {
  const overrides = {
    SUPABASE_URL: 'https://revision-fixture.supabase.co',
    SUPABASE_SECRET_KEY: 'fixture-only-revision-key',
    PORTAL_PERSISTENCE_PROVIDER: 'supabase',
  };
  for (const [key, value] of Object.entries(overrides)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const selections: Array<string | null> = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    const selection = new URL(url).searchParams.get('select');
    selections.push(selection);
    return Response.json(selection === 'revision'
      ? [{revision: 3}]
      : [{revision: 3, payload: {access: {allowed: true}}}]);
  });

  const initial = await loadPortalRuntimeState<{access: {allowed: boolean}}>();
  assert.ok(initial);
  initial.access.allowed = false;
  const refreshed = await refreshPortalRuntimeState<{access: {allowed: boolean}}>();
  assert.deepEqual(refreshed, {access: {allowed: true}});
  assert.deepEqual(selections, ['payload,revision', 'revision']);
});


test('calendário consulta somente processos e perfil, sem baixar o estado integral', async t => {
  const overrides = {
    SUPABASE_URL: 'https://calendar-fixture.supabase.co',
    SUPABASE_SECRET_KEY: 'fixture-only-calendar-key',
    PORTAL_PERSISTENCE_PROVIDER: 'supabase',
  };
  for (const [key, value] of Object.entries(overrides)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const installationProfile = {defaultDefenseLocation: 'Auditório'};
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url: string) => {
    const request = new URL(url);
    assert.equal(request.pathname, '/rest/v1/portal_runtime_state');
    assert.equal(request.searchParams.get('id'), 'eq.global');
    assert.equal(request.searchParams.get('select'), 'revision,processes:payload->processes,installationProfile:payload->settings->installationProfile');
    return Response.json([{revision: 42, processes: [], installationProfile}]);
  });

  assert.deepEqual(await loadPortalCalendarSnapshot(), {revision: 42, processes: [], settings: {installationProfile}});
  assert.equal(fetchMock.mock.callCount(), 1);
});
