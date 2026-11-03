import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {request as httpRequest} from 'node:http';
import {INITIAL_SETTINGS} from '../../src/services/demoSeed';

test('HTTP: document scanning preserves markers and permissions and handles unclosed delimiters', {timeout: 45000}, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'portal-regex-scan-'));
  await writeFile(path.join(directory, 'portal-state.json'), JSON.stringify({settings: structuredClone(INITIAL_SETTINGS), processes: [], memberships: []}));
  const reservation = createServer();
  await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = (reservation.address() as import('node:net').AddressInfo).port;
  await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    env: {...process.env, NODE_ENV: 'development', PORT: String(port), PORTAL_DATA_DIR: directory,
      PORTAL_SESSION_SECRET: 'test-session-secret-0123456789-abcdef', PORTAL_OTP_PEPPER: 'test-otp-pepper-0123456789-abcdef',
      PORTAL_ALLOW_INSECURE_DEMO_AUTH: 'true', PORTAL_ALLOW_LOCAL_OTP_STORE: 'true', PORTAL_ALLOW_LOCAL_SECRET_STORE: 'true',
      PORTAL_TEST_DOCUMENT_RENDERER: 'true', PORTAL_OTP_DELIVERY_MODE: 'log', ASTEN_INTEGRATION_ENABLED: 'false',
      PORTAL_PERSISTENCE_PROVIDER: 'local_file', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SECRET_KEY: ''},
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.resume(); child.stderr.resume();
  const base = `http://127.0.0.1:${port}`;
  const scan = async (body: unknown, email = 'master@portal.local') => {
    const response = await fetch(base + '/api/scan-drive-doc', {method: 'POST', headers: {'content-type': 'application/json', ...(email ? {'x-demo-user-email': email} : {})}, body: JSON.stringify(body), signal: AbortSignal.timeout(6000)});
    return {status: response.status, body: await response.json()};
  };
  try {
    const deadline = Date.now() + 25000;
    while (true) {
      try {if ((await fetch(base + '/api/health')).ok) break;} catch { /* startup */ }
      if (Date.now() > deadline || child.exitCode !== null) throw new Error('Servidor de teste não iniciou.');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal((await scan({text: '<<NOME>>'}, '')).status, 401);
    assert.equal((await scan({text: '<<NOME>>'}, 'student@example.invalid')).status, 403);
    const control = await scan({text: '<p><<NOME>></p> {{ TITULO }} [[INSTITUIÇÃO]] «DATA» <ALUNO>'});
    assert.equal(control.status, 200);
    assert.deepEqual(control.body.tags, ['<<NOME>>', '<<TITULO>>', '<<INSTITUIÇÃO>>', '<<DATA>>', '<<ALUNO>>']);
    const comment = await scan({name: '<!-- <<OCULTO>> <!--> <<VISIVEL>>'});
    assert.deepEqual(comment.body.tags, ['<<VISIVEL>>']);
    const scanFolder = async (folderUrl: string, email = 'master@portal.local') => fetch(base + '/api/scan-drive-folder', {method:'POST',headers:{'content-type':'application/json',...(email?{'x-demo-user-email':email}:{})},body:JSON.stringify({folderUrl}),signal:AbortSignal.timeout(6000)});
    const injectedFolder = "123456789012345' in parents or\n '123456789012345";
    assert.equal((await scanFolder(injectedFolder, '')).status, 401);
    assert.equal((await scanFolder(injectedFolder, 'student@example.invalid')).status, 403);
    assert.equal((await scanFolder(injectedFolder)).status, 400);
    assert.equal((await scanFolder('1AbC_def-1234567890')).status, 409);
    for (const character of ['<', '{', '[', '«']) {
      const result = await scan({name: character.repeat(250000)});
      assert.equal(result.status, 200);
      assert.deepEqual(result.body.tags, []);
    }
    assert.equal((await fetch(base + '/api/health', {signal: AbortSignal.timeout(2000)})).status, 200);
    assert.equal((await fetch(base + '/api/health', {method:'HEAD'})).status, 200);
    const healthWithBody = await new Promise<number>((resolve,reject)=>{
      const request=httpRequest(base+'/api/health',{method:'GET',headers:{'content-type':'application/json','content-length':'1'}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode||0));});
      request.on('error',reject);request.end('{');
    });
    assert.equal(healthWithBody,200,'health answers before the body parser');
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise(resolve => child.once('exit', resolve));
    }
    await rm(directory, {recursive: true, force: true});
  }
});
