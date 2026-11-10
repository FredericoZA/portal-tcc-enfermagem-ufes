import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';
import { packageRelease } from '../scripts/package-release.mjs';

test('source release preserves reproducible source and excludes local data, credentials and generated reviews', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'portal-release-package-'));
  const included = [
    'package.json', 'server.ts', 'supabase/migrations/001.sql', '.env.example',
    '.env.local.example', 'server/flow.test.ts', 'docs/operation.md',
    'public/manual/manual.pdf', 'src/main.tsx',
  ];
  const excluded = [
    '.portal-data/records.json', '.git/config', '.vercel/project.json',
    '.supabase/config.json', '.supabase-temp/config.json', 'supabase/.temp/project-ref',
    '.playwright-cli/state.json', '.playwright-mcp/state.json',
    'node_modules/library/index.js', 'dist/client/index.html', 'build/server.js',
    'coverage/index.html', 'test-results/result.json', 'playwright-report/index.html',
    'review_inputs/input.pdf', 'output/review.json', 'tmp/readback.json',
    '.env', '.env.local', '.env.production', '.npmrc', '.DS_Store',
    'credentials.json', 'nested/credentials-google.json', 'client_secret_google.json',
    'service-account.json', 'nested/service_account_private.json',
    'certificate.pem', 'private.key', 'certificate.p12', 'certificate.pfx',
    'private.keystore', 'run.log', 'old-release.zip',
  ];
  try {
    for (const name of [...included, ...excluded]) {
      const file = path.join(root, name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, `fixture:${name}`);
    }
    await symlink(path.join(root, '.portal-data'), path.join(root, 'linked-private-data'));
    await symlink(path.join(root, '.env.local'), path.join(root, 'linked-file.txt'));
    const first = await packageRelease(root, path.join(root, 'first.zip'));
    const second = await packageRelease(root, path.join(root, 'second.zip'));
    assert.equal(first.files, included.length);
    assert.equal(first.sha256, second.sha256);
    const archive = await JSZip.loadAsync(await readFile(first.outputPath), { checkCRC32: true });
    assert.deepEqual(Object.keys(archive.files).sort(), included.sort());
    for (const name of included) assert.equal(await archive.file(name)?.async('string'), `fixture:${name}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
