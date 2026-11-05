import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';

test('every deployed API function uses an explicit compiled artifact and packaged resources', async () => {
  const adapters = (await readdir('api')).filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts')).sort();
  const expected = ['index.ts', 'public-indicators.ts', 'replication-model.ts', 'runtime-asset.ts'];
  assert.deepEqual(adapters, expected);
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  for (const adapter of adapters) {
    const source = await readFile('api/' + adapter, 'utf8');
    const name = adapter.slice(0, -3);
    assert.ok(source.includes("loadBundle('../dist/server/vercel/" + name + ".cjs')"));
    assert.doesNotMatch(source, /from ['"]\.\.\/server\//);
    assert.match(config.functions['api/' + adapter].includeFiles, /dist\/server\/\*\*/);
    assert.match(config.functions['api/' + adapter].includeFiles, /server\/documents\/fonts\/\*\*/);
    assert.match(config.functions['api/' + adapter].includeFiles, /pdf\.worker\.mjs/);
  }
});

test('deployment upload excludes local reviews, provider state and credential files', async () => {
  const ignored = new Set((await readFile('.vercelignore', 'utf8')).split(/\r?\n/).map((line) => line.trim()));
  for (const name of [
    '.portal-data/', '.env*', 'output/', 'tmp/', '.vercel/', '.supabase/',
    '.supabase-temp/', 'supabase/.temp/', '.playwright-cli/', '.playwright-mcp/',
    '.npmrc', '*.pem', '*.key', '*.p12', '*.pfx', '*.keystore',
    'credentials*.json', 'client_secret*.json', 'service-account*.json', 'service_account*.json',
  ]) assert.ok(ignored.has(name), `Missing deployment exclusion: ${name}`);
});
