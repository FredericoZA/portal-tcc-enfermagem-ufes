#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const directory = await mkdtemp(path.join(tmpdir(), 'portal-serverless-artifacts-'));
let child;
let output = '';
try {
  await mkdir(path.join(directory, 'api'), { recursive: true });
  await cp(path.join(root, 'dist/server'), path.join(directory, 'dist/server'), { recursive: true });
  // Non-source document resources are part of every configured function artifact.
  for (const resource of ['fonts', 'assets']) await cp(path.join(root, 'server/documents', resource), path.join(directory, 'server/documents', resource), { recursive: true });
  await symlink(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
  await writeFile(path.join(directory, 'package.json'), '{"type":"module"}\n');
  const names = ['index', 'runtime-asset', 'replication-model', 'public-indicators'];
  const adapters = (await readdir(path.join(root, 'api'))).filter((name) => name.endsWith('.ts') && !name.endsWith('.d.ts')).sort();
  assert.deepEqual(adapters, names.map((name) => name + '.ts').sort(), 'Every deployable API adapter must participate in the artifact smoke test.');
  for (const name of names) {
    const source = await readFile(path.join(root, 'api', name + '.ts'), 'utf8');
    const { code } = await transform(source, { loader: 'ts', format: 'esm', target: 'node22' });
    await writeFile(path.join(directory, 'api', name + '.js'), code);
  }
  const emittedFiles = [...await readdir(path.join(directory, 'api'), { recursive: true }), ...await readdir(path.join(directory, 'dist/server'), { recursive: true })];
  assert.ok(emittedFiles.every((name) => !String(name).endsWith('.ts')), 'Smoke staging must contain no TypeScript application source.');

  // Reproduce the failed production pattern in the same source-free fixture.
  await writeFile(path.join(directory, 'api', 'old-import.js'), "import '../server/security/requestAdmission';\n");
  const old = spawn(process.execPath, [path.join(directory, 'api/old-import.js')], { cwd: directory, env: {}, stdio: ['ignore', 'pipe', 'pipe'] });
  let oldError = '';
  old.stderr.on('data', (chunk) => { oldError += String(chunk); });
  const [oldCode] = await once(old, 'exit');
  assert.notEqual(oldCode, 0);
  assert.match(oldError, /ERR_MODULE_NOT_FOUND/);
  await rm(path.join(directory, 'api', 'old-import.js'));

  await cp(path.join(root, 'scripts/fixtures/serverless-runtime-smoke.mjs'), path.join(directory, 'smoke.mjs'));
  const secret = () => randomBytes(32).toString('hex');
  child = spawn(process.execPath, ['smoke.mjs'], {
    cwd: directory,
    // No inherited portal credentials and no tsx/import loader.
    env: {
      PATH: process.env.PATH, NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production',
      PORTAL_DATA_DIR: path.join(directory, 'data'), PORTAL_BOOTSTRAP_MASTER_EMAIL: 'master@example.invalid',
      PORTAL_PERSISTENCE_PROVIDER: 'supabase', SUPABASE_URL: 'https://database.example.invalid', SUPABASE_SECRET_KEY: secret(),
      PORTAL_SESSION_SECRET: secret(), PORTAL_OTP_PEPPER: secret(), PORTAL_SECRET_ENCRYPTION_KEY: secret(),
      PORTAL_UPLOAD_BINDING_SECRET: secret(), PORTAL_VERIFICATION_SECRET: secret(), CRON_SECRET: secret(),
      SUPABASE_SECURE_FILES_BUCKET: 'private-fixture', GOOGLE_OAUTH_CLIENT_ID: 'fixture-client', GOOGLE_OAUTH_CLIENT_SECRET: secret(),
      GOOGLE_OAUTH_STATE_SECRET: secret(), PORTAL_PUBLIC_URL: 'https://portal.example.invalid', APP_URL: 'https://portal.example.invalid',
      PORTAL_DRIVE_TECHNICAL_FOLDER_ID: 'technical_fixture_123',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let port;
  child.stdout.on('data', (chunk) => {
    output += String(chunk);
    for (const line of output.split('\n')) { try { port ||= JSON.parse(line).port; } catch { /* Startup logs are not JSON. */ } }
  });
  child.stderr.on('data', (chunk) => { output += String(chunk); });
  for (let attempt = 0; !port && attempt < 150; attempt++) {
    if (child.exitCode !== null) throw new Error('Serverless artifact harness exited before startup. ' + output.slice(-4000));
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(port, 'Serverless artifact harness did not start. ' + output.slice(-4000));
  const base = 'http://127.0.0.1:' + port;
  const get = async (route) => {
    try { return await fetch(base + route, { signal: AbortSignal.timeout(15_000) }); }
    catch (cause) { throw new Error('Artifact request failed at ' + route + '. ' + output.slice(-5000), { cause }); }
  };

  let result = await get('/api/health');
  assert.equal(result.status, 200, 'Main wrapper must load the real app bundle. ' + await result.clone().text());
  assert.equal((await result.json()).status, 'ok');
  result = await get('/api/me');
  assert.equal(result.status, 200, 'Main wrapper must route through Express. ' + await result.clone().text());
  assert.equal((await result.json()).isAuthenticated, false);

  for (const key of ['a', 'b']) {
    result = await get('/asset?key=' + key.repeat(64) + '&format=png');
    assert.equal(result.status, 200, 'Image wrapper must load raster and dynamic Drive dependencies. ' + await result.clone().text());
    assert.equal(result.headers.get('content-type'), 'image/png');
    assert.equal(Buffer.from(await result.arrayBuffer()).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
  result = await get('/replication?slug=all');
  assert.equal(result.status, 200, 'Replication wrapper must load OAuth/Drive/ZIP dependencies. ' + await result.clone().text());
  assert.equal(result.headers.get('content-type'), 'application/zip');
  assert.equal(Buffer.from(await result.arrayBuffer()).subarray(0, 2).toString('hex'), '504b');
  const beforeIndicators = (await (await get('/__smoke/calls')).json()).calls.length;
  result = await get('/indicators');
  assert.equal(result.status, 200);
  const indicators=await result.json();
  assert.equal(indicators.totals.registered,6);
  assert.equal(indicators.totals.completed,6);
  assert.equal(indicators.totals.published,3);
  assert.doesNotMatch(JSON.stringify(indicators),/Private historical|private_historical|private-historical|legado-|sourceFingerprint|attachments|@/);
  assert.match(result.headers.get('cache-control'), /private, no-store/);
  const indicatorReads=(await (await get('/__smoke/calls')).json()).calls.slice(beforeIndicators);
  assert.equal(indicatorReads.length,1,'Indicators read only the necessary state projection.');
  assert.deepEqual(indicatorReads[0],{host:'database.example.invalid',path:'/rest/v1/portal_runtime_state',method:'GET'});
  const indicatorBundle=await readFile(path.join(directory,'dist/server/vercel/public-indicators.cjs'),'utf8');
  assert.doesNotMatch(indicatorBundle,/loadIntegrationSecret|GOOGLE_OAUTH_CLIENT_SECRET|sendGmailMessage|ASTEN_|createPortalApp/,'Public aggregates must not load the application or provider credential modules.');

  // Exhaust the download admission budget without provider access. A valid
  // provider operation must then stop at 429, before OAuth or Drive is called.
  for (let attempt = 0; attempt < 60; attempt++) await get('/replication?slug=invalid');
  const before = (await (await get('/__smoke/calls')).json()).calls.length;
  result = await get('/replication?slug=all');
  assert.equal(result.status, 429);
  const final = await (await get('/__smoke/calls')).json();
  assert.equal(final.calls.length, before, 'Rejected requests must not reach providers.');
  assert.deepEqual(final.unexpected, [], 'All upstream requests must be expected synthetic reads.');
  assert.ok(final.calls.some((call) => call.host === 'oauth2.googleapis.com'));
  assert.ok(final.calls.some((call) => call.path === '/drive/v3/files/image_fixture_123'));
  console.log('Serverless artifacts: old ESM failure reproduced; four emitted wrappers, real app startup, SVG/Drive images, OAuth/ZIP, public historical aggregates and admission passed in plain Node. No real provider traffic.');
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 2000))]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  await rm(directory, { recursive: true, force: true });
}
