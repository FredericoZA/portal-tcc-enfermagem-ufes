import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('desenvolvimento oferece bootstrap único, modo compilado e verificação de paridade',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.local,'node scripts/prepare-local.mjs && node scripts/start-local-compiled.mjs');
  assert.equal(pkg.scripts['dev:compiled'],'node scripts/start-local-compiled.mjs');
  assert.equal(pkg.scripts['parity:check'],'node scripts/portal-parity.mjs');

  const prepare=read('scripts/prepare-local.mjs');
  assert.match(prepare,/copyFile\('\.env\.development\.example', '\.env\.local'\)/);
  assert.match(prepare,/npm'\), \['ci'\]/);

  const compiled=read('scripts/start-local-compiled.mjs');
  assert.match(compiled,/PORTAL_SERVE_COMPILED_CLIENT: 'true'/);
  assert.match(compiled,/PORTAL_GIT_COMMIT: commit/);
  assert.match(compiled,/VITE_PORTAL_LOCAL_DEMO_AUTH: 'true'/);
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


test('bundle compilado local preserva autenticação demo e seletor de usuário',()=>{
  const runtime=read('src/utils/runtimeEnvironment.ts');
  const api=read('src/services/apiClient.ts');
  const app=read('src/App.tsx');
  assert.match(runtime,/VITE_PORTAL_LOCAL_DEMO_AUTH === 'true'/);
  assert.match(api,/isLocalDemoFrontend\(\)/);
  assert.match(app,/isLocalDemoFrontend\(\) && <UserSimulatorBar/);
});

test('bootstrap gera segredos locais sem versioná-los',()=>{
  const env=read('.env.development.example');
  const prepare=read('scripts/prepare-local.mjs');
  assert.match(env,/PORTAL_ALLOW_INSECURE_DEMO_AUTH="true"/);
  assert.match(env,/PORTAL_SESSION_SECRET=""/);
  assert.match(env,/PORTAL_OTP_PEPPER=""/);
  assert.match(env,/PORTAL_OTP_DELIVERY_MODE="log"/);
  assert.match(env,/PORTAL_OTP_TEST_CODE="\d{6}"/);
  assert.match(prepare,/randomBytes\(36\)\.toString\('base64url'\)/);
  assert.match(prepare,/ensureSecret\('PORTAL_SESSION_SECRET'\)/);
  assert.match(prepare,/ensureSecret\('PORTAL_OTP_PEPPER'\)/);
});
