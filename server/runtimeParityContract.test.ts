import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('desenvolvimento oferece modo compilado e verificação de paridade',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['dev:compiled'],'node scripts/start-local-compiled.mjs');
  assert.equal(pkg.scripts['parity:check'],'node scripts/portal-parity.mjs');
  const compiled=read('scripts/start-local-compiled.mjs');
  assert.match(compiled,/PORTAL_SERVE_COMPILED_CLIENT: 'true'/);
  assert.match(compiled,/PORTAL_GIT_COMMIT: commit/);
});

test('build local identifica o mesmo commit que CI e Vercel',()=>{
  const vite=read('vite.config.ts');
  assert.match(vite,/VERCEL_GIT_COMMIT_SHA/);
  assert.match(vite,/GITHUB_SHA/);
  assert.match(vite,/PORTAL_GIT_COMMIT/);
  assert.match(vite,/git', \['rev-parse', '--short=7', 'HEAD'\]/);
});

test('health check local informa commit, versão e tipo de runtime',()=>{
  const server=read('server.ts');
  assert.match(server,/version: runtimePackageVersion/);
  assert.match(server,/commit: runtimeGitCommit\(\)/);
  assert.match(server,/runtime: productionRuntime \? 'production' : serveCompiledClient \? 'local-compiled' : 'local-source'/);
});

test('aparência continua com um único entrypoint canônico de CSS',()=>{
  const css=read('src/index.css');
  const imports=[...css.matchAll(/@import\s+"([^"]+)";/g)].map(match=>match[1]);
  assert.deepEqual(imports,[
    'tailwindcss',
    './styles/portal-tokens.css',
    './styles/portal-layout.css',
    './styles/portal-components.css',
    './styles/portal-sheet.css',
    './styles/portal-pages.css',
    './styles/portal-responsive.css',
  ]);
});
