import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {buildRuntimePatch} from './integrations/supabase';

test('the runtime patch sends only changed items and delegates atomically to the canonical commit', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table portal_runtime_state(id text primary key, payload jsonb, revision bigint);
      create function portal_commit_runtime_state(expected_revision bigint, next_payload jsonb)
      returns bigint language sql as $$
        update public.portal_runtime_state set payload=next_payload, revision=revision+1
        where id='global' and revision=expected_revision returning revision
      $$;
    `);
    await db.exec(await readFile('supabase/migrations/20261109193000_runtime_patch_v1.sql', 'utf8'));
    const initial = {
      processes: [{id:'one', title:'original'}, {id:'two', title:'unchanged'}],
      auditLogs: [{id:'historical', data:'x'.repeat(100_000)}],
      settings: {keep:true},
    };
    const next = {...initial, processes:[{id:'one', title:'updated'}, initial.processes[1]], auditLogs:[...initial.auditLogs, {id:'new'}]};
    const patch = JSON.parse(buildRuntimePatch(5, initial, next)!);
    assert.deepEqual(patch, {expected_revision:5, changed_sections:{}, changed_items:{processes:{0:next.processes[0]}, auditLogs:{1:{id:'new'}}}});
    assert.equal(buildRuntimePatch(5, initial, {}), null);
    await db.query("insert into portal_runtime_state values ('global',$1,5)", [JSON.stringify(initial)]);
    const commit = (revision:number) => db.query(
      'select portal_commit_runtime_patch_v1($1,$2,$3)::int as revision',
      [revision, JSON.stringify(patch.changed_sections), JSON.stringify(patch.changed_items)],
    );
    assert.deepEqual((await commit(5)).rows, [{revision:6}]);
    await assert.rejects(commit(5), /concorrência/);
    assert.deepEqual((await db.query('select payload, revision::int from portal_runtime_state')).rows, [{payload:next, revision:6}]);
    await db.exec('set role anon');
    await assert.rejects(commit(6), /permission denied for function/);
  } finally {
    await db.close();
  }
});
