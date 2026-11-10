import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationReadStore } from './notificationReadStore';

test('a leitura durável é isolada por conta e versão e não altera o estado do Portal', async t => {
  const originalUrl = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = 'https://notificacoes.example.invalid';
  const rows = new Map<string,string>();
  const requests: Array<{ method: string; path: string }> = [];
  t.mock.method(globalThis,'fetch',async (input: URL, init: RequestInit) => {
    const method = init.method || 'GET';
    requests.push({method,path:input.pathname});
    if (method==='POST') {
      const row = JSON.parse(String(init.body));
      assert.equal(row.preference_scope,'USER');
      assert.equal(row.updated_by,row.owner_email);
      assert.deepEqual(row.config,{});
      assert.equal(new Headers(init.headers).get('Prefer'),'resolution=ignore-duplicates,return=minimal');
      rows.set(row.owner_email+':'+row.table_key,row.table_key);
      return new Response(null,{status:201});
    }
    const owner = input.searchParams.get('owner_email')?.slice(4,-1);
    assert.equal(input.searchParams.get('preference_scope'),'eq.USER');
    assert.equal(input.searchParams.get('select'),'table_key');
    const keys = input.searchParams.get('table_key')?.slice(4,-1).split(',') || [];
    return Response.json(keys.filter(key=>rows.has(owner+':'+key)).map(table_key=>({table_key})));
  });
  try {
    const store = notificationReadStore('/not-used',true);
    const email = 'autor@example.invalid';
    const event = {id:'alerta-1',createdAt:'2026-11-06T12:00:00Z'};
    assert.deepEqual(await store.read(email,[]),new Set());
    assert.equal(requests.length,0);
    await Promise.all([store.mark(email,event),store.mark(email,event)]);
    assert.equal(rows.size,1);
    assert.deepEqual(await store.read(email,[event]),new Set([event.id]));
    assert.deepEqual(await store.read('outro@example.invalid',[event]),new Set());
    assert.deepEqual(await store.read(email,[{...event,createdAt:'2026-11-06T12:01:00Z'}]),new Set());
    assert.deepEqual(requests.map(request=>request.method),['POST','POST','GET','GET','GET']);
    assert.ok(requests.every(request=>request.path==='/rest/v1/portal_table_preferences'));
  } finally {
    if (originalUrl===undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL=originalUrl;
  }
});
