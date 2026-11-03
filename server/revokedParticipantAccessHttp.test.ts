import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES, INITIAL_SETTINGS} from '../src/services/demoSeed';

const secret = 'revocation-http-test-secret-0123456789abcdef';
const master = 'master@revocation.invalid';
const advisor = 'advisor@revocation.invalid';
const student = 'student@revocation.invalid';
const president = 'president@revocation.invalid';
function session(email: string) {
  const now = Math.floor(Date.now() / 1000);
  const data = Buffer.from(JSON.stringify({sessionId: `session_${email.replace(/[^a-z]/g, '')}_1234567890`, uid: `email:${email}`, email, emailVerified: true, authTime: now, issuedAt: now, expiresAt: now + 3600, isDemo: false, method: 'EMAIL_OTP'})).toString('base64url');
  return `portal_tcc_session=${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`;
}

test('revoking or deleting access takes effect on an existing advisor session without deleting historical membership', {timeout: 45000}, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'portal-revocation-'));
  const p = structuredClone(DEMO_PROCESSES[0]);
  p.id = 'revocation-process';
  p.orientador.email = advisor;
  p.avaliacao.status = 'CONCLUIDO';
  p.acervo = undefined;
  p.status = 'AGUARDANDO_DADOS_FINAIS';
  const now = new Date().toISOString();
  await writeFile(path.join(dir, 'portal-state.json'), JSON.stringify({
    settings: {...INITIAL_SETTINGS, masterEmail: master, ownerEmail: master, commissionPresidentEmail: president}, processes: [p], signatureJobs: [],
    memberships: [
      {id: 'advisor-membership', processId: p.id, email: advisor, roles: ['ADVISOR'], active: true, createdAt: now, updatedAt: now},
      {id: 'student-membership', processId: p.id, email: student, roles: ['STUDENT'], active: true, createdAt: now, updatedAt: now}
    ],
    authorizedStudents: [
      {id: 'advisor-access', nome: 'Orientador de teste', email: advisor, roles: ['ADVISOR'], accessType: 'ADVISOR', active: true, processIds: [p.id], origin: 'MASTER_LIST', createdAt: now, updatedAt: now},
      {id: 'student-access', nome: 'Autor de teste', email: student, roles: ['STUDENT'], accessType: 'STUDENT', active: true, processIds: [p.id], origin: 'MASTER_LIST', createdAt: now, updatedAt: now}
    ],
    emailDeliveries: [
      {id: 'private-notice', processId: p.id, recipient: advisor, subject: 'Process-specific failure', status: 'FAILED', updatedAt: now},
      {id: 'global-notice', recipient: master, subject: 'Administrative failure', status: 'FAILED', updatedAt: now}
    ]
  }));
  const port = 47500 + Math.floor(Math.random() * 400), base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {cwd: process.cwd(), env: {...process.env, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: String(port), PORTAL_DATA_DIR: dir, PORTAL_PERSISTENCE_PROVIDER: 'local_file', PORTAL_ALLOW_INSECURE_DEMO_AUTH: 'false', PORTAL_TEST_DOCUMENT_RENDERER: 'true', PORTAL_ALLOW_LOCAL_SECRET_STORE: 'true', PORTAL_SESSION_SECRET: secret, ASTEN_INTEGRATION_ENABLED: 'false', SUPABASE_URL: '', SUPABASE_SECRET_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '', VERCEL: ''}, stdio: 'ignore'});
  const advisorCookie = session(advisor), masterCookie = session(master);
  const request = (route: string, cookie: string, method = 'GET', body?: unknown) => fetch(base + route, {method, headers: {'Content-Type': 'application/json', cookie}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
  const reopen = () => request(`/api/processes/${p.id}/reopen`, advisorCookie, 'POST', {reason: 'Correção do parecer da defesa.'});
  try {
    const deadline = Date.now() + 20000;
    while (true) {
      try { if ((await fetch(base + '/api/health')).ok) break; } catch {}
      if (Date.now() > deadline || child.exitCode !== null) throw Error('Fixture server did not start');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const notices = await (await request('/api/notifications', advisorCookie)).json();
    assert.ok(notices.some((item: any) => item.id === 'email-private-notice'));
    assert.ok(!notices.some((item: any) => item.id === 'email-global-notice'));
    for (const email of [student, president]) {
      assert.equal((await request(`/api/processes/${p.id}/reopen`, session(email), 'POST', {reason: 'Tentativa de reabrir a avaliação.'})).status, 403, 'process access does not grant the advisor role');
    }
    assert.equal((await reopen()).status, 200, 'active advisor can reopen');
    for (const action of ['deactivate', 'delete'] as const) {
      const before = await (await request(`/api/processes/${p.id}`, masterCookie)).json();
      const update = await request('/api/admin/access-list/advisor-access', masterCookie, action === 'deactivate' ? 'PATCH' : 'DELETE', action === 'deactivate' ? {active: false} : undefined);
      assert.equal(update.status, 200, await update.clone().text());
      const denied = await reopen();
      assert.equal(denied.status, 404, `${action}: historical role must not grant access`);
      assert.deepEqual(await (await request('/api/notifications', advisorCookie)).json(), []);
      assert.equal((await request(`/api/processes/${p.id}/documents`, advisorCookie)).status, 404);
      assert.deepEqual(await (await request(`/api/processes/${p.id}`, masterCookie)).json(), before, 'denied mutation does not change process');
      if (action === 'deactivate') {
        assert.equal((await request('/api/admin/access-list/advisor-access', masterCookie, 'PATCH', {active: true})).status, 200);
        assert.equal((await reopen()).status, 200, 'reactivation restores the same session');
      }
    }
    assert.equal((await request(`/api/processes/${p.id}/reopen`, masterCookie, 'POST', {reason: 'Correção administrativa do parecer.'})).status, 200);
    assert.deepEqual(await (await request('/api/notifications', session('unrelated@revocation.invalid'))).json(), []);
    const adminNotices = await (await request('/api/notifications', masterCookie)).json();
    assert.ok(adminNotices.some((item: any) => item.id === 'email-global-notice'));
  } finally {
    if (child.exitCode === null) { const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await stopped; }
    await rm(dir, {recursive: true, force: true});
  }
});
