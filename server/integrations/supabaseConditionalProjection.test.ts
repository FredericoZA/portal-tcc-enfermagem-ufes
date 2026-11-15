import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test, { type TestContext } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import {
  currentPortalRuntimeRevision,
  loadPortalRuntimeLeanState,
  loadPortalRuntimeLiteState,
  readCachedPortalRuntimeState,
  refreshPortalRuntimeLeanState,
  refreshPortalRuntimeLiteState,
} from './supabase';

const migration =
  'supabase/migrations/20261111194302_conditional_runtime_projection.sql';
const rpc = '/rest/v1/rpc/portal_read_runtime_projection_v1';
type ProjectionRow = {
  revision: number;
  fingerprint: string;
  payload: Record<string, any> | null;
};
function configure(t: TestContext, origin: string) {
  for (const [key, value] of Object.entries({
    SUPABASE_URL: origin,
    SUPABASE_SECRET_KEY: 'local-test-key-without-real-credentials',
    PORTAL_PERSISTENCE_PROVIDER: 'supabase',
    PORTAL_RUNTIME_WIRE_SNAPSHOT: 'false',
    PORTAL_RUNTIME_AUDIT_DELTA: 'false',
    PORTAL_RUNTIME_CONDITIONAL_READS: 'true',
  })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
}

test('conditional SQL compares the current projection atomically without discarding evidence or permissions', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create table portal_runtime_state(id text primary key,revision bigint not null,payload jsonb not null);
      alter table portal_runtime_state enable row level security;
      alter table portal_runtime_state force row level security;
      revoke all on portal_runtime_state from public,anon,authenticated;
      grant select on portal_runtime_state to service_role;`);
    const original = {
      settings: { site: 'Portal' },
      processes: [{ id: 'tcc-1', authorEmail: 'one@example.invalid' }],
      authorizedStudents: [{ email: 'one@example.invalid', active: true }],
      revokedSessionIds: [],
      auditLogs: [{ id: 'audit-1', evidence: 'preserved' }],
      legacyAcademicRecords: [{ id: 'legacy-1' }],
    };
    await db.query("insert into portal_runtime_state values('global',7,$1)", [
      JSON.stringify(original),
    ]);
    await db.exec(await readFile(migration, 'utf8'));
    const read = (kind: string, hash: string | null = null) =>
      db.query<ProjectionRow>(
        'select * from public.portal_read_runtime_projection_v1($1,$2)',
        [kind, hash],
      );
    const first = (await read('LEAN')).rows[0];
    assert.equal(first.revision, 7);
    assert.match(first.fingerprint, /^[a-f0-9]{64}$/);
    const { auditLogs, legacyAcademicRecords, ...lean } = original;
    assert.deepEqual(first.payload, lean);
    const firstLite = (await read('LITE')).rows[0];
    assert.deepEqual(firstLite.payload, { ...lean, legacyAcademicRecords });
    assert.notEqual(firstLite.fingerprint, first.fingerprint);
    assert.deepEqual((await read('LEAN', first.fingerprint)).rows, [
      { ...first, payload: null },
    ]);
    await db.exec(`update portal_runtime_state set revision=8,
      payload=jsonb_set(payload,'{auditLogs}',payload->'auditLogs'||'[{"id":"audit-2"}]'::jsonb)`);
    assert.deepEqual((await read('LEAN', first.fingerprint)).rows, [
      { ...first, revision: 8, payload: null },
    ]);
    assert.deepEqual((await read('LITE', firstLite.fingerprint)).rows, [
      { ...firstLite, revision: 8, payload: null },
    ]);
    await db.exec(`update portal_runtime_state set revision=9,
      payload=jsonb_set(payload,'{legacyAcademicRecords}','[{"id":"legacy-2"}]'::jsonb)`);
    assert.equal((await read('LEAN', first.fingerprint)).rows[0].payload, null);
    assert.notEqual(
      (await read('LITE', firstLite.fingerprint)).rows[0].payload,
      null,
    );
    await db.exec(`update portal_runtime_state set revision=10,
      payload=jsonb_set(payload,'{authorizedStudents,0,active}','false'::jsonb)`);
    const deactivated = (await read('LEAN', first.fingerprint)).rows[0];
    assert.notEqual(deactivated.fingerprint, first.fingerprint);
    assert.equal(deactivated.payload?.authorizedStudents[0].active, false);
    await db.exec(`update portal_runtime_state set revision=11,
      payload=jsonb_set(payload,'{revokedSessionIds}','["revoked-session"]'::jsonb)`);
    const revoked = (await read('LEAN', deactivated.fingerprint)).rows[0];
    assert.notEqual(revoked.fingerprint, deactivated.fingerprint);
    assert.deepEqual(revoked.payload?.revokedSessionIds, ['revoked-session']);
    const canonical = (
      await db.query<{ revision: number; payload: any }>(
        'select * from portal_runtime_state',
      )
    ).rows[0];
    assert.equal(
      canonical.revision,
      11,
      'reads never increment the CAS revision',
    );
    assert.deepEqual(canonical.payload.auditLogs, [
      ...auditLogs,
      { id: 'audit-2' },
    ]);
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role);
      await assert.rejects(
        read('LEAN', revoked.fingerprint),
        /permission denied/,
      );
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    assert.equal(
      (await read('LEAN', revoked.fingerprint)).rows[0].payload,
      null,
    );
    await db.exec('reset role');
    await assert.rejects(read('FULL'), /Invalid runtime projection/);
    await assert.rejects(
      read('LEAN', 'untrusted'),
      /Invalid runtime projection fingerprint/,
    );
    assert.equal(
      (
        await db.query<{ prosecdef: boolean }>(
          "select prosecdef from pg_proc where oid='public.portal_read_runtime_projection_v1(text,text)'::regprocedure",
        )
      ).rows[0].prosecdef,
      false,
    );
  } finally {
    await db.close();
  }
});

test('warm lean and lite readers reuse only a current matching hash; audit-only commits transfer metadata', async (t) => {
  configure(t, 'https://conditional-cost.invalid');
  let revision = 7;
  const state: Record<string, any> = {
    settings: { site: 'Portal', content: 's'.repeat(40_000) },
    processes: [
      { id: 'one', title: 'title', participants: 'p'.repeat(120_000) },
    ],
    authorizedStudents: [{ email: 'one@example.invalid', active: true }],
    revokedSessionIds: [],
    legacyAcademicRecords: [{ id: 'legacy', content: 'l'.repeat(180_000) }],
    auditLogs: [{ id: 'audit', content: 'a'.repeat(300_000) }],
  };
  const calls: { path: string; bytes: number; sent?: any }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: any, init?: RequestInit) => {
    const target = new URL(url);
    let body: any, sent: any;
    if (target.pathname === rpc) {
      assert.equal(init?.method, 'POST');
      sent = JSON.parse(String(init?.body));
      const { auditLogs, ...lite } = state;
      const { legacyAcademicRecords, ...lean } = lite;
      const projection = sent.projection_kind === 'LEAN' ? lean : lite;
      const fingerprint = createHash('sha256')
        .update(JSON.stringify(projection))
        .digest('hex');
      body = [
        {
          revision,
          fingerprint,
          payload: sent.known_fingerprint === fingerprint ? null : projection,
        },
      ];
    } else {
      assert.equal(target.pathname, '/rest/v1/portal_runtime_state');
      assert.equal(target.searchParams.get('select'), 'revision');
      body = [{ revision }];
    }
    calls.push({
      path: target.pathname,
      bytes: Buffer.byteLength(JSON.stringify(body)),
      sent,
    });
    return Response.json(body);
  });
  const first = await loadPortalRuntimeLeanState<Record<string, any>>();
  assert.equal(first?.processes[0].id, 'one');
  first!.processes[0].id = 'mutated-uncommitted-copy';
  assert.equal(
    (await refreshPortalRuntimeLeanState<Record<string, any>>())?.processes[0]
      .id,
    'one',
  );
  assert.equal(calls.at(-1)?.path, '/rest/v1/portal_runtime_state');
  revision++;
  state.auditLogs.push({ id: 'audit-2' });
  assert.equal(
    (await refreshPortalRuntimeLeanState<Record<string, any>>())?.processes[0]
      .id,
    'one',
  );
  const leanMetadata = calls.at(-1)!;
  assert.ok(leanMetadata.bytes < 160);
  const firstBytes = calls[0].bytes;
  assert.ok(firstBytes > 160_000);
  assert.ok(
    leanMetadata.bytes / firstBytes < 0.001,
    'unchanged payload is omitted, not resent then filtered',
  );
  await loadPortalRuntimeLiteState();
  revision++;
  state.auditLogs.push({ id: 'audit-3' });
  assert.ok(await refreshPortalRuntimeLiteState());
  const liteMetadata = calls.at(-1)!;
  assert.ok(liteMetadata.bytes < 160);
  revision++;
  state.authorizedStudents[0].active = false;
  state.revokedSessionIds.push('session-1');
  const fresh = await refreshPortalRuntimeLeanState<Record<string, any>>();
  assert.equal(fresh?.authorizedStudents[0].active, false);
  assert.deepEqual(fresh?.revokedSessionIds, ['session-1']);
  assert.ok(
    calls.at(-1)!.bytes > 160_000,
    'permission changes must transfer and replace the snapshot',
  );
  assert.equal(
    currentPortalRuntimeRevision(),
    null,
    'read projections cannot become a write baseline',
  );
  assert.equal(
    readCachedPortalRuntimeState(revision),
    null,
    'partial state never populates the canonical write cache',
  );
  t.diagnostic(
    JSON.stringify({
      fixture: true,
      leanInitialResponseBytes: firstBytes,
      auditOnlyLeanResponseBytes: leanMetadata.bytes,
      auditOnlyLiteResponseBytes: liteMetadata.bytes,
      requestsForChangedRevision: 2,
    }),
  );
});

test('malformed acknowledgements and denied reads never reuse stale projections or fall back to another privilege', async (t) => {
  configure(t, 'https://conditional-validation.invalid');
  const hash = 'a'.repeat(64);
  let answer: any = [
      { revision: 1, fingerprint: hash, payload: { processes: [] } },
    ],
    status = 200;
  const paths: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: any) => {
    paths.push(new URL(url).pathname);
    return Response.json(answer, { status });
  });
  await loadPortalRuntimeLeanState();
  for (const invalid of [
    [{ revision: 2, fingerprint: 'b'.repeat(64), payload: null }],
    [{ revision: 2, fingerprint: hash }],
    [{ revision: 2, fingerprint: hash, payload: { auditLogs: [] } }],
    [
      {
        revision: 2,
        fingerprint: hash,
        payload: { legacyAcademicRecords: [] },
      },
    ],
    [{ revision: 0, fingerprint: hash, payload: {} }],
    [null],
    [[]],
    [],
  ]) {
    answer = invalid;
    await assert.rejects(loadPortalRuntimeLeanState());
  }
  for (const code of [401, 403, 404, 500]) {
    status = code;
    answer = { code: code === 500 ? '57014' : '42501' };
    await assert.rejects(
      loadPortalRuntimeLeanState(),
      new RegExp(String(code)),
    );
  }
  assert.ok(paths.every((path) => path === rpc));
  configure(t, 'https://conditional-no-cache.invalid');
  status = 200;
  answer = [{ revision: 1, fingerprint: hash, payload: null }];
  await assert.rejects(loadPortalRuntimeLiteState(), /não confirmou/);
});

test('an additive migration rollout uses existing readers and backs off only for an absent RPC', async (t) => {
  configure(t, 'https://conditional-rollout.invalid');
  const paths: string[] = [];
  let now = Date.now(),
    installed = false;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'fetch', async (url: any) => {
    const path = new URL(url).pathname;
    paths.push(path);
    if (path === rpc)
      return installed
        ? Response.json([
            {
              revision: 2,
              fingerprint: 'b'.repeat(64),
              payload: { settings: { current: true } },
            },
          ])
        : Response.json({ code: 'PGRST202' }, { status: 404 });
    assert.equal(path, '/rest/v1/rpc/portal_read_runtime_lean_v1');
    return Response.json([
      { revision: 1, payload: { settings: { legacyReader: true } } },
    ]);
  });
  assert.deepEqual(await loadPortalRuntimeLeanState(), {
    settings: { legacyReader: true },
  });
  assert.deepEqual(await loadPortalRuntimeLeanState(), {
    settings: { legacyReader: true },
  });
  assert.deepEqual(paths, [
    rpc,
    '/rest/v1/rpc/portal_read_runtime_lean_v1',
    '/rest/v1/rpc/portal_read_runtime_lean_v1',
  ]);
  installed = true;
  now += 60_001;
  assert.deepEqual(await loadPortalRuntimeLeanState(), {
    settings: { current: true },
  });
  assert.equal(paths.at(-1), rpc);
  process.env.PORTAL_RUNTIME_CONDITIONAL_READS = 'false';
  await loadPortalRuntimeLeanState();
  assert.equal(paths.at(-1), '/rest/v1/rpc/portal_read_runtime_lean_v1');
});
